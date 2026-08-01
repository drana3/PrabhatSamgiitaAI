from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class OccasionResponse(BaseModel):
    slug: str
    name: str
    category: str
    description: str


class FestivalResponse(BaseModel):
    slug: str
    name: str
    song_count: int
    verification_status: str
    source_urls: list[str] = Field(default_factory=list)


class TodayRecommendationItem(BaseModel):
    number: int
    title: str
    first_line: str | None = None
    score: float
    reasons: list[str] = Field(default_factory=list)
    is_verified: bool


class TodayResponse(BaseModel):
    context: dict[str, Any]
    recommendations: list[TodayRecommendationItem]
    disclaimer: str


class ContentReportRequest(BaseModel):
    entity_type: Literal["song", "media", "notation", "translation", "recommendation"]
    entity_id: str = Field(min_length=1, max_length=128)
    reason: Literal[
        "incorrect_lyrics",
        "incorrect_translation",
        "incorrect_notation",
        "wrong_media",
        "broken_media",
        "wrong_occasion",
        "copyright_concern",
        "other",
    ]
    comment: str = Field(min_length=3, max_length=1500)


class ContentReportResponse(BaseModel):
    report_id: str
    status: str
    message: str
