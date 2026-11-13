"""Shapes of the recording-mood API (docs/search-menu.md, section 6)."""

from __future__ import annotations

from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


class MoodState(BaseModel):
    mood: str
    # none: nobody proposed it (or it was rejected, and the viewer is not the team)
    status: Literal["none", "suggested", "confirmed", "rejected"]
    source: Literal["uploader", "listeners", "team"] | None = None
    locked: bool = False
    yes: int = 0
    no: int = 0
    mine: Literal["yes", "no"] | None = None


class MoodNeeded(BaseModel):
    uploader: int
    listeners: int


class RecordingMoods(BaseModel):
    recording_id: UUID
    moods: list[MoodState]
    can_vote: bool
    # sign_in | own | too_new | listen_first, when can_vote is false
    cannot_vote_because: str | None = None
    can_suggest: bool
    needed: MoodNeeded


class ConfirmedItem(BaseModel):
    recording_id: UUID
    moods: list[str]


class ConfirmedMoods(BaseModel):
    items: list[ConfirmedItem]


class SuggestIn(BaseModel):
    # One or two moods; an empty list means "I am not sure".
    moods: list[str] = Field(default_factory=list, max_length=6)


class VoteIn(BaseModel):
    vote: Literal["yes", "no", "clear"]


class DecisionIn(BaseModel):
    decision: Literal["confirmed", "rejected", "clear"]
