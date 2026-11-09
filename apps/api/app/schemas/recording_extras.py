"""Request and response shapes of the recording extras (docs/recording-extras.md).

Every PUBLIC shape (`*Out`) has no member id, no email and, for an anonymous item, no name and no
avatar: `author` is null. The team's shapes (`Admin*`) know the author. A test walks the whole JSON.
"""

from __future__ import annotations

import re
from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator, model_validator

from app.models.recording_extras import (
    SHEET_MAX_LINE_LENGTH,
    SHEET_MAX_LINES,
    SHEET_TEXT_MAX_LENGTH,
    VIDEO_TITLE_MAX_LENGTH,
    VIDEO_URL_MAX_LENGTH,
)
from app.schemas.song_chords import (
    CHORD_PATTERN,
    KEY_PATTERN,
    STRUM_PATTERN,
    ChordBasedOn,
    ChordLineIn,
    ChordPlacementOut,
)
from app.schemas.song_comments import CommentAuthor, ReplyTo

# --------------------------------------------------------------------------- comments


class RecordingCommentOut(BaseModel):
    id: str
    recording_id: str
    body: str
    created_at: datetime
    is_anonymous: bool
    # null for an anonymous comment, whoever asks
    author: CommentAuthor | None
    mine: bool = False
    can_remove: bool = False
    # True for the line an author's own delete leaves behind: no text, no author, nothing to act on
    deleted: bool = False
    # Replies, as under a song (`SongCommentOut`)
    parent_id: str | None = None
    reply_to: ReplyTo | None = None
    reply_count: int = 0
    replies: list[RecordingCommentOut] = Field(default_factory=list)


class RecordingCommentList(BaseModel):
    items: list[RecordingCommentOut]
    # the top-level entries the list pages through, tombstones included (it drives `has_more`)
    total: int
    # the comments people can read, replies included, tombstones left out: the number to show
    live_total: int
    limit: int
    offset: int
    has_more: bool


RecordingCommentOut.model_rebuild()


class AdminRecordingCommentOut(BaseModel):
    """For the team only: the author is visible here, also for an anonymous comment."""

    id: str
    recording_id: str
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


class AdminRecordingCommentList(BaseModel):
    items: list[AdminRecordingCommentOut]
    total: int


# --------------------------------------------------------------------------- chord sheets

SheetInstrument = Literal["guitar", "harmonium"]
SheetStatus = Literal["pending", "published", "rejected"]
SheetReportReason = Literal["wrong_chords", "offensive", "spam", "other"]
SheetFilter = Literal["pending", "reported", "published", "rejected", "all"]

# A key as a note name, with an optional minor mark: C, F#, Bb, Am, F#m. Used with `fullmatch`.
SHEET_KEY_PATTERN = re.compile(r"[A-G][#b]?m?")


class SheetLineIn(ChordLineIn):
    """One line of a chart: the words it holds and the chords over them, by word number."""

    text: str = Field(default="", max_length=SHEET_MAX_LINE_LENGTH + 80)


# The chord cycle of a Kiirtan: tunes (melodies played in the recording), each a ring of chords.
# Old rows and old clients call a tune a "form" (`forms`): read as tunes (see kiirtan_cycles).
CYCLE_MAX_TUNES = 30
CYCLE_MAX_LEGACY_FORMS = 8
CYCLE_MIN_CHORDS = 2
CYCLE_MAX_CHORDS = 8
CYCLE_NAME_MAX = 30
CYCLE_TIMES_MAX = 99


class CycleTuneIn(BaseModel):
    """One tune of the recording: the chords in a ring, the one the ring starts on, optionally the
    key it is in, a name and how many rounds are played. A tune nobody has chords for yet is simply
    not sent: it stays in the recording as "no chords yet" (see `CycleIn.tune_count`)."""

    # Which tune of the recording this is (1 = the first one played).
    # Missing: its place in the list.
    number: int | None = Field(default=None, ge=1, le=CYCLE_MAX_TUNES)
    name: str | None = Field(default=None, max_length=CYCLE_NAME_MAX + 40)
    # The key of THIS tune (different tunes can be in different keys).
    # Optional: many do not know it.
    key: str | None = Field(default=None, max_length=3)
    chords: list[str] = Field(min_length=CYCLE_MIN_CHORDS, max_length=CYCLE_MAX_CHORDS)
    # The slot the ring starts on: required, so a listener never has to guess where a round begins.
    start: int = Field(ge=0, lt=CYCLE_MAX_CHORDS)
    times: int | None = Field(default=None, ge=1, le=CYCLE_TIMES_MAX)

    @field_validator("key")
    @classmethod
    def _tune_key(cls, value: str | None) -> str | None:
        key = (value or "").strip()
        if not key:
            return None
        if not SHEET_KEY_PATTERN.fullmatch(key):
            raise ValueError("The key must be a note such as C, F# or Am")
        return key

    @field_validator("chords")
    @classmethod
    def _chord_names(cls, value: list[str]) -> list[str]:
        out: list[str] = []
        for chord in value:
            name = chord.strip()
            if len(name) > 16 or not CHORD_PATTERN.fullmatch(name):
                raise ValueError(f"'{chord}' is not a chord name")
            out.append(name)
        return out

    @model_validator(mode="after")
    def _start_in_ring(self) -> CycleTuneIn:
        if self.start >= len(self.chords):
            raise ValueError("The start must be one of the chords of the cycle")
        return self


