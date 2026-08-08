from __future__ import annotations

from datetime import UTC, datetime
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


def protected_admin_emails(settings: Settings | None = None) -> set[str]:
    settings = settings or get_settings()
    return _email_set(settings.protected_admin_emails)


def ensure_ephemeral_smoke_admin(member: UserAccount) -> None:
    """CI/deploy probe identities need admin routes without hardcoding owner emails."""
    if is_ephemeral_member(member):
        member.is_admin = True


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


async def require_admin_member(session: AsyncSession, member: UserAccount) -> UserAccount:
    was_admin = member.is_admin
    ensure_ephemeral_smoke_admin(member)
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


def _subject_rank(subject: str) -> int:
    value = (subject or "").casefold()
    if value.startswith("aad:") and "@" not in value and "preview" not in value:
        return 3
    if "preview" in value:
        return 0
    if "@" in value:
        return 1
    return 2


def _dedupe_members(rows: list[UserAccount]) -> list[UserAccount]:
    by_email: dict[str, UserAccount] = {}
    for row in rows:
        if is_ephemeral_member(row):
            continue
        key = (row.email or "").casefold() or str(row.id)
        current = by_email.get(key)
        if current is None:
            by_email[key] = row
            continue
        row_key = (_subject_rank(row.external_subject), _last_seen_key(row))
        cur_key = (_subject_rank(current.external_subject), _last_seen_key(current))
        if row_key >= cur_key:
            by_email[key] = row
    return list(by_email.values())


async def list_signed_in_members(
    session: AsyncSession,
    *,
    query: str | None = None,
    limit: int = 100,
) -> list[UserAccount]:
    statement = select(UserAccount).where(UserAccount.deleted_at.is_(None))
    if query and query.strip():
        needle = f"%{query.strip().casefold()}%"
        statement = statement.where(
            func.lower(UserAccount.email).like(needle)
            | func.lower(UserAccount.display_name).like(needle)
        )
    rows = list(
        (
            await session.execute(
                statement.order_by(
                    UserAccount.is_admin.desc(),
                    UserAccount.last_seen_at.desc(),
                    UserAccount.display_name.asc(),
                ).limit(limit * 3)
            )
        ).scalars()
    )
    deduped = _dedupe_members(rows)
    deduped.sort(
        key=lambda member: (
            0 if member.is_admin else 1,
            -_last_seen_key(member).timestamp(),
            (member.display_name or "").casefold(),
        )
    )
    return deduped[:limit]


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
    return sorted(
        _dedupe_members(rows),
        key=lambda member: (member.display_name or "").casefold(),
    )


async def find_member_by_email(session: AsyncSession, email: str) -> UserAccount | None:
    normalized = email.strip().casefold()
    if not normalized:
        return None
    rows = list(
        (
            await session.scalars(
                select(UserAccount).where(
                    UserAccount.deleted_at.is_(None),
                    func.lower(UserAccount.email) == normalized,
                )
            )
        ).all()
    )
    if not rows:
        return None

    def _rank(subject: str) -> int:
        value = (subject or "").casefold()
        if value.startswith("aad:") and "@" not in value and "preview" not in value:
            return 3
        if "preview" in value:
            return 0
        if "@" in value:
            return 1
        return 2

    rows.sort(
        key=lambda row: (
            0 if row.is_admin else 1,
            -_rank(row.external_subject),
            row.created_at or datetime.min.replace(tzinfo=UTC),
        )
    )
    return rows[0]


async def require_super_admin_member(session: AsyncSession, member: UserAccount) -> UserAccount:
    member = await require_admin_member(session, member)
    if not member.is_super_admin:
        raise HTTPException(status_code=403, detail="Super-admin access is required")
    return member


async def grant_super_admin(session: AsyncSession, email: str) -> UserAccount:
    member = await grant_admin(session, email)
    member.is_super_admin = True
    await session.commit()
    await session.refresh(member)
    return member


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


async def grant_admin_bulk(session: AsyncSession, user_ids: list[UUID]) -> list[UserAccount]:
    promoted: list[UserAccount] = []
    for user_id in user_ids:
        member = await session.get(UserAccount, user_id)
        if member is None or member.deleted_at is not None or is_ephemeral_member(member):
            continue
        if not member.is_admin:
            member.is_admin = True
            promoted.append(member)
    if not promoted:
        raise HTTPException(
            status_code=400,
            detail="No eligible members were selected for promotion.",
        )
    await session.commit()
    for member in promoted:
        await session.refresh(member)
    return promoted


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
