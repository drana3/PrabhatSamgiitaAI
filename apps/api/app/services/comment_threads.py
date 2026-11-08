"""Replies under comments: one level, for the song comments and the recording comments alike.

A top-level comment has no `parent_id`. A reply has the top-level comment's id as `parent_id`; when
it answers another reply, `reply_to_id` is that reply (the app shows "to Name"), so a reply to a
reply is still attached to the same top-level comment. Replying to a reply never makes a third
level.

What readers see (docs/comment-replies.md):

* the list pages through the TOP-LEVEL entries (`total` counts them, tombstones included), each
  carrying its replies, oldest first;
* `live_total` is the number of comments a person can read: live top-level comments plus live
  replies whose top-level comment is still on the list. It is the number to show;
* a top-level comment its author deleted stays as a tombstone with its replies under it. A reply its
  author deletes just goes. A top-level comment the team removed takes its replies out of sight.

The functions take the model and a scope (the target's conditions), so both comment tables use them.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass, field
from typing import Any
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.models import MemberNotice, UserAccount
from app.schemas.song_comments import CommentAuthor, ReplyTo
from app.services.song_comments import AUTHOR_DELETED_BY, FALLBACK_NAME, display_name

# A conversation holds at most this many live replies. The next one is refused (409).
THREAD_MAX_REPLIES = 50
THREAD_FULL_CODE = "comment_thread_full"

# The notice a member gets when somebody answers their comment (docs/comment-replies.md).
REPLY_NOTICE_KIND = "comment_reply"
ANONYMOUS_REPLIER = "Someone"

Row = tuple[Any, UserAccount | None]


@dataclass
class ThreadPage:
    tops: list[Row]
    replies: dict[UUID, list[Row]] = field(default_factory=dict)
    # reply id -> the comment (and its author) that reply answers, for "to Name"
    answered: dict[UUID, Row] = field(default_factory=dict)
    total: int = 0
    live_total: int = 0


def is_tombstone(comment: Any) -> bool:
    """A top-level comment its author deleted: the row stays, readers see a bare line."""
    return (
        comment.parent_id is None
        and comment.status == "removed"
        and comment.removed_by == AUTHOR_DELETED_BY
    )


def _top_visible(model: Any) -> Any:
    return and_(
        model.parent_id.is_(None),
        or_(
            model.status == "published",
            and_(model.status == "removed", model.removed_by == AUTHOR_DELETED_BY),
        ),
    )


async def list_threads(
    session: AsyncSession, model: Any, scope: Sequence[Any], *, limit: int, offset: int
) -> ThreadPage:
    """One page of top-level entries with all their live replies, and the two counts."""
    visible = (*scope, _top_visible(model))
    total = int(await session.scalar(select(func.count()).select_from(model).where(*visible)) or 0)
    tops = [
        (c, a)
        for c, a in (
            await session.execute(
                select(model, UserAccount)
                .join(UserAccount, UserAccount.id == model.member_id, isouter=True)
                .where(*visible)
                .order_by(model.created_at.desc(), model.id.desc())
                .limit(limit)
                .offset(offset)
            )
        ).all()
    ]
    page = ThreadPage(tops=tops, total=total)
    ids = [c.id for c, _ in tops]
    if ids:
        for c, a in (
            await session.execute(
                select(model, UserAccount)
                .join(UserAccount, UserAccount.id == model.member_id, isouter=True)
                .where(model.parent_id.in_(ids), model.status == "published")
                .order_by(model.created_at.asc(), model.id.asc())
            )
        ).all():
            page.replies.setdefault(c.parent_id, []).append((c, a))
        wanted = {r.reply_to_id for rows in page.replies.values() for r, _ in rows if r.reply_to_id}
        if wanted:
            for c, a in (
                await session.execute(
                    select(model, UserAccount)
                    .join(UserAccount, UserAccount.id == model.member_id, isouter=True)
                    .where(model.id.in_(wanted))
                )
            ).all():
                page.answered[c.id] = (c, a)
    page.live_total = await live_count(session, model, scope)
    return page


async def live_count(session: AsyncSession, model: Any, scope: Sequence[Any]) -> int:
    """Comments people can read: live top-level comments, and live replies under a top-level comment
    that is on the list (live or a tombstone)."""
    live_tops = await session.scalar(
        select(func.count())
        .select_from(model)
        .where(*scope, model.parent_id.is_(None), model.status == "published")
    )
    parent = aliased(model)
    replies = await session.scalar(
        select(func.count())
        .select_from(model)
        .join(parent, parent.id == model.parent_id)
        .where(
            *scope,
            model.status == "published",
            or_(
                parent.status == "published",
                and_(parent.status == "removed", parent.removed_by == AUTHOR_DELETED_BY),
            ),
        )
    )
    return int(live_tops or 0) + int(replies or 0)


async def resolve_parent(
    session: AsyncSession, model: Any, scope: Sequence[Any], parent_id: UUID
) -> tuple[UUID, UUID | None]:
    """The top-level comment a new reply hangs under and the reply it answers (None when it answers
    the top-level comment itself). 404 when the comment is not here, not on this target or not live;
    409 when the conversation is full."""
    gone = HTTPException(status_code=404, detail="Comment not found")
    answered = await session.scalar(select(model).where(*scope, model.id == parent_id))
    if answered is None or answered.status != "published":
        raise gone
    if answered.parent_id is None:
        top, reply_to = answered, None
    else:
        top = await session.scalar(select(model).where(*scope, model.id == answered.parent_id))
        reply_to = answered.id
    if top is None or top.status != "published":
        raise gone
    count = await session.scalar(
        select(func.count())
        .select_from(model)
        .where(model.parent_id == top.id, model.status == "published")
    )
    if int(count or 0) >= THREAD_MAX_REPLIES:
        raise HTTPException(
            status_code=409,
            detail=f"This conversation already has {THREAD_MAX_REPLIES} replies.",
            headers={"X-Error-Code": THREAD_FULL_CODE},
        )
    return top.id, reply_to


async def page_for_new(session: AsyncSession, model: Any, comment: Any) -> ThreadPage:
    """What `render` needs to say "to Name" for a reply that was just posted."""
    page = ThreadPage(tops=[])
    if comment.reply_to_id is not None:
        row = (
            await session.execute(
                select(model, UserAccount)
                .join(UserAccount, UserAccount.id == model.member_id, isouter=True)
                .where(model.id == comment.reply_to_id)
            )
        ).first()
        if row is not None:
            page.answered[row[0].id] = (row[0], row[1])
    return page


def reply_to_of(comment: Any, answered: dict[UUID, Row]) -> ReplyTo | None:
    """ "to Name" for a reply that answers another reply. An anonymous reply is never named."""
    if comment.reply_to_id is None:
        return None
    row = answered.get(comment.reply_to_id)
    if row is None or row[0].status != "published":
        return ReplyTo(deleted=True)
    target, author = row
    if target.is_anonymous or author is None:
        return ReplyTo()
    return ReplyTo(name=display_name(author))


async def add_reply_notice(
    session: AsyncSession,
    model: Any,
    comment: Any,
    replier: UserAccount,
    *,
    target: dict[str, Any],
    recording_id: UUID | None = None,
) -> MemberNotice | None:
    """Tell the author of the comment that was answered. Added to the session, committed with the
    reply.

    The one who is told is the author of the comment the reply answers (the top-level comment, or
    the reply it answers). Nobody is told about an answer to themselves, or about a comment that is
    gone. An anonymous reply never carries its author's name: the notice says "Someone". The text
    is the default English; the phone writes its own words from the payload."""
    if comment.parent_id is None:
        return None
    addressed = await session.get(model, comment.reply_to_id or comment.parent_id)
    if (
        addressed is None
        or addressed.status != "published"
        or addressed.member_id == comment.member_id
    ):
        return None
    name = None if comment.is_anonymous else display_name(replier)
    await session.flush()  # the reply's id is needed for the payload
    notice = MemberNotice(
        user_id=addressed.member_id,
        kind=REPLY_NOTICE_KIND,
        recording_id=recording_id,
        title="New reply",
        body=f"{name or ANONYMOUS_REPLIER} replied to your comment.",
        payload={
            **target,
            "parent_id": str(comment.parent_id),
            "comment_id": str(comment.id),
            "answered_id": str(addressed.id),
            "from_name": name,
        },
    )
    session.add(notice)
    return notice


def render(
    out_cls: type[Any],
    comment: Any,
    author: UserAccount | None,
    *,
    viewer_id: UUID | None,
    team: bool,
    target: dict[str, Any],
    page: ThreadPage | None = None,
) -> Any:
    """The public shape of one comment (a top-level comment with its replies when `page` is given).

    The one rule that must not break: an anonymous comment carries no trace of its author, and a
    tombstone carries no text, no author and nothing to act on. `target` is the `song_id` or
    `recording_id` field of the shape."""
    answered = page.answered if page else {}
    if is_tombstone(comment):
        shown, body, anonymous, mine, can_remove, deleted = None, "", True, False, False, True
    else:
        shown = None
        if not comment.is_anonymous and author is not None:
            shown = CommentAuthor(name=display_name(author), avatar_url=author.avatar_url)
        body, anonymous, deleted = comment.body, comment.is_anonymous, False
        mine = viewer_id is not None and comment.member_id == viewer_id
        can_remove = team
    replies = [
        render(out_cls, r, a, viewer_id=viewer_id, team=team, target=target, page=page)
        for r, a in (page.replies.get(comment.id, []) if page else [])
    ]
    return out_cls(
        id=str(comment.id),
        body=body,
        created_at=comment.created_at,
        is_anonymous=anonymous,
        author=shown,
        mine=mine,
        can_remove=can_remove,
        deleted=deleted,
        parent_id=str(comment.parent_id) if comment.parent_id else None,
        reply_to=reply_to_of(comment, answered),
        reply_count=len(replies),
        replies=replies,
        **target,
    )


__all__ = [
    "ANONYMOUS_REPLIER",
    "FALLBACK_NAME",
    "REPLY_NOTICE_KIND",
    "THREAD_FULL_CODE",
    "THREAD_MAX_REPLIES",
    "ThreadPage",
    "add_reply_notice",
    "is_tombstone",
    "list_threads",
    "page_for_new",
    "live_count",
    "render",
    "resolve_parent",
]
