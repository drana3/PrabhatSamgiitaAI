"""Comments of members on one Prabhat Samgiita song (the end of the song page).

A comment is `published` the moment it is posted (publish first, review after, like recordings).
The team marks it `removed` with a reason; the author may delete their own comment for good.

Anonymity: `is_anonymous` is only a display choice for OTHER members. The account is always kept
in `member_id` (the team needs it to deal with abuse and the author needs it to delete their own
comment). The public API never sends `member_id`, a name or an avatar for an anonymous comment.
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin
from app.models.recordings import PS_SONG_COUNT

COMMENT_STATUSES = ("published", "removed")
COMMENT_MAX_LENGTH = 2000
COMMENT_REPORT_REASONS = ("offensive", "spam", "private", "other")


class SongComment(Base, TimestampMixin):
    __tablename__ = "song_comments"
    __table_args__ = (
        CheckConstraint(
            f"song_id >= 1 AND song_id <= {PS_SONG_COUNT}", name="ck_song_comments_song"
        ),
        CheckConstraint("status IN ('published', 'removed')", name="ck_song_comments_status"),
        CheckConstraint(
            f"length(body) >= 1 AND length(body) <= {COMMENT_MAX_LENGTH}",
            name="ck_song_comments_body",
        ),
        Index("ix_song_comments_song_status_created", "song_id", "status", "created_at"),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    song_id: Mapped[int] = mapped_column(Integer, nullable=False)
    member_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("user_accounts.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)
    is_anonymous: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false", nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(16), default="published", server_default="published", nullable=False
    )
    reports_count: Mapped[int] = mapped_column(
        Integer, default=0, server_default="0", nullable=False
    )
    removed_reason: Mapped[str | None] = mapped_column(Text)
    removed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    removed_by: Mapped[str | None] = mapped_column(String(255))


class SongCommentReport(Base, TimestampMixin):
    """One report of one comment by one reporter (a member, or an anonymous device bucket)."""

    __tablename__ = "song_comment_reports"
    __table_args__ = (
        UniqueConstraint("comment_id", "reporter_key", name="uq_song_comment_reports_once"),
        CheckConstraint(
            "reason IN ('offensive', 'spam', 'private', 'other')",
            name="ck_song_comment_reports_reason",
        ),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    comment_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("song_comments.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    reporter_key: Mapped[str] = mapped_column(String(80), nullable=False)
    reporter_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("user_accounts.id", ondelete="SET NULL"), nullable=True
    )
    reason: Mapped[str] = mapped_column(String(16), nullable=False)
    note: Mapped[str | None] = mapped_column(Text)
