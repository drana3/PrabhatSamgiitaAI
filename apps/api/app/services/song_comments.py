"""Song comments: posting, reading, reporting, removal (apps/mobile/docs/song-comments.md).

Same model as the Kiirtan recordings: publish first, review after. Members post; anyone may report;
the team removes with a reason; the author can delete their own comment for good.

The one rule that must not break: a PUBLIC view of an anonymous comment carries no trace of its
author (see `public_out`). Everything that knows the author is `admin_out` and team-only.
"""

from __future__ import annotations

import re
from datetime import timedelta
from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import UserAccount
from app.models.recordings import PS_SONG_COUNT
from app.models.song_comments import COMMENT_MAX_LENGTH, SongComment, SongCommentReport
from app.schemas.song_comments import (
    AdminSongCommentOut,
    CommentAuthor,
    SongCommentOut,
)
from app.services.recordings import RateLimiter, clean_text, now_utc

DAILY_COMMENTS = 20
HOURLY_COMMENTS = 10
HOURLY_COMMENTS_TEAM = 120
MAX_LINKS = 2
DAILY_LIMIT_CODE = "comment_daily_limit"
FALLBACK_NAME = "Member"

limiter = RateLimiter()
_LINK = re.compile(r"(?:https?://|www\.)", re.IGNORECASE)
_CONTROL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


def check_song(song_id: int) -> int:
    if not 1 <= song_id <= PS_SONG_COUNT:
        raise HTTPException(status_code=422, detail="Unknown song number.")
    return song_id


def clean_body(raw: str) -> str:
    """Trim, drop control characters, keep line breaks but never more than one blank line."""
    text = _CONTROL.sub("", raw.replace("\r\n", "\n").replace("\r", "\n"))
    lines = [" ".join(line.split()) for line in text.split("\n")]
    text = "\n".join(lines).strip()
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text[:COMMENT_MAX_LENGTH]


def display_name(member: UserAccount) -> str:
    """The name shown beside a named comment. An address is never shown as a name."""
    name = clean_text(member.display_name, 80)
    if not name or "@" in name:
        return FALLBACK_NAME
    return name


def public_out(
    comment: SongComment,
    author: UserAccount | None,
    *,
    viewer_id: UUID | None,
    team: bool,
) -> SongCommentOut:
    """What every reader gets. `author` is filled only for a NAMED comment."""
    shown = None
    if not comment.is_anonymous and author is not None:
        shown = CommentAuthor(name=display_name(author), avatar_url=author.avatar_url)
    return SongCommentOut(
        id=str(comment.id),
        song_id=comment.song_id,
        body=comment.body,
        created_at=comment.created_at,
        is_anonymous=comment.is_anonymous,
        author=shown,
        mine=viewer_id is not None and comment.member_id == viewer_id,
        can_remove=team,
    )


def admin_out(comment: SongComment, author: UserAccount | None) -> AdminSongCommentOut:
    return AdminSongCommentOut(
        id=str(comment.id),
        song_id=comment.song_id,
        body=comment.body,
        created_at=comment.created_at,
        is_anonymous=comment.is_anonymous,
        status=comment.status,  # type: ignore[arg-type]
        reports_count=comment.reports_count,
        author_id=comment.member_id,
        author_name=display_name(author) if author is not None else FALLBACK_NAME,
        removed_reason=comment.removed_reason,
    )


async def list_published(
    session: AsyncSession, song_id: int, *, limit: int, offset: int
) -> tuple[list[tuple[SongComment, UserAccount | None]], int]:
    """Published comments of one song, newest first, each with its author's account."""
    condition = (SongComment.song_id == song_id, SongComment.status == "published")
    total = await session.scalar(select(func.count()).select_from(SongComment).where(*condition))
    rows = (
        await session.execute(
            select(SongComment, UserAccount)
            .join(UserAccount, UserAccount.id == SongComment.member_id, isouter=True)
            .where(*condition)
            .order_by(SongComment.created_at.desc(), SongComment.id.desc())
            .limit(limit)
            .offset(offset)
        )
    ).all()
    return [(c, a) for c, a in rows], int(total or 0)


