from typing import Any

from pydantic import BaseModel, Field


class SongSummary(BaseModel):
    number: int
    title: str
    first_line: str | None = None
    theme: str | None = None
    occasion: str | None = None
    mood: str | None = None
    language: str | None = None
    difficulty: str | None = None
    is_verified: bool = False


class SongDetail(SongSummary):
    lyrics_original: str | None = None
    transliteration: str | None = None
    hindi_meaning: str | None = None
    english_meaning: str | None = None
    festival: str | None = None
    season: str | None = None
    meditation_context: str | None = None
    raga: str | None = None
    tala: str | None = None
    harmonium_notation: str | None = None
    canonical_source_url: str | None = None
    canonical_source_status: str = "pending"
    related_songs: list["SongSummary"] = Field(default_factory=list)
    media: list[dict[str, Any]] = Field(default_factory=list)
    notation_scale: str | None = None
    metadata_json: dict[str, Any] = Field(default_factory=dict)


class SearchRequest(BaseModel):
    query: str = Field(min_length=1)


class RecommendationRequest(BaseModel):
    date: str | None = None
    day: str | None = None
    occasion: str | None = None
    festival: str | None = None
    season: str | None = None
    mood: str | None = None
    language: str | None = None
    difficulty: str | None = None
    meditation_context: str | None = None


class ExplanationRequest(BaseModel):
    song_number: int
    prompt: str | None = None


SongDetail.model_rebuild()
