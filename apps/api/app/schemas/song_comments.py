"""Request and response shapes of the song comments (docs: apps/mobile/docs/song-comments.md).

`SongCommentOut` is the PUBLIC shape. It has no member id, no email and, for an anonymous comment,
no name and no avatar: `author` is null. Keep it that way; a test walks the whole JSON.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.song_comments import COMMENT_MAX_LENGTH

CommentReportReason = Literal["offensive", "spam", "private", "other"]


class SongCommentCreate(BaseModel):
    body: str = Field(min_length=1, max_length=COMMENT_MAX_LENGTH)
    is_anonymous: bool = False
    # Set to answer a comment. It may be a top-level comment or a reply; the new comment is attached
    # to the top-level one either way (one level of replies).
    parent_id: UUID | None = None


class CommentAuthor(BaseModel):
    name: str
    avatar_url: str | None = None


class ReplyTo(BaseModel):
    """Who a reply answers, shown as "to Name" when it answers another reply. `name` is null for an
    anonymous comment (never a name, whoever asks); `deleted` when that reply is gone."""

    name: str | None = None
    deleted: bool = False


class SongCommentOut(BaseModel):
    id: str
    song_id: int
    body: str
    created_at: datetime
    is_anonymous: bool
    # null for an anonymous comment, whoever asks
    author: CommentAuthor | None
    # true only for the signed-in author asking about their own comment (so they can delete it)
    mine: bool = False
    # true for the team (any comment can be removed)
    can_remove: bool = False
    # True for the line an author's own delete leaves behind (a top-level comment): no text, no
    # author, nothing to act on. Its replies stay under it.
    deleted: bool = False
    # Replies: `parent_id` is the top-level comment a reply hangs under; `reply_to` is set when a
    # reply answers another reply; `reply_count` and `replies` (oldest first) are on a top-level
    # comment.
    parent_id: str | None = None
    reply_to: ReplyTo | None = None
    reply_count: int = 0
    replies: list[SongCommentOut] = Field(default_factory=list)


class SongCommentList(BaseModel):
    items: list[SongCommentOut]
    # the top-level entries the list pages through (tombstones included); drives `has_more`
    total: int
    # the comments people can read, replies included: the number to show
    live_total: int = 0
    limit: int
    offset: int
    has_more: bool


class CommentReportCreate(BaseModel):
    reason: CommentReportReason
    note: str | None = Field(default=None, max_length=1000)


class CommentReportResponse(BaseModel):
    status: Literal["received", "already_reported"]
    message: str


class CommentRemoveRequest(BaseModel):
    reason: str = Field(default="", max_length=500)


class AdminSongCommentOut(BaseModel):
    """For the team only: the author is visible here, also for an anonymous comment."""

    id: str
    song_id: int
    body: str
    created_at: datetime
    is_anonymous: bool
    status: Literal["published", "removed"]
    reports_count: int
    author_id: UUID
    author_name: str
    removed_reason: str | None = None
    # set for a reply: the top-level comment it hangs under
    parent_id: str | None = None


class AdminSongCommentList(BaseModel):
    items: list[AdminSongCommentOut]
    total: int


SongCommentOut.model_rebuild()
