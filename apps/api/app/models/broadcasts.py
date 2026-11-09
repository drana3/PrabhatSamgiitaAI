"""Live and announced broadcasts (Zoom, YouTube Live, Facebook, Instagram Live): docs/broadcasts.md.

A member posts the LINK of a broadcast, with a title and, when it is known, the start. Nothing is
recorded or relayed: the app shows the link, opens it in the person's own browser or app (Zoom and
every other site) or plays the YouTube embed. Two tables:

broadcasts            one row per posted broadcast
broadcast_reports     one row per person, broadcast and reason: "this link is broken", spam, ...
broadcast_decisions   the team's verdicts (keep, hide, remove), the history
broadcast_recordings  the recording of an ended broadcast: a link, or a recording of the library

The state of a broadcast (upcoming, now, ended) is never stored: it is worked out from the start,
the end and, for a YouTube link, the last look of the YouTube Data API
(`services/broadcasts.phase`), so no job has to run for it to change.
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import (
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

BROADCAST_PROVIDERS = ("youtube", "zoom", "facebook", "instagram", "other")
BROADCAST_STATUSES = ("published", "removed")
BROADCAST_REPORT_REASONS = ("broken", "not_a_broadcast", "offensive", "spam", "other")
BROADCAST_LINK_STATUSES = ("unknown", "ok", "no_embed", "unavailable")
BROADCAST_DECISIONS = ("keep", "hide", "remove")
BROADCAST_YT_STATES = ("live", "upcoming", "none")
BROADCAST_RECORDING_KINDS = ("link", "file")
BROADCAST_RECORDING_STATUSES = ("accepted", "pending", "rejected")
BROADCAST_RECORDING_SOURCES = ("author", "team", "member", "youtube")
BROADCAST_TITLE_MAX_LENGTH = 120
BROADCAST_URL_MAX_LENGTH = 500
BROADCAST_DESCRIPTION_MAX_LENGTH = 1000
BROADCAST_ORGANIZER_MAX_LENGTH = 120


class Broadcast(Base, TimestampMixin):
    __tablename__ = "broadcasts"
    __table_args__ = (
        CheckConstraint(
            "provider IN ('youtube', 'zoom', 'facebook', 'instagram', 'other')",
            name="ck_broadcasts_provider",
        ),
        CheckConstraint("status IN ('published', 'removed')", name="ck_broadcasts_status"),
        CheckConstraint(
            "link_status IN ('unknown', 'ok', 'no_embed', 'unavailable')",
            name="ck_broadcasts_link_status",
        ),
        Index("ix_broadcasts_status_start", "status", "starts_at"),
        Index("ix_broadcasts_member_created", "member_id", "created_at"),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    member_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("user_accounts.id", ondelete="CASCADE"),
        nullable=False,
    )
    provider: Mapped[str] = mapped_column(String(12), nullable=False)
    # The YouTube video id (the only site the server looks at); empty for every other site.
    external_id: Mapped[str] = mapped_column(
        String(32), default="", server_default="", nullable=False
    )
    # The address as the server stored it (rebuilt for YouTube, cleaned for the others).
    url: Mapped[str] = mapped_column(String(500), nullable=False)
    # The host alone, for the line "zoom.us" under the title; never used to decide anything.
    host: Mapped[str] = mapped_column(String(100), nullable=False)
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    organizer: Mapped[str | None] = mapped_column(String(120))
    # The start in UTC, and the zone the organizer meant (an IANA name) so it can be shown there.
    starts_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    timezone: Mapped[str | None] = mapped_column(String(64))
    # Set when the author (or the team) says "it is over"; otherwise the end is worked out.
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # The end the organizer announced (optional). Nothing lasts longer than MAX_DURATION.
    declared_ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # What the last look of the YouTube Data API said (services/youtube_status.py). Only these
    # five facts are kept; the client gets nothing but the resulting state.
    yt_state: Mapped[str | None] = mapped_column(String(10))
    yt_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    yt_ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    yt_checked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # What a look at a YouTube link found (services/broadcasts.enrich): the video's own title and
    # thumbnail, and whether it can be shown inside the app.
    thumbnail_url: Mapped[str | None] = mapped_column(String(300))
    fetched_title: Mapped[str | None] = mapped_column(String(200))
    link_status: Mapped[str] = mapped_column(
        String(12), default="unknown", server_default="unknown", nullable=False
    )
    check_fails: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)
    checked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(
        String(12), default="published", server_default="published", nullable=False
    )
    reports_count: Mapped[int] = mapped_column(
        Integer, default=0, server_default="0", nullable=False
    )
    removed_reason: Mapped[str | None] = mapped_column(Text)
    removed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    removed_by: Mapped[str | None] = mapped_column(String(255))
    # "Keep": the team looked at the reports that were there and found nothing wrong. The reports
    # stay (cleared, never deleted) so the same people cannot send them again.
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    reviewed_by: Mapped[str | None] = mapped_column(String(255))
    reviewed_reports: Mapped[int] = mapped_column(
        Integer, default=0, server_default="0", nullable=False
    )
    # "Hide": off every public list, the author and the team still read it.
    hidden_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    hidden_by: Mapped[str | None] = mapped_column(String(255))
    hidden_reason: Mapped[str | None] = mapped_column(Text)


class BroadcastReport(Base, TimestampMixin):
    __tablename__ = "broadcast_reports"
    __table_args__ = (
        UniqueConstraint(
            "broadcast_id", "reporter_key", "reason", name="uq_broadcast_reports_reporter_reason"
        ),
        CheckConstraint(
            "reason IN ('broken', 'not_a_broadcast', 'offensive', 'spam', 'other')",
            name="ck_broadcast_reports_reason",
        ),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    broadcast_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("broadcasts.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    reporter_key: Mapped[str] = mapped_column(String(80), nullable=False)
    reporter_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("user_accounts.id", ondelete="SET NULL")
    )
    reason: Mapped[str] = mapped_column(String(20), nullable=False)
    note: Mapped[str | None] = mapped_column(String(1000))
    # What the report adds to the hiding count (0 for an anonymous reader or a fresh account).
    weight: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)
    # Set when the team gave its verdict: a cleared report no longer counts, and still blocks the
    # same person from sending the same reason again.
    cleared_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cleared_by: Mapped[str | None] = mapped_column(String(255))


class BroadcastDecision(Base, TimestampMixin):
    """One verdict of the team on a broadcast: the history screen."""

    __tablename__ = "broadcast_decisions"
    __table_args__ = (
        CheckConstraint(
            "action IN ('keep', 'hide', 'remove')", name="ck_broadcast_decisions_action"
        ),
        Index("ix_broadcast_decisions_created", "created_at"),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    broadcast_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("broadcasts.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    action: Mapped[str] = mapped_column(String(8), nullable=False)
    reason: Mapped[str | None] = mapped_column(Text)
    decided_by: Mapped[str] = mapped_column(String(255), nullable=False)
    # Reports from different people at that moment, and the ones of them that counted.
    reports_total: Mapped[int] = mapped_column(
        Integer, default=0, server_default="0", nullable=False
    )
    reports_counted: Mapped[int] = mapped_column(
        Integer, default=0, server_default="0", nullable=False
    )


class BroadcastRecording(Base, TimestampMixin):
    """The recording of an ended broadcast. Two kinds: a LINK (YouTube keeps the same video as the
    recording, a Zoom cloud recording, Vimeo, archive.org: opened by the person, never fetched
    or embedded but for YouTube) and a FILE (an ordinary library recording uploaded through the
    wizard). The server never downloads anything from YouTube or Zoom."""

    __tablename__ = "broadcast_recordings"
    __table_args__ = (
        CheckConstraint("kind IN ('link', 'file')", name="ck_broadcast_recordings_kind"),
        CheckConstraint(
            "status IN ('accepted', 'pending', 'rejected')", name="ck_broadcast_recordings_status"
        ),
        CheckConstraint(
            "source IN ('author', 'team', 'member', 'youtube')",
            name="ck_broadcast_recordings_source",
        ),
        Index("ix_broadcast_recordings_status", "status", "created_at"),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    broadcast_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("broadcasts.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    # Who added or suggested it; empty for the one the YouTube look added by itself.
    member_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("user_accounts.id", ondelete="SET NULL")
    )
    kind: Mapped[str] = mapped_column(String(8), nullable=False)
    provider: Mapped[str | None] = mapped_column(String(12))
    url: Mapped[str | None] = mapped_column(String(500))
    host: Mapped[str | None] = mapped_column(String(100))
    recording_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("recordings.id", ondelete="CASCADE"), index=True
    )
    status: Mapped[str] = mapped_column(
        String(10), default="accepted", server_default="accepted", nullable=False
    )
    source: Mapped[str] = mapped_column(String(8), nullable=False)
    decided_by: Mapped[str | None] = mapped_column(String(255))
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
