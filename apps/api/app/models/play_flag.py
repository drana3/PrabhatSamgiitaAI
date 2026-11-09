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
    """What is left out of the numbers for one recording-day, kept in three separate parts.

    confirmed_held  plays a person confirmed as inflated. Permanent: it is always left out, whatever
                    happens to the flag afterwards (cleared later, reopened, judged again).
    held            plays the rules suspect and a person has not decided yet. Left out only while
                    the status is `open`; a `cleared` flag gives them back, a `confirmed` one moves
                    them into `confirmed_held`.
    reviewed_plays  how many plays the day had when a person last decided. A decision covers those
                    plays only: when the day grows well beyond them the flag opens again and the
                    rules may suspect the new part only (services/play_fraud.py).

    open       found by the rules, the suspected part is held back until a person looks
    cleared    a person says the suspected plays are real (confirmed_held stays held back)
    confirmed  a person says they are inflated (they went into confirmed_held)

    `last_decision`, `reviewed_by` and `reviewed_at` stay as the audit trail of the last decision
    even when the flag has been reopened since.

    What every number leaves out is `confirmed_held + (held if status == "open" else 0)`; see
    `held_expression` in services/play_fraud.py, the one place that says so.
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
    confirmed_held: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    last_decision: Mapped[str | None] = mapped_column(String(12))
