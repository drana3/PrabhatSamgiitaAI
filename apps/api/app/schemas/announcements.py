from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class SiteAnnouncementItem(BaseModel):
    id: str
    title: str
    body: str
    kind: str
    priority: str
    starts_at: str
    ends_at: str
    is_active: bool
    notify_by_email: bool
    email_sent_count: int
    created_at: str


class SiteAnnouncementListResponse(BaseModel):
    items: list[SiteAnnouncementItem]


class ActiveSiteAnnouncementItem(BaseModel):
    id: str
    title: str
    body: str
    kind: str
    priority: str
    ends_at: str


class ActiveSiteAnnouncementListResponse(BaseModel):
    items: list[ActiveSiteAnnouncementItem]


class SiteAnnouncementCreateWrite(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    body: str = Field(min_length=1, max_length=4000)
    kind: str = Field(default="general", pattern="^(general|maintenance|quiz)$")
    priority: str = Field(default="normal", pattern="^(normal|high|urgent)$")
    starts_at: datetime
    ends_at: datetime
    notify_by_email: bool = False
