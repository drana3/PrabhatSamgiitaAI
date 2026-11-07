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
    SHEET_TEXT_MAX_LENGTH,
    VIDEO_TITLE_MAX_LENGTH,
    VIDEO_URL_MAX_LENGTH,
)
from app.schemas.song_comments import CommentAuthor

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


class RecordingCommentList(BaseModel):
    items: list[RecordingCommentOut]
    total: int
    limit: int
    offset: int
    has_more: bool


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


class SheetCreate(BaseModel):
    instrument: SheetInstrument
    # The key the chords are written in. Optional: many players do not know it.
    chart_key: str | None = Field(default=None, max_length=3)
    # Raw text; the service cleans it and checks it holds chords. A little room over the stored
    # limit: cleaning only ever makes the text shorter.
    body: str = Field(min_length=1, max_length=SHEET_TEXT_MAX_LENGTH + 2000)
    played_it: bool
    note: str | None = Field(default=None, max_length=300)
    is_anonymous: bool = False

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

    @model_validator(mode="after")
    def _whole(self) -> SheetCreate:
        if not self.played_it:
            raise ValueError("Please confirm that you played or checked these chords")
        return self


class SheetAuthor(BaseModel):
    name: str


class SheetOut(BaseModel):
    id: str
    recording_id: str
    instrument: SheetInstrument
    chart_key: str | None
    body: str
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
