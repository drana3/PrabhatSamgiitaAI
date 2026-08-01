from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator

Octave = Literal["lower", "middle", "upper"]


class NotationNote(BaseModel):
    sargam: str
    western: str | None = None
    duration: float = Field(gt=0)
    octave: Octave = "middle"
    syllable: str | None = None
    ornament: str | None = None

    @field_validator("sargam")
    @classmethod
    def validate_sargam(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("sargam is required")
        return value.strip()


class NotationBeat(BaseModel):
    beat: int = Field(ge=1)
    notes: list[NotationNote] = Field(default_factory=list)


class NotationMeasure(BaseModel):
    beats: list[NotationBeat] = Field(default_factory=list)


class NotationLine(BaseModel):
    line_number: int = Field(ge=1)
    lyrics: str
    transliteration: str | None = None
    measures: list[NotationMeasure] = Field(default_factory=list)


class TalaSpec(BaseModel):
    name: str
    beats: int = Field(ge=1)
    groups: list[int] = Field(default_factory=list)


class HarmoniumNotation(BaseModel):
    version: int = 1
    source_scale: str
    tempo_bpm: int | None = Field(default=None, ge=1)
    tala: TalaSpec | None = None
    lines: list[NotationLine] = Field(default_factory=list)


class TransposedNotationResponse(BaseModel):
    song_number: int
    source_scale: str
    target_scale: str
    verification_status: str
    notation: HarmoniumNotation


class NotationSourceResponse(BaseModel):
    song_number: int
    source_url: str
    verification_status: str
    learner_verification_status: str | None = None
    machine_readable: bool = False
    transposition_available: bool = False
