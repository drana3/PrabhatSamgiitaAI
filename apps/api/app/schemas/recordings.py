from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from typing import Literal, Self
from uuid import UUID

from pydantic import BaseModel, Field, field_validator, model_validator

from app.models.recordings import (
    DANCES,
    KIND_LANGUAGE_RULE,
    KINDS_WITH_DANCE,
    PS_SONG_COUNT,
    public_kind,
)
from app.services.recording_languages import (
    OTHER,
    clean_language_other,
    normalize_language,
)
from app.services.recording_styles import clean_style_other, normalize_style

# The category of a recording. "kiirtan" is Baba Nam Kevalam (the only mantra of the library),
# "prabhat_samgiita" is a performance of one Prabhat Samgiita song (`ps_song_number`),
# "spiritual_song" is a song in the language the uploader names (required), "dance_song" is a song
# for Tandava or Kaoshiki (`dance`, required). `devotional_song` is gone: it reads as "bhajan".
Kind = Literal["kiirtan", "bhajan", "prabhat_samgiita", "spiritual_song", "dance_song"]
# An ISO 639 code from app/services/recording_languages.py, or "other" (named in `language_other`).
Language = str
FIRST_YEAR = 1900
Status = Literal["published", "removed", "flagged"]
ReportReason = Literal["copyright", "offensive", "wrong_info", "duplicate", "other"]
AdminFilter = Literal["new", "flagged", "removed", "all"]


def _legacy_kind_is_a_bhajan(value: object) -> object:
    """Reads only: a row stored as the old `devotional_song` is answered as `bhajan`."""
    return public_kind(value) if isinstance(value, str) else value


def kind_field_problem(
    kind: str,
    *,
    language: str | None,
    language_other: str | None,
    dance: str | None,
    ps_song_number: int | None,
) -> str | None:
    """What is missing or wrong for this category, as one sentence for the person; None if fine.

    ONE place for the per-category rules, used by the schema (a plain upload) and by the set
    service (a track whose language or dance comes from its playlist). The rules:
    Bhajan and spiritual song = language required; dance song = dance required (from DANCES),
    language optional; Prabhat Samgiita = song number, language optional; Kiirtan = no language.
    """
    if kind == "prabhat_samgiita" and ps_song_number is None:
        return "Choose the Prabhat Samgiita song this is a performance of."
    if kind != "prabhat_samgiita" and ps_song_number is not None:
        return "A song number belongs to the Prabhat Samgiita category only."
    if KIND_LANGUAGE_RULE.get(kind) == "required" and not language:
        return "Choose the language of this song."
    if language == OTHER and not language_other:
        return "Write the name of the language."
    if kind in KINDS_WITH_DANCE:
        if not dance:
            return "Choose the dance: " + " or ".join(d.title() for d in DANCES) + "."
        if dance not in DANCES:
            return "Choose one of the dances: " + ", ".join(DANCES) + "."
    elif dance:
        return "A dance belongs to the Dance song category only."
    return None


class UploadRequest(BaseModel):
    file_name: str = Field(min_length=1, max_length=255)
    content_type: str = Field(min_length=3, max_length=100)
    size_bytes: int = Field(gt=0)
    # Optional: lets the server refuse an exact duplicate before the bytes travel.
    sha256: str | None = Field(default=None, pattern=r"^[0-9a-fA-F]{64}$")
    # The file is a track of this playlist from an event: its own, larger allowance applies.
    collection_id: UUID | None = None


class UploadTargetResponse(BaseModel):
    key: str
    method: str
    url: str
    headers: dict[str, str]
    expires_at: datetime
    max_bytes: int


