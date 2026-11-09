"""The oldest app version still allowed, per platform (docs/forced-update.md).

One row per platform ("ios", "android"). No row means "every version is fine".
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class AppVersionPolicy(Base):
    __tablename__ = "app_version_policies"

    platform: Mapped[str] = mapped_column(String(10), primary_key=True)
    # Below this the app shows a full-screen "please update" and nothing else.
    minimum_version: Mapped[str | None] = mapped_column(String(20))
    # Below this (and at or above the minimum) the app shows a dismissible banner.
    recommended_version: Mapped[str | None] = mapped_column(String(20))
    # Where the button goes: the store page of the app. Empty = the app guesses from its package.
    store_url: Mapped[str | None] = mapped_column(String(300))
    note: Mapped[str | None] = mapped_column(String(300))
    updated_by: Mapped[str | None] = mapped_column(String(255))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
