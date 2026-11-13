"""Signed session tokens for members (docs/security-member-auth.md).

An access token is a JWT (HS256) that lives one hour. It says WHO (the account id and the session
it belongs to) and nothing else: no role, no admin flag. Whether somebody is an admin or in the
team is read from the database on every request, so a demoted admin loses the right at once and a
token can never carry a right the database does not give.

A refresh token is a random string. The server keeps only its SHA-256. Using it hands out a new
pair and the old refresh token stops working; presenting an old one again means a copy was stolen
and the whole session is revoked.
"""

from __future__ import annotations

import hashlib
import hmac
import logging
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

import jwt
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.models import UserAccount
from app.models.member_session import MemberSession

logger = logging.getLogger(__name__)

ALGORITHM = "HS256"
ISSUER = "prabhat-api"
AUDIENCE = "prabhat-member"
TOKEN_TYPE = "access"
MIN_SECRET_LENGTH = 32
LEEWAY_SECONDS = 5
MAX_DEVICE_LABEL = 120


class TokenError(Exception):
    """The token cannot be used. `reason` is for logs and tests, never shown to the caller."""

    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


@dataclass(frozen=True, slots=True)
class AccessClaims:
    account_id: UUID
    subject: str
    provider: str
    session_id: UUID
    expires_at: datetime


@dataclass(frozen=True, slots=True)
class TokenPair:
    access_token: str
    refresh_token: str
    expires_in: int
    session_id: UUID


def _usable(secret: str | None) -> str | None:
    value = (secret or "").strip()
    return value if len(value) >= MIN_SECRET_LENGTH else None


def session_tokens_enabled(settings: Settings | None = None) -> bool:
    return _usable((settings or get_settings()).member_session_secret) is not None


def _kid(secret: str) -> str:
    return hashlib.sha256(b"kid:" + secret.encode("utf-8")).hexdigest()[:8]


def _signing_keys(settings: Settings) -> dict[str, str]:
    keys: dict[str, str] = {}
    for secret in (settings.member_session_secret, settings.member_session_secret_previous):
        usable = _usable(secret)
        if usable:
            keys.setdefault(_kid(usable), usable)
    return keys


def issue_access_token(
    *,
    account: UserAccount,
    session_id: UUID,
    settings: Settings | None = None,
    now: datetime | None = None,
) -> tuple[str, int]:
    settings = settings or get_settings()
    secret = _usable(settings.member_session_secret)
    if secret is None:
        raise TokenError("signing secret is not configured")
    issued = now or datetime.now(UTC)
    ttl = settings.member_access_ttl_seconds
    claims: dict[str, Any] = {
        "iss": ISSUER,
        "aud": AUDIENCE,
        "typ": TOKEN_TYPE,
        "sub": str(account.id),
        "subj": account.external_subject,
        "prov": account.identity_provider,
        "sid": str(session_id),
        "jti": secrets.token_hex(8),
        "iat": int(issued.timestamp()),
        "exp": int((issued + timedelta(seconds=ttl)).timestamp()),
    }
    token = jwt.encode(claims, secret, algorithm=ALGORITHM, headers={"kid": _kid(secret)})
    return token, ttl


def verify_access_token(
    token: str, settings: Settings | None = None, *, now: datetime | None = None
) -> AccessClaims:
    """Check signature, expiry, issuer, audience and shape. Does not look at the database."""
    settings = settings or get_settings()
    keys = _signing_keys(settings)
    if not keys:
        raise TokenError("signing secret is not configured")
    try:
        header = jwt.get_unverified_header(token)
    except jwt.PyJWTError as exc:
        raise TokenError("not a token") from exc
    # Only HS256 is ever accepted: "none" or an asymmetric algorithm in the header is refused
    # outright.
    if header.get("alg") != ALGORITHM:
        raise TokenError("unexpected algorithm")
    kid = header.get("kid")
    candidates = [keys[kid]] if kid in keys else list(keys.values())
    options: Any = {"require": ["exp", "iat", "sub", "sid", "typ", "iss", "aud"]}
    payload: dict[str, Any] | None = None
    last: Exception | None = None
    for secret in candidates:
        try:
            payload = jwt.decode(
                token,
                secret,
                algorithms=[ALGORITHM],
                audience=AUDIENCE,
                issuer=ISSUER,
                options=options,
                leeway=LEEWAY_SECONDS,
            )
            break
        except jwt.ExpiredSignatureError as exc:
            raise TokenError("expired") from exc
        except jwt.PyJWTError as exc:
            last = exc
    if payload is None:
        raise TokenError(f"invalid: {type(last).__name__}")
    if payload.get("typ") != TOKEN_TYPE:
        raise TokenError("wrong token type")
    reference = now or datetime.now(UTC)
    exp = datetime.fromtimestamp(int(payload["exp"]), UTC)
    if exp + timedelta(seconds=LEEWAY_SECONDS) < reference:
        raise TokenError("expired")
    try:
        account_id = UUID(str(payload["sub"]))
        session_id = UUID(str(payload["sid"]))
    except ValueError as exc:
        raise TokenError("bad identifiers") from exc
    return AccessClaims(
        account_id=account_id,
        subject=str(payload.get("subj") or ""),
        provider=str(payload.get("prov") or ""),
        session_id=session_id,
        expires_at=exp,
    )


