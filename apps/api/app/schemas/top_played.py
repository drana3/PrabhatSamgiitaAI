"""Top Played: the most played recordings and Prabhat Samgiita songs, with their counts."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

from app.schemas.recordings import RecordingOut

Period = Literal["all", "30d", "7d"]


class TopPlayedItem(BaseModel):
    rank: int
    # "rec": a recording (its row is in `recording`); "ps": a song of the catalogue (`song_number`)
    ref: Literal["rec", "ps"]
    # the recording's id, or the song number as text: the phone's key is `rec:<id>` / `ps:<number>`
    id: str
    kind: str
    title: str
    author: str
    plays: int
    song_number: int | None = None
    recording: RecordingOut | None = None


class TopPlayedPage(BaseModel):
    period: Period
    kinds: list[str]
    items: list[TopPlayedItem]
    total: int
    has_more: bool
    # the first day anything was counted (ISO date), so the phone can say "counting since ..."
    since: str | None
    # only items with at least this many counted plays are listed
    min_plays: int
