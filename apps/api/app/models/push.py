"""Push notifications (docs/comment-replies.md, "Push"): the phones that may be woken, the member's
choice, and what was sent. Migration `0051_push_replies`."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    String,
    UniqueConstraint,
    true,
)
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class PushDevice(Base, TimestampMixin):
    """One phone: its Expo push token. A token belongs to one member at a time."""

    __tablename__ = "push_devices"
    __table_args__ = (
        UniqueConstraint("token", name="uq_push_devices_token"),
        CheckConstraint("platform IN ('ios', 'android')", name="ck_push_devices_platform"),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    member_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("user_accounts.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    token: Mapped[str] = mapped_column(String(255), nullable=False)
    platform: Mapped[str] = mapped_column(String(8), nullable=False)
    # the app's language (en, ru, es): the push is written in it
    language: Mapped[str] = mapped_column(
        String(5), nullable=False, default="en", server_default="en"
    )


class PushPreference(Base, TimestampMixin):
    """The member's switches. No row means everything on."""

    __tablename__ = "push_preferences"

    member_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("user_accounts.id", ondelete="CASCADE"),
        primary_key=True,
    )
    replies: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default=true()
    )


class PushDelivery(Base):
    """One push handed to Expo for one token. The throttle and the receipt check read these."""

    __tablename__ = "push_deliveries"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    member_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("user_accounts.id", ondelete="CASCADE"), nullable=False
    )
    notice_id: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True), nullable=True)
    # the discussion (the top-level comment): several replies to one comment fold into one push
    group_key: Mapped[str] = mapped_column(String(64), nullable=False)
    token: Mapped[str] = mapped_column(String(255), nullable=False)
    ticket_id: Mapped[str | None] = mapped_column(String(80), nullable=True)
    # sent | ok (receipt fine) | error (Expo refused, or the receipt says so)
    status: Mapped[str] = mapped_column(
        String(12), nullable=False, default="sent", server_default="sent"
    )
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    checked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
