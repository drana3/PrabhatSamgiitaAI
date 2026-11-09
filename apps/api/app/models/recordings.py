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
    Float,
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
    "baba_audio",
    # Others (mantras of Ananda Marga that are not Baba Nam Kevalam: Guru Puja, Pitr Yajina ...): a Kiirtan is only Baba Nam
    # Kevalam, every other mantra has its own category and its own upload page (9 Nov 2026).
    "other_mantra",
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
    # Baba's Audio Discourses: a talk, not a song, but it is spoken in a language: required.
    "baba_audio": "required",
    # A mantra is usually Sanskrit: the language may be named, nothing forces it.
    "other_mantra": "optional",
}
# Categories that carry a sung language at all.
KINDS_WITH_LANGUAGE = tuple(k for k, rule in KIND_LANGUAGE_RULE.items() if rule != "none")
# The dances a dance music names (required for that category). ONE list: add an id here and on the
# phone (lib/kirtan/types.ts DANCES) and it exists; the database does not list the values, so no
# migration is needed to grow it.
DANCES = ("tandava", "kaoshiki")
KINDS_WITH_DANCE = ("dance_song",)
# Baba's Audio Discourses (`baba_audio`): the speaker is always Baba, so no performer is asked and
# this name is stored; the optional place and discourse name or number are asked for this kind only.
BABA_AUTHOR = "Shrii Shrii Anandamurti"
KINDS_WITH_DISCOURSE = ("baba_audio",)
# Where it was recorded or performed (`place`): asked for EVERY category now (9 Nov 2026); it used
# to be Baba's Audio Discourses only. Optional everywhere.
# What a recording of "Others" (kind `other_mantra`, shown as "Others" since 9 Nov 2026) is: a REQUIRED
# single choice. `pitriyajina` keeps its old id (rows and clients that carry it stay valid) and shows as
# "Pitr Yajina"; `other` is "Something else" and then `type_other` holds the name the person wrote. The
# spelling of every visible name: docs/others-category.md.
MANTRA_TYPES = (
    "guru_puja",
    "pitriyajina",
    "samgacchadhvam",
    "nityam_shuddham",
    "ananda_sutram",
    "shlokas",
    "other",
)


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
            "'spiritual_song', 'dance_song', 'baba_audio', 'other_mantra')",
            name="ck_recordings_kind",
        ),
        CheckConstraint(
            "status IN ('published', 'removed', 'flagged')", name="ck_recordings_status"
        ),
        CheckConstraint(
            "(kind = 'kiirtan' AND type IN ('bnk', 'lila', 'festival', 'other')) OR "
            "(kind = 'bhajan' AND type IN ('morning', 'evening', 'devotional', 'other')) OR "
            "(kind = 'other_mantra' AND type IN ('guru_puja', 'pitriyajina', 'samgacchadhvam', "
            "'nityam_shuddham', 'ananda_sutram', 'shlokas', 'other')) OR "
            "(kind IN ('devotional_song', 'prabhat_samgiita', 'spiritual_song', 'dance_song', "
            "'baba_audio') AND type = 'other')",
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
        # A dance music names its dance; no other category has one.
        CheckConstraint(
            "(kind = 'dance_song' AND dance IS NOT NULL) OR "
            "(kind <> 'dance_song' AND dance IS NULL)",
            name="ck_recordings_dance",
        ),
        # A spiritual song and an audio discourse of Baba always name their language.
        CheckConstraint(
            "kind NOT IN ('spiritual_song', 'baba_audio') OR language IS NOT NULL",
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
    # How loud it is (services/recording_loudness.py): integrated loudness in LUFS and the true
    # peak in dBTP, read with ffmpeg; the phone levels recordings with them. Null until measured
    # (ffmpeg missing, or an old recording that the backfill script has not reached).
    loudness_lufs: Mapped[float | None] = mapped_column(Float)
    true_peak_db: Mapped[float | None] = mapped_column(Float)
    loudness_measured_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
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
    # The OLD single style (a Kiirtan's only, before 9 Nov 2026) and its word for "other". Since
    # `styles` exists they mirror the first of it, so an older phone and the search shelves read
    # on; a row from before holds just these (services/recording_tags.effective_tags).
    style: Mapped[str | None] = mapped_column(String(16))
    style_other: Mapped[str | None] = mapped_column(String(80))
    # How it is sung or played: SEVERAL listed ids (services/recording_styles.py STYLES) and the
    # uploader's own words. Null on a row from before the lists. Required for a Kiirtan.
    styles: Mapped[list[str] | None] = mapped_column(PortableJSON)
    styles_other: Mapped[list[str] | None] = mapped_column(PortableJSON)
    # How it feels: several listed moods (services/recording_moods.py UPLOAD_MOODS) and own words.
    # What the uploader SAYS; the listener-confirmed moods are the `recording_moods` table.
    moods: Mapped[list[str] | None] = mapped_column(PortableJSON)
    moods_other: Mapped[list[str] | None] = mapped_column(PortableJSON)
    # The own words (above) that the team accepted, like `lead_instrument_checked` for the main
    # instrument: the uploader sees their own word at once, everybody else only the words listed
    # here (services/recording_tags.visible_own). Null: none accepted (and a row from before the
    # lists, which has no checked list, shows its single old word as before).
    styles_other_ok: Mapped[list[str] | None] = mapped_column(PortableJSON)
    moods_other_ok: Mapped[list[str] | None] = mapped_column(PortableJSON)
    # The practice a Kiirtan is for (services/recording_practice.py): "avarta", or null (the usual).
    practice: Mapped[str | None] = mapped_column(String(16))
    # How it was recorded (services/recording_info.py): studio, live, home or ai. Required for a
    # new Kiirtan; null for older rows and for the categories that do not carry it.
    recording_type: Mapped[str | None] = mapped_column(String(16))
    # slow / medium / fast / mix (Dance music only), and solo / group (Kiirtan, Bhajan, Other
    # mantras). Optional.
    tempo: Mapped[str | None] = mapped_column(String(8))
    performance: Mapped[str | None] = mapped_column(String(8))
    # The main (lead) instrument (services/recording_instruments.py): a listed code, "other" or
    # null. With "other", `lead_instrument_other` is the word the author wrote; it is shown to the
    # author at once and to everyone only once the team accepted it (`lead_instrument_checked`).
    lead_instrument: Mapped[str | None] = mapped_column(String(32), index=True)
    lead_instrument_other: Mapped[str | None] = mapped_column(String(80))
    lead_instrument_checked: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="0", nullable=False
    )
    # Others only: with type "other" ("Something else") the name the author wrote. Their own at once,
    # everybody's once the team accepted it (`type_other_checked`): the same rule and the same queue
    # (`value_suggestions`, field "mantra") as the main instrument's own word.
    type_other: Mapped[str | None] = mapped_column(String(80))
    type_other_checked: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="0", nullable=False
    )
    # Where it was recorded or performed (every category, optional); for Baba's Audio Discourses
    # where it was given. `discourse` is the name or number of the discourse (that kind only).
    place: Mapped[str | None] = mapped_column(String(200))
    discourse: Mapped[str | None] = mapped_column(String(200))
    # The dance of a dance music (one of DANCES); null for every other category.
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


