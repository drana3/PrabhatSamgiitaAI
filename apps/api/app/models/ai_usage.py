from __future__ import annotations

from datetime import date

from sqlalchemy import Boolean, Date, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class AiDailyUsage(Base, TimestampMixin):
    """Persisted daily AI companion question counts (OWASP LLM10)."""

    __tablename__ = "ai_daily_usage"
    __table_args__ = (
        UniqueConstraint("identity_key", "usage_date", name="uq_ai_daily_usage_identity_date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    identity_key: Mapped[str] = mapped_column(String(320), nullable=False, index=True)
    usage_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    question_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_member: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
