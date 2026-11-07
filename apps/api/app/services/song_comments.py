"""Song comments: posting, reading, reporting, removal (apps/mobile/docs/song-comments.md).

Same model as the Kiirtan recordings: publish first, review after. Members post; anyone may report;
the team removes with a reason; the author can delete their own comment for good.

The one rule that must not break: a PUBLIC view of an anonymous comment carries no trace of its
author (see `public_out`). Everything that knows the author is `admin_out` and team-only.
"""

from __future__ import annotations

import re
import unicodedata
from typing import Any
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import UserAccount
from app.models.recordings import PS_SONG_COUNT
from app.models.song_comments import COMMENT_MAX_LENGTH, SongComment, SongCommentReport
from app.schemas.song_comments import AdminSongCommentOut, SongCommentOut
from app.services.invisible_text import strip_invisible  # noqa: F401  (also imported from here)
from app.services.recordings import RateLimiter, clean_text, now_utc

# The one anti-flood rule of the comments (songs, recordings and replies together): at most this
# many posts per member in any 60 seconds. There is no daily limit.
POSTS_PER_MINUTE = 5
POSTS_PER_MINUTE_TEAM = 30
MAX_LINKS = 2
FALLBACK_NAME = "Member"

# The in-process limiter keeps its counts in this API process only (see
# apps/mobile/docs/song-comments.md, "Limits that are only as strong as one process"): a restart
# empties it and several instances do not share it. It stops a script, not a botnet.
limiter = RateLimiter()


def check_flood(member_id: UUID, *, team: bool) -> None:
    """429 when this member posted too often in the last minute (a comment, a reply, on a song or a
    recording: one shared count). Call it AFTER the text was validated, so a refused post costs
    nothing."""
    limiter.hit(
        "post",
        str(member_id),
        limit=POSTS_PER_MINUTE_TEAM if team else POSTS_PER_MINUTE,
        window_seconds=60,
    )


# What the author's own delete leaves behind: the row stays (the team keeps who and when) and the
# text is replaced. `removed_by` says the author did it. The marker starts with a control
# character, which `team_removed_by` strips from every name a team removal records, so no display
# name (however it was chosen) can ever equal it: a team removal can never pass for an author
# delete (QA-056, QA-059).
AUTHOR_DELETED_BY = "\x1fauthor"
AUTHOR_DELETED_BODY = "[deleted by the author]"
_NAME_CONTROL = re.compile(r"[\x00-\x1f\x7f]")


def team_removed_by(name: str | None, fallback: str = "team") -> str:
    """The `removed_by` of a team removal: the member's name, never equal to the author marker."""
    return _NAME_CONTROL.sub("", name or "").strip()[:255] or fallback


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
    page: Any = None,
) -> SongCommentOut:
    """What every reader gets. `author` is filled only for a NAMED comment; a comment its author
    deleted is a tombstone (no text, no author). `page` carries a top-level comment's replies."""
    from app.services import comment_threads as threads

    return threads.render(
        SongCommentOut,
        comment,
        author,
        viewer_id=viewer_id,
        team=team,
        target={"song_id": comment.song_id},
        page=page,
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
        parent_id=str(comment.parent_id) if comment.parent_id else None,
    )


async def list_threads(session: AsyncSession, song_id: int, *, limit: int, offset: int) -> Any:
    """One page of the song's top-level comments (tombstones included), newest first, each with its
    replies, and the two counts (see `comment_threads`)."""
    from app.services import comment_threads as threads

    return await threads.list_threads(
        session, SongComment, (SongComment.song_id == song_id,), limit=limit, offset=offset
    )


def validate_body(raw: str) -> str:
    body = clean_body(raw)
    if not body:
        raise HTTPException(status_code=422, detail="Write something before posting.")
    if link_count(body) > MAX_LINKS:
        raise HTTPException(status_code=422, detail="Please use at most two links in a comment.")
    return body


async def shared_before(
    session: AsyncSession, member_id: UUID, song_id: int, body: str, parent_id: UUID | None = None
) -> bool:
    """Has this member already published the same comment on this song (see `same_text_key`)?
    A reply
    is only compared with the replies of the same conversation, so "Thank you" can be said twice."""
    key = same_text_key(body)
    earlier = await session.scalars(
        select(SongComment.body).where(
            SongComment.member_id == member_id,
            SongComment.song_id == song_id,
            SongComment.status == "published",
            SongComment.parent_id.is_(None)
            if parent_id is None
            else SongComment.parent_id == parent_id,
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
    team: bool = False,
    parent_id: UUID | None = None,
) -> SongComment:
    from app.services import comment_threads as threads

    body = validate_body(body)
    top_id: UUID | None = None
    reply_to_id: UUID | None = None
    if parent_id is not None:
        top_id, reply_to_id = await threads.resolve_parent(
            session, SongComment, (SongComment.song_id == song_id,), parent_id
        )
    check_flood(member.id, team=team)
    if await shared_before(session, member.id, song_id, body, top_id):
        raise HTTPException(status_code=409, detail="You already shared this comment.")
    comment = SongComment(
        song_id=song_id,
        member_id=member.id,
        body=body,
        is_anonymous=is_anonymous,
        parent_id=top_id,
        reply_to_id=reply_to_id,
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
    comment.removed_by = team_removed_by(by)
    await session.commit()


async def delete_by_author(session: AsyncSession, comment: SongComment) -> bool:
    """The author deletes their own comment. False when there is nothing to delete (already done).

    The text goes at once (it is replaced). A top-level comment leaves a tombstone with its replies
    under it; a reply just disappears. A comment the TEAM already removed is left exactly as it is,
    text and reason included: the team keeps it for the record, and the author asking to delete it
    changes nothing (the answer is the same).
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


async def keep(session: AsyncSession, comment: SongComment) -> None:
    """The team looked at the reports and the comment stays: the reports leave the queue."""
    comment.reports_count = 0
    await session.commit()


async def restore(session: AsyncSession, comment: SongComment) -> None:
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
) -> tuple[list[tuple[SongComment, UserAccount | None]], int]:
    """The team's list: `reported` = live comments somebody reported, most reported first;
    `removed` = comments the team took down (to restore one). An author's own delete is not for the
    team to read."""
    condition: tuple[Any, ...] = (
        (SongComment.status == "removed", SongComment.removed_by != AUTHOR_DELETED_BY)
        if which == "removed"
        else (SongComment.status == "published", SongComment.reports_count > 0)
    )
    order = (
        (SongComment.removed_at.desc(),)
        if which == "removed"
        else (SongComment.reports_count.desc(), SongComment.created_at.desc())
    )
    total = await session.scalar(select(func.count()).select_from(SongComment).where(*condition))
    rows = (
        await session.execute(
            select(SongComment, UserAccount)
            .join(UserAccount, UserAccount.id == SongComment.member_id, isouter=True)
            .where(*condition)
            .order_by(*order)
            .limit(limit)
            .offset(offset)
        )
    ).all()
    return [(c, a) for c, a in rows], int(total or 0)


async def reported_queue(
    session: AsyncSession, *, limit: int, offset: int
) -> tuple[list[tuple[SongComment, UserAccount | None]], int]:
    """Published comments somebody reported, most reported first (the team's daily list)."""
    return await review_queue(session, which="reported", limit=limit, offset=offset)
