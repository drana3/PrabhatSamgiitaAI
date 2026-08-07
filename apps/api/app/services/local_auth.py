from __future__ import annotations

import re
from datetime import UTC, datetime
from uuid import uuid4

import bcrypt
from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import UserAccount, UserCredential
from app.schemas.auth import AuthSessionResponse, LocalLoginWrite, LocalRegisterWrite
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


async def register_local_user(
    session: AsyncSession, payload: LocalRegisterWrite
) -> AuthSessionResponse:
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
    if existing_member is not None:
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
    return AuthSessionResponse(
        client_principal=principal_for_member(member),
        display_name=member.display_name,
        email=email,
        identity_provider=member.identity_provider,
    )


async def login_local_user(session: AsyncSession, payload: LocalLoginWrite) -> AuthSessionResponse:
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
    return AuthSessionResponse(
        client_principal=principal_for_member(member),
        display_name=member.display_name,
        email=email,
        identity_provider=member.identity_provider,
    )
