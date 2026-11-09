"""One request limiter for the whole API (docs/rate-limits.md).

Before: every limiter lived in the memory of one API process, so a restart or a second instance
reset it. Now: the counters live in the database (`DatabaseRateStore`) behind a small interface
(`RateStore`), so Redis can be plugged in later by writing one class. If the database cannot be
reached the limiter falls back to process memory instead of blocking people.

Two ways to use it:

* `RateLimitMiddleware` applies the coarse, per-route policies (sign in, upload, comments,
  plays, takedown requests) before the route runs. Nothing in the routes has to change.
* `enforce_rate_limit(request, "policy", key_extra=...)` for a limit that needs more than the
  IP (for example "10 sign-in tries per e-mail address").

Keys are salted hashes of the address or the account: no raw IP address is stored.
"""

from __future__ import annotations

import hashlib
import logging
import re
import secrets
import time
from collections import defaultdict, deque
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any, Protocol

from fastapi import HTTPException, Request, Response
from sqlalchemy import delete, select
from sqlalchemy.dialects import postgresql, sqlite
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.types import ASGIApp

from app.config import Settings, get_settings
from app.models.rate_limit import RateLimitCounter

logger = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class RateLimitPolicy:
    name: str
    limit: int
    window_seconds: int


# One table for every limit the API applies. A number changes here, in one place.
POLICIES: dict[str, RateLimitPolicy] = {
    policy.name: policy
    for policy in (
        RateLimitPolicy("sign_in", 20, 600),  # per address: login, register, token exchange, reset
        RateLimitPolicy("sign_in_account", 8, 900),  # per e-mail address (guessing one password)
        RateLimitPolicy("token_refresh", 60, 600),
        RateLimitPolicy("upload", 40, 3600),  # per member (or address): upload targets and files
        RateLimitPolicy("comment", 30, 600),  # per member (or address)
        RateLimitPolicy("play", 240, 600),  # per address: play counting endpoints
        RateLimitPolicy("takedown", 5, 86_400),  # per address: copyright/takedown requests
        RateLimitPolicy("takedown_counter", 3, 86_400),
        RateLimitPolicy("default_write", 300, 600),  # every other write, a safety net
    )
}


@dataclass(frozen=True, slots=True)
class RateDecision:
    allowed: bool
    count: float
    retry_after: int


class RateStore(Protocol):
    async def hit(self, key: str, *, limit: int, window_seconds: int) -> RateDecision: ...


class MemoryRateStore:
    """Sliding log in process memory: the fallback, and the store of the quick tests."""

    def __init__(self) -> None:
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    async def hit(self, key: str, *, limit: int, window_seconds: int) -> RateDecision:
        now = time.monotonic()
        hits = self._hits[key]
        while hits and hits[0] <= now - window_seconds:
            hits.popleft()
        if len(hits) >= limit:
            return RateDecision(
                False, float(len(hits)), max(1, int(hits[0] + window_seconds - now))
            )
        hits.append(now)
        return RateDecision(True, float(len(hits)), 0)

    def reset(self) -> None:
        self._hits.clear()


