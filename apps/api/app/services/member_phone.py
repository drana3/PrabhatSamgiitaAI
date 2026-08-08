from __future__ import annotations

from datetime import UTC, datetime
from typing import TypedDict

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import UserAccount
from app.services.phone_numbers import mask_phone_e164, normalize_phone


def phone_required(member: UserAccount) -> bool:
    return not member.phone_e164


def phone_verification_required(_member: UserAccount) -> bool:
    return False


async def _ensure_phone_available(
    session: AsyncSession, phone_e164: str, *, exclude_user_id: object | None = None
) -> None:
    existing = await session.scalar(
        select(UserAccount).where(UserAccount.phone_e164 == phone_e164)
    )
    if existing is not None and existing.id != exclude_user_id:
        raise HTTPException(
            status_code=409,
            detail="That mobile number is already linked to another account.",
        )


async def set_member_phone(
    session: AsyncSession,
    member: UserAccount,
    *,
    phone_country_code: str,
    phone_number: str,
) -> UserAccount:
    phone_e164, region = normalize_phone(phone_country_code, phone_number)
    await _ensure_phone_available(session, phone_e164, exclude_user_id=member.id)

    member.phone_e164 = phone_e164
    member.phone_country_code = region
    member.phone_verified_at = datetime.now(UTC)

    await session.commit()
    await session.refresh(member)
    return member


class PhoneProfileFields(TypedDict):
    phone_e164: str | None
    phone_display: str | None
    phone_country_code: str | None
    phone_verified: bool
    phone_required: bool
    phone_verification_required: bool


def phone_profile_fields(member: UserAccount) -> PhoneProfileFields:
    return {
        "phone_e164": member.phone_e164,
        "phone_display": mask_phone_e164(member.phone_e164),
        "phone_country_code": member.phone_country_code,
        "phone_verified": member.phone_verified_at is not None,
        "phone_required": phone_required(member),
        "phone_verification_required": False,
    }
