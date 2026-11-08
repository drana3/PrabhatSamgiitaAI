"""Request and response shapes of the recording extras (docs/recording-extras.md).

Every PUBLIC shape (`*Out`) has no member id, no email and, for an anonymous item, no name and no
avatar: `author` is null. The team's shapes (`Admin*`) know the author. A test walks the whole JSON.
"""

from __future__ import annotations

import re
from datetime import datetime
from typing import Literal
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
        if (self.body is None) == (self.lines is None):
            raise ValueError("Send either the chart text or the chart lines")
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
