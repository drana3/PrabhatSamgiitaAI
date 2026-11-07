"""Request and answer shapes of the playlists from an event (docs/kiirtan-sets.md)."""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from typing import Literal, Self
from uuid import UUID

from pydantic import BaseModel, Field, field_validator, model_validator

from app.models.recordings import DANCES, KIND_LANGUAGE_RULE
from app.schemas.recordings import Kind, RecordingOut
from app.services.recording_languages import OTHER, clean_language_other, normalize_language

SetState = Literal["draft", "uploading", "published", "removed"]
AdminSetFilter = Literal["all", "active", "removed"]


def _not_far_in_the_future(value: date | None) -> date | None:
    if value is not None and value > datetime.now(UTC).date() + timedelta(days=1):
        raise ValueError("The date cannot be in the future.")
    return value


class _SetFields(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=1000)
    place: str | None = Field(default=None, max_length=200)
    starts_on: date
    ends_on: date | None = None
    cover_url: str | None = Field(default=None, max_length=500, pattern=r"^https://\S+$")
    default_kind: Kind = "kiirtan"
    default_language: str | None = Field(default=None, max_length=16)
    default_language_other: str | None = Field(default=None, max_length=200)
    default_dance: str | None = Field(default=None, max_length=16)

    @field_validator("starts_on", "ends_on")
    @classmethod
    def _dates_not_in_the_future(cls, value: date | None) -> date | None:
        return _not_far_in_the_future(value)

    @field_validator("default_language", mode="before")
    @classmethod
    def _known_language(cls, value: object) -> str | None:
        if value is None or isinstance(value, str):
            return normalize_language(value)
        raise ValueError("Choose a language from the list.")

    @model_validator(mode="after")
    def _consistent(self) -> Self:
        if self.ends_on is not None and self.ends_on < self.starts_on:
            raise ValueError("The last day cannot be before the first day.")
        if KIND_LANGUAGE_RULE.get(self.default_kind) == "none":
            self.default_language = None
        self.default_language_other = (
            clean_language_other(self.default_language_other)
            if self.default_language == OTHER
            else None
        )
        if self.default_language == OTHER and not self.default_language_other:
            raise ValueError("Write the name of the language.")
        if self.default_kind == "dance_song":
            if self.default_dance and self.default_dance.lower() not in DANCES:
                raise ValueError("Choose one of the dances: " + ", ".join(DANCES) + ".")
            self.default_dance = self.default_dance.lower() if self.default_dance else None
        else:
            self.default_dance = None
        return self


class SetCreate(_SetFields):
    # The phone makes the id, so a create that is sent twice (the app was killed, no answer came)
    # finds the same set instead of making a second one.
    id: UUID | None = None
    tracks_expected: int = Field(default=0, ge=0, le=1000)


class SetPatch(BaseModel):
    """Every field optional; only the ones sent change. `cover_url: null` removes the cover."""

    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=1000)
    place: str | None = Field(default=None, max_length=200)
    starts_on: date | None = None
    ends_on: date | None = None
    cover_url: str | None = Field(default=None, max_length=500, pattern=r"^https://\S+$")
    default_kind: Kind | None = None
    tracks_expected: int | None = Field(default=None, ge=0, le=1000)

    @field_validator("starts_on", "ends_on")
    @classmethod
    def _dates_not_in_the_future(cls, value: date | None) -> date | None:
        return _not_far_in_the_future(value)


class SetOrder(BaseModel):
    recording_ids: list[UUID] = Field(min_length=1, max_length=1000)


class TrackAttach(BaseModel):
    recording_id: UUID
    position: int | None = Field(default=None, ge=1, le=1000)


class TrackPatch(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    recorded_on: date | None = None

    @field_validator("recorded_on")
    @classmethod
    def _not_in_the_future(cls, value: date | None) -> date | None:
        return _not_far_in_the_future(value)


class SetOut(BaseModel):
    id: str
    title: str
    description: str | None
    place: str | None
    starts_on: date
    ends_on: date | None
    cover_url: str | None
    owner_id: str | None
    owner_name: str
    default_kind: Kind
    default_language: str | None
    default_language_other: str | None
    default_dance: str | None
    tracks_expected: int
    tracks_count: int
    state: SetState
    finished_at: datetime | None
    created_at: datetime
    # Only for the owner and the team.
    removed_reason: str | None = None
    removed_at: datetime | None = None


class SetDetail(SetOut):
    tracks: list[RecordingOut]


class SetList(BaseModel):
    items: list[SetOut]
    total: int


class SetRemove(BaseModel):
    reason: str = Field(min_length=3, max_length=500)
    reviewer: str | None = Field(default=None, max_length=255)


class SetRestore(BaseModel):
    reviewer: str | None = Field(default=None, max_length=255)
