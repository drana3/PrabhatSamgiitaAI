"""Chord proposals: a member offers the chords of a Prabhat Samgiita song (guitar or harmonium).

Design and guarantees: apps/mobile/docs/chord-proposals.md.

One row is one chart for one instrument. The chart is the SAME structure the song page already
draws (apps/mobile/lib/songPage/chordChart.ts): per lyric line a list of `{word, chord}`
placements, the chord being the SOUNDING chord, in `base_key` (for the harmonium, `base_key` is
Sa). A guitar player's capo is kept as the capo they played with (a hint for the display), not
folded into the chords.

Moderation: a team member's proposal is `published` at once; everybody else's is `pending` until the
team approves it. The team can `reject` (with a reason the author is told) and `restore`. A member
may delete their own proposal for good.

Anonymity is a display choice for OTHER members only. The account is always kept in `member_id`
(the team needs it to deal with abuse, the author needs it to delete their own proposal); the public
shapes never carry a name or an avatar for an anonymous proposal.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin
from app.models.recordings import PS_SONG_COUNT, PortableJSON

CHORD_INSTRUMENTS = ("guitar", "harmonium")
CHORD_STATUSES = ("pending", "published", "rejected")
CHORD_REPORT_REASONS = ("wrong_chords", "offensive", "spam", "other")
MAX_CAPO = 7


class SongChordProposal(Base, TimestampMixin):
    __tablename__ = "song_chord_proposals"
    __table_args__ = (
        CheckConstraint(
            f"song_id >= 1 AND song_id <= {PS_SONG_COUNT}", name="ck_song_chord_proposals_song"
        ),
        CheckConstraint(
            "instrument IN ('guitar', 'harmonium')", name="ck_song_chord_proposals_instrument"
        ),
        CheckConstraint(
            "status IN ('pending', 'published', 'rejected')", name="ck_song_chord_proposals_status"
        ),
        CheckConstraint(f"capo >= 0 AND capo <= {MAX_CAPO}", name="ck_song_chord_proposals_capo"),
        Index("ix_song_chord_proposals_song_status", "song_id", "status", "created_at"),
        Index("ix_song_chord_proposals_status_created", "status", "created_at"),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    song_id: Mapped[int] = mapped_column(Integer, nullable=False)
    member_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("user_accounts.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    instrument: Mapped[str] = mapped_column(String(12), nullable=False)
    # The key of the chart as it SOUNDS ("C", "F#", "Bb"). For the harmonium this is Sa.
    base_key: Mapped[str] = mapped_column(String(3), nullable=False)
    # Guitar: the fret the capo was on when the author played it (0 = no capo). Harmonium: 0.
    capo: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)
    strum: Mapped[str | None] = mapped_column(String(40))
    # {"lines": [{"placements": [{"word": 0, "chord": "Am"}]}]}; one entry per lyric line.
    chart: Mapped[dict[str, Any]] = mapped_column(PortableJSON, nullable=False)
    placements_count: Mapped[int] = mapped_column(
        Integer, default=0, server_default="0", nullable=False
    )
    # The author's own word that they played or checked the chart. Required to submit.
    played_it: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default="true", nullable=False
    )
    note: Mapped[str | None] = mapped_column(String(300))
    is_anonymous: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false", nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(12), default="pending", server_default="pending", nullable=False
    )
    reports_count: Mapped[int] = mapped_column(
        Integer, default=0, server_default="0", nullable=False
    )
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    reviewed_by: Mapped[str | None] = mapped_column(String(255))
    rejected_reason: Mapped[str | None] = mapped_column(Text)


class SongChordOffer(Base, TimestampMixin):
    """One row for every chart a member ever offered, kept when the chart is deleted.

    The daily allowance counts these, not the charts that are left: deleting a chart must not give
    its place in the day back. Nothing else reads it; a deleted member takes their rows with them.
    """

    __tablename__ = "song_chord_offers"
    __table_args__ = (Index("ix_song_chord_offers_member_created", "member_id", "created_at"),)

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    member_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("user_accounts.id", ondelete="CASCADE"),
        nullable=False,
    )


class SongChordReport(Base, TimestampMixin):
    """One report of one proposal by one reporter (a member, or an anonymous device bucket)."""

    __tablename__ = "song_chord_reports"
    __table_args__ = (
        UniqueConstraint("proposal_id", "reporter_key", name="uq_song_chord_reports_once"),
        CheckConstraint(
            "reason IN ('wrong_chords', 'offensive', 'spam', 'other')",
            name="ck_song_chord_reports_reason",
        ),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    proposal_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("song_chord_proposals.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    reporter_key: Mapped[str] = mapped_column(String(80), nullable=False)
    reporter_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("user_accounts.id", ondelete="SET NULL"), nullable=True
    )
    reason: Mapped[str] = mapped_column(String(16), nullable=False)
    note: Mapped[str | None] = mapped_column(Text)