# ------------------------------------------------------------------ refresh tokens and sessions


def _hash_refresh(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _new_refresh(session_id: UUID) -> str:
    return f"{session_id.hex}.{secrets.token_urlsafe(32)}"


def _split_refresh(token: str) -> UUID:
    head, _, tail = (token or "").partition(".")
    if len(head) != 32 or not tail or len(token) > 200:
        raise TokenError("malformed refresh token")
    try:
        return UUID(hex=head)
    except ValueError as exc:
        raise TokenError("malformed refresh token") from exc


def _aware(moment: datetime) -> datetime:
    return moment if moment.tzinfo else moment.replace(tzinfo=UTC)


async def start_session(
    db: AsyncSession,
    account: UserAccount,
    *,
    device_label: str | None = None,
    provider: str | None = None,
    settings: Settings | None = None,
    now: datetime | None = None,
) -> TokenPair:
    """A new sign-in on a device: stores the session and returns the first token pair."""
    settings = settings or get_settings()
    moment = now or datetime.now(UTC)
    row = MemberSession(
        user_id=account.id,
        refresh_hash="",
        device_label=(device_label or "").strip()[:MAX_DEVICE_LABEL] or None,
        sign_in_provider=(provider or account.identity_provider or "")[:32] or None,
        last_used_at=moment,
        expires_at=moment + timedelta(days=settings.member_refresh_ttl_days),
    )
    db.add(row)
    await db.flush()
    refresh = _new_refresh(row.id)
    row.refresh_hash = _hash_refresh(refresh)
    access, ttl = issue_access_token(
        account=account, session_id=row.id, settings=settings, now=moment
    )
    await db.commit()
    return TokenPair(access, refresh, ttl, row.id)


async def refresh_session(
    db: AsyncSession,
    refresh_token: str,
    *,
    settings: Settings | None = None,
    now: datetime | None = None,
) -> tuple[UserAccount, TokenPair]:
    """Rotate: a valid refresh token buys a new pair and is itself spent."""
    settings = settings or get_settings()
    moment = now or datetime.now(UTC)
    session_id = _split_refresh(refresh_token)
    row = await db.get(MemberSession, session_id)
    if row is None:
        raise TokenError("unknown session")
    if row.revoked_at is not None:
        raise TokenError("session revoked")
    presented = _hash_refresh(refresh_token)
    if row.previous_refresh_hash and hmac.compare_digest(presented, row.previous_refresh_hash):
        # An already used refresh token came back: someone holds a copy. End the session for both.
        row.revoked_at = moment
        row.revoked_reason = "refresh token reused"
        await db.commit()
        logger.warning("member session %s revoked: refresh token reuse", session_id)
        raise TokenError("refresh token reused")
    if not hmac.compare_digest(presented, row.refresh_hash):
        raise TokenError("refresh token does not match")
    if _aware(row.expires_at) <= moment:
        raise TokenError("session expired")
    account = await db.get(UserAccount, row.user_id)
    if account is None or account.deleted_at is not None:
        raise TokenError("account is gone")
    fresh = _new_refresh(row.id)
    row.previous_refresh_hash = row.refresh_hash
    row.refresh_hash = _hash_refresh(fresh)
    row.last_used_at = moment
    row.expires_at = moment + timedelta(days=settings.member_refresh_ttl_days)
    access, ttl = issue_access_token(
        account=account, session_id=row.id, settings=settings, now=moment
    )
    await db.commit()
    return account, TokenPair(access, fresh, ttl, row.id)


async def session_is_live(db: AsyncSession, claims: AccessClaims) -> bool:
    row = await db.get(MemberSession, claims.session_id)
    return row is not None and row.revoked_at is None and row.user_id == claims.account_id


async def revoke_session(
    db: AsyncSession, session_id: UUID, *, reason: str = "signed out", user_id: UUID | None = None
) -> bool:
    row = await db.get(MemberSession, session_id)
    if row is None or row.revoked_at is not None:
        return False
    if user_id is not None and row.user_id != user_id:
        return False
    row.revoked_at = datetime.now(UTC)
    row.revoked_reason = reason[:200]
    await db.commit()
    return True


async def revoke_all_sessions(
    db: AsyncSession, user_id: UUID, *, reason: str = "signed out everywhere", commit: bool = True
) -> int:
    """Every device of one member (password change, account deletion, 'sign out everywhere')."""
    live = list(
        (
            await db.scalars(
                select(MemberSession.id).where(
                    MemberSession.user_id == user_id, MemberSession.revoked_at.is_(None)
                )
            )
        ).all()
    )
    if live:
        await db.execute(
            update(MemberSession)
            .where(MemberSession.id.in_(live))
            .values(revoked_at=datetime.now(UTC), revoked_reason=reason[:200])
        )
        if commit:
            await db.commit()
    return len(live)