class DatabaseRateStore:
    """Sliding-window counter in the `rate_limit_counters` table (PostgreSQL, SQLite in tests).

    Two fixed windows are kept, the current and the one before; the estimate is
    `current + previous * (share of the previous window that still overlaps)`.
    """

    CLEANUP_EVERY = 200

    def __init__(self, session_factory: Callable[[], AsyncSession]) -> None:
        self._sessions = session_factory
        self._calls = 0

    async def hit(self, key: str, *, limit: int, window_seconds: int) -> RateDecision:
        now = time.time()
        window_start = int(now // window_seconds) * window_seconds
        async with self._sessions() as session:
            bind = session.get_bind()
            dialect = bind.dialect.name
            insert: Any = postgresql.insert if dialect == "postgresql" else sqlite.insert
            statement = insert(RateLimitCounter).values(
                key=key,
                window_start=window_start,
                hits=1,
                expires_at=window_start + 2 * window_seconds + 60,
            )
            statement = statement.on_conflict_do_update(
                index_elements=[RateLimitCounter.key, RateLimitCounter.window_start],
                set_={"hits": RateLimitCounter.hits + 1},
            ).returning(RateLimitCounter.hits)
            current = int((await session.execute(statement)).scalar_one())
            previous = await session.scalar(
                select(RateLimitCounter.hits).where(
                    RateLimitCounter.key == key,
                    RateLimitCounter.window_start == window_start - window_seconds,
                )
            )
            self._calls += 1
            if self._calls % self.CLEANUP_EVERY == 0:
                await session.execute(
                    delete(RateLimitCounter).where(RateLimitCounter.expires_at < int(now))
                )
            await session.commit()
        elapsed = (now - window_start) / window_seconds
        estimate = current + float(previous or 0) * (1.0 - elapsed)
        if estimate > limit:
            return RateDecision(False, estimate, max(1, int(window_seconds * (1.0 - elapsed)) + 1))
        return RateDecision(True, estimate, 0)


class Limiter:
    """The store in use, with a memory fallback when the primary store fails."""

    def __init__(self) -> None:
        self.primary: RateStore | None = None
        self.fallback = MemoryRateStore()

    def configure(self, store: RateStore | None) -> None:
        self.primary = store

    async def hit(self, key: str, *, limit: int, window_seconds: int) -> RateDecision:
        if self.primary is not None:
            try:
                return await self.primary.hit(key, limit=limit, window_seconds=window_seconds)
            except Exception:
                logger.exception("rate limit store failed; using process memory for this call")
        return await self.fallback.hit(key, limit=limit, window_seconds=window_seconds)


limiter = Limiter()


def default_store() -> RateStore | None:
    """The database store, unless RATE_LIMIT_BACKEND=memory."""
    if get_settings().rate_limit_backend == "memory":
        return None
    from app.core.db import SessionLocal

    return DatabaseRateStore(SessionLocal)


# ------------------------------------------------------------------ keys (no raw addresses)

_pepper_fallback = secrets.token_hex(16)


def _pepper(settings: Settings) -> str:
    return settings.rate_limit_pepper or settings.member_session_secret or _pepper_fallback


def pepper(settings: Settings) -> str:
    """The secret that salts every key made here (also used to hash take-down senders)."""
    return _pepper(settings)


def hashed(value: str, settings: Settings | None = None) -> str:
    settings = settings or get_settings()
    digest = hashlib.sha256(f"{_pepper(settings)}|{value}".encode()).hexdigest()
    return digest[:24]


def client_ip(request: Request, settings: Settings | None = None) -> str:
    """The caller's address. Behind the Azure ingress it is the `hops`-th from the right."""
    settings = settings or get_settings()
    hops = settings.rate_limit_trusted_proxy_hops
    forwarded = request.headers.get("x-forwarded-for") or ""
    parts = [part.strip() for part in forwarded.split(",") if part.strip()]
    if hops > 0 and len(parts) >= hops:
        return parts[-hops]
    return request.client.host if request.client else "unknown"


def bearer_account(request: Request, settings: Settings | None = None) -> str | None:
    """The account id in a valid access token, without touching the database."""
    value = request.headers.get("authorization") or ""
    scheme, _, token = value.partition(" ")
    if scheme.casefold() != "bearer" or not token.strip():
        return None
    from app.services.member_tokens import TokenError, verify_access_token

    try:
        return str(verify_access_token(token.strip(), settings).account_id)
    except TokenError:
        return None


def _too_many(retry_after: int) -> HTTPException:
    return HTTPException(
        status_code=429,
        detail="Please wait a little before trying again.",
        headers={"Retry-After": str(retry_after), "X-Error-Code": "rate_limited"},
    )


async def check_policy(
    policy_name: str, subject: str, *, store: Limiter | None = None
) -> RateDecision:
    policy = POLICIES[policy_name]
    return await (store or limiter).hit(
        f"{policy.name}:{subject}", limit=policy.limit, window_seconds=policy.window_seconds
    )


async def enforce_rate_limit(
    request: Request,
    policy_name: str,
    *,
    session: AsyncSession | None = None,  # kept so call sites read the same as the other helpers
    key_extra: str | None = None,
    ip: bool = True,
) -> None:
    """Raises 429 when this caller (and `key_extra`, hashed, if given) used up the policy.

    `ip=False` skips the per-address count, for a route the middleware already counts by address.
    """
    settings = get_settings()
    if not settings.rate_limit_enabled:
        return
    if ip:
        subject = f"ip:{hashed(client_ip(request, settings), settings)}"
        decision = await check_policy(policy_name, subject)
        if not decision.allowed:
            raise _too_many(decision.retry_after)
    if key_extra:
        account_policy = f"{policy_name}_account"
        decision = await check_policy(
            account_policy if account_policy in POLICIES else policy_name,
            f"k:{hashed(key_extra.strip().casefold(), settings)}",
        )
        if not decision.allowed:
            raise _too_many(decision.retry_after)


# ------------------------------------------------------------------ route table and middleware

# (method, path regex, policy, key by account when a signed token is present)
ROUTES: list[tuple[str, re.Pattern[str], str, bool]] = [
    (
        "POST",
        re.compile(r"^/api/v1/auth/(login|register|forgot-password|reset-password)$"),
        "sign_in",
        False,
    ),
    ("POST", re.compile(r"^/api/v1/recordings/uploads(/discard)?$"), "upload", True),
    ("PUT", re.compile(r"^/api/v1/recordings/uploads/[^/]+$"), "upload", True),
    ("POST", re.compile(r"^/api/v1/recordings$"), "upload", True),
    (
        "POST",
        re.compile(r"^/api/v1/(song-comments|recording-comments)/(songs|recordings)/[^/]+$"),
        "comment",
        True,
    ),
    ("POST", re.compile(r"^/api/v1/recordings/[^/]+/play$"), "play", False),
    ("POST", re.compile(r"^/api/v1/plays$"), "play", False),
    ("POST", re.compile(r"^/api/v1/takedown$"), "takedown", False),
    ("POST", re.compile(r"^/api/v1/takedown/[^/]+/counter-notice$"), "takedown_counter", True),
]


WRITE_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})


def policy_for(method: str, path: str) -> tuple[str, bool] | None:
    """The policy for a request, or None. A write nobody listed gets the `default_write` net."""
    for route_method, pattern, policy, by_account in ROUTES:
        if route_method == method and pattern.match(path):
            return policy, by_account
    # The admin tools use the admin key and are not a way to flood the service.
    if (
        method in WRITE_METHODS
        and path.startswith("/api/v1/")
        and not path.startswith("/api/v1/admin")
    ):
        return "default_write", True
    return None


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        settings = get_settings()
        match = (
            policy_for(request.method, request.url.path) if settings.rate_limit_enabled else None
        )
        if match is not None:
            policy_name, by_account = match
            account = bearer_account(request, settings) if by_account else None
            subject = (
                f"acct:{hashed(account, settings)}"
                if account
                else f"ip:{hashed(client_ip(request, settings), settings)}"
            )
            decision = await check_policy(policy_name, subject)
            if not decision.allowed:
                return Response(
                    content='{"detail":"Please wait a little before trying again."}',
                    status_code=429,
                    media_type="application/json",
                    headers={
                        "Retry-After": str(decision.retry_after),
                        "X-Error-Code": "rate_limited",
                    },
                )
        return await call_next(request)
