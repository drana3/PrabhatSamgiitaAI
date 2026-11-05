"""Kiirtan and Bhajan recordings, published at once and moderated afterwards.

See docs/kiirtan-publishing.md. One table holds both kinds (`kind`). A recording is `published`
the moment the upload succeeds; the team looks afterwards and may mark it `flagged` (too many
reports, or a copyright claim) or `removed` (with a reason that the author is told).
"""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin

RECORDING_KINDS = ("kiirtan", "bhajan")
RECORDING_STATUSES = ("published", "removed", "flagged")
KIRTAN_TYPES = ("bnk", "lila", "festival", "other")
BHAJAN_TYPES = ("morning", "evening", "devotional", "other")
REPORT_REASONS = ("copyright", "offensive", "wrong_info", "other")

# JSONB on Postgres, plain JSON elsewhere (the tests run on SQLite).
PortableJSON = JSON().with_variant(JSONB(), "postgresql")


class Recording(Base, TimestampMixin):
    __tablename__ = "recordings"
    __table_args__ = (
        CheckConstraint("kind IN ('kiirtan', 'bhajan')", name="ck_recordings_kind"),
        CheckConstraint(
            "status IN ('published', 'removed', 'flagged')", name="ck_recordings_status"
        ),
        CheckConstraint(
            "(kind = 'kiirtan' AND type IN ('bnk', 'lila', 'festival', 'other')) OR "
            "(kind = 'bhajan' AND type IN ('morning', 'evening', 'devotional', 'other'))",
            name="ck_recordings_type_for_kind",
        ),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    kind: Mapped[str] = mapped_column(
        String(16), default="kiirtan", server_default="kiirtan", index=True, nullable=False
    )
    type: Mapped[str] = mapped_column(
        String(16), default="other", server_default="other", nullable=False
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    # Performer or group as the uploader wrote it. Empty when unknown.
    author: Mapped[str] = mapped_column(String(200), default="", server_default="", nullable=False)
    # Display name of the person who added it ("Ananda Marga team" for the bulk load).
    added_by: Mapped[str] = mapped_column(String(255), nullable=False)
    # The account that uploaded it; null for the bulk-loaded library. "Block this author" blocks it.
    author_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("user_accounts.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
    )
    by_author: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false", nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(16), default="published", server_default="published", index=True, nullable=False
    )
    duration_sec: Mapped[int | None] = mapped_column(Integer)
    plays: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)
    reports_count: Mapped[int] = mapped_column(
        Integer, default=0, server_default="0", nullable=False
    )

    # Audio
    audio_key: Mapped[str] = mapped_column(String(300), nullable=False)
    audio_url: Mapped[str] = mapped_column(Text, nullable=False)
    audio_mime: Mapped[str | None] = mapped_column(String(100))
    audio_bytes: Mapped[int | None] = mapped_column(BigInteger)
    audio_sha256: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    # Chromaprint raw fingerprint (base64 of big-endian uint32 values); null when fpcalc is missing.
    fingerprint: Mapped[str | None] = mapped_column(Text)
    thumbnail_url: Mapped[str | None] = mapped_column(Text)

    # Terms the uploader accepted, with the time.
    terms_accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    terms_version: Mapped[str | None] = mapped_column(String(32))

    # Moderation after publication
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    reviewed_by: Mapped[str | None] = mapped_column(String(255))
    flagged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    removed_reason: Mapped[str | None] = mapped_column(Text)
    removed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    removed_by: Mapped[str | None] = mapped_column(String(255))
    duplicate_of: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("recordings.id", ondelete="SET NULL"), nullable=True
    )


class RecordingReport(Base, TimestampMixin):
    """One report of one recording by one reporter (a member, or an anonymous device bucket)."""

    __tablename__ = "recording_reports"
    __table_args__ = (
        UniqueConstraint("recording_id", "reporter_key", name="uq_recording_reports_once"),
        CheckConstraint(
            "reason IN ('copyright', 'offensive', 'wrong_info', 'other')",
            name="ck_recording_reports_reason",
        ),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    recording_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("recordings.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    reporter_key: Mapped[str] = mapped_column(String(80), nullable=False)
    reporter_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("user_accounts.id", ondelete="SET NULL"), nullable=True
    )
    reason: Mapped[str] = mapped_column(String(16), nullable=False)
    comment: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(
        String(16), default="new", server_default="new", nullable=False
    )


class AuthorBlock(Base, TimestampMixin):
    """A member hides every recording of one author (the phone hides them too)."""

    __tablename__ = "recording_author_blocks"
    __table_args__ = (UniqueConstraint("blocker_id", "blocked_id", name="uq_author_blocks_pair"),)

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    blocker_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("user_accounts.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    blocked_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("user_accounts.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )


class MemberNotice(Base, TimestampMixin):
    """A message to one member (docs/notifications.md, phase 2); a takedown is the first."""

    __tablename__ = "member_notices"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("user_accounts.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    # "recording_removed" | "recording_restored"
    kind: Mapped[str] = mapped_column(String(32), nullable=False)
    recording_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("recordings.id", ondelete="SET NULL"), nullable=True
    )
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    payload: Mapped[dict[str, Any]] = mapped_column(PortableJSON, default=dict, nullable=False)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