SUGGESTION_FIELDS = ("instrument", "style", "language", "mood")
SUGGESTION_STATUSES = ("pending", "accepted", "merged", "rejected")


class ValueSuggestion(Base, TimestampMixin):
    """A word an author wrote under "Add your own" (instrument, style, mood), waiting for the team.

    One row per field and normalized word (services/value_suggestions.py): "Harmonium", "harmonium "
    and "HARMONIUM" are one row, with a counter of recordings and of people. The team accepts the
    word (it becomes visible to everyone and can be picked in the form), merges it into a listed
    value (the recordings take that value) or rejects it (the recordings lose the word).
    """

    __tablename__ = "value_suggestions"
    __table_args__ = (
        UniqueConstraint("field", "key", name="uq_value_suggestions_word"),
        CheckConstraint(
            "field IN ('instrument', 'style', 'language', 'mood', 'mantra')",
            name="ck_value_suggestions_field",
        ),
        CheckConstraint(
            "status IN ('pending', 'accepted', 'merged', 'rejected')",
            name="ck_value_suggestions_status",
        ),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    field: Mapped[str] = mapped_column(String(16), nullable=False)
    # The word without case, spaces, marks and accents: the identity of the row.
    key: Mapped[str] = mapped_column(String(80), nullable=False)
    # The word as it was first written (the team may fix it when accepting).
    label: Mapped[str] = mapped_column(String(80), nullable=False)
    status: Mapped[str] = mapped_column(String(12), default="pending", nullable=False, index=True)
    # A listed value this word is at least 85% like ("harmonyum", harmonium): a hint for the team.
    similar_to: Mapped[str | None] = mapped_column(String(32))
    # The listed value the team merged it into.
    merged_into: Mapped[str | None] = mapped_column(String(32))
    # Who wrote it first: the weekly limit of new words counts these rows.
    first_user_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("user_accounts.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
    )
    recordings_count: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    people_count: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    decided_by: Mapped[str | None] = mapped_column(String(255))
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ValueSuggestionUse(Base, TimestampMixin):
    """One recording that used a suggested word."""

    __tablename__ = "value_suggestion_uses"
    __table_args__ = (
        UniqueConstraint("suggestion_id", "recording_id", name="uq_value_suggestion_uses_once"),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    suggestion_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("value_suggestions.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("user_accounts.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    recording_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("recordings.id", ondelete="SET NULL"), nullable=True
    )
