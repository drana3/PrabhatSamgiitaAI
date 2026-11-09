"""The request limiter: stores, keys, the route table, the middleware (docs/rate-limits.md)."""

import os
import time
from collections.abc import AsyncIterator
from typing import Any, cast

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://test:test@localhost/test")
os.environ.setdefault("APP_ENV", "test")

import httpx
import pytest
import pytest_asyncio
from fastapi import FastAPI, HTTPException, Request
from sqlalchemy import Table, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.config import Settings
from app.models import Base
from app.models.rate_limit import RateLimitCounter
from app.services import rate_limit as rl
from app.services.rate_limit import (
    DatabaseRateStore,
    Limiter,
    MemoryRateStore,
    RateDecision,
    RateLimitMiddleware,
    RateLimitPolicy,
)


def settings(**over: Any) -> Settings:
    values: dict[str, Any] = {
        "_env_file": None,
        "RATE_LIMIT_PEPPER": "pepper-for-the-tests-0123456789",
        "MEMBER_SESSION_SECRET": "unit-test-session-secret-0123456789abcdef",
    }
    values.update(over)
    return Settings.model_validate(values)


@pytest.fixture(autouse=True)
def fresh_limiter(monkeypatch: pytest.MonkeyPatch) -> Limiter:
    """Every test gets a limiter of its own, and the settings above."""
    limiter = Limiter()
    monkeypatch.setattr(rl, "limiter", limiter)
    monkeypatch.setattr(rl, "get_settings", lambda: settings())
    return limiter


@pytest_asyncio.fixture(name="db_store")
async def db_store_fixture() -> AsyncIterator[
    tuple[DatabaseRateStore, async_sessionmaker[AsyncSession]]
]:
    engine = create_async_engine(
        "sqlite+aiosqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False}
    )
    async with engine.begin() as conn:
        await conn.run_sync(
            lambda c: Base.metadata.create_all(c, tables=[cast(Table, RateLimitCounter.__table__)])
        )
    sessions = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    yield DatabaseRateStore(sessions), sessions
    await engine.dispose()


# --------------------------------------------------------------------------- the stores


async def test_memory_store_allows_up_to_the_limit_then_blocks() -> None:
    store = MemoryRateStore()
    for _ in range(3):
        assert (await store.hit("k", limit=3, window_seconds=60)).allowed
    blocked = await store.hit("k", limit=3, window_seconds=60)
    assert not blocked.allowed
    assert 1 <= blocked.retry_after <= 60
    # another key is not affected
    assert (await store.hit("other", limit=3, window_seconds=60)).allowed


async def test_database_store_allows_up_to_the_limit_then_blocks(
    db_store: tuple[DatabaseRateStore, async_sessionmaker[AsyncSession]],
) -> None:
    store, _ = db_store
    for _ in range(3):
        assert (await store.hit("k", limit=3, window_seconds=3600)).allowed
    blocked = await store.hit("k", limit=3, window_seconds=3600)
    assert not blocked.allowed
    assert blocked.retry_after >= 1
    assert (await store.hit("other", limit=3, window_seconds=3600)).allowed


async def test_database_store_keeps_counters_across_instances(
    db_store: tuple[DatabaseRateStore, async_sessionmaker[AsyncSession]],
) -> None:
    """A restart or a second API process sees the same counts: that is the point of the table."""
    first, sessions = db_store
    for _ in range(2):
        await first.hit("shared", limit=2, window_seconds=3600)
    second = DatabaseRateStore(sessions)
    assert not (await second.hit("shared", limit=2, window_seconds=3600)).allowed


