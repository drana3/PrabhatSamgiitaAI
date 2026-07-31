from __future__ import annotations

from pydantic import BaseModel, Field


class SearchFilters(BaseModel):
    language: str | None = None
    theme: str | None = None
    occasion: str | None = None
    festival: str | None = None
    season: str | None = None
    difficulty: str | None = None
    verification_status: str | None = None
    has_audio: bool | None = None
    has_video: bool | None = None
    has_notation: bool | None = None


class MediaSummary(BaseModel):
    audio_count: int = 0
    video_count: int = 0
    notation_count: int = 0


class SearchResultItem(BaseModel):
    song_number: int
    opening_line: str | None = None
    matched_by: list[str] = Field(default_factory=list)
    score: float = 0.0
    verification_status: str = "pending"
    themes: list[str] = Field(default_factory=list)
    media_summary: MediaSummary = Field(default_factory=MediaSummary)


class SearchResponse(BaseModel):
    query: str
    detected_intent: str
    total: int
    items: list[SearchResultItem] = Field(default_factory=list)
