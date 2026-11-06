"""A member's Learn progress, kept on the server so it follows them to another phone.

See docs/learn-sync.md. One row per member (the member id is the primary key). `document` holds
one entry per song, keyed by song id; the entries are merged song by song, newest `updated_at` wins.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import JSON, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin

# JSONB on Postgres, plain JSON elsewhere (the tests run on SQLite).
PortableJSON = JSON().with_variant(JSONB(), "postgresql")


class MemberLearnProgress(Base, TimestampMixin):
    __tablename__ = "member_learn_progress"

    # Deleting the account (DELETE /members/me) removes the row with it.
    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("user_accounts.id", ondelete="CASCADE"),
        primary_key=True,
    )
    # {"version": 1, "songs": {"ps-7": {...entry...}}}; the entry shape is app.schemas.learn_sync.
    document: Mapped[dict[str, Any]] = mapped_column(PortableJSON, nullable=False, default=dict)
