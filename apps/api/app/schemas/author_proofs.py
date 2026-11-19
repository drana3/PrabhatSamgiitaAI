"""Request and response shapes of the proof of identity for claiming recordings
(docs/author-profiles.md, "Proof of identity"). A one-time code and its hash are never in these
shapes."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

ProofKind = Literal["link", "email", "voice", "team", "request"]
ProofStatus = Literal["waiting", "code_sent", "ok", "declined", "more_needed", "withdrawn"]
# Where a request stands, for the "My request" screen:
#   no_proof   nothing sent yet (or all declined): the person has to send one
#   code       the team sent a code to the person's address: the person enters it
#   with_team  a proof is with the team: the answer is due in 3 days
#   need_more  the team asked for more: the person answers
#   verified   the page is verified
#   closed     the request closed after 14 days without a reply; sending a proof opens it again
RequestStage = Literal["no_proof", "code", "with_team", "need_more", "verified", "closed"]


class ProofIn(BaseModel):
    kind: Literal["link", "email", "voice", "team"]
    # the channel link, the address listed on the channel, a short description of the note (or a
    # link to it), or the name of the team member who knows the person
    value: str = Field(min_length=1, max_length=500)
    note: str | None = Field(default=None, max_length=500)


class CodeIn(BaseModel):
    code: str = Field(min_length=4, max_length=12)


class ProofOut(BaseModel):
    id: str
    kind: ProofKind
    value: str
    note: str | None
    status: ProofStatus
    code_sent: bool  # a code was sent and not used yet
    code_confirmed: bool
    team_note: str | None  # what the team wrote to the person
    created_at: datetime
    decided_at: datetime | None


class RequestState(BaseModel):
    stage: RequestStage
    verified: bool
    required: int  # proofs needed: 1, or 2 for a famous name or a group
    have: int  # accepted proofs (a team member who knows the person counts for 2)
    why_required: Literal["one", "famous", "group"]
    proofs: list[ProofOut]
    pending_claims: int
    approved_claims: int
    # answer target: the team answers within 3 days of a proof; the request closes 14 days after the
    # last move of the person
    answer_by: datetime | None
    closes_at: datetime | None


# --------------------------------------------------------------------------- the team desk


class AdminProofOut(ProofOut):
    profile_id: str
    profile_slug: str
    profile_name: str
    decided_by: str | None
    overdue: bool


class AdminProofList(BaseModel):
    items: list[AdminProofOut]
    total: int


class ProofDecision(BaseModel):
    # what the person is told: a reason, or what else is needed
    note: str | None = Field(default=None, max_length=1000)
    # `ok` only: also approve the page's waiting claims that wait only because it was not verified
    approve_waiting: bool = False


class AskMore(BaseModel):
    note: str = Field(min_length=1, max_length=1000)


class CodeSent(BaseModel):
    sent: bool  # false: e-mail is not set up on this server, nothing left it


class PageDetail(BaseModel):
    profile_id: str
    slug: str
    name: str
    author_type: Literal["solo", "group"]
    status: str
    verified: bool
    claimed_name: str | None
    country: str | None
    city: str | None
    bio: str
    links: list[dict[str, str]]
    names: list[str]  # every name the page's recordings were looked for under
    created_at: datetime
    stage: RequestStage
    required: int
    have: int
    why_required: Literal["one", "famous", "group"]
    proofs: list[AdminProofOut]
    pending: int
    approved: int
    rejected: int
