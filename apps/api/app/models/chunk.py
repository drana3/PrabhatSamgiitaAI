from __future__ import annotations

from collections.abc import Callable
from importlib import import_module
from typing import Any

from sqlalchemy import Integer, String, Text, text
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


class SongChunk(Base, TimestampMixin):
    __tablename__ = "song_chunks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    song_number: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    chunk_type: Mapped[str] = mapped_column(String(64), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    source_url: Mapped[str | None] = mapped_column(String(512))
    embeddings: Mapped[list[float] | None] = mapped_column(vector_factory(VECTOR_DIMENSION))
    metadata_json: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        default=dict,
        server_default=text("'{}'::jsonb"),
    )
