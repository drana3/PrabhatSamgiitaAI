"""Takedown requests from rights holders, counter-notices, and the blocked file list.

See docs/takedown-process.md. A `notice` is what a rights holder sends; a `counter_notice` is
what the uploader sends back after a take-down. Nothing here is legal advice.
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin

TAKEDOWN_KINDS = ("notice", "counter_notice")
# notice:         new -> taken_down | rejected;  taken_down -> counter_received -> restored | closed
# counter_notice: new -> forwarded -> restored | closed
TAKEDOWN_STATUSES = (
    "new",
    "taken_down",
    "rejected",
    "counter_received",
    "forwarded",
    "restored",
    "closed",
)


class TakedownRequest(Base, TimestampMixin):
    __tablename__ = "takedown_requests"
    __table_args__ = (
        CheckConstraint("kind IN ('notice', 'counter_notice')", name="ck_takedown_kind"),
        CheckConstraint(
            "status IN ('new', 'taken_down', 'rejected', 'counter_received', 'forwarded', "
            "'restored', 'closed')",
            name="ck_takedown_status",
        ),
        Index("ix_takedown_requests_status_created", "status", "created_at"),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    # What the claimant can quote when they write to us ("TD-7K3M9Q").
    reference: Mapped[str] = mapped_column(String(12), unique=True, nullable=False)
    kind: Mapped[str] = mapped_column(String(16), nullable=False, default="notice")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="new", index=True)
    # A counter-notice points at the notice it answers.
    related_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("takedown_requests.id", ondelete="SET NULL"), index=True
    )

    # What the sender typed to identify the recording (an address or a title), and what we linked.
    recording_ref: Mapped[str] = mapped_column(Text, nullable=False, default="")
    recording_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("recordings.id", ondelete="SET NULL"), index=True
    )
    # Copied when linked, so the queue still reads after the recording changes.
    recording_title: Mapped[str | None] = mapped_column(String(200))
    audio_sha256: Mapped[str | None] = mapped_column(String(64))

    sender_name: Mapped[str] = mapped_column(String(200), nullable=False)
    sender_org: Mapped[str | None] = mapped_column(String(200))
    sender_email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    sender_phone: Mapped[str | None] = mapped_column(String(60))
    sender_address: Mapped[str | None] = mapped_column(String(400))
    # A member who filed the counter-notice (the uploader).
    sender_member_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("user_accounts.id", ondelete="SET NULL"), nullable=True
    )

    # Notice: the work and the right. Counter-notice: why the recording was removed by mistake.
    work_description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    claim_description: Mapped[str | None] = mapped_column(Text)
    statement_good_faith: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    statement_accuracy: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    signature: Mapped[str] = mapped_column(String(200), nullable=False, default="")

    source: Mapped[str] = mapped_column(String(16), nullable=False, default="web")
    # Salted hash of the sender's address, only to count abuse. Never the address itself.
    sender_key: Mapped[str | None] = mapped_column(String(40), index=True)

    decision_reason: Mapped[str | None] = mapped_column(Text)
    decided_by: Mapped[str | None] = mapped_column(String(255))
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    author_notified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Counter-notice only: when the team passed it to the claimant (the waiting period starts here).
    forwarded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class BlockedAudioHash(Base):
    """A file (by SHA-256) that cannot be uploaded again because of a take-down.

    One row per take-down request, not one per file: two requests about the same file each hold
    their own row, and lifting one never lifts the other. The file stays blocked while any row
    for it exists.
    """

    __tablename__ = "blocked_audio_hashes"
    __table_args__ = (UniqueConstraint("sha256", "takedown_id", name="uq_blocked_audio_request"),)

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    sha256: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    takedown_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("takedown_requests.id", ondelete="SET NULL")
    )
    reason: Mapped[str] = mapped_column(Text, nullable=False, default="")
    blocked_by: Mapped[str | None] = mapped_column(String(255))
    blocked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
