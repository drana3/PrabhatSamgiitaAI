"""Revoke the Apple grant when a member who signed in with Apple deletes the account.

App Store rule 5.1.1(v): deleting the account must also end the "Sign in with Apple" link, so the
person no longer sees the app in Settings > Apple ID > Sign in with Apple. Apple's call is
`POST https://appleid.apple.com/auth/revoke` with `client_id`, `client_secret` and `token`.

* `client_id` is the first entry of APPLE_BUNDLE_IDS.
* `client_secret` is a short ES256 JWT that we sign with the Apple private key (APPLE_TEAM_ID,
  APPLE_KEY_ID, APPLE_PRIVATE_KEY; the key text may carry "\\n" escapes).
* `token` is a refresh token. Apple hands one out only in exchange for the one-time
  `authorizationCode` of the sign-in, so the phone has to send that code
  (docs/apple-token-revocation.md); `store_refresh_token` keeps the result until the account is
  deleted.

Nothing here may ever stop an account deletion: every public function that talks to Apple swallows
its failures and returns False/None, logging the kind of failure (never the key, the secret, a token
or Apple's answer). The network goes through `_post_form`, which the tests replace.
"""

from __future__ import annotations

import logging
import time
from typing import Any
from uuid import UUID

import httpx
import jwt
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.models.apple_token import AppleRefreshToken

logger = logging.getLogger(__name__)

APPLE_ISSUER = "https://appleid.apple.com"
APPLE_TOKEN_URL = "https://appleid.apple.com/auth/token"
APPLE_REVOKE_URL = "https://appleid.apple.com/auth/revoke"
SECRET_LIFETIME_SECONDS = 600  # Apple allows up to six months; a call needs seconds
HTTP_TIMEOUT_SECONDS = 6.0


def _client_id(settings: Settings) -> str:
    ids = [item.strip() for item in (settings.apple_bundle_ids or "").split(",") if item.strip()]
    return ids[0] if ids else ""


def _private_key_pem(raw: str | None) -> str:
    """The key as an environment value is often one line with literal backslash-n; make it real."""
    return (raw or "").strip().strip('"').strip("'").replace("\\n", "\n")


def apple_revocation_configured(settings: Settings | None = None) -> bool:
    """True when the team id, key id, key and client id are all present (no values are shown)."""
    settings = settings or get_settings()
    return bool(
        settings.apple_team_id.strip()
        and settings.apple_key_id.strip()
        and _private_key_pem(settings.apple_private_key)
        and _client_id(settings)
    )


def build_client_secret(settings: Settings | None = None, *, now: int | None = None) -> str:
    """The ES256 JWT Apple wants as `client_secret`. Raises if the key is missing or unreadable."""
    settings = settings or get_settings()
    issued = int(time.time()) if now is None else now
    payload = {
        "iss": settings.apple_team_id.strip(),
        "iat": issued,
        "exp": issued + SECRET_LIFETIME_SECONDS,
        "aud": APPLE_ISSUER,
        "sub": _client_id(settings),
    }
    return jwt.encode(
        payload,
        _private_key_pem(settings.apple_private_key),
        algorithm="ES256",
        headers={"kid": settings.apple_key_id.strip()},
    )


async def _post_form(url: str, data: dict[str, str]) -> tuple[int, dict[str, Any] | None]:
    """The one network call. Returns the status and the JSON body when there is one."""
    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT_SECONDS) as client:
        response = await client.post(url, data=data)
    try:
        body = response.json()
    except ValueError:
        body = None
    return response.status_code, body if isinstance(body, dict) else None


def _subject_of(id_token: str | None) -> str | None:
    """The `sub` of the id_token Apple returned. Read without checking the signature: it came
    straight from Apple over TLS in answer to our own call, and is only compared, never trusted."""
    if not id_token:
        return None
    try:
        claims = jwt.decode(id_token, options={"verify_signature": False})
    except jwt.PyJWTError:
        return None
    sub = claims.get("sub")
    return str(sub) if sub else None


