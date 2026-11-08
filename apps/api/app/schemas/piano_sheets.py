"""Shapes of the piano notes API (`/api/v1/piano-notes`). Design: docs/piano-notation.md."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.models.piano_sheets import PIANO_LINK_MAX_LENGTH

PianoLevel = Literal["one_finger", "two_hands"]
PianoStatus = Literal["pending", "published", "rejected"]
PianoSa = Literal["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
PianoHand = Literal["right", "left"]
PianoReportReason = Literal["wrong_notes", "offensive", "spam", "other"]
PianoFilter = Literal["pending", "reported", "published", "rejected", "all"]

# What one sheet may hold (the same limits protect the phone and the database).
MAX_ROWS = 24
MAX_STEPS_PER_ROW = 128
MAX_STEPS = 600
MAX_KEYS_PER_STEP = 6
MIN_KEY = -24  # two octaves below Sa
MAX_KEY = 36  # three octaves above Sa
MAX_BEATS = 16.0
MAX_REPEAT = 16
MAX_LABEL = 40
MIN_SOUNDING_STEPS = 2


class PianoStep(BaseModel):
    """The keys pressed together (semitones above Sa; empty = a rest) and their length in beats."""

    k: list[int] = Field(default_factory=list, max_length=MAX_KEYS_PER_STEP)
    b: float = Field(default=1.0, gt=0, le=MAX_BEATS)

    @field_validator("k")
    @classmethod
    def _keys(cls, keys: list[int]) -> list[int]:
        if any(not MIN_KEY <= key <= MAX_KEY for key in keys):
            raise ValueError("A key is out of the range of the keyboard.")
        return sorted(set(keys))

    @field_validator("b")
    @classmethod
    def _beats(cls, beats: float) -> float:
        # quarter beats: 0.25, 0.5, 1, 1.5 ... so the numbers stay readable and comparable
        if abs(beats * 4 - round(beats * 4)) > 1e-9:
            raise ValueError("Beats come in quarters.")
        return round(beats * 4) / 4


class PianoRow(BaseModel):
    label: str | None = Field(default=None, max_length=MAX_LABEL + 40)
    repeat: int = Field(default=1, ge=1, le=MAX_REPEAT)
    hand: PianoHand = "right"
    steps: list[PianoStep] = Field(min_length=1, max_length=MAX_STEPS_PER_ROW)


class PianoSheetCreate(BaseModel):
    sa_key: PianoSa = "C"
    rows: list[PianoRow] = Field(min_length=1, max_length=MAX_ROWS)
    link_url: str | None = Field(default=None, max_length=PIANO_LINK_MAX_LENGTH + 100)
    note: str | None = Field(default=None, max_length=300)
    is_anonymous: bool = False
    # A new version of the author's own LIVE sheet of the same target.
    replaces_id: str | None = None
    # "Start from this sheet": somebody else's published sheet of the same target (credited).
    based_on_id: str | None = None


class PianoAuthor(BaseModel):
    name: str


class PianoBasedOn(BaseModel):
    id: str | None = None
    name: str | None = None


class PianoSheetOut(BaseModel):
    id: str
    recording_id: str | None = None
    song_number: int | None = None
    sa_key: PianoSa
    level: PianoLevel
    rows: list[PianoRow]
    steps_count: int
    link_url: str | None = None
    note: str | None = None
    created_at: datetime
    is_anonymous: bool
    author: PianoAuthor | None = None
    # the notes of the author of the recording (live at once): shown as such
    by_recording_author: bool = False
    based_on: PianoBasedOn | None = None
    archived: bool = False
    replaced_by: str | None = None
    replaces: str | None = None
    mine: bool = False
    status: PianoStatus = "published"
    rejected_reason: str | None = None
    can_review: bool = False
    recording_title: str | None = None


class PianoSheetList(BaseModel):
    items: list[PianoSheetOut]
    total: int


class AdminPianoSheetOut(PianoSheetOut):
    author_id: str
    author_name: str
    reports_count: int
    reviewed_at: datetime | None = None
    reviewed_by: str | None = None
    published_at: datetime | None = None


class AdminPianoSheetList(BaseModel):
    items: list[AdminPianoSheetOut]
    total: int


class PianoReportCreate(BaseModel):
    reason: PianoReportReason
    note: str | None = Field(default=None, max_length=1000)


class PianoRejectRequest(BaseModel):
    reason: str = Field(min_length=3, max_length=500)


class PianoReportResponse(BaseModel):
    status: Literal["received", "already_reported"]
    message: str


class PianoRecordingIds(BaseModel):
    """Recordings that have at least one published sheet (feeds the shelf "Kiirtan for piano")."""

    recording_ids: list[str]
