from __future__ import annotations

import re
from datetime import UTC, datetime
from uuid import uuid4

import bcrypt
from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models import UserAccount, UserCredential
from app.schemas.auth import AuthSessionResponse, LocalLoginWrite, LocalRegisterWrite
from app.services.admin_members import owner_admin_emails
from app.services.member_tokens import session_tokens_enabled, start_session
from app.services.members import _find_canonical_by_email
from app.services.principals import principal_for_member

EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _normalize_email(email: str) -> str:
    return email.strip().casefold()


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def _verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        return False


async def _with_tokens(
    session: AsyncSession, member: UserAccount, response: AuthSessionResponse, device: str | None
) -> AuthSessionResponse:
    if session_tokens_enabled():
        pair = await start_session(session, member, device_label=device, provider="local")
        response.access_token = pair.access_token
        response.refresh_token = pair.refresh_token
        response.expires_in = pair.expires_in
    return response


MINIMUM_AGE = 16
AGE_REFUSAL = f"You must be {MINIMUM_AGE} or older to create an account."


def _require_age_confirmed(payload: LocalRegisterWrite) -> None:
    """The sign-up tick "I'm 16 or older". An explicit false is always refused. A missing field
    (an old app build that has no tick) is accepted unless REQUIRE_AGE_CONFIRMATION is on."""
    if payload.age_confirmed is False:
        raise HTTPException(status_code=422, detail=AGE_REFUSAL)
    if payload.age_confirmed is None and get_settings().require_age_confirmation:
        raise HTTPException(status_code=422, detail=AGE_REFUSAL)


async def register_local_user(
    session: AsyncSession, payload: LocalRegisterWrite, device: str | None = None
) -> AuthSessionResponse:
    _require_age_confirmed(payload)
    email = _normalize_email(str(payload.email))
    if not EMAIL_PATTERN.match(email):
        raise HTTPException(status_code=422, detail="Enter a valid email address.")

    existing_credential = await session.scalar(
        select(UserCredential).where(func.lower(UserCredential.email) == email)
    )
    if existing_credential is not None:
        raise HTTPException(
            status_code=409,
            detail="An account with this email already exists. Sign in instead.",
        )

    existing_member = await _find_canonical_by_email(session, email)
    # An owner address cannot be taken by typing it in: nothing here proves the e-mail is yours.
    if existing_member is not None or email in owner_admin_emails():
        raise HTTPException(
            status_code=409,
            detail="An account with this email already exists. Sign in instead.",
        )

    now = datetime.now(UTC)
    display_name = payload.display_name.strip()[:255] or email
    user_id = uuid4()
    member = UserAccount(
        id=user_id,
        external_subject=f"local:{user_id}",
        identity_provider="local",
        email=email,
        display_name=display_name,
        last_seen_at=now,
    )
    session.add(member)
    await session.flush()

    session.add(
        UserCredential(
            id=uuid4(),
            user_id=member.id,
            email=email,
            password_hash=_hash_password(payload.password),
        )
    )
    member.last_seen_at = now
    member.deleted_at = None
    await session.commit()
    await session.refresh(member)
    return await _with_tokens(
        session,
        member,
        AuthSessionResponse(
            client_principal=principal_for_member(member),
            display_name=member.display_name,
            email=email,
            identity_provider=member.identity_provider,
        ),
        device,
    )


async def login_local_user(
    session: AsyncSession, payload: LocalLoginWrite, device: str | None = None
) -> AuthSessionResponse:
    email = _normalize_email(str(payload.email))
    credential = await session.scalar(
        select(UserCredential).where(func.lower(UserCredential.email) == email)
    )
    if credential is None or not _verify_password(payload.password, credential.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    member = await session.get(UserAccount, credential.user_id)
    if member is None or member.deleted_at is not None:
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    member.last_seen_at = datetime.now(UTC)
    await session.commit()
    await session.refresh(member)
    return await _with_tokens(
        session,
        member,
        AuthSessionResponse(
            client_principal=principal_for_member(member),
            display_name=member.display_name,
            email=email,
            identity_provider=member.identity_provider,
        ),
        device,
    )
