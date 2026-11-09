"""Comments under a recording: posting, reading, reporting, removal (docs/recording-extras.md).

The same model and the same text rules as the comments under a Prabhat Samgiita song
(`services/song_comments.py`): publish first, review after; members post, anyone may report, the
team removes with a reason, the author can delete their own comment. The text functions, the
anti-flood rule and the limits are the song comments' own, imported, so a fix in one reaches both.
Replies are `services/comment_threads.py`, shared with the song comments.

The one rule that must not break: a PUBLIC view of an anonymous comment carries no trace of its
author (see `public_out`). Everything that knows the author is `admin_out` and team-only.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import UserAccount
from app.models.recording_extras import RecordingComment, RecordingCommentReport
from app.schemas.recording_extras import AdminRecordingCommentOut, RecordingCommentOut
from app.services import comment_threads as threads
from app.services import song_comments as base
from app.services.extras_common import display_name, one_line
from app.services.recordings import now_utc
from app.services.song_comments import (
    AUTHOR_DELETED_BODY,
    AUTHOR_DELETED_BY,
    FALLBACK_NAME,
    POSTS_PER_MINUTE,
    POSTS_PER_MINUTE_TEAM,
    check_flood,
    limiter,
    team_removed_by,
    validate_body,
)

__all__ = [
    "AUTHOR_DELETED_BODY",
    "AUTHOR_DELETED_BY",
    "POSTS_PER_MINUTE",
    "POSTS_PER_MINUTE_TEAM",
    "check_flood",
    "limiter",
    "validate_body",
]


def is_tombstone(comment: RecordingComment) -> bool:
    """The author deleted a top-level comment: the row stays and readers see a bare line."""
    return threads.is_tombstone(comment)


def public_out(
    comment: RecordingComment,
    author: UserAccount | None,
    *,
    viewer_id: UUID | None,
    team: bool,
    page: threads.ThreadPage | None = None,
) -> RecordingCommentOut:
    """What every reader gets. `author` is filled only for a NAMED comment. A top-level comment its
    author deleted comes back as a tombstone: `deleted`, no text, no author, nothing to act on, and
    its replies stay under it. `page` carries a top-level comment's replies."""
    return threads.render(
        RecordingCommentOut,
        comment,
        author,
        viewer_id=viewer_id,
        team=team,
        target={"recording_id": str(comment.recording_id)},
        page=page,
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
        author_name=(
            display_name(author) if author is not None else comment.author_name or FALLBACK_NAME
        ),
        removed_reason=comment.removed_reason,
        parent_id=str(comment.parent_id) if comment.parent_id else None,
    )


def _scope(recording_id: UUID) -> tuple[Any, ...]:
    return (RecordingComment.recording_id == recording_id,)


async def list_threads(
    session: AsyncSession, recording_id: UUID, *, limit: int, offset: int
) -> threads.ThreadPage:
    """One page of the recording's top-level comments (tombstones included), newest first, each with
    its replies, and the two counts (see `comment_threads`)."""
    return await threads.list_threads(
        session, RecordingComment, _scope(recording_id), limit=limit, offset=offset
    )


async def shared_before(
    session: AsyncSession,
    member_id: UUID,
    recording_id: UUID,
    body: str,
    parent_id: UUID | None = None,
) -> bool:
    """Has this member already published the same comment on this recording (in the same
    conversation, for a reply)?"""
    key = base.same_text_key(body)
    earlier = await session.scalars(
        select(RecordingComment.body).where(
            RecordingComment.member_id == member_id,
            RecordingComment.recording_id == recording_id,
            RecordingComment.status == "published",
            RecordingComment.parent_id.is_(None)
            if parent_id is None
            else RecordingComment.parent_id == parent_id,
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
    team: bool = False,
    parent_id: UUID | None = None,
) -> RecordingComment:
    body = validate_body(body)
    top_id: UUID | None = None
    reply_to_id: UUID | None = None
    if parent_id is not None:
        top_id, reply_to_id = await threads.resolve_parent(
            session, RecordingComment, _scope(recording_id), parent_id
        )
    check_flood(member.id, team=team)
    if await shared_before(session, member.id, recording_id, body, top_id):
        raise HTTPException(status_code=409, detail="You already shared this comment.")
    comment = RecordingComment(
        recording_id=recording_id,
        member_id=member.id,
        body=body,
        is_anonymous=is_anonymous,
        parent_id=top_id,
        reply_to_id=reply_to_id,
    )
    session.add(comment)
    if top_id is not None:
        await threads.add_reply_notice(
            session,
            RecordingComment,
            comment,
            member,
            target={"recording_id": str(recording_id)},
            recording_id=recording_id,
        )
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

    The text goes at once. A top-level comment leaves a tombstone (no text, no author) with its
    replies under it; a reply just disappears. A comment the TEAM already removed is left exactly as
    it is, text and reason included.
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


async def keep(session: AsyncSession, comment: RecordingComment) -> None:
    """The team looked at the reports and the comment stays: the reports leave the queue."""
    comment.reports_count = 0
    await session.commit()


async def restore(session: AsyncSession, comment: RecordingComment) -> None:
    """A comment the team removed is published again (a mistake). An author's own delete stays."""
    if comment.status != "removed" or comment.removed_by == AUTHOR_DELETED_BY:
        raise HTTPException(
            status_code=409, detail="Only a comment the team removed can be restored."
        )
    comment.status = "published"
    comment.removed_reason = None
    comment.removed_at = None
    comment.removed_by = None
    comment.reports_count = 0
    await session.commit()


async def review_queue(
    session: AsyncSession, *, which: str, limit: int, offset: int
) -> tuple[list[tuple[RecordingComment, UserAccount | None]], int]:
    """The team's list: `reported` = live comments somebody reported, most reported first;
    `removed` = comments the team took down (to restore one). An author's own delete is not for the
    team to read."""
    condition: tuple[Any, ...] = (
        (RecordingComment.status == "removed", RecordingComment.removed_by != AUTHOR_DELETED_BY)
        if which == "removed"
        else (RecordingComment.status == "published", RecordingComment.reports_count > 0)
    )
    order = (
        (RecordingComment.removed_at.desc(),)
        if which == "removed"
        else (RecordingComment.reports_count.desc(), RecordingComment.created_at.desc())
    )
    total = await session.scalar(
        select(func.count()).select_from(RecordingComment).where(*condition)
    )
    rows = (
        await session.execute(
            select(RecordingComment, UserAccount)
            .join(UserAccount, UserAccount.id == RecordingComment.member_id, isouter=True)
            .where(*condition)
            .order_by(*order)
            .limit(limit)
            .offset(offset)
        )
    ).all()
    return [(c, a) for c, a in rows], int(total or 0)


async def reported_queue(
    session: AsyncSession, *, limit: int, offset: int
) -> tuple[list[tuple[RecordingComment, UserAccount | None]], int]:
    """Live comments somebody reported, most reported first (the team's daily list)."""
    return await review_queue(session, which="reported", limit=limit, offset=offset)
