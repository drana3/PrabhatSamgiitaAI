from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class UserAccount(Base, TimestampMixin):
    __tablename__ = "user_accounts"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    external_subject: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    identity_provider: Mapped[str] = mapped_column(String(64), nullable=False)
    email: Mapped[str | None] = mapped_column(String(320), index=True)
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    avatar_url: Mapped[str | None] = mapped_column(Text)
    preferred_language: Mapped[str | None] = mapped_column(String(32))
    country: Mapped[str | None] = mapped_column(String(128))
    personalization_enabled: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default="true", nullable=False
    )
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class UserFavorite(Base, TimestampMixin):
    __tablename__ = "user_favorites"
    __table_args__ = (UniqueConstraint("user_id", "song_number", name="uq_user_favorite"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("user_accounts.id", ondelete="CASCADE"), index=True
    )
    song_number: Mapped[int] = mapped_column(Integer, nullable=False, index=True)


class UserPlaylist(Base, TimestampMixin):
    __tablename__ = "user_playlists"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("user_accounts.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)


class UserPlaylistSong(Base, TimestampMixin):
    __tablename__ = "user_playlist_songs"
    __table_args__ = (
        UniqueConstraint("playlist_id", "song_number", name="uq_user_playlist_song"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    playlist_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("user_playlists.id", ondelete="CASCADE"), index=True
    )
    song_number: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    position: Mapped[int] = mapped_column(Integer, default=0, server_default="0")


class UserChatMessage(Base, TimestampMixin):
    __tablename__ = "user_chat_messages"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("user_accounts.id", ondelete="CASCADE"), index=True
    )
    song_number: Mapped[int | None] = mapped_column(Integer, index=True)
    role: Mapped[str] = mapped_column(String(16), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )


class UserInterestProfile(Base, TimestampMixin):
    __tablename__ = "user_interest_profiles"

    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("user_accounts.id", ondelete="CASCADE"),
        primary_key=True,
    )
    summary_text: Mapped[str] = mapped_column(Text, default="", server_default="")
    topic_counts: Mapped[dict[str, Any]] = mapped_column(
        JSONB, default=dict, server_default=text("'{}'::jsonb")
    )
    song_counts: Mapped[dict[str, Any]] = mapped_column(
        JSONB, default=dict, server_default=text("'{}'::jsonb")
    )
    language_counts: Mapped[dict[str, Any]] = mapped_column(
        JSONB, default=dict, server_default=text("'{}'::jsonb")
    )


class CommunityTestimonial(Base, TimestampMixin):
    __tablename__ = "community_testimonials"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("user_accounts.id", ondelete="SET NULL"), index=True
    )
    quote_text: Mapped[str] = mapped_column(Text, nullable=False)
    display_name: Mapped[str] = mapped_column(String(120), nullable=False)
    display_location: Mapped[str | None] = mapped_column(String(160))
    avatar_url: Mapped[str | None] = mapped_column(Text)
    consented_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(
        String(32), default="pending", server_default="pending", index=True
    )


class ReflectionQuote(Base, TimestampMixin):
    __tablename__ = "reflection_quotes"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    quote_text: Mapped[str] = mapped_column(Text, nullable=False)
    attribution: Mapped[str] = mapped_column(String(255), nullable=False)
    source_title: Mapped[str] = mapped_column(String(500), nullable=False)
    source_url: Mapped[str] = mapped_column(Text, nullable=False)
    source_date: Mapped[str | None] = mapped_column(String(64))
    themes: Mapped[dict[str, Any]] = mapped_column(
        JSONB, default=dict, server_default=text("'{}'::jsonb")
    )
    observances: Mapped[dict[str, Any]] = mapped_column(
        JSONB, default=dict, server_default=text("'{}'::jsonb")
    )
    verification_status: Mapped[str] = mapped_column(
        String(32), default="pending", server_default="pending", index=True
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default="true", nullable=False
    )


class InspirationStoryRecord(Base, TimestampMixin):
    __tablename__ = "inspiration_stories"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    slug: Mapped[str] = mapped_column(String(120), unique=True, index=True, nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    author: Mapped[str] = mapped_column(String(255), nullable=False)
    teaser: Mapped[str] = mapped_column(Text, nullable=False)
    source_url: Mapped[str] = mapped_column(Text, nullable=False)
    body_paragraphs: Mapped[list[Any]] = mapped_column(
        JSONB, default=list, server_default=text("'[]'::jsonb")
    )
    themes: Mapped[list[Any]] = mapped_column(
        JSONB, default=list, server_default=text("'[]'::jsonb")
    )
    song_numbers: Mapped[list[Any]] = mapped_column(
        JSONB, default=list, server_default=text("'[]'::jsonb")
    )
    verification_status: Mapped[str] = mapped_column(
        String(32), default="source_verified", server_default="source_verified", index=True
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default="true", nullable=False
    )


class QuizAttempt(Base, TimestampMixin):
    __tablename__ = "quiz_attempts"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("user_accounts.id", ondelete="CASCADE"), index=True
    )
    level: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    question_ids: Mapped[list[Any]] = mapped_column(
        JSONB, default=list, server_default=text("'[]'::jsonb")
    )
    answers: Mapped[list[Any]] = mapped_column(
        JSONB, default=list, server_default=text("'[]'::jsonb")
    )
    score: Mapped[int | None] = mapped_column(Integer)
    passed: Mapped[bool | None] = mapped_column(Boolean)
    status: Mapped[str] = mapped_column(
        String(32), default="in_progress", server_default="in_progress", nullable=False
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class QuizCertification(Base, TimestampMixin):
    __tablename__ = "quiz_certifications"
    __table_args__ = (UniqueConstraint("user_id", "level", name="uq_quiz_certification_user_level"),)

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("user_accounts.id", ondelete="CASCADE"), index=True
    )
    level: Mapped[str] = mapped_column(String(32), nullable=False)
    attempt_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("quiz_attempts.id", ondelete="CASCADE"), nullable=False
    )
    certificate_code: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    earned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