class RecordingCreate(BaseModel):
    key: str = Field(min_length=10, max_length=300)
    kind: Kind = "kiirtan"
    type: str = Field(default="other", max_length=16)
    # The uploader types the title.
    title: str = Field(min_length=1, max_length=200)
    # Performer or group: required (the form prefills it with the member's name).
    author: str = Field(min_length=1, max_length=200)
    by_author: bool = False
    terms_accepted: bool
    terms_version: str = Field(min_length=1, max_length=32)
    # Language: an ISO code, "other" (then `language_other`), or one of the five old words.
    # Required for a Bhajan and a spiritual song, optional for Prabhat Samgiita and dance song,
    # dropped for a Kiirtan.
    language: str | None = Field(default=None, max_length=16)
    language_other: str | None = Field(default=None, max_length=200)
    # Required for a dance song (one of DANCES), refused for every other category.
    dance: str | None = Field(default=None, max_length=16)
    # Optional, Kiirtan only: how it is sung (STYLES or "other" + `style_other`). Dropped for the others.
    style: str | None = Field(default=None, max_length=16)
    style_other: str | None = Field(default=None, max_length=200)
    # Optional details ("More details" in the app).
    credits: str | None = Field(default=None, max_length=300)
    year: int | None = Field(default=None, ge=FIRST_YEAR)
    notes: str | None = Field(default=None, max_length=500)
    # Required for a Prabhat Samgiita recording (1..5018), not allowed for the other categories.
    ps_song_number: int | None = Field(default=None, ge=1, le=PS_SONG_COUNT)
    # The uploader saw "Sounds like a recording already in the library" and said theirs is a
    # different performance. `confirm_similar` is the older name of the same flag.
    confirm_different: bool = False
    confirm_similar: bool = False
    duration_sec: int | None = Field(default=None, ge=1, le=60 * 60 * 6)
    # A track of a playlist from an event: the set, the place in it, the day it was recorded.
    collection_id: UUID | None = None
    position: int | None = Field(default=None, ge=1, le=1000)
    recorded_on: date | None = None

    @field_validator("language", mode="before")
    @classmethod
    def _language_is_a_known_code(cls, value: object) -> str | None:
        if value is None or isinstance(value, str):
            return normalize_language(value)
        raise ValueError("Choose a language from the list.")

    @field_validator("style", mode="before")
    @classmethod
    def _style_is_a_known_id(cls, value: object) -> str | None:
        if value is None or isinstance(value, str):
            return normalize_style(value)
        raise ValueError("Choose a style from the list.")

    @field_validator("dance", mode="before")
    @classmethod
    def _dance_in_lower_case(cls, value: object) -> object:
        return value.strip().lower() or None if isinstance(value, str) else value

    @field_validator("recorded_on")
    @classmethod
    def _recorded_not_in_the_future(cls, value: date | None) -> date | None:
        if value is not None and value > datetime.now(UTC).date() + timedelta(days=1):
            raise ValueError("The date cannot be in the future.")
        if value is not None and value.year < FIRST_YEAR:
            raise ValueError(f"The date cannot be before {FIRST_YEAR}.")
        return value

    @field_validator("year")
    @classmethod
    def _year_not_in_the_future(cls, value: int | None) -> int | None:
        if value is not None and value > datetime.now(UTC).year:
            raise ValueError("The year cannot be in the future.")
        return value

    @model_validator(mode="after")
    def _fields_match_the_category(self) -> Self:
        # A Kiirtan has no language field (it is always Baba Nam Kevalam): a language sent with
        # one is dropped, so a Kiirtan never carries one.
        # (Inside a playlist a track that did not name its kind takes the playlist's, so its
        # language is kept until the service knows the kind.)
        kind_unsaid = self.collection_id is not None and "kind" not in self.model_fields_set
        if KIND_LANGUAGE_RULE.get(self.kind) == "none" and not kind_unsaid:
            self.language = None
        # A style belongs to a Kiirtan only; "other" needs its name.
        if self.kind != "kiirtan" and not kind_unsaid:
            self.style = None
        self.style_other = clean_style_other(self.style_other) if self.style == OTHER else None
        if self.style == OTHER and not self.style_other:
            raise ValueError("Write the name of the style.")
        # The free-text name only goes with "other", and is cleaned before it is stored.
        self.language_other = (
            clean_language_other(self.language_other) if self.language == OTHER else None
        )
        # A track of a playlist may take its language or dance from the playlist, so the service
        # checks it after the defaults are in; a plain upload is checked here.
        if self.collection_id is None:
            problem = kind_field_problem(
                self.kind,
                language=self.language,
                language_other=self.language_other,
                dance=self.dance,
                ps_song_number=self.ps_song_number,
            )
            if problem:
                raise ValueError(problem)
        return self