class CycleIn(BaseModel):
    # How many tunes are played in the recording. Missing: as many as were sent
    # (or the highest number).
    tune_count: int | None = Field(default=None, ge=1, le=CYCLE_MAX_TUNES)
    tunes: list[CycleTuneIn] = Field(min_length=1, max_length=CYCLE_MAX_TUNES)

    @model_validator(mode="before")
    @classmethod
    def _legacy_forms(cls, data: Any) -> Any:
        """A cycle sent as `forms` (the first build) is a cycle of tunes."""
        if isinstance(data, dict) and "tunes" not in data and "forms" in data:
            data = {**data, "tunes": data["forms"]}
            data.pop("forms", None)
        return data

    @model_validator(mode="after")
    def _numbers(self) -> CycleIn:
        numbers = [t.number if t.number is not None else i + 1 for i, t in enumerate(self.tunes)]
        if len(set(numbers)) != len(numbers):
            raise ValueError("Two tunes have the same number")
        total = self.tune_count if self.tune_count is not None else max(len(self.tunes), *numbers)
        if max(numbers) > total:
            raise ValueError("A tune number is above the number of tunes of the recording")
        return self


class CycleTuneOut(BaseModel):
    number: int
    name: str | None = None
    key: str | None = None
    chords: list[str]
    start: int
    times: int | None = None


class CycleOut(BaseModel):
    # How many tunes the recording has; the numbers missing from `tunes` have no chords yet.
    tune_count: int
    tunes: list[CycleTuneOut]


class SheetCreate(BaseModel):
    instrument: SheetInstrument
    # The key the chords are written in. Optional: many players do not know it. For a chart (see
    # `lines`) it is the key the chords SOUND in (Sa for the harmonium) and it is required.
    chart_key: str | None = Field(default=None, max_length=3)
    # Raw text; the service cleans it and checks it holds chords. A little room over the stored
    # limit: cleaning only ever makes the text shorter. Not sent together with `lines`.
    body: str | None = Field(default=None, min_length=1, max_length=SHEET_TEXT_MAX_LENGTH + 2000)
    # A chart of a Bhajan or a Spiritual song: the lines of the pasted text with chords over words,
    # like a Prabhat Samgiita chart. Sent instead of `body`; the service writes `body` from it.
    lines: list[SheetLineIn] | None = Field(default=None, min_length=1, max_length=SHEET_MAX_LINES)
    capo: int = Field(default=0, ge=0, le=7)
    strum: str | None = Field(default=None, max_length=40)
    # The chord cycle of a Kiirtan (one or more forms). Sent instead of `body` and `lines`.
    cycle: CycleIn | None = None
    played_it: bool
    note: str | None = Field(default=None, max_length=300)
    is_anonymous: bool = False
    # A new version of the author's own LIVE sheet (same recording and instrument): when it goes
    # live the old one is archived. Checked by the service; ignored when a sheet is edited (PUT).
    replaces_id: UUID | None = None
    # "Start from this chart": somebody else's published chart of the same recording. Credited on
    # the new one. Dropped, not refused, when it is gone or not eligible.
    based_on_id: UUID | None = None

    @field_validator("chart_key")
    @classmethod
    def _key_shape(cls, value: str | None) -> str | None:
        if value is None:
            return None
        key = value.strip()
        if not key:
            return None
        if not SHEET_KEY_PATTERN.fullmatch(key):
            raise ValueError("The key must be a note name such as C, F#, Bb or Am")
        return key

    @field_validator("strum")
    @classmethod
    def _strum_shape(cls, value: str | None) -> str | None:
        if value is None:
            return None
        text = " ".join(value.split())
        if not text:
            return None
        if not STRUM_PATTERN.fullmatch(text):
            raise ValueError("The strum pattern may only use D, U, x, dots and dashes")
        return text

    @model_validator(mode="after")
    def _whole(self) -> SheetCreate:
        if not self.played_it:
            raise ValueError("Please confirm that you played or checked these chords")
        given = [x for x in (self.body, self.lines, self.cycle) if x is not None]
        if len(given) != 1:
            raise ValueError("Send either the chart text, the chart lines or the chord cycle")
        if self.cycle is not None:
            # a cycle is for the guitar or the harmonium like a sheet; a guitar may name its capo, a
            # strum pattern belongs to a chart over words
            if self.strum:
                raise ValueError("A chord cycle has no strum pattern")
            if self.instrument == "harmonium" and self.capo:
                raise ValueError("A harmonium cycle has no capo")
            return self
        if self.lines is None:
            if self.capo or self.strum or self.replaces_id or self.based_on_id:
                raise ValueError("A capo, a strum pattern and versions belong to a chart")
            return self
        if self.chart_key is None or not KEY_PATTERN.fullmatch(self.chart_key):
            raise ValueError("A chart needs its key as a note name such as C, F# or Bb")
        if self.instrument == "harmonium" and (self.capo or self.strum):
            raise ValueError("A harmonium chart has no capo and no strum pattern")
        return self


