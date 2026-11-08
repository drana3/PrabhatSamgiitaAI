"""Product events and feature flags (docs/analytics-flags.md).

`app_events`: what the app did, with no person in it. No account id, no e-mail, no free text, no
address. A row is the name of an event, a few allow-listed small properties, the app version, the
platform, the interface language, a random per-launch session id and (only when the person chose
"Share usage") a short keyed hash of the install id. Pruned after a retention period.

`feature_flags`: one row per flag, edited by the team: a kill switch, a rollout percentage, an app
version window, platforms, optional variants for an A/B test, and per-subject overrides.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any

from sqlalchemy import JSON, Boolean, Date, DateTime, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.author_profiles import BigIntPk
from app.models.base import Base

Json = JSON().with_variant(JSONB(), "postgresql")


class AppEvent(Base):
    __tablename__ = "app_events"
    __table_args__ = (
        Index("ix_app_events_name_day", "name", "day"),
        Index("ix_app_events_session", "session_id"),
    )

    id: Mapped[int] = mapped_column(BigIntPk, primary_key=True, autoincrement=True)
    day: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    name: Mapped[str] = mapped_column(String(48), nullable=False)
    props: Mapped[dict[str, Any]] = mapped_column(Json, nullable=False, default=dict)
    app_version: Mapped[str | None] = mapped_column(String(20))
    platform: Mapped[str | None] = mapped_column(String(10))
    language: Mapped[str | None] = mapped_column(String(8))
    # A random id made at each app launch and never saved on the phone.
    session_id: Mapped[str | None] = mapped_column(String(36))
    # Only for "Share usage": short keyed hash of the install id, never the id itself.
    install_key: Mapped[str | None] = mapped_column(String(16), index=True)


class FeatureFlag(Base):
    __tablename__ = "feature_flags"

    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    # The kill switch. False means off for everyone, whatever the rest says.
    enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # 0..100, in steps of 1. Raising it only adds people; nobody who had it loses it.
    rollout_percent: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    min_app_version: Mapped[str | None] = mapped_column(String(20))
    max_app_version: Mapped[str | None] = mapped_column(String(20))
    # ["ios", "android", "web"] or null for all.
    platforms: Mapped[list[str] | None] = mapped_column(Json)
    # [{"name": "control", "weight": 50}, {"name": "b", "weight": 50}] or null (plain on/off).
    variants: Mapped[list[dict[str, Any]] | None] = mapped_column(Json)
    # Install ids that always have it / never have it (the team's own test phones).
    include_ids: Mapped[list[str]] = mapped_column(Json, default=list, nullable=False)
    exclude_ids: Mapped[list[str]] = mapped_column(Json, default=list, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_by: Mapped[str | None] = mapped_column(String(80))
