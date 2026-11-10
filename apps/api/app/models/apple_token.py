"""The Apple refresh token of a member who signed in with Apple (docs/apple-token-revocation.md).

Apple's rule 5.1.1(v): when a person deletes the account, the app must also revoke the Apple
grant. Apple's revoke call needs a refresh token, and the only way to get one is to trade the
one-time `authorizationCode` the phone receives at sign-in. The token is kept here until the
account is deleted (the row goes with the account, `ON DELETE CASCADE`) and is used only for that
one call. It is not a sign-in credential for our service: without our Apple private key it opens
nothing.
"""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class AppleRefreshToken(Base, TimestampMixin):
    __tablename__ = "apple_refresh_tokens"

    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("user_accounts.id", ondelete="CASCADE"),
        primary_key=True,
    )
    refresh_token: Mapped[str] = mapped_column(Text, nullable=False)
