from typing import Any, Literal

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


class MediaItemResponse(BaseModel):
    kind: str
    provider: str
    title: str
    url: str
    embed_url: str | None = None
    verification_status: str
    source_url: str | None = None
    notes: str | None = None
    external_id: str | None = None
    channel_name: str | None = None
    source_status: str | None = None
    rights_status: str | None = None
    availability_status: str | None = None
    language: str | None = None
    match_score: float | None = None


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
    media: list[MediaItemResponse] = Field(default_factory=list)
    notation_scale: str | None = None
    notation_source_url: str | None = None
    notation_verification_status: str | None = None
    notation_transposition_available: bool = False
    metadata_json: dict[str, Any] = Field(default_factory=dict)


class SearchRequest(BaseModel):
    query: str = Field(min_length=1)


class RecommendationRequest(BaseModel):
    date: str | None = None
    timezone: str | None = None
    day: str | None = None
    occasion: str | None = None
    festival: str | None = None
    season: str | None = None
    mood: str | None = None
    language: str | None = None
    difficulty: str | None = None
    meditation_context: str | None = None
    time_of_day: str | None = None
    media_preference: str | None = None
    maximum_results: int = Field(default=20, ge=1, le=100)


class ConversationTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=2000)


class ExplanationRequest(BaseModel):
    song_number: int
    prompt: str | None = None
    history: list[ConversationTurn] = Field(default_factory=list, max_length=8)


class SongLocalizationResponse(BaseModel):
    song_number: int
    language: str
    localized_title: str | None = None
    localized_first_line: str | None = None
    localized_meaning: str | None = None
    localized_explanation: str | None = None


SongDetail.model_rebuild()
