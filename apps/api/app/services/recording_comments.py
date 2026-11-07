"""Comments under a recording: posting, reading, reporting, removal (docs/recording-extras.md).

The same model and the same text rules as the comments under a Prabhat Samgiita song
(`services/song_comments.py`): publish first, review after; members post, anyone may report, the
team removes with a reason, the author can delete their own comment. The text functions, the daily
allowance and the limits are the song comments' own, imported, so a fix in one reaches both.

The one rule that must not break: a PUBLIC view of an anonymous comment carries no trace of its
author (see `public_out`). Everything that knows the author is `admin_out` and team-only.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import UserAccount
from app.models.recording_extras import RecordingComment, RecordingCommentReport
from app.schemas.recording_extras import AdminRecordingCommentOut, RecordingCommentOut
from app.schemas.song_comments import CommentAuthor
from app.services import song_comments as base
from app.services.extras_common import (
    AUTHOR_DELETED_BY,
    comments_in_last_day,
    display_name,
    one_line,
    team_removed_by,
)
from app.services.recordings import now_utc
from app.services.song_comments import (
    AUTHOR_DELETED_BODY,
    DAILY_COMMENTS,
    DAILY_LIMIT_CODE,
    HOURLY_COMMENTS,
    HOURLY_COMMENTS_TEAM,
    limiter,
    validate_body,
)

__all__ = [
    "AUTHOR_DELETED_BODY",
    "AUTHOR_DELETED_BY",
    "DAILY_COMMENTS",
    "HOURLY_COMMENTS",
    "HOURLY_COMMENTS_TEAM",
    "limiter",
    "validate_body",
]


def is_tombstone(comment: RecordingComment) -> bool:
    """The author deleted it: the row stays (allowance, evidence) and readers see a bare line."""
    return comment.status == "removed" and comment.removed_by == AUTHOR_DELETED_BY


def public_out(
    comment: RecordingComment,
    author: UserAccount | None,
    *,
    viewer_id: UUID | None,
    team: bool,
) -> RecordingCommentOut:
    """What every reader gets. `author` is filled only for a NAMED comment. A comment its author
    deleted comes back as a tombstone: `deleted`, no text, no author, nothing to act on."""
    if is_tombstone(comment):
        return RecordingCommentOut(
            id=str(comment.id),
            recording_id=str(comment.recording_id),
            body="",
            created_at=comment.created_at,
            is_anonymous=True,
            author=None,
            mine=False,
            can_remove=False,
            deleted=True,
        )
    shown = None
    if not comment.is_anonymous and author is not None:
        shown = CommentAuthor(name=display_name(author), avatar_url=author.avatar_url)
    return RecordingCommentOut(
        id=str(comment.id),
        recording_id=str(comment.recording_id),
        body=comment.body,
        created_at=comment.created_at,
        is_anonymous=comment.is_anonymous,
        author=shown,
        mine=viewer_id is not None and comment.member_id == viewer_id,
        can_remove=team,
    )


def admin_out(comment: RecordingComment, author: UserAccount | None) -> AdminRecordingCommentOut:
    return AdminRecordingCommentOut(
        id=str(comment.id),
        recording_id=str(comment.recording_id),
        body=comment.body,
        created_at=comment.created_at,
        is_anonymous=comment.is_anonymous,
        status=comment.status,  # type: ignore[arg-type]
        reports_count=comment.reports_count,
        author_id=comment.member_id,
        author_name=display_name(author),
        removed_reason=comment.removed_reason,
    )


async def list_published(
    session: AsyncSession, recording_id: UUID, *, limit: int, offset: int
) -> tuple[list[tuple[RecordingComment, UserAccount | None]], int, int]:
    """Published comments of one recording, newest first, each with its author's account, and the
    tombstones of the comments their authors deleted (a team removal leaves no trace for readers).
    Returns the rows, the total of everything listed (tombstones too, for paging) and the count of
    live comments alone (the number to show)."""
    condition = (
        RecordingComment.recording_id == recording_id,
        or_(
            RecordingComment.status == "published",
            and_(
                RecordingComment.status == "removed",
                RecordingComment.removed_by == AUTHOR_DELETED_BY,
            ),
        ),
    )
    total = await session.scalar(
        select(func.count()).select_from(RecordingComment).where(*condition)
    )
    rows = (
        await session.execute(
            select(RecordingComment, UserAccount)
            .join(UserAccount, UserAccount.id == RecordingComment.member_id, isouter=True)
            .where(*condition)
            .order_by(RecordingComment.created_at.desc(), RecordingComment.id.desc())
            .limit(limit)
            .offset(offset)
        )
    ).all()
    live = await session.scalar(
        select(func.count())
        .select_from(RecordingComment)
        .where(
            RecordingComment.recording_id == recording_id,
            RecordingComment.status == "published",
        )
    )
    return [(c, a) for c, a in rows], int(total or 0), int(live or 0)


async def ensure_daily_allowance(
    session: AsyncSession, member_id: UUID, *, team: bool, limit: int = DAILY_COMMENTS
) -> None:
    """At most DAILY_COMMENTS in 24 hours (removed ones count), on recordings and on songs together:
    the song comments of the member are added to the recording comments. The team has no limit."""
    if team:
        return
    used = await comments_in_last_day(session, member_id) + await base.comments_in_last_day(
        session, member_id
    )
    if used >= limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"You can add up to {limit} comments a day. Please come back tomorrow.",
            headers={"X-Error-Code": DAILY_LIMIT_CODE},
        )


async def shared_before(
    session: AsyncSession, member_id: UUID, recording_id: UUID, body: str
) -> bool:
    """Has this member already published the same comment on this recording?"""
    key = base.same_text_key(body)
    earlier = await session.scalars(
        select(RecordingComment.body).where(
            RecordingComment.member_id == member_id,
            RecordingComment.recording_id == recording_id,
            RecordingComment.status == "published",
        )
    )
    return any(base.same_text_key(text) == key for text in earlier)


async def create_comment(
    session: AsyncSession,
    *,
    member: UserAccount,
    recording_id: UUID,
    body: str,
    is_anonymous: bool,
    team: bool,
) -> RecordingComment:
    body = validate_body(body)
    await ensure_daily_allowance(session, member.id, team=team)
    if await shared_before(session, member.id, recording_id, body):
        raise HTTPException(status_code=409, detail="You already shared this comment.")
    comment = RecordingComment(
        recording_id=recording_id, member_id=member.id, body=body, is_anonymous=is_anonymous
    )
    session.add(comment)
    await session.commit()
    await session.refresh(comment)
    return comment


async def add_report(
    session: AsyncSession,
    *,
    comment: RecordingComment,
    reporter_key: str,
    reporter_id: UUID | None,
    reason: str,
    note: str | None,
) -> bool:
    """Store a report. False when this reporter already reported it (one report each)."""
    already = await session.scalar(
        select(RecordingCommentReport.id).where(
            RecordingCommentReport.comment_id == comment.id,
            RecordingCommentReport.reporter_key == reporter_key,
        )
    )
    if already is not None:
        return False
    session.add(
        RecordingCommentReport(
            comment_id=comment.id,
            reporter_key=reporter_key,
            reporter_id=reporter_id,
            reason=reason,
            note=one_line(note, 1000) or None,
        )
    )
    comment.reports_count = (comment.reports_count or 0) + 1
    await session.commit()
    return True


async def remove_by_team(
    session: AsyncSession, comment: RecordingComment, *, reason: str, by: str
) -> None:
    comment.status = "removed"
    comment.removed_reason = one_line(reason, 500) or None
    comment.removed_at = now_utc()
    comment.removed_by = team_removed_by(by)
    await session.commit()


async def delete_by_author(session: AsyncSession, comment: RecordingComment) -> bool:
    """The author deletes their own comment. False when there is nothing to delete (already done).

    The text goes at once and readers see a tombstone (no text, no author), and the row stays marked
    removed: it still counts toward the daily allowance (QA-009). A comment the TEAM already
    removed is left exactly as it is, text and reason included.
    """
    if comment.status == "removed":
        return comment.removed_by != AUTHOR_DELETED_BY
    comment.status = "removed"
    comment.body = AUTHOR_DELETED_BODY
    comment.removed_reason = None
    comment.removed_at = now_utc()
    comment.removed_by = AUTHOR_DELETED_BY
    await session.commit()
    return True


async def reported_queue(
    session: AsyncSession, *, limit: int, offset: int
) -> tuple[list[tuple[RecordingComment, UserAccount | None]], int]:
    """Published comments somebody reported, most reported first (the team's daily list)."""
    condition: tuple[Any, ...] = (
        RecordingComment.status == "published",
        RecordingComment.reports_count > 0,
    )
    total = await session.scalar(
        select(func.count()).select_from(RecordingComment).where(*condition)
    )
    rows = (
        await session.execute(
            select(RecordingComment, UserAccount)
            .join(UserAccount, UserAccount.id == RecordingComment.member_id, isouter=True)
            .where(*condition)
            .order_by(RecordingComment.reports_count.desc(), RecordingComment.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
    ).all()
    return [(c, a) for c, a in rows], int(total or 0)
