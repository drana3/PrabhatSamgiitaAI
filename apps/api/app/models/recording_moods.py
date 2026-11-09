"""The mood of a recording, decided by people (docs/search-menu.md, section 6).

The uploader suggests, listeners confirm, the team can overrule and lock. Nothing here is a guess
by a model: a confirmed mood is a public statement and is only ever based on people.

recording_moods       one row per recording and mood, with the status and where it came from
recording_mood_votes  one row per member, recording and mood: "this fits" (+1) or "it does not"
                      (-1). Only counts leave the server, never who voted. A deleted account takes
                      its votes with it.
"""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    SmallInteger,
    String,
)
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base

MOOD_STATUSES = ("suggested", "confirmed", "rejected")
MOOD_SOURCES = ("uploader", "listeners", "team")


def _now() -> datetime:
    return datetime.now(UTC)


class RecordingMood(Base):
    """`mood` is one of the six words of the app (Joyful, Longing, Calm, Ecstatic, Devotion, Sad),
    kept as its lowercase id; the words themselves live on the phone, in three languages.

    suggested  somebody proposed it, the votes have not decided yet (not public)
    confirmed  enough people agree, or the team says so (public: the search menu uses it)
    rejected   people disagree, or the team says so (never shown to listeners)
    """

    __tablename__ = "recording_moods"
    __table_args__ = (
        CheckConstraint(
            "status IN ('suggested', 'confirmed', 'rejected')", name="ck_recording_mood_status"
        ),
        CheckConstraint(
            "source IN ('uploader', 'listeners', 'team')", name="ck_recording_mood_source"
        ),
        Index("ix_recording_moods_mood_status", "mood", "status"),
    )

    recording_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("recordings.id", ondelete="CASCADE"), primary_key=True
    )
    mood: Mapped[str] = mapped_column(String(24), primary_key=True)
    status: Mapped[str] = mapped_column(String(12), default="suggested", nullable=False)
    source: Mapped[str] = mapped_column(String(12), default="listeners", nullable=False)
    # A team decision stays: votes do not change a locked mood.
    locked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    yes_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    no_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    suggested_by: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True))
    decided_by: Mapped[str | None] = mapped_column(String(255))
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, onupdate=_now
    )


class RecordingMoodVote(Base):
    __tablename__ = "recording_mood_votes"
    __table_args__ = (
        CheckConstraint("vote IN (-1, 1)", name="ck_recording_mood_vote"),
        Index("ix_recording_mood_votes_member_day", "member_id", "created_at"),
    )

    recording_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("recordings.id", ondelete="CASCADE"), primary_key=True
    )
    mood: Mapped[str] = mapped_column(String(24), primary_key=True)
    member_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("user_accounts.id", ondelete="CASCADE"), primary_key=True
    )
    vote: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, onupdate=_now
    )
