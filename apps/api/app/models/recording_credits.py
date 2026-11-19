"""Several performers on one recording (docs/co-performers.md).

`recordings.author` stays the display credit (free text). One row here per PERSON on a recording
says who that person is: a plain name (`text`), or an author page that was asked and has said yes
(`accepted`). Only an `accepted` credit puts the recording on that page
(`services/author_profiles.attribution`). The recording itself is never changed by a credit.
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import (
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

from app.models.author_profiles import BigIntPk
from app.models.base import Base, TimestampMixin

CREDIT_ROLES = ("performer", "author")
CREDIT_STATUSES = ("text", "invited", "accepted", "declined", "removed", "expired")
CREDIT_SOURCES = ("uploader", "self", "team")
CREDIT_INVITES = ("everyone", "nobody")


class RecordingCredit(Base, TimestampMixin):
    """One person on one recording."""

    __tablename__ = "recording_credits"
    __table_args__ = (
        UniqueConstraint("recording_id", "profile_id", name="uq_recording_credits_pair"),
        CheckConstraint("role IN ('performer', 'author')", name="ck_recording_credits_role"),
        CheckConstraint(
            "status IN ('text', 'invited', 'accepted', 'declined', 'removed', 'expired')",
            name="ck_recording_credits_status",
        ),
        CheckConstraint(
            "source IN ('uploader', 'self', 'team')", name="ck_recording_credits_source"
        ),
        Index("ix_recording_credits_profile_status", "profile_id", "status"),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    recording_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("recordings.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    position: Mapped[int] = mapped_column(default=0, nullable=False)
    # The name as written (120). A credit that points to a page keeps the written name too.
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    # null = a plain name with no page behind it (yet).
    profile_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("author_profiles.id", ondelete="SET NULL"),
        nullable=True,
    )
    role: Mapped[str] = mapped_column(
        String(10), default="performer", server_default="performer", nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(10), default="text", server_default="text", index=True, nullable=False
    )
    source: Mapped[str] = mapped_column(
        String(10), default="uploader", server_default="uploader", nullable=False
    )
    invited_by: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("user_accounts.id", ondelete="SET NULL"), nullable=True
    )
    # Only for a person with no account yet: the sha256 of a long random token (never the token).
    invite_token_hash: Mapped[str | None] = mapped_column(String(64), unique=True, index=True)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # An invitation not answered by then becomes `expired`; the name stays as text.
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)


class RecordingCreditEvent(Base):
    """The log of a credit: added, invited, accepted, declined, removed, expired, token_used,
    team_added. Nothing is ever erased."""

    __tablename__ = "recording_credit_events"

    id: Mapped[int] = mapped_column(BigIntPk, primary_key=True, autoincrement=True)
    credit_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("recording_credits.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    actor: Mapped[str] = mapped_column(String(255), nullable=False)
    action: Mapped[str] = mapped_column(String(16), nullable=False)
    note: Mapped[str | None] = mapped_column(Text)


class AuthorCreditBlock(Base, TimestampMixin):
    """ "Not me, and do not let this person add me again": a page refuses credits from one member."""

    __tablename__ = "author_credit_blocks"
    __table_args__ = (
        UniqueConstraint("profile_id", "blocked_member_id", name="uq_author_credit_blocks_pair"),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    profile_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("author_profiles.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    blocked_member_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("user_accounts.id", ondelete="CASCADE"), nullable=False
    )
