"""Song comments: posting, reading, reporting, removal (apps/mobile/docs/song-comments.md).

Same model as the Kiirtan recordings: publish first, review after. Members post; anyone may report;
the team removes with a reason; the author can delete their own comment for good.

The one rule that must not break: a PUBLIC view of an anonymous comment carries no trace of its
author (see `public_out`). Everything that knows the author is `admin_out` and team-only.
"""

from __future__ import annotations

import re
import unicodedata
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
from app.services.invisible_text import strip_invisible  # noqa: F401  (also imported from here)
from app.services.recordings import RateLimiter, clean_text, now_utc

DAILY_COMMENTS = 20
HOURLY_COMMENTS = 10
HOURLY_COMMENTS_TEAM = 120
MAX_LINKS = 2
DAILY_LIMIT_CODE = "comment_daily_limit"
FALLBACK_NAME = "Member"

# The in-process limiter keeps its counts in this API process only (see
# apps/mobile/docs/song-comments.md, "Limits that are only as strong as one process"): a restart
# empties it and several instances do not share it. The daily allowance is the strong one: it is
# counted from rows in the database.
limiter = RateLimiter()

# What the author's own delete leaves behind: the row stays (so the daily allowance is not given
# back and the team keeps who and when), the text is replaced, nobody sees it. `removed_by` says
# the author did it.
AUTHOR_DELETED_BY = "author"
AUTHOR_DELETED_BODY = "[deleted by the author]"

_LINK = re.compile(r"(?:https?://|www\.)", re.IGNORECASE)
_LINK_TOKEN = re.compile(r"(?:https?://|www\.)[^\s,;<>\"')\]]*", re.IGNORECASE)
# A bare address such as `example.com` or `shop.example.org/page` is a link too. Only well-known
# endings are matched, so ordinary writing such as "yes.No" or "end.Next" is never taken for one; an
# e-mail address is not a link.
_BARE_TLDS = (
    "com|org|net|edu|gov|info|biz|io|co|app|dev|xyz|online|site|link|shop|store|blog|club|live|"
    "tv|ly|"
    "uk|de|fr|ru|ua|pl|nl|ch|cz|se|jp|cn|br|au|nz|ai"
)
_BARE_LINK = re.compile(
    rf"(?<![\w@./-])(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+(?:{_BARE_TLDS})(?![\w@-])(?!\.[a-z0-9])",
    re.IGNORECASE,
)
_CONTROL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


def check_song(song_id: int) -> int:
    if not 1 <= song_id <= PS_SONG_COUNT:
        raise HTTPException(status_code=422, detail="Unknown song number.")
    return song_id


def clean_body(raw: str) -> str:
    """Trim, drop control and invisible characters, keep line breaks (one blank line at most)."""
    text = _CONTROL.sub("", strip_invisible(raw).replace("\r\n", "\n").replace("\r", "\n"))
    lines = [" ".join(line.split()) for line in text.split("\n")]
    text = "\n".join(lines).strip()
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text[:COMMENT_MAX_LENGTH]


def link_count(body: str) -> int:
    """Links in a comment: `https://...`, `www....` and bare addresses such as `example.com`."""
    with_scheme = len(_LINK.findall(body))
    bare = len(_BARE_LINK.findall(_LINK_TOKEN.sub(" ", body)))
    return with_scheme + bare


def same_text_key(body: str) -> str:
    """What "the same comment" means: letters, marks and digits only, one case, one Unicode form.
    "Hello", "hello!" and "H e l l o" are the same; "क" and "कि" are not (marks are kept)."""
    folded = unicodedata.normalize("NFKC", strip_invisible(body)).casefold()
    return "".join(c for c in folded if unicodedata.category(c)[0] in "LMN")


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
    if link_count(body) > MAX_LINKS:
        raise HTTPException(status_code=422, detail="Please use at most two links in a comment.")
    return body


async def shared_before(session: AsyncSession, member_id: UUID, song_id: int, body: str) -> bool:
    """Has this member already published the same comment on this song (see `same_text_key`)?"""
    key = same_text_key(body)
    earlier = await session.scalars(
        select(SongComment.body).where(
            SongComment.member_id == member_id,
            SongComment.song_id == song_id,
            SongComment.status == "published",
        )
    )
    return any(same_text_key(text) == key for text in earlier)


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
    if await shared_before(session, member.id, song_id, body):
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


async def delete_by_author(session: AsyncSession, comment: SongComment) -> bool:
    """The author deletes their own comment. False when there is nothing to delete (already done).

    The text goes at once (it is replaced) and the comment disappears for every reader, but the row
    stays, marked removed: it still counts toward the author's daily allowance (deleting and posting
    again is not a way around the limit). A comment the TEAM already removed is left exactly as it
    is, text and reason included: the team keeps it for the record, and the author asking to delete
    it changes nothing (the answer is the same).
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
