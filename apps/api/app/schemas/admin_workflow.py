from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator

from app.core.urls import validate_external_media_url
from app.services.ingestion_language import SUPPORTED_LANGUAGES, validate_meaning_language


class IngestionMeaningEntry(BaseModel):
    language: str = Field(min_length=2, max_length=16)
    text: str = Field(min_length=1, max_length=12000)
    is_primary: bool = False

    @field_validator("language")
    @classmethod
    def supported_language(cls, value: str) -> str:
        code = value.strip().casefold()
        if code not in SUPPORTED_LANGUAGES:
            raise ValueError(f"Unsupported language: {value}")
        return code


class IngestionMediaEntry(BaseModel):
    kind: Literal["audio", "video"]
    url: str
    title: str | None = Field(default=None, max_length=255)
    is_primary: bool = False

    @field_validator("url")
    @classmethod
    def validate_url(cls, value: str) -> str:
        return validate_external_media_url(value)


class SongIngestionWrite(BaseModel):
    song_number: int = Field(ge=1, le=5018)
    lyrics: str | None = Field(default=None, max_length=20000)
    meanings: list[IngestionMeaningEntry] = Field(default_factory=list)
    audio: IngestionMediaEntry | None = None
    video: IngestionMediaEntry | None = None
    notation_text: str | None = Field(default=None, max_length=20000)
    notation_is_primary: bool = False
    comments: str | None = Field(default=None, max_length=4000)


class SongIngestionPreview(BaseModel):
    song_number: int
    existing_lyrics: str | None = None
    existing_meanings: dict[str, str] = Field(default_factory=dict)
    existing_audio_url: str | None = None
    existing_video_url: str | None = None
    existing_notation: str | None = None


class SongIngestionItem(BaseModel):
    id: str
    song_number: int
    status: str
    payload: dict[str, Any]
    language_warnings: list[str] = Field(default_factory=list)
    review_note: str | None = None
    submitted_by_email: str | None = None
    created_at: str


class SongIngestionListResponse(BaseModel):
    total: int
    items: list[SongIngestionItem]


class SongIngestionReviewWrite(BaseModel):
    approve: bool
    review_note: str | None = Field(default=None, max_length=2000)


class YoutubeReviewItem(BaseModel):
    id: str
    external_id: str
    title: str
    url: str
    channel_name: str | None = None
    candidate_song_number: int | None = None
    title_similarity: float | None = None
    review_reason: str
    status: str
    created_at: str


class YoutubeReviewListResponse(BaseModel):
    total: int
    items: list[YoutubeReviewItem]


class YoutubeReviewApproveWrite(BaseModel):
    song_number: int = Field(ge=1, le=5018)
    review_note: str | None = Field(default=None, max_length=2000)
    is_primary: bool = True


class LanguageCheckRequest(BaseModel):
    language: str
    text: str


class LanguageCheckResponse(BaseModel):
    ok: bool
    message: str = ""


def collect_language_warnings(payload: SongIngestionWrite) -> list[str]:
    warnings: list[str] = []
    for entry in payload.meanings:
        ok, message = validate_meaning_language(entry.language, entry.text)
        if not ok and message:
            warnings.append(f"{entry.language}: {message}")
    return warnings