async def test_database_store_counts_the_previous_window_partly(
    db_store: tuple[DatabaseRateStore, async_sessionmaker[AsyncSession]],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    store, _ = db_store
    clock = {"now": 10_000.0}
    monkeypatch.setattr(time, "time", lambda: clock["now"])
    window = 100
    # 10 hits late in one window ...
    clock["now"] = 10_000.0 + 95
    for _ in range(10):
        assert (await store.hit("k", limit=10, window_seconds=window)).allowed
    # ... just after the next one starts, they still count (a burst across the border is not free)
    clock["now"] = 10_100.0 + 1
    assert not (await store.hit("k", limit=10, window_seconds=window)).allowed
    # a window later, they are forgotten
    clock["now"] = 10_300.0
    assert (await store.hit("k", limit=10, window_seconds=window)).allowed


async def test_database_store_cleans_up_old_rows(
    db_store: tuple[DatabaseRateStore, async_sessionmaker[AsyncSession]],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    store, sessions = db_store
    clock = {"now": 5_000.0}
    monkeypatch.setattr(time, "time", lambda: clock["now"])
    await store.hit("old", limit=5, window_seconds=60)
    clock["now"] = 9_000.0
    for _ in range(DatabaseRateStore.CLEANUP_EVERY):
        await store.hit("new", limit=10**6, window_seconds=60)
    async with sessions() as session:
        keys = set((await session.scalars(select(RateLimitCounter.key))).all())
    assert "old" not in keys and "new" in keys


async def test_the_limiter_falls_back_to_memory_when_the_store_fails(
    fresh_limiter: Limiter, caplog: pytest.LogCaptureFixture
) -> None:
    class Broken:
        async def hit(self, key: str, *, limit: int, window_seconds: int) -> RateDecision:
            raise RuntimeError("database is down")

    fresh_limiter.configure(Broken())
    assert (await fresh_limiter.hit("k", limit=1, window_seconds=60)).allowed
    # still limits, from memory, and nobody gets an error
    assert not (await fresh_limiter.hit("k", limit=1, window_seconds=60)).allowed
    assert "rate limit store failed" in caplog.text


async def test_the_default_store_can_be_turned_to_memory(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(rl, "get_settings", lambda: settings(RATE_LIMIT_BACKEND="memory"))
    assert rl.default_store() is None


# --------------------------------------------------------------------------- keys


def test_keys_are_salted_hashes_not_addresses() -> None:
    key = rl.hashed("203.0.113.9")
    assert "203" not in key and len(key) == 24
    assert key == rl.hashed("203.0.113.9")
    other = settings(RATE_LIMIT_PEPPER="a-different-pepper-0123456789")
    assert rl.hashed("203.0.113.9", other) != key


async def test_the_stored_key_holds_no_raw_address(
    db_store: tuple[DatabaseRateStore, async_sessionmaker[AsyncSession]],
) -> None:
    store, sessions = db_store
    limiter = Limiter()
    limiter.configure(store)
    await rl.check_policy("play", f"ip:{rl.hashed('198.51.100.7')}", store=limiter)
    async with sessions() as session:
        keys = list((await session.scalars(select(RateLimitCounter.key))).all())
    assert keys and all("198.51" not in k for k in keys)


def request_with(headers: dict[str, str], host: str = "10.0.0.1") -> Request:
    scope = {
        "type": "http",
        "headers": [(k.lower().encode(), v.encode()) for k, v in headers.items()],
        "client": (host, 1234),
    }
    return Request(scope)


def test_client_ip_trusts_only_the_proxy_hop() -> None:
    # The ingress appends the real address; anything the caller wrote sits to the left.
    forged = request_with({"X-Forwarded-For": "6.6.6.6, 203.0.113.9"})
    assert rl.client_ip(forged, settings()) == "203.0.113.9"
    assert rl.client_ip(request_with({}), settings()) == "10.0.0.1"
    direct = request_with({"X-Forwarded-For": "6.6.6.6"}, host="192.0.2.5")
    assert rl.client_ip(direct, settings(RATE_LIMIT_TRUSTED_PROXY_HOPS=0)) == "192.0.2.5"


def test_the_account_comes_only_from_a_valid_signed_token() -> None:
    from uuid import uuid4

    from app.models import UserAccount
    from app.services import member_tokens

    account = UserAccount(
        id=uuid4(), external_subject="x", identity_provider="test", display_name="A"
    )
    token, _ = member_tokens.issue_access_token(
        account=account, session_id=uuid4(), settings=settings()
    )
    good = request_with({"Authorization": f"Bearer {token}"})
    assert rl.bearer_account(good, settings()) == str(account.id)
    assert (
        rl.bearer_account(request_with({"Authorization": f"Bearer {token}x"}), settings()) is None
    )
    assert rl.bearer_account(request_with({"Authorization": "Bearer nonsense"}), settings()) is None
    assert rl.bearer_account(request_with({}), settings()) is None


# --------------------------------------------------------------------------- the route table


@pytest.mark.parametrize(
    ("method", "path", "policy", "by_account"),
    [
        ("POST", "/api/v1/auth/login", "sign_in", False),
        ("POST", "/api/v1/auth/register", "sign_in", False),
        ("POST", "/api/v1/auth/forgot-password", "sign_in", False),
        ("POST", "/api/v1/auth/reset-password", "sign_in", False),
        ("POST", "/api/v1/recordings/uploads", "upload", True),
        ("POST", "/api/v1/recordings/uploads/discard", "upload", True),
        ("PUT", "/api/v1/recordings/uploads/abc123", "upload", True),
        ("POST", "/api/v1/recordings", "upload", True),
        ("POST", "/api/v1/song-comments/songs/42", "comment", True),
        ("POST", "/api/v1/recording-comments/recordings/7", "comment", True),
        ("POST", "/api/v1/recordings/0b1c/play", "play", False),
        ("POST", "/api/v1/plays", "play", False),
        ("POST", "/api/v1/takedown", "takedown", False),
        ("POST", "/api/v1/takedown/TD-ABC234/counter-notice", "takedown_counter", True),
        # anything else that writes gets the net
        ("POST", "/api/v1/recordings/0b1c/report", "default_write", True),
        ("PATCH", "/api/v1/authors/me", "default_write", True),
        ("DELETE", "/api/v1/members/me", "default_write", True),
    ],
)
def test_each_real_route_has_its_policy(
    method: str, path: str, policy: str, by_account: bool
) -> None:
    assert rl.policy_for(method, path) == (policy, by_account)


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("GET", "/api/v1/recordings"),
        ("GET", "/api/v1/plays"),
        ("POST", "/api/v1/admin/takedowns/1/take-down"),
        ("POST", "/health"),
        ("OPTIONS", "/api/v1/plays"),
    ],
)
def test_reads_admin_and_the_rest_are_not_limited(method: str, path: str) -> None:
    assert rl.policy_for(method, path) is None


def test_every_route_policy_exists() -> None:
    for _, _, policy, _ in rl.ROUTES:
        assert policy in rl.POLICIES
    assert "default_write" in rl.POLICIES


def test_the_table_matches_the_real_app_routes() -> None:
    """If a route is renamed, the limit must not silently stop applying to it."""
    from app.main import app

    paths = {
        (method.upper(), path) for path, ops in app.openapi()["paths"].items() for method in ops
    }
    for sample in (
        ("POST", "/api/v1/auth/login"),
        ("POST", "/api/v1/recordings"),
        ("POST", "/api/v1/recordings/uploads"),
        ("POST", "/api/v1/plays"),
        ("POST", "/api/v1/takedown"),
    ):
        assert sample in paths, sample
    prefixes = ("/api/v1/song-comments/songs/", "/api/v1/recording-comments/recordings/")
    assert all(any(p.startswith(prefix) and m == "POST" for m, p in paths) for prefix in prefixes)
    assert ("POST", "/api/v1/recordings/{recording_id}/play") in paths


# --------------------------------------------------------------------------- the middleware


def limited_app() -> FastAPI:
    app = FastAPI()
    app.add_middleware(RateLimitMiddleware)

    @app.post("/api/v1/plays")
    async def plays() -> dict[str, bool]:
        return {"ok": True}

    @app.get("/api/v1/plays")
    async def read() -> dict[str, bool]:
        return {"ok": True}

    @app.post("/api/v1/auth/login")
    async def login(request: Request) -> dict[str, bool]:
        await rl.enforce_rate_limit(
            request, "sign_in", key_extra=request.headers["x-email"], ip=False
        )
        return {"ok": True}

    return app


async def hit(client: httpx.AsyncClient, path: str, ip: str, **headers: str) -> httpx.Response:
    return await client.post(path, headers={"X-Forwarded-For": ip, **headers})


async def test_the_middleware_blocks_the_fourth_play_from_one_address(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setitem(rl.POLICIES, "play", RateLimitPolicy("play", 3, 600))
    transport = httpx.ASGITransport(app=limited_app())
    async with httpx.AsyncClient(transport=transport, base_url="http://t") as client:
        for _ in range(3):
            assert (await hit(client, "/api/v1/plays", "203.0.113.1")).status_code == 200
        blocked = await hit(client, "/api/v1/plays", "203.0.113.1")
        assert blocked.status_code == 429
        assert int(blocked.headers["Retry-After"]) >= 1
        assert blocked.headers["X-Error-Code"] == "rate_limited"
        # another address, and reads, are not touched
        assert (await hit(client, "/api/v1/plays", "203.0.113.2")).status_code == 200
        assert (await client.get("/api/v1/plays")).status_code == 200


async def test_a_forged_forwarded_header_does_not_buy_a_new_allowance(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setitem(rl.POLICIES, "play", RateLimitPolicy("play", 2, 600))
    transport = httpx.ASGITransport(app=limited_app())
    async with httpx.AsyncClient(transport=transport, base_url="http://t") as client:
        for index in range(2):
            await hit(client, "/api/v1/plays", f"1.1.1.{index}, 203.0.113.1")
        blocked = await hit(client, "/api/v1/plays", "9.9.9.9, 203.0.113.1")
        assert blocked.status_code == 429


async def test_the_limits_can_be_turned_off(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setitem(rl.POLICIES, "play", RateLimitPolicy("play", 1, 600))
    monkeypatch.setattr(rl, "get_settings", lambda: settings(RATE_LIMIT_ENABLED="false"))
    transport = httpx.ASGITransport(app=limited_app())
    async with httpx.AsyncClient(transport=transport, base_url="http://t") as client:
        for _ in range(4):
            assert (await hit(client, "/api/v1/plays", "203.0.113.1")).status_code == 200


async def test_sign_in_is_limited_per_email_from_many_addresses(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setitem(rl.POLICIES, "sign_in_account", RateLimitPolicy("sign_in_account", 3, 900))
    monkeypatch.setitem(rl.POLICIES, "sign_in", RateLimitPolicy("sign_in", 100, 600))

    def failing(request: Request) -> None:
        raise HTTPException(status_code=401, detail="no")

    transport = httpx.ASGITransport(app=limited_app())
    async with httpx.AsyncClient(transport=transport, base_url="http://t") as client:
        for index in range(3):
            r = await hit(
                client, "/api/v1/auth/login", f"203.0.113.{index}", **{"x-email": "a@x.org"}
            )
            assert r.status_code == 200
        # a fourth try for the same e-mail from a new address is stopped
        blocked = await hit(client, "/api/v1/auth/login", "203.0.113.50", **{"x-email": "A@x.org "})
        assert blocked.status_code == 429
        # another e-mail is free
        other = await hit(client, "/api/v1/auth/login", "203.0.113.50", **{"x-email": "b@x.org"})
        assert other.status_code == 200


async def test_an_account_has_its_own_allowance_behind_one_address(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Many members on one mobile network address do not use up each other's uploads."""
    from uuid import uuid4

    from app.models import UserAccount
    from app.services import member_tokens

    monkeypatch.setitem(rl.POLICIES, "default_write", RateLimitPolicy("default_write", 2, 600))
    app = FastAPI()
    app.add_middleware(RateLimitMiddleware)

    @app.post("/api/v1/authors/me")
    async def write() -> dict[str, bool]:
        return {"ok": True}

    def bearer() -> dict[str, str]:
        account = UserAccount(
            id=uuid4(), external_subject="x", identity_provider="test", display_name="A"
        )
        token, _ = member_tokens.issue_access_token(
            account=account, session_id=uuid4(), settings=settings()
        )
        return {"Authorization": f"Bearer {token}", "X-Forwarded-For": "203.0.113.1"}

    first, second = bearer(), bearer()
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://t") as client:
        for _ in range(2):
            assert (await client.post("/api/v1/authors/me", headers=first)).status_code == 200
        assert (await client.post("/api/v1/authors/me", headers=first)).status_code == 429
        assert (await client.post("/api/v1/authors/me", headers=second)).status_code == 200
