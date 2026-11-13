"""Takedown requests from rights holders (docs/takedown-process.md). Not legal advice.

Public: `POST /takedown` (the web form, no sign-in), `POST /takedown/{reference}/counter-notice`
(the uploader, signed in). Team (admin key): `/admin/takedowns`, a queue with the actions take
down, reject, forward a counter-notice, restore, close, and the two letter templates.
"""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.extras_common import AppSettings, DatabaseSession, Member
from app.core.security import require_admin
from app.models.recordings import Recording
from app.models.takedown import TakedownRequest
from app.services import takedowns as service
from app.services.rate_limit import pepper as _pepper

router = APIRouter(prefix="/takedown", tags=["takedown"])
admin_router = APIRouter(prefix="/admin/takedowns", tags=["admin"])
AdminIdentity = Annotated[str, Depends(require_admin)]

RECEIVED = (
    "Thank you. We received your request. A person on our team will read it and write to the "
    "address you gave. Please keep the reference number."
)


class NoticeCreate(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    organization: str | None = Field(default=None, max_length=200)
    email: EmailStr
    phone: str | None = Field(default=None, max_length=60)
    address: str | None = Field(default=None, max_length=400)
    # What identifies the recording: an address from the app or the website, or its title.
    recording: str = Field(min_length=3, max_length=500)
    # The work and the right the sender holds in it.
    work: str = Field(min_length=10, max_length=2000)
    claim: str | None = Field(default=None, max_length=2000)
    good_faith: bool
    accuracy: bool
    signature: str = Field(min_length=2, max_length=200)
    # A field real people never see; a bot fills it.
    website: str | None = Field(default=None, max_length=200)


class Receipt(BaseModel):
    reference: str
    message: str


@router.post("", response_model=Receipt, status_code=201)
async def file_notice(
    body: NoticeCreate, session: DatabaseSession, settings: AppSettings
) -> Receipt:
    """The public form. Stores the request and hides nothing: a person decides."""
    if body.website:
        # A bot: look like a success, store nothing.
        return Receipt(reference=service.new_reference(), message=RECEIVED)
    if not (body.good_faith and body.accuracy):
        raise HTTPException(
            status_code=422, detail="Please confirm both statements. Without them we cannot act."
        )
    filed = await service.file_notice(
        session,
        name=body.name,
        organization=body.organization,
        email=str(body.email),
        phone=body.phone,
        address=body.address,
        recording_ref=body.recording,
        work_description=body.work,
        claim_description=body.claim,
        good_faith=body.good_faith,
        accuracy=body.accuracy,
        signature=body.signature,
        pepper=_pepper(settings),
    )
    return Receipt(reference=filed.request.reference, message=RECEIVED)


class CounterCreate(BaseModel):
    explanation: str = Field(min_length=20, max_length=2000)
    good_faith: bool
    accuracy: bool
    signature: str = Field(min_length=2, max_length=200)
    contact: str | None = Field(default=None, max_length=255)
    address: str | None = Field(default=None, max_length=400)


async def _by_reference(session: AsyncSession, value: str) -> TakedownRequest:
    clauses = [TakedownRequest.reference == value.strip().upper()]
    try:
        clauses.append(TakedownRequest.id == UUID(value))
    except ValueError:
        pass
    row = await session.scalar(select(TakedownRequest).where(or_(*clauses)))
    if row is None:
        raise HTTPException(status_code=404, detail="Request not found")
    return row


@router.post("/{reference}/counter-notice", response_model=Receipt, status_code=201)
async def file_counter_notice(
    reference: str,
    body: CounterCreate,
    session: DatabaseSession,
    member: Member,
    settings: AppSettings,
) -> Receipt:
    """The uploader answers a take-down. Only the uploader of that recording, once."""
    if not (body.good_faith and body.accuracy):
        raise HTTPException(status_code=422, detail="Please confirm both statements.")
    original = await _by_reference(session, reference)
    counter = await service.file_counter_notice(
        session,
        original,
        member_id=member.id,
        member_name=member.display_name,
        member_email=member.email,
        explanation=body.explanation,
        good_faith=body.good_faith,
        accuracy=body.accuracy,
        signature=body.signature,
        contact=body.contact,
        address=body.address,
        pepper=_pepper(settings),
    )
    return Receipt(
        reference=counter.reference,
        message=(
            "Thank you. We received your answer and will pass it to the person who asked for the "
            "removal. We will write to you with what happens next."
        ),
    )


# --------------------------------------------------------------------------- the team


class TakedownOut(BaseModel):
    id: str
    reference: str
    kind: str
    status: str
    related_id: str | None
    recording_ref: str
    recording_id: str | None
    recording_title: str | None
    sender_name: str
    sender_org: str | None
    sender_email: str
    sender_phone: str | None
    sender_address: str | None
    work_description: str
    claim_description: str | None
    statement_good_faith: bool
    statement_accuracy: bool
    signature: str
    decision_reason: str | None
    decided_by: str | None
    decided_at: datetime | None
    author_notified_at: datetime | None
    forwarded_at: datetime | None
    waiting_until: datetime | None
    created_at: datetime


class TakedownList(BaseModel):
    total: int
    items: list[TakedownOut]


def _out(row: TakedownRequest) -> TakedownOut:
    return TakedownOut(
        id=str(row.id),
        reference=row.reference,
        kind=row.kind,
        status=row.status,
        related_id=str(row.related_id) if row.related_id else None,
        recording_ref=row.recording_ref,
        recording_id=str(row.recording_id) if row.recording_id else None,
        recording_title=row.recording_title,
        sender_name=row.sender_name,
        sender_org=row.sender_org,
        sender_email=row.sender_email,
        sender_phone=row.sender_phone,
        sender_address=row.sender_address,
        work_description=row.work_description,
        claim_description=row.claim_description,
        statement_good_faith=row.statement_good_faith,
        statement_accuracy=row.statement_accuracy,
        signature=row.signature,
        decision_reason=row.decision_reason,
        decided_by=row.decided_by,
        decided_at=row.decided_at,
        author_notified_at=row.author_notified_at,
        forwarded_at=row.forwarded_at,
        waiting_until=service.waiting_until(row),
        created_at=row.created_at,
    )


async def _get(session: AsyncSession, request_id: UUID) -> TakedownRequest:
    row = await session.get(TakedownRequest, request_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Request not found")
    return row


@admin_router.get("", response_model=TakedownList)
async def admin_list(
    _admin: AdminIdentity,
    session: DatabaseSession,
    status: Annotated[str | None, Query(max_length=20)] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 30,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> TakedownList:
    rows, total = await service.queue(session, status=status, limit=limit, offset=offset)
    return TakedownList(total=total, items=[_out(r) for r in rows])


@admin_router.get("/{request_id}", response_model=TakedownOut)
async def admin_detail(
    request_id: UUID, _admin: AdminIdentity, session: DatabaseSession
) -> TakedownOut:
    return _out(await _get(session, request_id))


class LinkBody(BaseModel):
    recording_id: UUID


@admin_router.post("/{request_id}/link", response_model=TakedownOut)
async def admin_link(
    request_id: UUID, body: LinkBody, _admin: AdminIdentity, session: DatabaseSession
) -> TakedownOut:
    row = await _get(session, request_id)
    await service.link_recording(session, row, body.recording_id)
    await session.commit()
    return _out(row)


class TakeDownBody(BaseModel):
    note: str | None = Field(default=None, max_length=1000)


@admin_router.post("/{request_id}/take-down", response_model=TakedownOut)
async def admin_take_down(
    request_id: UUID, body: TakeDownBody, admin: AdminIdentity, session: DatabaseSession
) -> TakedownOut:
    """Hide the recording, block its file, tell the uploader (with the reason and how to answer)."""
    row = await _get(session, request_id)
    return _out(await service.take_down(session, row, by=admin, note=body.note))


class ReasonBody(BaseModel):
    reason: str = Field(min_length=3, max_length=1000)


@admin_router.post("/{request_id}/reject", response_model=TakedownOut)
async def admin_reject(
    request_id: UUID, body: ReasonBody, admin: AdminIdentity, session: DatabaseSession
) -> TakedownOut:
    row = await _get(session, request_id)
    return _out(await service.reject(session, row, by=admin, reason=body.reason))


@admin_router.post("/{request_id}/forward", response_model=TakedownOut)
async def admin_forward(
    request_id: UUID, admin: AdminIdentity, session: DatabaseSession
) -> TakedownOut:
    """Mark a counter-notice as passed to the claimant: the waiting time starts."""
    row = await _get(session, request_id)
    return _out(await service.forward_counter_notice(session, row, by=admin))


class RestoreBody(BaseModel):
    claimant_withdrew: bool = False


@admin_router.post("/{request_id}/restore", response_model=TakedownOut)
async def admin_restore(
    request_id: UUID, body: RestoreBody, admin: AdminIdentity, session: DatabaseSession
) -> TakedownOut:
    """Put the recording back after the waiting time (or at once if the claimant withdrew)."""
    row = await _get(session, request_id)
    return _out(
        await service.restore(session, row, by=admin, claimant_withdrew=body.claimant_withdrew)
    )


@admin_router.post("/{request_id}/close", response_model=TakedownOut)
async def admin_close(
    request_id: UUID, body: ReasonBody, admin: AdminIdentity, session: DatabaseSession
) -> TakedownOut:
    """The claimant started a legal process, or it is over: the recording stays down."""
    row = await _get(session, request_id)
    return _out(await service.close(session, row, by=admin, reason=body.reason))


class LetterOut(BaseModel):
    subject: str
    body: str


class LettersOut(BaseModel):
    to_author: LetterOut | None
    to_claimant: LetterOut
    disclaimer: Literal["Templates, not legal advice."] = "Templates, not legal advice."


@admin_router.get("/{request_id}/letters", response_model=LettersOut)
async def admin_letters(
    request_id: UUID, _admin: AdminIdentity, session: DatabaseSession
) -> LettersOut:
    """The two letters filled in for this request: the notice to the uploader and the reply."""
    row = await _get(session, request_id)
    original = row
    if row.kind == "counter_notice" and row.related_id is not None:
        original = await _get(session, row.related_id)
    recording = (
        await session.get(Recording, original.recording_id) if original.recording_id else None
    )
    author = service.letter_to_author(original, recording)
    claimant = service.letter_to_claimant(original, outcome=row.status)
    return LettersOut(
        to_author=LetterOut(subject=author.subject, body=author.body),
        to_claimant=LetterOut(subject=claimant.subject, body=claimant.body),
    )
