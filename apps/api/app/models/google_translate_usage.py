"""Monthly Google Cloud Translation character usage (free-tier guard)."""

from __future__ import annotations

from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class GoogleTranslateUsage(Base, TimestampMixin):
    __tablename__ = "google_translate_usage"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # UTC calendar month, e.g. "2026-10"
    month_key: Mapped[str] = mapped_column(String(7), unique=True, nullable=False, index=True)
    characters: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
