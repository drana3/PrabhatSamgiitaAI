"""What members add around a recording or a song: comments, chord sheets and video links.

Design, limits and what is not built: docs/recording-extras.md.

Three features, each with its own table (nothing existing is changed):

* `recording_comments` (+ reports): the same model as `song_comments`, aimed at a recording instead
  of a Prabhat Samgiita song number. Published at once; the team removes; the author deletes.
* `recording_chord_sheets` (+ reports): a plain-text chord chart of a recording, for the guitar or
  the harmonium. A recording has no lyrics in the app to align chords to, so this is NOT the
  word-indexed
  `song_chord_proposals` shape. Reviewed the same way: a team member's sheet is live at once,
  everybody else's waits as `pending`.
* `video_links` (+ reports): a link to a video on an allow-listed site (YouTube, Vimeo, the Internet
  Archive), attached to a recording OR to a Prabhat Samgiita song. Nothing is downloaded.

Anonymity is a display choice for OTHER members only. The account is always kept in `member_id` (the
team needs it to deal with abuse, the author needs it to delete their own item); the public shapes
never carry an id, a name or an avatar for an anonymous item.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any
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
    text,
)
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin
from app.models.recordings import PS_SONG_COUNT, PortableJSON

# ---------------------------------------------------------------------------------- comments

RECORDING_COMMENT_MAX_LENGTH = 2000

# ---------------------------------------------------------------------------------- chords

SHEET_INSTRUMENTS = ("guitar", "harmonium")
SHEET_STATUSES = ("pending", "published", "rejected")
SHEET_REPORT_REASONS = ("wrong_chords", "offensive", "spam", "other")
SHEET_TEXT_MAX_LENGTH = 8000
SHEET_MAX_LINES = 250
SHEET_MAX_LINE_LENGTH = 120

# ---------------------------------------------------------------------------------- videos

VIDEO_PROVIDERS = ("youtube", "vimeo", "archive")
VIDEO_STATUSES = ("published", "removed")
VIDEO_REPORT_REASONS = ("broken", "not_about_this", "offensive", "spam", "other")
VIDEO_TITLE_MAX_LENGTH = 80
VIDEO_URL_MAX_LENGTH = 300
# What the last automatic look at a link found (services/video_checks.py). A soft hint, never a
# block.
VIDEO_LINK_STATUSES = ("unknown", "ok", "no_embed", "unavailable")


class RecordingComment(Base, TimestampMixin):
    __tablename__ = "recording_comments"
    __table_args__ = (
        CheckConstraint("status IN ('published', 'removed')", name="ck_recording_comments_status"),
        CheckConstraint(
            f"length(body) >= 1 AND length(body) <= {RECORDING_COMMENT_MAX_LENGTH}",
            name="ck_recording_comments_body",
        ),
        Index(
            "ix_recording_comments_recording_status_created",
            "recording_id",
            "status",
            "created_at",
        ),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    recording_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("recordings.id", ondelete="CASCADE"),
        nullable=False,
    )
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
    # One level of replies. `parent_id` is the top-level comment a reply hangs under (null for a
    # top-level comment). `reply_to_id` is the reply it answers when it answers a reply, so the app
    # can say "to Name".
    parent_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("recording_comments.id", ondelete="CASCADE"),
        index=True,
        nullable=True,
    )
    reply_to_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("recording_comments.id", ondelete="SET NULL"),
        nullable=True,
    )


class RecordingCommentReport(Base, TimestampMixin):
    __tablename__ = "recording_comment_reports"
    __table_args__ = (
        UniqueConstraint("comment_id", "reporter_key", name="uq_recording_comment_reports_once"),
        CheckConstraint(
            "reason IN ('offensive', 'spam', 'private', 'other')",
            name="ck_recording_comment_reports_reason",
        ),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    comment_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("recording_comments.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    reporter_key: Mapped[str] = mapped_column(String(80), nullable=False)
    reporter_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("user_accounts.id", ondelete="SET NULL"), nullable=True
    )
    reason: Mapped[str] = mapped_column(String(16), nullable=False)
    note: Mapped[str | None] = mapped_column(Text)


class RecordingChordSheet(Base, TimestampMixin):
    """One chord chart of one recording for one instrument (plain text, chords over words)."""

    __tablename__ = "recording_chord_sheets"
    __table_args__ = (
        CheckConstraint(
            "instrument IN ('guitar', 'harmonium')", name="ck_recording_chord_sheets_instrument"
        ),
        CheckConstraint(
            "status IN ('pending', 'published', 'rejected')",
            name="ck_recording_chord_sheets_status",
        ),
        CheckConstraint(
            f"length(body) >= 1 AND length(body) <= {SHEET_TEXT_MAX_LENGTH}",
            name="ck_recording_chord_sheets_body",
        ),
        Index(
            "ix_recording_chord_sheets_recording_status",
            "recording_id",
            "status",
            "created_at",
        ),
        Index("ix_recording_chord_sheets_status_created", "status", "created_at"),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    recording_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("recordings.id", ondelete="CASCADE"),
        nullable=False,
    )
    member_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("user_accounts.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    instrument: Mapped[str] = mapped_column(String(12), nullable=False)
    # The key the chords are WRITTEN in ("C", "F#", "Bb"); null when the author did not say. For the
    # harmonium it is Sa. Used to show the key after a transpose, never to change the text.
    chart_key: Mapped[str | None] = mapped_column(String(3))
    # The chart as typed: chords on a line of their own over the words, or [Am] inside the words.
    body: Mapped[str] = mapped_column(Text, nullable=False)
    chords_count: Mapped[int] = mapped_column(
        Integer, default=0, server_default="0", nullable=False
    )
    played_it: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default="true", nullable=False
    )
    note: Mapped[str | None] = mapped_column(String(300))
    is_anonymous: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false", nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(12), default="pending", server_default="pending", nullable=False
    )
    reports_count: Mapped[int] = mapped_column(
        Integer, default=0, server_default="0", nullable=False
    )
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    reviewed_by: Mapped[str | None] = mapped_column(String(255))
    rejected_reason: Mapped[str | None] = mapped_column(Text)
    # A chart of a Bhajan or a Spiritual song, in the shape of the Prabhat Samgiita charts, with
    # the text of every line kept beside its chords (a recording has no lyrics of its own):
    # {"lines": [{"text": "Baba Nam", "placements": [{"word": 0, "chord": "Am"}]}]}. Null for a
    # plain-text sheet. `body` is filled for both: for a chart it is the same chart as `[Am]word`.
    chart: Mapped[dict[str, Any] | None] = mapped_column(PortableJSON, nullable=True)
    # Guitar only: the fret of the capo the author played with (a hint; chords are as they sound).
    capo: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)
    strum: Mapped[str | None] = mapped_column(String(40))
    # The chord cycle of a Kiirtan: one entry per tune (melody) of the recording:
    # {"tune_count": 3, "tunes": [{"number": 1, "name": "Slow", "key": "G", "chords": ["Em", "C",
    # "G", "D"], "start": 0, "times": 4}]}; a number missing from `tunes` has no chords yet. The
    # first build kept {"forms": [...]}: services/kiirtan_cycles.normalize reads those as tunes.
    # Null for a plain sheet and for a chart. `body` is filled too (the cycle written as text).
    cycle: Mapped[dict[str, Any] | None] = mapped_column(PortableJSON, nullable=True)
    # A new version of the author's own live sheet: when this one goes live the old one is archived
    # (kept, hidden). Null when the old sheet is deleted.
    replaces_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("recording_chord_sheets.id", ondelete="SET NULL"),
        nullable=True,
    )
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # "Start from this chart": the sheet whose chords were copied; the credit is worked out when it
    # is shown (`credit_map`).
    based_on_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("recording_chord_sheets.id", ondelete="SET NULL"),
        nullable=True,
    )


class RecordingChordReport(Base, TimestampMixin):
    __tablename__ = "recording_chord_reports"
    __table_args__ = (
        UniqueConstraint("sheet_id", "reporter_key", name="uq_recording_chord_reports_once"),
        CheckConstraint(
            "reason IN ('wrong_chords', 'offensive', 'spam', 'other')",
            name="ck_recording_chord_reports_reason",
        ),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    sheet_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("recording_chord_sheets.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    reporter_key: Mapped[str] = mapped_column(String(80), nullable=False)
    reporter_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("user_accounts.id", ondelete="SET NULL"), nullable=True
    )
    reason: Mapped[str] = mapped_column(String(16), nullable=False)
    note: Mapped[str | None] = mapped_column(Text)


class VideoLink(Base, TimestampMixin):
    """A link to one video, attached to a recording OR to a Prabhat Samgiita song (never both).

    `target_key` is "recording:<uuid>" or "song:<number>": one column that names the target, so the
    uniqueness rule (one live copy of a video per target) does not depend on how a database treats
    NULLs in a composite key.
    """

    __tablename__ = "video_links"
    __table_args__ = (
        CheckConstraint(
            "(recording_id IS NOT NULL AND song_id IS NULL) OR "
            f"(recording_id IS NULL AND song_id IS NOT NULL AND song_id >= 1 "
            f"AND song_id <= {PS_SONG_COUNT})",
            name="ck_video_links_one_target",
        ),
        CheckConstraint("status IN ('published', 'removed')", name="ck_video_links_status"),
        # One live copy of a video per target. A removed row does not count (the author may add it
        # again after deleting it; the team's own removals are refused in the service).
        Index(
            "uq_video_links_live",
            "target_key",
            "provider",
            "external_id",
            unique=True,
            postgresql_where=text("status = 'published'"),
            sqlite_where=text("status = 'published'"),
        ),
        Index("ix_video_links_target_status", "target_key", "status", "created_at"),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    recording_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("recordings.id", ondelete="CASCADE"), nullable=True
    )
    song_id: Mapped[int | None] = mapped_column(Integer)
    target_key: Mapped[str] = mapped_column(String(60), nullable=False)
    member_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("user_accounts.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    provider: Mapped[str] = mapped_column(String(16), nullable=False)
    # The site's own id of the video (11 characters for YouTube, digits for Vimeo, an item id for
    # the Internet Archive): what "the same video" means, whatever the pasted link looked like.
    external_id: Mapped[str] = mapped_column(String(120), nullable=False)
    # The normalised https address, rebuilt from provider + id (never the pasted text).
    url: Mapped[str] = mapped_column(String(VIDEO_URL_MAX_LENGTH), nullable=False)
    title: Mapped[str | None] = mapped_column(String(VIDEO_TITLE_MAX_LENGTH))
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
    # The automatic check: "unknown" until looked at; "unavailable" only after two looks in a row.
    link_status: Mapped[str] = mapped_column(
        String(16), default="unknown", server_default="unknown", nullable=False
    )
    checked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    check_fails: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)


class VideoLinkReport(Base, TimestampMixin):
    __tablename__ = "video_link_reports"
    __table_args__ = (
        UniqueConstraint("video_id", "reporter_key", name="uq_video_link_reports_once"),
        CheckConstraint(
            "reason IN ('broken', 'not_about_this', 'offensive', 'spam', 'other')",
            name="ck_video_link_reports_reason",
        ),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    video_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("video_links.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    reporter_key: Mapped[str] = mapped_column(String(80), nullable=False)
    reporter_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("user_accounts.id", ondelete="SET NULL"), nullable=True
    )
    reason: Mapped[str] = mapped_column(String(16), nullable=False)
    note: Mapped[str | None] = mapped_column(Text)
