from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class CaptureEvent(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    sargam: str
    western: str
    start_sec: float = Field(ge=0, alias="startSec")
    duration_sec: float = Field(gt=0, alias="durationSec")


class CaptureLine(BaseModel):
    line_number: int
    lyric: str
    lyric_original: str | None = None
    status: Literal["empty", "recorded", "confirmed"] = "empty"
    events: list[CaptureEvent] = Field(default_factory=list)
    sargam: str | None = None


class SargamCaptureResponse(BaseModel):
    song_number: int
    title: str
    booklet_locked: bool = False
    source_scale: str = "C"
    tempo_bpm: int = 100
    can_submit: bool = False
    submitted: bool = False
    notation_enabled: bool = True
    listen_url: str | None = None
    lines: list[CaptureLine] = Field(default_factory=list)


class CaptureTakeWrite(BaseModel):
    events: list[CaptureEvent]
    source_scale: str | None = None
    tempo_bpm: int | None = None


class NotationVisibilityWrite(BaseModel):
    enabled: bool
