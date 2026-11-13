"""Piano notes: the keys of a melody, for a recording or for a Prabhat Samgiita song.

A sheet is NOT a staff and NOT a file: it is rows of steps, and a step is the keys pressed together
(`k`, semitones above Sa, so one sheet fits any key) and how many beats they last (`b`). The reader
picks Sa; the keyboard on screen lights the keys. docs/piano-notation.md has the design and the
decisions of the owner of the app.

Who publishes: a team member's sheet, and the sheet of the author of the recording (the account that
uploaded it), go live at once; everybody else's waits as `pending` for the team, like chord sheets.
A sheet that carries a link always waits (the team looks at every link), unless the team posted it.

A sheet belongs to ONE target, a recording or a Prabhat Samgiita song (never both). `target_key` is
"recording:<uuid>" or "song:<number>", one column that names the target.
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
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin
from app.models.recordings import PS_SONG_COUNT, PortableJSON

PIANO_LEVELS = ("one_finger", "two_hands")
PIANO_STATUSES = ("pending", "published", "rejected")
PIANO_REPORT_REASONS = ("wrong_notes", "offensive", "spam", "other")
# Sa as a note name (sharp spelling, like HARMONIUM_TONICS of the phone).
PIANO_SA_KEYS = ("C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B")
PIANO_LINK_MAX_LENGTH = 300


class PianoSheet(Base, TimestampMixin):
    """One piano sheet of one recording or one song."""

    __tablename__ = "piano_sheets"
    __table_args__ = (
        CheckConstraint(
            "(recording_id IS NOT NULL AND song_id IS NULL) OR "
            f"(recording_id IS NULL AND song_id IS NOT NULL AND song_id >= 1 "
            f"AND song_id <= {PS_SONG_COUNT})",
            name="ck_piano_sheets_one_target",
        ),
        CheckConstraint(
            "status IN ('pending', 'published', 'rejected')", name="ck_piano_sheets_status"
        ),
        CheckConstraint("level IN ('one_finger', 'two_hands')", name="ck_piano_sheets_level"),
        Index("ix_piano_sheets_target_status", "target_key", "status", "created_at"),
        Index("ix_piano_sheets_status_created", "status", "created_at"),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    recording_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("recordings.id", ondelete="CASCADE"), nullable=True
    )
    song_id: Mapped[int | None] = mapped_column(Integer)
    target_key: Mapped[str] = mapped_column(String(60), nullable=False)
    member_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("user_accounts.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    # Where Sa sat when the author wrote the notes (a note name). The steps are relative to Sa.
    sa_key: Mapped[str] = mapped_column(String(3), default="C", server_default="C", nullable=False)
    # one_finger = the right hand only; two_hands = a row for the left hand exists. Worked out
    # from the rows by the service, never taken from the request.
    level: Mapped[str] = mapped_column(
        String(12), default="one_finger", server_default="one_finger", nullable=False
    )
    # {"rows": [{"label": "A", "repeat": 4, "hand": "right",
    #            "steps": [{"k": [0], "b": 1}, {"k": [0, 4, 7], "b": 2}]}]}
    score: Mapped[dict[str, Any]] = mapped_column(PortableJSON, nullable=False)
    steps_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)
    # A link to notes kept elsewhere (a PDF, a page). Only a link: the app stores no file.
    link_url: Mapped[str | None] = mapped_column(String(PIANO_LINK_MAX_LENGTH))
    note: Mapped[str | None] = mapped_column(String(300))
    is_anonymous: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false", nullable=False
    )
    # True when the sheet went live at once because its member is the author of the recording.
    by_recording_author: Mapped[bool] = mapped_column(
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
    rejected_reason: Mapped[str | None] = mapped_column(String(500))
    # A new version of the author's own live sheet: when this one goes live the old one is
    # archived (kept, hidden).
    replaces_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("piano_sheets.id", ondelete="SET NULL"),
        nullable=True,
    )
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # "Start from this sheet": the sheet whose notes were copied; the credit is worked out when it
    # is shown.
    based_on_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("piano_sheets.id", ondelete="SET NULL"),
        nullable=True,
    )


class PianoSheetReport(Base, TimestampMixin):
    __tablename__ = "piano_sheet_reports"
    __table_args__ = (
        UniqueConstraint("sheet_id", "reporter_key", name="uq_piano_sheet_reports_once"),
        CheckConstraint(
            "reason IN ('wrong_notes', 'offensive', 'spam', 'other')",
            name="ck_piano_sheet_reports_reason",
        ),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    sheet_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("piano_sheets.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    reporter_key: Mapped[str] = mapped_column(String(80), nullable=False)
    reporter_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("user_accounts.id", ondelete="SET NULL"), nullable=True
    )
    reason: Mapped[str] = mapped_column(String(16), nullable=False)
    note: Mapped[str | None] = mapped_column(String(1000))
