from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator

from app.core.urls import validate_external_media_url

VerificationStatus = Literal["draft", "ai_generated", "human_reviewed", "officially_verified"]


class AdminSongWrite(BaseModel):
    number: int = Field(ge=1, le=5018)
    title: str = Field(min_length=1, max_length=255)
    first_line: str | None = Field(default=None, max_length=512)
    lyrics_original: str | None = None
    transliteration: str | None = None
    hindi_meaning: str | None = None
    english_meaning: str | None = None
    theme: str | None = None
    occasion: str | None = Field(default=None, max_length=255)
    festival: str | None = Field(default=None, max_length=255)
    season: str | None = Field(default=None, max_length=255)
    mood: str | None = Field(default=None, max_length=255)
    language: str | None = Field(default=None, max_length=64)
    difficulty: str | None = Field(default=None, max_length=64)
    meditation_context: str | None = Field(default=None, max_length=255)
    raga: str | None = Field(default=None, max_length=255)
    tala: str | None = Field(default=None, max_length=255)
    canonical_source_url: str | None = Field(default=None, max_length=512)
    canonical_source_status: VerificationStatus = "draft"
    is_verified: bool = False
    metadata_json: dict[str, Any] = Field(default_factory=dict)


class AdminSongUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    first_line: str | None = Field(default=None, max_length=512)
    lyrics_original: str | None = None
    transliteration: str | None = None
    hindi_meaning: str | None = None
    english_meaning: str | None = None
    theme: str | None = None
    occasion: str | None = Field(default=None, max_length=255)
    festival: str | None = Field(default=None, max_length=255)
    season: str | None = Field(default=None, max_length=255)
    mood: str | None = Field(default=None, max_length=255)
    language: str | None = Field(default=None, max_length=64)
    difficulty: str | None = Field(default=None, max_length=64)
    meditation_context: str | None = Field(default=None, max_length=255)
    raga: str | None = Field(default=None, max_length=255)
    tala: str | None = Field(default=None, max_length=255)
    canonical_source_url: str | None = Field(default=None, max_length=512)
    canonical_source_status: VerificationStatus | None = None
    is_verified: bool | None = None
    metadata_json: dict[str, Any] | None = None
    review_note: str | None = Field(default=None, max_length=1000)


class AdminMediaWrite(BaseModel):
    song_number: int = Field(ge=1, le=5018)
    kind: Literal["audio", "video", "performance", "tutorial", "instrumental"]
    provider: Literal[
        "youtube", "vimeo", "official_site", "external_site", "direct_audio", "direct_video"
    ]
    title: str = Field(min_length=1, max_length=255)
    url: str
    embed_url: str | None = None
    verification_status: VerificationStatus = "draft"
    source_url: str | None = None
    notes: str | None = Field(default=None, max_length=2000)
    metadata_json: dict[str, Any] = Field(default_factory=dict)

    @field_validator("url", "embed_url", "source_url")
    @classmethod
    def validate_url(cls, value: str | None) -> str | None:
        return validate_external_media_url(value) if value else None


class AdminMediaUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    url: str | None = None
    embed_url: str | None = None
    verification_status: VerificationStatus | None = None
    source_url: str | None = None
    notes: str | None = Field(default=None, max_length=2000)
    metadata_json: dict[str, Any] | None = None
    review_note: str | None = Field(default=None, max_length=1000)

    @field_validator("url", "embed_url", "source_url")
    @classmethod
    def validate_url(cls, value: str | None) -> str | None:
        return validate_external_media_url(value) if value else None


class AdminNotationWrite(BaseModel):
    song_number: int = Field(ge=1, le=5018)
    source_url: str | None = None
    notation_text: str
    scale: str = Field(min_length=1, max_length=64)
    verification_status: VerificationStatus = "human_reviewed"
    metadata_json: dict[str, Any] = Field(default_factory=dict)

    @field_validator("source_url")
    @classmethod
    def validate_url(cls, value: str | None) -> str | None:
        return validate_external_media_url(value) if value else None


class AdminActionResponse(BaseModel):
    status: str
    entity_type: str
    entity_id: str
