"""Request and response shapes of "claim my recordings" (docs/author-profiles.md, "Claiming
recordings"). The uploader's account id is never in these shapes: only the name the recording was
added under ("added by ...")."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

ClaimStatus = Literal["pending", "approved", "rejected", "withdrawn", "revoked"]
ClaimRoute = Literal["self", "team"]
MatchLevel = Literal["same", "alike", "title", "manual"]
TeamReason = Literal[
    "protected_name",
    "famous_name",
    "taken_by_other",
    "alias_match",
    "group_credit",
    "group_page",
    "not_same_name",
    "unverified_page",
    "draft_page",
    "review_flag",
]


class ClaimRecording(BaseModel):
    id: str
    kind: str
    title: str
    author: str
    added_by: str
    library: bool  # added by the team's library import, nobody to tell
    duration_sec: int | None
    plays: int


class ClaimCandidate(BaseModel):
    """A recording that may be the person's, and where it stands."""

    recording: ClaimRecording
    level: MatchLevel
    matched_text: str
    # the way the claim would go if made now: approved at once, or to the team (and why)
    route: ClaimRoute
    team_reason: TeamReason | None
    claim_status: ClaimStatus | None
    claim_id: str | None


class ClaimSuggestions(BaseModel):
    names: list[str]  # the names that were looked for (display name, known as, aliases)
    same: list[ClaimCandidate]
    alike: list[ClaimCandidate]
    total: int


class ClaimSearch(BaseModel):
    query: str
    items: list[ClaimCandidate]
    total: int
    has_more: bool


class ClaimSummary(BaseModel):
    suggested: int  # recordings to look at (same + alike, not claimed yet)
    pending: int
    approved: int


class ClaimsCreate(BaseModel):
    recording_ids: list[str] = Field(min_length=1, max_length=50)


class ClaimResult(BaseModel):
    recording_id: str
    outcome: Literal[
        "approved",
        "pending",
        "already_on_page",
        "already_yours",
        "already_pending",
        "already_approved",
        "rejected_before",
        "revoked_before",
        "not_found",
    ]
    claim_id: str | None = None
    team_reason: TeamReason | None = None


class ClaimsCreated(BaseModel):
    results: list[ClaimResult]
    approved: int
    pending: int


class ClaimOut(BaseModel):
    id: str
    recording: ClaimRecording
    level: MatchLevel
    matched_text: str
    route: ClaimRoute
    status: ClaimStatus
    team_reason: TeamReason | None
    decision_note: str | None
    created_at: datetime
    decided_at: datetime | None


class ClaimList(BaseModel):
    items: list[ClaimOut]
    total: int


class AliasIn(BaseModel):
    alias: str = Field(min_length=1, max_length=200)


class AliasOut(BaseModel):
    alias: str
    key: str


class AliasList(BaseModel):
    items: list[AliasOut]


# --------------------------------------------------------------------------- the team desk


class AdminClaimOut(BaseModel):
    id: str
    profile_id: str
    profile_slug: str
    profile_name: str
    profile_verified: bool
    recording: ClaimRecording
    level: MatchLevel
    matched_text: str
    route: ClaimRoute
    status: ClaimStatus
    team_reason: TeamReason | None
    created_at: datetime
    decided_by: str | None
    decision_note: str | None


class AdminClaimList(BaseModel):
    items: list[AdminClaimOut]
    total: int


class AdminDecision(BaseModel):
    note: str | None = Field(default=None, max_length=1000)


class AdminBulk(BaseModel):
    # one page (every claim waiting, or the ids given), or none when the ids come from several pages
    profile_id: str | None = None
    action: Literal["approve", "reject", "revoke", "reopen"]
    ids: list[str] | None = Field(default=None, max_length=500)  # none = every claim waiting
    note: str | None = Field(default=None, max_length=1000)


class AdminBulkResult(BaseModel):
    changed: int


class DeskSummary(BaseModel):
    pending: int
    approved: int
    rejected: int
    revoked: int
    # the waiting ones per reason (`other` when a claim has none)
    by_reason: dict[str, int]


class ShownPage(BaseModel):
    id: str
    slug: str
    name: str


class ShownOnPages(BaseModel):
    recording_id: str
    pages: list[ShownPage]


class ShownOnPagesList(BaseModel):
    items: list[ShownOnPages]