class SheetAuthor(BaseModel):
    name: str


class SheetLineOut(BaseModel):
    text: str
    placements: list[ChordPlacementOut]


class SheetOut(BaseModel):
    id: str
    recording_id: str
    instrument: SheetInstrument
    chart_key: str | None
    body: str
    # Set for a chart (Bhajan, Spiritual song): the lines with their chords; null for plain text
    lines: list[SheetLineOut] | None = None
    # Set for the chord cycle of a Kiirtan; null for a plain sheet and for a chart
    cycle: CycleOut | None = None
    capo: int = 0
    strum: str | None = None
    based_on: ChordBasedOn | None = None
    # Only the author's own view ever carries an archived chart; `replaced_by` is the newer sheet
    # that took its place, `replaces` the live one a new version on its way will replace.
    archived: bool = False
    replaced_by: str | None = None
    replaces: str | None = None
    chords_count: int
    note: str | None
    played_it: bool
    created_at: datetime
    is_anonymous: bool
    author: SheetAuthor | None
    mine: bool = False
    status: SheetStatus = "published"
    rejected_reason: str | None = None
    can_review: bool = False
    # Filled only in the member's own list (`/mine`): the title of the recording, to name the chart
    recording_title: str | None = None


class SheetList(BaseModel):
    items: list[SheetOut]
    total: int


class AdminSheetOut(SheetOut):
    author_id: str
    author_name: str
    reports_count: int
    reviewed_at: datetime | None = None
    reviewed_by: str | None = None
    published_at: datetime | None = None


class AdminSheetList(BaseModel):
    items: list[AdminSheetOut]
    total: int


class SheetReportCreate(BaseModel):
    reason: SheetReportReason
    note: str | None = Field(default=None, max_length=1000)


class SheetRejectRequest(BaseModel):
    reason: str = Field(min_length=3, max_length=500)


# --------------------------------------------------------------------------- video links

VideoProvider = Literal["youtube", "vimeo", "archive"]
VideoReportReason = Literal["broken", "not_about_this", "offensive", "spam", "other"]
VideoFilter = Literal["reported", "removed", "all"]
VideoLinkStatus = Literal["unknown", "ok", "no_embed", "unavailable"]


class VideoCreate(BaseModel):
    # The pasted link. Long enough for a YouTube link with tracking parameters; the service
    # rebuilds the stored address from the provider and the id, never from this text.
    url: str = Field(min_length=1, max_length=VIDEO_URL_MAX_LENGTH + 200)
    title: str | None = Field(default=None, max_length=VIDEO_TITLE_MAX_LENGTH + 120)
    is_anonymous: bool = False


class VideoOut(BaseModel):
    id: str
    provider: VideoProvider
    url: str
    title: str | None
    created_at: datetime
    is_anonymous: bool
    author: CommentAuthor | None
    mine: bool = False
    can_remove: bool = False
    # What the last automatic look found: unknown, ok (may be shown inside the app), no_embed (its
    # owner does not allow other apps to show it: offer Open), unavailable (gone or private). A
    # hint.
    link_status: VideoLinkStatus = "unknown"


class VideoList(BaseModel):
    items: list[VideoOut]
    total: int
    # how many more the target takes before it is full (so the app can say so before a try)
    room: int


class AdminVideoOut(BaseModel):
    id: str
    song_id: int | None
    recording_id: str | None
    provider: VideoProvider
    url: str
    title: str | None
    created_at: datetime
    is_anonymous: bool
    status: Literal["published", "removed"]
    reports_count: int
    author_id: UUID
    author_name: str
    removed_reason: str | None = None
    removed_by: str | None = None
    link_status: VideoLinkStatus = "unknown"
    checked_at: datetime | None = None


class AdminVideoList(BaseModel):
    items: list[AdminVideoOut]
    total: int


class VideoReportCreate(BaseModel):
    reason: VideoReportReason
    note: str | None = Field(default=None, max_length=1000)


class RemoveRequest(BaseModel):
    reason: str = Field(default="", max_length=500)


class ReportResponse(BaseModel):
    status: Literal["received", "already_reported"]
    message: str
