from __future__ import annotations

from datetime import UTC, datetime
from typing import cast
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.models import UserAccount

# Probe / deploy identities that must not clutter the admin console.
EPHEMERAL_MEMBER_MARKERS = (
    "deploy-smoke",
    "admin-diag",
    "feedback-diag",
    "quiz-diag",
    "member-diag",
)


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


def is_ephemeral_member(member: UserAccount) -> bool:
    haystack = f"{member.external_subject or ''} {member.display_name or ''}".casefold()
    return any(marker in haystack for marker in EPHEMERAL_MEMBER_MARKERS)


def is_protected_admin(member: UserAccount, settings: Settings | None = None) -> bool:
    if is_ephemeral_member(member):
        return False
    email = (member.email or "").casefold()
    if not email:
        return False
    return email in protected_admin_emails(settings)


def apply_default_admin(member: UserAccount, settings: Settings | None = None) -> None:
    # Ephemeral deploy/probe identities may still be promoted so smoke checks can
    # exercise admin routes; list_admin_members hides them from the console.
    email = (member.email or "").casefold()
    if email and email in default_admin_emails(settings):
        member.is_admin = True


async def require_admin_member(session: AsyncSession, member: UserAccount) -> UserAccount:
    was_admin = member.is_admin
    apply_default_admin(member)
    if member.is_admin and not was_admin:
        await session.commit()
        await session.refresh(member)
    if not member.is_admin:
        raise HTTPException(status_code=403, detail="Admin access is required")
    return member


def _last_seen_key(member: UserAccount) -> datetime:
    value = member.last_seen_at or member.created_at
    if value is None:
        return datetime.min.replace(tzinfo=UTC)
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value


async def list_admin_members(session: AsyncSession) -> list[UserAccount]:
    rows = list(
        (
            await session.execute(
                select(UserAccount)
                .where(UserAccount.is_admin.is_(True), UserAccount.deleted_at.is_(None))
                .order_by(UserAccount.display_name.asc())
            )
        ).scalars()
    )
    # One row per email so deploy/probe clones of the owner account do not appear twice.
    by_email: dict[str, UserAccount] = {}
    for row in rows:
        if is_ephemeral_member(row):
            continue
        key = (row.email or "").casefold() or str(row.id)
        current = by_email.get(key)
        if current is None or _last_seen_key(row) >= _last_seen_key(current):
            by_email[key] = row
    return sorted(
        by_email.values(),
        key=lambda member: (member.display_name or "").casefold(),
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
