"""A playlist from an event: a set of recordings uploaded together (docs/kiirtan-sets.md).

One person uploads all the Kiirtans of a retreat; the set carries the title, the year and month
of the event and the place, and every track is an ordinary recording (`recordings.collection_id`,
`recordings.position`) that goes through the same pipeline: hash check, fingerprint warning, daily
allowance. A set is exactly as published as its tracks: it is listed while at least one track is
visible, and the team can take a track or the whole set down.
"""

from __future__ import annotations

from datetime import date, datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    LargeBinary,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin

SET_STATUSES = ("active", "removed")


class RecordingCollection(Base, TimestampMixin):
    __tablename__ = "recording_collections"
    __table_args__ = (
        CheckConstraint("status IN ('active', 'removed')", name="ck_recording_collections_status"),
        CheckConstraint(
            "ends_on IS NULL OR ends_on >= starts_on", name="ck_recording_collections_dates"
        ),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    # The member who made it. The set outlives a deleted account (the tracks do too).
    owner_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("user_accounts.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
    )
    owner_name: Mapped[str] = mapped_column(
        String(255), default="", server_default="", nullable=False
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(String(1000))
    place: Mapped[str | None] = mapped_column(String(200))
    # The day of the event, or its first day; `ends_on` is the last day of a range.
    starts_on: Mapped[date] = mapped_column(Date, nullable=False)
    ends_on: Mapped[date | None] = mapped_column(Date)
    # The approximate date people give: a year and, when they know it, a month. `starts_on` is
    # always filled from them (the first of the month, or 1 January), so ordering and the old
    # clients keep working; `ends_on` is no longer asked for and stays for old rows.
    event_year: Mapped[int | None] = mapped_column(Integer)
    event_month: Mapped[int | None] = mapped_column(Integer)
    # An https link to a cover picture the team set by hand. A picture the member uploads lives in
    # `recording_collection_covers`; `cover_version` is the hash prefix of it (null when none).
    cover_url: Mapped[str | None] = mapped_column(Text)
    cover_version: Mapped[str | None] = mapped_column(String(16))
    # What the tracks are unless a track says otherwise (the app fills these per track as well).
    default_kind: Mapped[str] = mapped_column(
        String(16), default="kiirtan", server_default="kiirtan", nullable=False
    )
    default_language: Mapped[str | None] = mapped_column(String(16))
    default_language_other: Mapped[str | None] = mapped_column(String(80))
    default_dance: Mapped[str | None] = mapped_column(String(16))
    # How many files the member chose; the set says "uploading" until that many are published or
    # the member calls /finish (partial success is allowed).
    tracks_expected: Mapped[int] = mapped_column(
        Integer, default=0, server_default="0", nullable=False
    )
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # active | removed (the team took the whole set down, with a reason the member reads)
    status: Mapped[str] = mapped_column(
        String(16), default="active", server_default="active", index=True, nullable=False
    )
    removed_reason: Mapped[str | None] = mapped_column(Text)
    removed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    removed_by: Mapped[str | None] = mapped_column(String(255))


class RecordingCollectionCover(Base):
    """The cover picture of a playlist, kept apart so listing playlists never loads image bytes
    (a JPEG, PNG or WebP of at most 300 KB with its metadata stripped)."""

    __tablename__ = "recording_collection_covers"

    collection_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("recording_collections.id", ondelete="CASCADE"),
        primary_key=True,
    )
    mime: Mapped[str] = mapped_column(String(32), nullable=False)
    data: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
