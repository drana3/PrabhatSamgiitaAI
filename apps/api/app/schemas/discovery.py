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
    audio_url: str | None = None
    video_embed_url: str | None = None
    notation_available: bool = False


class ContextSignalResponse(BaseModel):
    title: str
    category: str
    summary: str
    source_name: str
    source_url: str


class TodayResponse(BaseModel):
    context: dict[str, Any]
    recommendations: list[TodayRecommendationItem]
    signals: list[ContextSignalResponse] = Field(default_factory=list)
    disclaimer: str


class ReflectionQuoteResponse(BaseModel):
    quote_text: str
    attribution: str
    source_title: str
    source_url: str
    source_date: str | None = None
    context_label: str
    verification_status: str


class CommunityTestimonialResponse(BaseModel):
    quote_text: str
    display_name: str
    display_location: str | None = None
    avatar_url: str | None = None


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


class UserFeedbackRequest(BaseModel):
    category: Literal[
        "experience", "content", "search", "audio_video", "ai", "accessibility", "other"
    ]
    rating: int = Field(ge=1, le=5)
    comment: str = Field(min_length=3, max_length=2000)
    page_path: str | None = Field(default=None, max_length=512)
    contact: str | None = Field(default=None, max_length=320)


class UserFeedbackResponse(BaseModel):
    feedback_id: str
    status: str
    message: str


class AnalyticsEventRequest(BaseModel):
    metric_type: Literal["page_view", "feature_use"]
    dimension: str = Field(min_length=1, max_length=256, pattern=r"^[a-zA-Z0-9/_-]+$")
