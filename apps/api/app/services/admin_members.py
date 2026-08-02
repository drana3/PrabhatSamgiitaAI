from __future__ import annotations

from typing import cast
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.models import UserAccount


def _email_set(raw: str) -> set[str]:
    return {email.strip().casefold() for email in raw.split(",") if email.strip()}


def default_admin_emails(settings: Settings | None = None) -> set[str]:
    return _email_set((settings or get_settings()).default_admin_emails)


def protected_admin_emails(settings: Settings | None = None) -> set[str]:
    settings = settings or get_settings()
    protected = _email_set(settings.protected_admin_emails)
    if protected:
        return protected
    return default_admin_emails(settings)


def is_protected_admin(member: UserAccount, settings: Settings | None = None) -> bool:
    email = (member.email or "").casefold()
    if not email:
        return False
    return email in protected_admin_emails(settings)


def apply_default_admin(member: UserAccount, settings: Settings | None = None) -> None:
    email = (member.email or "").casefold()
    if email and email in default_admin_emails(settings):
        member.is_admin = True


async def require_admin_member(session: AsyncSession, member: UserAccount) -> UserAccount:
    apply_default_admin(member)
    if not member.is_admin:
        raise HTTPException(status_code=403, detail="Admin access is required")
    return member


async def list_admin_members(session: AsyncSession) -> list[UserAccount]:
    return list(
        (
            await session.execute(
                select(UserAccount)
                .where(UserAccount.is_admin.is_(True), UserAccount.deleted_at.is_(None))
                .order_by(UserAccount.display_name.asc())
            )
        ).scalars()
    )


async def find_member_by_email(session: AsyncSession, email: str) -> UserAccount | None:
    normalized = email.strip().casefold()
    if not normalized:
        return None
    return cast(
        UserAccount | None,
        await session.scalar(
            select(UserAccount).where(
                UserAccount.deleted_at.is_(None),
                func.lower(UserAccount.email) == normalized,
            )
        ),
    )


async def grant_admin(session: AsyncSession, email: str) -> UserAccount:
    member = await find_member_by_email(session, email)
    if member is None:
        raise HTTPException(
            status_code=404,
            detail=(
                "No signed-in member was found with that email. "
                "They need to sign in once first."
            ),
        )
    member.is_admin = True
    await session.commit()
    await session.refresh(member)
    return member


async def revoke_admin(
    session: AsyncSession,
    target_id: UUID,
    actor: UserAccount,
    settings: Settings | None = None,
) -> UserAccount:
    settings = settings or get_settings()
    target = await session.get(UserAccount, target_id)
    if target is None or target.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Member not found")
    if not target.is_admin:
        raise HTTPException(status_code=400, detail="This member is not an admin")
    if is_protected_admin(target, settings):
        raise HTTPException(
            status_code=403,
            detail="This admin account is protected and cannot be removed",
        )
    if target.id == actor.id:
        raise HTTPException(status_code=400, detail="You cannot remove your own admin access here")

    admin_count = await session.scalar(
        select(func.count())
        .select_from(UserAccount)
        .where(UserAccount.is_admin.is_(True), UserAccount.deleted_at.is_(None))
    )
    if int(admin_count or 0) <= 1:
        raise HTTPException(status_code=400, detail="At least one admin must remain")

    target.is_admin = False
    await session.commit()
    await session.refresh(target)
    return target
