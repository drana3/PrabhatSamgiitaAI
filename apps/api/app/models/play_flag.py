"""A day on which a recording's play count looks inflated (docs/play-fraud.md).

Only counts and a reason live here: no listener key, no client key, no address. A person looking
at a flag can see how many plays were held back and why, never who played.
"""

from __future__ import annotations

from datetime import UTC, date, datetime
from uuid import UUID

from sqlalchemy import CheckConstraint, Date, DateTime, Float, ForeignKey, Index, Integer, String
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base

PLAY_FLAG_STATUSES = ("open", "cleared", "confirmed")


def _now() -> datetime:
    return datetime.now(UTC)


class PlayFlag(Base):
    """`held` plays of that day are left out of every number an author or the public sees.

    open       found by the rules, held back until a person looks
    cleared    a person says the plays are real: nothing is held back any more
    confirmed  a person says the plays are inflated: they stay held back for good

    A decision covers the plays the day had at that moment (`reviewed_plays`). If the day grows
    well beyond that, the flag opens again for the new part (services/play_fraud.py).
    """

    __tablename__ = "play_flags"
    __table_args__ = (
        CheckConstraint("status IN ('open', 'cleared', 'confirmed')", name="ck_play_flag_status"),
        Index("ix_play_flags_status_day", "status", "day"),
    )

    recording_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("recordings.id", ondelete="CASCADE"),
        primary_key=True,
    )
    day: Mapped[date] = mapped_column(Date, primary_key=True)
    plays: Mapped[int] = mapped_column(Integer, nullable=False)
    held: Mapped[int] = mapped_column(Integer, nullable=False)
    baseline: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    reason: Mapped[str] = mapped_column(String(80), nullable=False)
    status: Mapped[str] = mapped_column(String(12), nullable=False, default="open")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    reviewed_by: Mapped[str | None] = mapped_column(String(120))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # How many plays the day had when a person decided. A day that grows well past this is judged
    # again (the decision covered those plays, not whatever is added afterwards).
    reviewed_plays: Mapped[int | None] = mapped_column(Integer)
