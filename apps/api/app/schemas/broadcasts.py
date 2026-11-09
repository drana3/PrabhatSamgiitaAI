"""The shapes of the broadcasts API (docs/broadcasts.md)."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Provider = Literal["youtube", "zoom", "facebook", "instagram", "other"]
Phase = Literal["upcoming", "now", "ended"]
LinkStatus = Literal["unknown", "ok", "no_embed", "unavailable"]
ReportReason = Literal["broken", "not_a_broadcast", "offensive", "spam", "other"]


class BroadcastCreate(BaseModel):
    """`POST /broadcasts`. The title is the only text that must be written; the start is optional
    (without it the broadcast counts as live from the moment it is posted). A start without an
    offset needs `timezone` (an IANA name such as Europe/Berlin)."""

    model_config = ConfigDict(extra="forbid")

    url: str = Field(min_length=1, max_length=800)
    title: str = Field(min_length=1, max_length=300)
    description: str | None = Field(default=None, max_length=3000)
    organizer: str | None = Field(default=None, max_length=300)
    starts_at: datetime | None = None
    timezone: str | None = Field(default=None, max_length=100)


class BroadcastOut(BaseModel):
    """What a reader gets. No account of the author: the organizer is the text the author wrote."""

    id: str
    provider: Provider
    url: str
    host: str
    title: str
    description: str | None
    organizer: str | None
    starts_at: datetime | None
    timezone: str | None
    ends_at: datetime
    phase: Phase
    archived: bool
    thumbnail_url: str | None
    link_status: LinkStatus
    status: Literal["published", "removed"]
    mine: bool
    can_end: bool
    can_remove: bool
    created_at: datetime
    # only for the author and the team
    reports_count: int | None = None


class BroadcastList(BaseModel):
    items: list[BroadcastOut]
    total: int


class BroadcastReportCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reason: ReportReason
    note: str | None = Field(default=None, max_length=1000)


class BroadcastRemove(BaseModel):
    reason: str = Field(default="", max_length=500)
