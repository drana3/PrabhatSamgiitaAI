from __future__ import annotations

from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import Boolean, Float, ForeignKey, Integer, String, Text, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class Theme(Base, TimestampMixin):
    __tablename__ = "themes"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    slug: Mapped[str] = mapped_column(String(128), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)


class Occasion(Base, TimestampMixin):
    __tablename__ = "occasions"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    slug: Mapped[str] = mapped_column(String(128), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    category: Mapped[str | None] = mapped_column(String(128))
    default_weight: Mapped[float] = mapped_column(Float, default=0.5, server_default="0.5")
    requires_human_approval: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false", nullable=False
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default="true", nullable=False
    )


class SongThemeLink(Base, TimestampMixin):
    __tablename__ = "song_theme_links"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    song_number: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    theme_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("themes.id"), nullable=False
    )
    relevance_score: Mapped[float] = mapped_column(Float, default=0.5, server_default="0.5")
    approval_status: Mapped[str] = mapped_column(
        String(32), default="draft", server_default="draft"
    )
    review_note: Mapped[str | None] = mapped_column(Text)


class SongOccasionLink(Base, TimestampMixin):
    __tablename__ = "song_occasion_links"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    song_number: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    occasion_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("occasions.id"), nullable=False
    )
    relevance_score: Mapped[float] = mapped_column(Float, default=0.5, server_default="0.5")
    approval_status: Mapped[str] = mapped_column(
        String(32), default="draft", server_default="draft"
    )
    review_note: Mapped[str | None] = mapped_column(Text)


class Festival(Base, TimestampMixin):
    __tablename__ = "festivals"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    slug: Mapped[str] = mapped_column(String(128), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    calendar_type: Mapped[str | None] = mapped_column(String(64))
    month: Mapped[int | None] = mapped_column(Integer)
    day: Mapped[int | None] = mapped_column(Integer)
    recurrence_rule: Mapped[str | None] = mapped_column(String(255))
    region: Mapped[str | None] = mapped_column(String(128))
    theme_tags: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        default=dict,
        server_default=text("'{}'::jsonb"),
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default="true", nullable=False
    )


class FestivalSongLink(Base, TimestampMixin):
    __tablename__ = "festival_song_links"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    festival_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("festivals.id"), nullable=False
    )
    song_number: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    relevance_score: Mapped[float] = mapped_column(Float, default=0.5, server_default="0.5")
    approval_status: Mapped[str] = mapped_column(
        String(32), default="draft", server_default="draft"
    )
    reviewed_by: Mapped[str | None] = mapped_column(String(255))
    reviewed_at: Mapped[str | None] = mapped_column(String(64))


class Season(Base, TimestampMixin):
    __tablename__ = "seasons"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    slug: Mapped[str] = mapped_column(String(128), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    hemisphere: Mapped[str | None] = mapped_column(String(64))
    start_month: Mapped[int] = mapped_column(Integer, nullable=False)
    end_month: Mapped[int] = mapped_column(Integer, nullable=False)


class SongSeasonLink(Base, TimestampMixin):
    __tablename__ = "song_season_links"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    song_number: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    season_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("seasons.id"), nullable=False
    )
    relevance_score: Mapped[float] = mapped_column(Float, default=0.5, server_default="0.5")
    approval_status: Mapped[str] = mapped_column(
        String(32), default="draft", server_default="draft"
    )
    review_note: Mapped[str | None] = mapped_column(Text)


class RecommendationAudit(Base, TimestampMixin):
    __tablename__ = "recommendation_audits"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    request_context: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        default=dict,
        server_default=text("'{}'::jsonb"),
    )
    candidate_scores: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        default=dict,
        server_default=text("'{}'::jsonb"),
    )
    selected_song_ids: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        default=dict,
        server_default=text("'{}'::jsonb"),
    )
    algorithm_version: Mapped[str] = mapped_column(String(64), nullable=False, default="r1")


class ContentReport(Base, TimestampMixin):
    __tablename__ = "content_reports"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    entity_type: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    entity_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    reason: Mapped[str] = mapped_column(String(64), nullable=False)
    comment: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(
        String(32), default="new", server_default="new", nullable=False
    )


class UserFeedback(Base, TimestampMixin):
    __tablename__ = "user_feedback"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    category: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    rating: Mapped[int] = mapped_column(Integer, nullable=False)
    comment: Mapped[str] = mapped_column(Text, nullable=False)
    page_path: Mapped[str | None] = mapped_column(String(512))
    contact: Mapped[str | None] = mapped_column(String(320))
    status: Mapped[str] = mapped_column(
        String(32), default="new", server_default="new", nullable=False
    )


class AnalyticsDaily(Base, TimestampMixin):
    __tablename__ = "analytics_daily"
    __table_args__ = (
        UniqueConstraint("metric_date", "metric_type", "dimension", name="uq_analytics_daily"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    metric_date: Mapped[str] = mapped_column(String(10), nullable=False, index=True)
    metric_type: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    dimension: Mapped[str] = mapped_column(String(256), nullable=False, index=True)
    count: Mapped[int] = mapped_column(Integer, default=1, server_default="1", nullable=False)


class ContentAudit(Base, TimestampMixin):
    __tablename__ = "content_audits"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    entity_type: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    entity_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    reviewer: Mapped[str] = mapped_column(String(128), nullable=False)
    previous_status: Mapped[str | None] = mapped_column(String(32))
    new_status: Mapped[str] = mapped_column(String(32), nullable=False)
    review_note: Mapped[str | None] = mapped_column(Text)
