from collections.abc import Callable
from importlib import import_module
from typing import Any

from sqlalchemy import Boolean, Integer, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON, TypeDecorator

from app.core.vector import VECTOR_DIMENSION
from app.models.base import Base, TimestampMixin

try:
    vector_factory: Callable[[int], Any] = import_module("pgvector.sqlalchemy").Vector
except ImportError:  # pragma: no cover - fallback for lightweight test environments

    class FallbackVector(TypeDecorator[list[float]]):
        impl = JSON
        cache_ok = True

        def __init__(self, dimension: int) -> None:
            super().__init__()
            self.dimension = dimension

    vector_factory = FallbackVector


class Song(Base, TimestampMixin):
    __tablename__ = "songs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    number: Mapped[int] = mapped_column(Integer, unique=True, index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    first_line: Mapped[str | None] = mapped_column(String(512))
    lyrics_original: Mapped[str | None] = mapped_column(Text)
    transliteration: Mapped[str | None] = mapped_column(Text)
    hindi_meaning: Mapped[str | None] = mapped_column(Text)
    english_meaning: Mapped[str | None] = mapped_column(Text)
    theme: Mapped[str | None] = mapped_column(String(255))
    occasion: Mapped[str | None] = mapped_column(String(255))
    festival: Mapped[str | None] = mapped_column(String(255))
    season: Mapped[str | None] = mapped_column(String(255))
    mood: Mapped[str | None] = mapped_column(String(255))
    language: Mapped[str | None] = mapped_column(String(64))
    difficulty: Mapped[str | None] = mapped_column(String(64))
    meditation_context: Mapped[str | None] = mapped_column(String(255))
    raga: Mapped[str | None] = mapped_column(String(255))
    tala: Mapped[str | None] = mapped_column(String(255))
    harmonium_notation: Mapped[str | None] = mapped_column(Text)
    canonical_source_url: Mapped[str | None] = mapped_column(String(512))
    canonical_source_status: Mapped[str] = mapped_column(
        String(32), default="pending", server_default="pending", nullable=False
    )
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    embeddings: Mapped[list[float] | None] = mapped_column(vector_factory(VECTOR_DIMENSION))
    metadata_json: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        default=dict,
        server_default=text("'{}'::jsonb"),
    )
