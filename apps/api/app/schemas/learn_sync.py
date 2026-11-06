"""Wire format of the Learn progress document (docs/learn-sync.md)."""

from __future__ import annotations

from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

MAX_SONG_NUMBER = 5018
"""Prabhat Samgiita has 5,018 numbered songs (the app checks the same range)."""

MAX_ENTRIES = 1000
"""Songs plus removed-song markers one member may keep. Over this the write is refused (413)."""

MAX_TIME_MS = 4_102_444_800_000  # 2100-01-01, a sanity bound for client timestamps

Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
Millis = Annotated[int, Field(ge=0, le=MAX_TIME_MS)]


class LearnPath(BaseModel):
    """The steps done on one song (the app's three steps, plus a passed song quiz)."""

    model_config = ConfigDict(extra="forbid")

    listen: bool = False
    words: bool = False
    meaning: bool = False
    chords: bool = False


class LearnSongEntry(BaseModel):
    """One song of the learner's list and what was done on it.

    `removed` is a marker: the song was taken off the list. The marker travels so that taking a
    song off on one phone does it on the others; its progress is kept, as in the app.
    """

    model_config = ConfigDict(extra="forbid")

    song_id: Annotated[str, Field(pattern=r"^ps-[0-9]{1,4}$")]
    number: Annotated[int, Field(ge=1, le=MAX_SONG_NUMBER)]
    title: Title
    started_at: Millis
    removed: bool = False
    path: LearnPath = Field(default_factory=LearnPath)
    # When this entry was last changed on the phone that wrote it (ms since 1970). Newest wins.
    updated_at: Annotated[int, Field(ge=1, le=MAX_TIME_MS)]

    @model_validator(mode="after")
    def _id_matches_number(self) -> LearnSongEntry:
        if self.song_id != f"ps-{self.number}":
            raise ValueError("song_id must be ps-<number>")
        return self


class LearnProgressWrite(BaseModel):
    """The entries a phone changed. Entries it left out are not touched (this is a merge)."""

    model_config = ConfigDict(extra="forbid")

    songs: Annotated[list[LearnSongEntry], Field(max_length=MAX_ENTRIES)] = Field(
        default_factory=list
    )

    @model_validator(mode="after")
    def _no_duplicates(self) -> LearnProgressWrite:
        ids = [entry.song_id for entry in self.songs]
        if len(ids) != len(set(ids)):
            raise ValueError("a song may appear once")
        return self


class LearnProgressResponse(BaseModel):
    songs: list[LearnSongEntry]
    # When the server copy last changed; null when this member never synced.
    updated_at: datetime | None = None
    max_entries: int = MAX_ENTRIES