class RecordingBrief(BaseModel):
    id: str
    kind: Kind
    title: str
    author: str
    audio_url: str

    _kind_read = field_validator("kind", mode="before")(_legacy_kind_is_a_bhajan)


class RecordingOut(BaseModel):
    id: str
    kind: Kind
    type: str
    title: str
    author: str
    added_by: str
    author_id: str | None
    by_author: bool
    status: Status
    duration_sec: int | None
    plays: int
    audio_url: str
    thumbnail_url: str | None
    published_at: datetime | None
    created_at: datetime
    year: int | None = None
    language: Language | None = None
    credits: str | None = None
    notes: str | None = None
    ps_song_number: int | None = None
    # Dance song: "tandava" or "kaoshiki". Language: the ISO code ("other" + `language_other`).
    dance: str | None = None
    language_other: str | None = None
    # Kiirtan only: how it is sung (a STYLES id or "other" + `style_other`).
    style: str | None = None
    style_other: str | None = None
    # Playlist from an event: its id, the place in it, the day this track was recorded.
    collection_id: str | None = None
    position: int | None = None
    recorded_on: date | None = None
    # Only filled for the owner (`/recordings/mine`) and for admins.
    removed_reason: str | None = None
    removed_at: datetime | None = None
    duplicate_of: str | None = None
    removed_duplicate_of: str | None = None

    _kind_read = field_validator("kind", mode="before")(_legacy_kind_is_a_bhajan)


class RecordingList(BaseModel):
    items: list[RecordingOut]
    total: int


class DuplicateDetail(BaseModel):
    code: Literal["duplicate", "removed_duplicate", "similar_recording", "own_duplicate"]
    message: str
    duplicate_of: RecordingBrief | None = None
    similar: list[RecordingBrief] = Field(default_factory=list)


class ReportCreate(BaseModel):
    reason: ReportReason
    comment: str | None = Field(default=None, max_length=1500)


class ReportResponse(BaseModel):
    status: Literal["received", "already_reported"]
    message: str


class BlockCreate(BaseModel):
    author_id: str = Field(min_length=36, max_length=36)


class BlockList(BaseModel):
    author_ids: list[str]


class NoticeOut(BaseModel):
    id: str
    kind: str
    recording_id: str | None
    title: str
    body: str
    payload: dict[str, object]
    created_at: datetime
    read_at: datetime | None


class TermsOut(BaseModel):
    version: str


# --- admin ---------------------------------------------------------------------------------


class AdminRecordingOut(RecordingOut):
    reports_count: int
    reviewed_at: datetime | None
    reviewed_by: str | None
    flagged_at: datetime | None
    removed_by: str | None
    audio_sha256: str
    has_fingerprint: bool
    terms_accepted_at: datetime | None


class AdminReportOut(BaseModel):
    id: str
    reason: ReportReason
    comment: str | None
    reporter_is_member: bool
    created_at: datetime


class AdminRecordingDetail(AdminRecordingOut):
    reports: list[AdminReportOut]


class AdminRecordingList(BaseModel):
    items: list[AdminRecordingOut]
    total: int


class RemoveRequest(BaseModel):
    reason: str = Field(min_length=3, max_length=500)
    reviewer: str | None = Field(default=None, max_length=255)


class ReviewRequest(BaseModel):
    reviewer: str | None = Field(default=None, max_length=255)


class DuplicateOfRequest(BaseModel):
    """Admin: this recording is a copy of `original_id`; remove it and tell the author."""

    original_id: UUID
    reviewer: str | None = Field(default=None, max_length=255)


class DiscardRequest(BaseModel):
    """The author gave up after the "similar recording" question: drop the stored file."""

    key: str = Field(min_length=10, max_length=300)
