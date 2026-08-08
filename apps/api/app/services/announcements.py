from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import SiteAnnouncement, UserAccount
from app.services.acs_email import send_transactional_email
from app.services.admin_members import is_ephemeral_member

ANNOUNCEMENT_KINDS = frozenset({"general", "maintenance", "quiz"})
ANNOUNCEMENT_PRIORITIES = frozenset({"normal", "high", "urgent"})


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value


async def list_active_announcements(session: AsyncSession) -> list[SiteAnnouncement]:
    now = datetime.now(UTC)
    rows = list(
        (
            await session.execute(
                select(SiteAnnouncement)
                .where(
                    SiteAnnouncement.is_active.is_(True),
                    SiteAnnouncement.starts_at <= now,
                    SiteAnnouncement.ends_at >= now,
                )
                .order_by(SiteAnnouncement.ends_at.asc())
            )
        ).scalars()
    )
    priority_rank = {"urgent": 3, "high": 2, "normal": 1}
    rows.sort(key=lambda row: (-priority_rank.get(row.priority, 1), row.ends_at))
    return rows


async def list_all_announcements(session: AsyncSession, limit: int = 50) -> list[SiteAnnouncement]:
    return list(
        (
            await session.execute(
                select(SiteAnnouncement)
                .order_by(SiteAnnouncement.starts_at.desc())
                .limit(limit)
            )
        ).scalars()
    )


async def create_announcement(
    session: AsyncSession,
    *,
    creator: UserAccount,
    title: str,
    body: str,
    kind: str,
    priority: str,
    starts_at: datetime,
    ends_at: datetime,
    notify_by_email: bool,
) -> SiteAnnouncement:
    if kind not in ANNOUNCEMENT_KINDS:
        raise HTTPException(status_code=422, detail="Invalid announcement kind.")
    if priority not in ANNOUNCEMENT_PRIORITIES:
        raise HTTPException(status_code=422, detail="Invalid announcement priority.")
    starts = _as_utc(starts_at)
    ends = _as_utc(ends_at)
    if ends <= starts:
        raise HTTPException(status_code=422, detail="End time must be after start time.")

    row = SiteAnnouncement(
        title=title.strip()[:200],
        body=body.strip(),
        kind=kind,
        priority=priority,
        starts_at=starts,
        ends_at=ends,
        is_active=True,
        notify_by_email=notify_by_email,
        created_by=creator.id,
    )
    session.add(row)
    await session.flush()

    if notify_by_email:
        row.email_sent_count = await _broadcast_announcement_email(session, row)

    await session.commit()
    await session.refresh(row)
    return row


async def deactivate_announcement(session: AsyncSession, announcement_id: UUID) -> SiteAnnouncement:
    row = await session.get(SiteAnnouncement, announcement_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Announcement not found.")
    row.is_active = False
    await session.commit()
    await session.refresh(row)
    return row


async def _broadcast_announcement_email(
    session: AsyncSession, announcement: SiteAnnouncement
) -> int:
    rows = list(
        (
            await session.execute(
                select(UserAccount).where(
                    UserAccount.deleted_at.is_(None),
                    UserAccount.email.is_not(None),
                )
            )
        ).scalars()
    )
    sent = 0
    seen: set[str] = set()
    deadline = announcement.ends_at.astimezone(UTC).strftime("%d %b %Y, %H:%M UTC")
    subject = f"Prabhat Samgiita: {announcement.title}"
    for member in rows:
        if is_ephemeral_member(member):
            continue
        email = (member.email or "").strip().casefold()
        if not email or email in seen:
            continue
        seen.add(email)
        plain = (
            f"{announcement.title}\n\n{announcement.body}\n\n"
            f"Visible on site until: {deadline}\n"
        )
        html = (
            f"<h2>{announcement.title}</h2>"
            f"<p>{announcement.body.replace(chr(10), '<br/>')}</p>"
            f"<p><small>Visible on site until {deadline}</small></p>"
        )
        if send_transactional_email(
            to_address=member.email or email,
            subject=subject,
            plain_text=plain,
            html_body=html,
        ):
            sent += 1
    return sent