async def comments_in_last_day(session: AsyncSession, member_id: UUID) -> int:
    since = now_utc() - timedelta(hours=24)
    total = await session.scalar(
        select(func.count())
        .select_from(SongComment)
        .where(SongComment.member_id == member_id, SongComment.created_at >= since)
    )
    return int(total or 0)


async def ensure_daily_allowance(
    session: AsyncSession, member_id: UUID, *, team: bool, limit: int = DAILY_COMMENTS
) -> None:
    """At most DAILY_COMMENTS per member in 24 hours (removed ones count). The team has no limit."""
    if team:
        return
    if await comments_in_last_day(session, member_id) >= limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"You can add up to {limit} comments a day. Please come back tomorrow.",
            headers={"X-Error-Code": DAILY_LIMIT_CODE},
        )


def validate_body(raw: str) -> str:
    body = clean_body(raw)
    if not body:
        raise HTTPException(status_code=422, detail="Write something before posting.")
    if len(_LINK.findall(body)) > MAX_LINKS:
        raise HTTPException(status_code=422, detail="Please use at most two links in a comment.")
    return body


async def create_comment(
    session: AsyncSession,
    *,
    member: UserAccount,
    song_id: int,
    body: str,
    is_anonymous: bool,
    team: bool,
) -> SongComment:
    body = validate_body(body)
    await ensure_daily_allowance(session, member.id, team=team)
    twin = await session.scalar(
        select(SongComment.id).where(
            SongComment.member_id == member.id,
            SongComment.song_id == song_id,
            SongComment.body == body,
            SongComment.status == "published",
        )
    )
    if twin is not None:
        raise HTTPException(status_code=409, detail="You already shared this comment.")
    comment = SongComment(
        song_id=song_id, member_id=member.id, body=body, is_anonymous=is_anonymous
    )
    session.add(comment)
    await session.commit()
    await session.refresh(comment)
    return comment


async def add_report(
    session: AsyncSession,
    *,
    comment: SongComment,
    reporter_key: str,
    reporter_id: UUID | None,
    reason: str,
    note: str | None,
) -> bool:
    """Store a report. False when this reporter already reported it (one report each)."""
    already = await session.scalar(
        select(SongCommentReport.id).where(
            SongCommentReport.comment_id == comment.id,
            SongCommentReport.reporter_key == reporter_key,
        )
    )
    if already is not None:
        return False
    session.add(
        SongCommentReport(
            comment_id=comment.id,
            reporter_key=reporter_key,
            reporter_id=reporter_id,
            reason=reason,
            note=clean_text(note, 1000) or None,
        )
    )
    comment.reports_count = (comment.reports_count or 0) + 1
    await session.commit()
    return True


async def remove_by_team(
    session: AsyncSession, comment: SongComment, *, reason: str, by: str
) -> None:
    comment.status = "removed"
    comment.removed_reason = clean_text(reason, 500) or None
    comment.removed_at = now_utc()
    comment.removed_by = by[:255]
    await session.commit()


async def reported_queue(
    session: AsyncSession, *, limit: int, offset: int
) -> tuple[list[tuple[SongComment, UserAccount | None]], int]:
    """Published comments somebody reported, most reported first (the team's daily list)."""
    condition: tuple[Any, ...] = (SongComment.status == "published", SongComment.reports_count > 0)
    total = await session.scalar(select(func.count()).select_from(SongComment).where(*condition))
    rows = (
        await session.execute(
            select(SongComment, UserAccount)
            .join(UserAccount, UserAccount.id == SongComment.member_id, isouter=True)
            .where(*condition)
            .order_by(SongComment.reports_count.desc(), SongComment.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
    ).all()
    return [(c, a) for c, a in rows], int(total or 0)
