"""Request and response shapes of "several performers on one recording" (docs/co-performers.md).
Another member's account id is never in these shapes."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

CreditRole = Literal["performer", "author"]
CreditStatus = Literal["text", "invited", "accepted", "declined", "removed", "expired"]


class PerformerIn(BaseModel):
    """One person on the upload form or in "add a person"."""

    name: str = Field(min_length=1, max_length=120)
    profile_id: str | None = Field(default=None, max_length=64)
    role: CreditRole = "performer"


class CreditPage(BaseModel):
    slug: str
    display_name: str


class CreditOut(BaseModel):
    id: str
    name: str
    role: CreditRole
    # The public sees `text` or `accepted` only; the uploader and the team see every state.
    status: CreditStatus
    # Only for a confirmed credit on a published page.
    page: CreditPage | None = None


class CreditSummary(BaseModel):
    confirmed: int
    waiting: int


class CreditList(BaseModel):
    credits: list[CreditOut]
    can_manage: bool
    summary: CreditSummary


class CreditAdd(PerformerIn):
    pass


class RoleIn(BaseModel):
    role: CreditRole


class InviteLink(BaseModel):
    token: str
    expires_at: datetime


class TokenIn(BaseModel):
    token: str = Field(min_length=20, max_length=200)


class CreditRecording(BaseModel):
    id: str
    kind: str
    title: str
    author: str


class InviteOut(BaseModel):
    """An invitation waiting for the page's owner."""

    credit_id: str
    recording: CreditRecording
    from_name: str  # who added the recording, as written on it
    role: CreditRole
    created_at: datetime
    expires_at: datetime | None


class InviteList(BaseModel):
    items: list[InviteOut]


class MyCreditOut(BaseModel):
    credit_id: str
    recording: CreditRecording
    role: CreditRole
    # false when the owner switched the recording off for the page (it stays a confirmed credit)
    shown: bool = True


class MyCreditList(BaseModel):
    items: list[MyCreditOut]


class DeclineIn(BaseModel):
    block: bool = False


class CreditSettings(BaseModel):
    credit_invites: Literal["everyone", "nobody"]


class BlockOut(BaseModel):
    id: str
    name: str


class BlockList(BaseModel):
    items: list[BlockOut]