async def exchange_authorization_code(
    code: str, *, expected_subject: str | None = None, settings: Settings | None = None
) -> str | None:
    """Trade the sign-in's authorization code for a refresh token. None on any problem.

    When `expected_subject` is given, the token is returned only if Apple says it belongs to that
    same Apple user (so a code from another person's sign-in is never attached to this account).
    """
    settings = settings or get_settings()
    if not code.strip() or not apple_revocation_configured(settings):
        return None
    try:
        secret = build_client_secret(settings)
        status, body = await _post_form(
            APPLE_TOKEN_URL,
            {
                "client_id": _client_id(settings),
                "client_secret": secret,
                "code": code.strip(),
                "grant_type": "authorization_code",
            },
        )
    except Exception as exc:
        logger.warning("apple code exchange failed: %s", type(exc).__name__)
        return None
    if status != 200 or not body:
        logger.warning("apple code exchange refused: http %s", status)
        return None
    refresh = body.get("refresh_token")
    if not isinstance(refresh, str) or not refresh:
        logger.warning("apple code exchange gave no refresh token")
        return None
    if expected_subject is not None:
        id_token = body.get("id_token")
        subject = _subject_of(id_token if isinstance(id_token, str) else None)
        if subject != expected_subject:
            logger.warning("apple code exchange: the code is another Apple user's, not stored")
            return None
    return refresh


async def store_refresh_token(session: AsyncSession, user_id: UUID, refresh_token: str) -> None:
    """Keep (or replace) the member's Apple refresh token. Never raises."""
    try:
        row = await session.get(AppleRefreshToken, user_id)
        if row is None:
            session.add(AppleRefreshToken(user_id=user_id, refresh_token=refresh_token))
        else:
            row.refresh_token = refresh_token
        await session.commit()
    except Exception as exc:
        logger.warning("could not store the apple refresh token: %s", type(exc).__name__)
        try:
            await session.rollback()
        except Exception:  # pragma: no cover - the session is gone anyway
            pass


async def stored_refresh_token(session: AsyncSession, user_id: UUID) -> str | None:
    """The member's stored Apple refresh token, or None. Never raises, and never poisons the
    caller's transaction: the read runs inside a savepoint, so a missing table is harmless."""
    try:
        async with session.begin_nested():
            row = await session.get(AppleRefreshToken, user_id)
            return row.refresh_token if row is not None else None
    except Exception as exc:
        logger.warning("could not read the apple refresh token: %s", type(exc).__name__)
        return None


async def revoke_refresh_token(refresh_token: str, settings: Settings | None = None) -> bool:
    """Call Apple's revoke endpoint. True only when Apple answered 200. Never raises."""
    settings = settings or get_settings()
    if not refresh_token:
        return False
    if not apple_revocation_configured(settings):
        logger.warning(
            "apple revoke skipped: APPLE_TEAM_ID, APPLE_KEY_ID or APPLE_PRIVATE_KEY is not set"
        )
        return False
    try:
        secret = build_client_secret(settings)
        status, _ = await _post_form(
            APPLE_REVOKE_URL,
            {
                "client_id": _client_id(settings),
                "client_secret": secret,
                "token": refresh_token,
                "token_type_hint": "refresh_token",
            },
        )
    except Exception as exc:
        logger.warning("apple revoke failed: %s", type(exc).__name__)
        return False
    if status != 200:
        logger.warning("apple revoke refused: http %s", status)
        return False
    return True


async def revoke_for_deleted_member(refresh_token: str | None, *, is_apple_member: bool) -> bool:
    """What account deletion calls after the account is gone. Never raises.

    No token for an Apple member means the phone never sent the authorization code (an old app
    build): log it and move on; the person can still remove the app under Settings > Apple ID.
    """
    try:
        if refresh_token:
            return await revoke_refresh_token(refresh_token)
        if is_apple_member:
            logger.warning(
                "apple revoke skipped: no stored token for this member "
                "(the app did not send the authorization code)"
            )
        return False
    except Exception as exc:  # belt and braces: deletion must never fail because of Apple
        logger.warning("apple revoke failed: %s", type(exc).__name__)
        return False
