from __future__ import annotations

from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import ForeignKey, Integer, String, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class NotationCapture(Base, TimestampMixin):
    __tablename__ = "notation_captures"
    __table_args__ = (
        UniqueConstraint("song_number", "admin_id", name="uq_notation_captures_song_admin"),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    song_number: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    admin_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("user_accounts.id", ondelete="CASCADE"), index=True
    )
    source_scale: Mapped[str] = mapped_column(
        String(8), default="C", server_default="C", nullable=False
    )
    tempo_bpm: Mapped[int] = mapped_column(
        Integer, default=100, server_default="100", nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(32), default="admin_draft", server_default="admin_draft", nullable=False
    )
    lines_json: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB,
        default=list,
        server_default=text("'[]'::jsonb"),
        nullable=False,
    )
