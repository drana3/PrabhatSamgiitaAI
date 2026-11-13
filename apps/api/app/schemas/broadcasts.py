"""The shapes of the broadcasts API (docs/broadcasts.md)."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Provider = Literal["youtube", "zoom", "facebook", "instagram", "other"]
Phase = Literal["upcoming", "now", "ended"]
LinkStatus = Literal["unknown", "ok", "no_embed", "unavailable"]
ReportReason = Literal["broken", "not_a_broadcast", "offensive", "spam", "other"]
LiveSource = Literal["clock", "youtube"]
RecordingAction = Literal["add", "suggest"]


class BroadcastCreate(BaseModel):
    """`POST /broadcasts`. The title is the only text that must be written; the start is optional
    (without it the broadcast counts as live from the moment it is posted). So is the end: up to
    14 days after the start (with none, it is "on" until the organizer says "it is over", and
    ends by itself on day 14). A time without an offset needs `timezone` (an IANA name such as
    Europe/Berlin)."""

    model_config = ConfigDict(extra="forbid")

    url: str = Field(min_length=1, max_length=800)
    title: str = Field(min_length=1, max_length=300)
    description: str | None = Field(default=None, max_length=3000)
    organizer: str | None = Field(default=None, max_length=300)
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    timezone: str | None = Field(default=None, max_length=100)


class BroadcastRecordingOut(BaseModel):
    """A recording of an ended broadcast: a link (opened by the person; YouTube may be played
    inside the app) or a recording of the library (`recording_id`). No account of who added it."""

    id: str
    kind: Literal["link", "file"]
    provider: str | None = None
    url: str | None = None
    host: str | None = None
    recording_id: str | None = None
    recording_title: str | None = None
    status: Literal["accepted", "pending"]
    source: Literal["author", "team", "member", "youtube"]
    mine: bool = False
    created_at: datetime


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
    # The end: "it is over", the end YouTube reported, the announced end, or (nothing said) the
    # limit of 14 days from the start. `ends_declared` says the organizer announced it.
    ends_at: datetime
    ends_declared: bool = False
    # "youtube": the state comes from YouTube's own word; "clock": by the organizer's clock.
    live_source: LiveSource = "clock"
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
    hidden: bool | None = None
    # What was added as the recording; `recording_action` says what the viewer may do about it:
    # "add" (the author, the team), "suggest" (another member), null (nothing: not ended yet, a
    # visitor, or the list is full).
    recordings: list[BroadcastRecordingOut] = Field(default_factory=list)
    recording_action: RecordingAction | None = None


class BroadcastList(BaseModel):
    items: list[BroadcastOut]
    total: int


class BroadcastReportCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reason: ReportReason
    note: str | None = Field(default=None, max_length=1000)


class BroadcastRemove(BaseModel):
    """The reason is written for the author (it goes into their notification)."""

    reason: str = Field(default="", max_length=500)


class BroadcastRecordingCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    url: str = Field(min_length=1, max_length=800)


class ReportsSummary(BaseModel):
    """What the team sees of the reports of one broadcast. Never who sent them."""

    # the weight that counted towards hiding (the part not yet judged)
    counted: int
    # people with a report not yet judged, and how many of them are anonymous
    open: int
    anonymous: int
    # people whose reports the team already judged ("Keep")
    cleared: int
    by_reason: dict[str, int]
    notes: list[str]


ReviewState = Literal["reported", "auto_hidden", "hidden", "removed", "kept"]


class BroadcastReviewOut(BroadcastOut):
    """A broadcast in the team's queue: the link itself is shown as text, never embedded."""

    state: ReviewState
    reports: ReportsSummary
    reviewed_at: datetime | None = None
    reviewed_by: str | None = None
    reviewed_reports: int = 0
    hidden_at: datetime | None = None
    hidden_by: str | None = None
    hidden_reason: str | None = None
    removed_at: datetime | None = None
    removed_by: str | None = None
    removed_reason: str | None = None


class BroadcastReviewList(BaseModel):
    items: list[BroadcastReviewOut]
    total: int


class BroadcastDecisionOut(BaseModel):
    id: str
    broadcast_id: str
    broadcast_title: str
    action: Literal["keep", "hide", "remove"]
    reason: str | None
    decided_by: str
    reports_total: int
    reports_counted: int
    created_at: datetime


class BroadcastDecisionList(BaseModel):
    items: list[BroadcastDecisionOut]
    total: int


class RecordingSuggestionOut(BaseModel):
    """A recording a member suggested for an ended broadcast, waiting for the team."""

    id: str
    broadcast_id: str
    broadcast_title: str
    recording: BroadcastRecordingOut


class RecordingSuggestionList(BaseModel):
    items: list[RecordingSuggestionOut]
    total: int
