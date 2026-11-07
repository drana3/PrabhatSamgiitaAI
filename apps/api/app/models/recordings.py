"""Kiirtan, Bhajan and Prabhat Samgiita recordings, published at once.

See docs/kiirtan-publishing.md. One table holds all four categories (`kind`). A recording is
`published` the moment the upload succeeds; the team looks afterwards and may mark it `flagged`
(too many reports, or a copyright claim) or `removed` (with a reason that the author is told).
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin

# The category of a recording, as the uploader picks it (the field is called `kind`). A Kiirtan is
# always a version of "Baba Nam Kevalam": there is only that one mantra in the library.
RECORDING_KINDS = (
    "kiirtan",
    "bhajan",
    "prabhat_samgiita",
    "spiritual_song",
    "dance_song",
)
# "Devotional song" was a fourth category once. A Bhajan already is one, so it is gone from every
# form and list. Rows stored with it stay valid (the database check still allows the word) and are
# shown, filtered and counted as Bhajans: see `public_kind` and `stored_kinds`.
LEGACY_KIND_DEVOTIONAL_SONG = "devotional_song"
STORED_KINDS = (*RECORDING_KINDS, LEGACY_KIND_DEVOTIONAL_SONG)
# The language rule of each category, in ONE place (the phone keeps the same table in
# lib/kirtan/types.ts LANGUAGE_RULE): "none" = never asked (a Kiirtan is always Baba Nam Kevalam, a
# language sent with one is dropped), "optional" = asked, may stay empty, "required" = the API
# answers 422 without it (a NEW upload: a Bhajan stored before the rule, with no language, stays
# valid and readable). `spiritual_song` is NOT the old `devotional_song`: that id stays a legacy
# alias of Bhajan.
KIND_LANGUAGE_RULE: dict[str, str] = {
    "kiirtan": "none",
    "bhajan": "required",
    "prabhat_samgiita": "optional",
    "spiritual_song": "required",
    "dance_song": "optional",
}
# Categories that carry a sung language at all.
KINDS_WITH_LANGUAGE = tuple(k for k, rule in KIND_LANGUAGE_RULE.items() if rule != "none")
# The dances a dance song names (required for that category). ONE list: add an id here and on the
# phone (lib/kirtan/types.ts DANCES) and it exists; the database does not list the values, so no
# migration is needed to grow it.
DANCES = ("tandava", "kaoshiki")
KINDS_WITH_DANCE = ("dance_song",)


def public_kind(stored: str) -> str:
    """The category as people see it: a legacy `devotional_song` row is a Bhajan."""
    return "bhajan" if stored == LEGACY_KIND_DEVOTIONAL_SONG else stored


def stored_kinds(kind: str) -> tuple[str, ...]:
    """Every stored value that shows as `kind` (Bhajan also finds the legacy rows)."""
    return ("bhajan", LEGACY_KIND_DEVOTIONAL_SONG) if kind == "bhajan" else (kind,)


RECORDING_STATUSES = ("published", "removed", "flagged")
KIRTAN_TYPES = ("bnk", "lila", "festival", "other")
BHAJAN_TYPES = ("morning", "evening", "devotional", "other")
REPORT_REASONS = ("copyright", "offensive", "wrong_info", "duplicate", "other")
RECORDING_LANGUAGES = ("bengali", "sanskrit", "hindi", "english", "other")
# Prabhat Samgiita songs are numbered 1 to 5018; a recording of that category names its song.
PS_SONG_COUNT = 5018

# JSONB on Postgres, plain JSON elsewhere (the tests run on SQLite).
PortableJSON = JSON().with_variant(JSONB(), "postgresql")


class Recording(Base, TimestampMixin):
    __tablename__ = "recordings"
    __table_args__ = (
        # One file, one recording, removed ones included (a removed file must not come back).
        # Also what makes two simultaneous uploads of the same bytes safe.
        Index("ix_recordings_audio_sha256", "audio_sha256", unique=True),
        CheckConstraint(
            "kind IN ('kiirtan', 'bhajan', 'devotional_song', 'prabhat_samgiita', "
            "'spiritual_song', 'dance_song')",
            name="ck_recordings_kind",
        ),
        CheckConstraint(
            "status IN ('published', 'removed', 'flagged')", name="ck_recordings_status"
        ),
        CheckConstraint(
            "(kind = 'kiirtan' AND type IN ('bnk', 'lila', 'festival', 'other')) OR "
            "(kind = 'bhajan' AND type IN ('morning', 'evening', 'devotional', 'other')) OR "
            "(kind IN ('devotional_song', 'prabhat_samgiita', 'spiritual_song', 'dance_song') "
            "AND type = 'other')",
            name="ck_recordings_type_for_kind",
        ),
        # A Prabhat Samgiita recording names its song (1..5018); no other category has one.
        CheckConstraint(
            "(kind = 'prabhat_samgiita' AND ps_song_number IS NOT NULL "
            "AND ps_song_number >= 1 AND ps_song_number <= 5018) OR "
            "(kind <> 'prabhat_samgiita' AND ps_song_number IS NULL)",
            name="ck_recordings_ps_song",
        ),
        # The language is an ISO 639 code (2 or 3 letters) or "other"; which codes exist is the
        # list in app/services/recording_languages.py, so it can grow without a migration.
        CheckConstraint(
            "language IS NULL OR (length(language) >= 2 AND length(language) <= 8)",
            name="ck_recordings_language",
        ),
        # A dance song names its dance; no other category has one.
        CheckConstraint(
            "(kind = 'dance_song' AND dance IS NOT NULL) OR "
            "(kind <> 'dance_song' AND dance IS NULL)",
            name="ck_recordings_dance",
        ),
        # A spiritual song always names its language.
        CheckConstraint(
            "kind <> 'spiritual_song' OR language IS NOT NULL",
            name="ck_recordings_spiritual_language",
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
    # Performer or group as the uploader wrote it (required for an upload; empty only for old data).
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
    audio_sha256: Mapped[str] = mapped_column(String(64), nullable=False)
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
    # Confirmed by the uploader as "a different performance" of this similar recording.
    duplicate_of: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("recordings.id", ondelete="SET NULL"), nullable=True
    )
    # The team removed it as a duplicate of this recording (set together with the removal).
    removed_duplicate_of: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("recordings.id", ondelete="SET NULL"), nullable=True
    )

    # Year it was recorded, when the uploader knows it.
    year: Mapped[int | None] = mapped_column(Integer)
    # Sung language: an ISO 639 code from the catalog (app/services/recording_languages.py),
    # "other", or none. Old rows with the words "bengali"... were turned into codes by 0032.
    language: Mapped[str | None] = mapped_column(String(16))
    # What the uploader called the language when they chose "other" (only then).
    language_other: Mapped[str | None] = mapped_column(String(80))
    # The dance of a dance song (one of DANCES); null for every other category.
    dance: Mapped[str | None] = mapped_column(String(16))
    # When it was recorded, when it differs from the year (a track of an event playlist).
    recorded_on: Mapped[date | None] = mapped_column(Date)
    # The playlist from an event this recording belongs to, and its place in it (1, 2, ...).
    collection_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("recording_collections.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
    )
    position: Mapped[int | None] = mapped_column(Integer)
    # "Words and music by": credits for a Bhajan or a Prabhat Samgiita recording.
    credits: Mapped[str | None] = mapped_column(String(300))
    notes: Mapped[str | None] = mapped_column(String(500))
    # The song of a `prabhat_samgiita` recording (1..5018). The song page lists it as a recording.
    ps_song_number: Mapped[int | None] = mapped_column(Integer, index=True)


class RecordingReport(Base, TimestampMixin):
    """One report of one recording by one reporter (a member, or an anonymous device bucket)."""

    __tablename__ = "recording_reports"
    __table_args__ = (
        UniqueConstraint("recording_id", "reporter_key", name="uq_recording_reports_once"),
        CheckConstraint(
            "reason IN ('copyright', 'offensive', 'wrong_info', 'duplicate', 'other')",
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


class RecordingSimilarConfirm(Base, TimestampMixin):
    """An uploader said: "this file is a different performance" of a similar recording.

    Remembered per file (SHA-256) and per similar recording, so the same warning is not asked again
    for the same pair (a second publish call of the same file, a retry after a dropped connection).
    """

    __tablename__ = "recording_similar_confirms"
    __table_args__ = (
        UniqueConstraint("audio_sha256", "other_id", name="uq_recording_similar_confirms_pair"),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    audio_sha256: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    other_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("recordings.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    member_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("user_accounts.id", ondelete="SET NULL"), nullable=True
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
