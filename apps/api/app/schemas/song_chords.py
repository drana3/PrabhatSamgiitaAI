"""Request and response shapes of the chord proposals (docs: apps/mobile/docs/chord-proposals.md).

`ChordProposalOut` is the PUBLIC shape: no member id, no email and, for an anonymous proposal, no
name: `author` is null. The team's shape (`AdminChordProposalOut`) knows the author.
"""

from __future__ import annotations

import re
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from app.models.recordings import PS_SONG_COUNT

Instrument = Literal["guitar", "harmonium"]
ChordStatus = Literal["pending", "published", "rejected"]
ChordReportReason = Literal["wrong_chords", "offensive", "spam", "other"]
AdminFilter = Literal["pending", "reported", "published", "rejected", "all"]

MAX_LINES = 400
MAX_PLACEMENTS_PER_LINE = 80
MAX_PLACEMENTS = 1500
MAX_WORD_INDEX = 199

# Every pattern is used with `fullmatch`: `$` would also accept a trailing newline.
KEY_PATTERN = re.compile(r"[A-G][#b]?")
# A root, then up to ten pieces of a chord's name that musicians really write (m, min, maj, M, dim,
# aug, sus, add, the degree and alteration signs and digits, the diminished and half-diminished
# signs), then an optional bass note (G/B) or a second number (C6/9). "Cfoo" is not a chord name.
CHORD_PATTERN = re.compile(
    r"[A-G][#b]?(?:maj|min|dim|aug|sus|add|m|M|°|ø|\+|-|#|b|\d|\(|\)){0,10}"
    r"(?:/(?:[A-G][#b]?|\d{1,2}))?"
)
STRUM_PATTERN = re.compile(r"[DUduxX.\-\s^v|()0-9]{0,40}")


class ChordPlacementIn(BaseModel):
    word: int = Field(ge=0, le=MAX_WORD_INDEX)
    chord: str = Field(min_length=1, max_length=16)

    @field_validator("chord")
    @classmethod
    def _chord_shape(cls, value: str) -> str:
        chord = value.strip()
        if not CHORD_PATTERN.fullmatch(chord):
            raise ValueError(f"'{value}' is not a chord name")
        return chord


class ChordLineIn(BaseModel):
    placements: list[ChordPlacementIn] = Field(
        default_factory=list, max_length=MAX_PLACEMENTS_PER_LINE
    )


class ChordProposalCreate(BaseModel):
    song_id: int = Field(ge=1, le=PS_SONG_COUNT)
    instrument: Instrument
    base_key: str = Field(min_length=1, max_length=3)
    capo: int = Field(default=0, ge=0, le=7)
    strum: str | None = Field(default=None, max_length=40)
    lines: list[ChordLineIn] = Field(min_length=1, max_length=MAX_LINES)
    # "I played / checked it": the member must say so.
    played_it: bool
    note: str | None = Field(default=None, max_length=300)
    is_anonymous: bool = False

    @field_validator("base_key")
    @classmethod
    def _key_shape(cls, value: str) -> str:
        key = value.strip()
        if not KEY_PATTERN.fullmatch(key):
            raise ValueError("The key must be a note name such as C, F# or Bb")
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
    def _whole(self) -> ChordProposalCreate:
        if self.instrument == "harmonium" and self.capo != 0:
            raise ValueError("A harmonium chart has no capo")
        if self.instrument == "harmonium" and self.strum:
            raise ValueError("A harmonium chart has no strum pattern")
        if not self.played_it:
            raise ValueError("Please confirm that you played or checked these chords")
        total = sum(len(line.placements) for line in self.lines)
        if total == 0:
            raise ValueError("Put at least one chord over a word")
        if total > MAX_PLACEMENTS:
            raise ValueError("Too many chords for one song")
        return self


class ChordPlacementOut(BaseModel):
    word: int
    chord: str


class ChordLineOut(BaseModel):
    placements: list[ChordPlacementOut]


class ChordAuthor(BaseModel):
    name: str


class ChordProposalOut(BaseModel):
    id: str
    song_id: int
    instrument: Instrument
    base_key: str
    capo: int
    strum: str | None
    lines: list[ChordLineOut]
    note: str | None
    played_it: bool
    created_at: datetime
    is_anonymous: bool
    # null for an anonymous proposal, whoever asks
    author: ChordAuthor | None
    # Filled only for the signed-in author asking about their own proposal.
    mine: bool = False
    status: ChordStatus = "published"
    rejected_reason: str | None = None
    # true for the team (any proposal can be rejected)
    can_review: bool = False


class ChordProposalList(BaseModel):
    items: list[ChordProposalOut]
    total: int


class ChordReportCreate(BaseModel):
    reason: ChordReportReason
    note: str | None = Field(default=None, max_length=1000)


class ChordReportResponse(BaseModel):
    status: Literal["received", "already_reported"]
    message: str


class RejectRequest(BaseModel):
    reason: str = Field(min_length=3, max_length=500)
    reviewer: str | None = Field(default=None, max_length=255)


class ReviewRequest(BaseModel):
    reviewer: str | None = Field(default=None, max_length=255)


class AdminChordProposalOut(ChordProposalOut):
    author_id: str
    author_name: str
    reports_count: int
    reviewed_at: datetime | None = None
    reviewed_by: str | None = None
    published_at: datetime | None = None


class AdminChordProposalList(BaseModel):
    items: list[AdminChordProposalOut]
    total: int
