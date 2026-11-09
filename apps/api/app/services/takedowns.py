"""Takedown requests from rights holders (docs/takedown-process.md). Not legal advice.

The flow, in the order a request lives:

1. A rights holder fills the public form (`file_notice`). Nothing is hidden yet: a person on the
   team reads it. The answer is the same whether or not the recording was found, so the form
   cannot be used to find out what is in the library.
2. The team either takes the recording down (`take_down`: it is hidden, its file is put on the
   blocked list, and the uploader gets a notice with the reason and how to answer) or rejects the
   request (`reject`: nothing changes).
3. The uploader may answer with a counter-notice (`file_counter_notice`). The team passes it to
   the claimant (`forward_counter_notice`), and unless the claimant starts a legal process within
   the waiting time, the recording comes back (`restore`) and the file leaves the blocked list.
   If the claimant does start one, the request is closed and the recording stays down (`close`).
"""

from __future__ import annotations

import hashlib
import logging
import re
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.recordings import MemberNotice, Recording
from app.models.takedown import TakedownRequest
from app.services import blocked_hashes
from app.services import recordings as recordings_service

# Days between passing a counter-notice to the claimant and putting the recording back. The usual
# range in public take-down procedures is 10 to 14 business days; the team may set it, see docs.
COUNTER_WAIT_DAYS = 14
# At most this many new notices from one sender in a day. There is deliberately no cap for the whole
# service: anyone can send a notice without an account, so a shared cap would let one stranger shut
# every real rights holder out. Past FLOOD_WARN_PER_DAY new notices a day the service still accepts
# them and logs a warning, so the team looks at the queue (docs/takedown-process.md).
MAX_PER_SENDER_PER_DAY = 3
FLOOD_WARN_PER_DAY = 200
logger = logging.getLogger(__name__)
UUID_PATTERN = re.compile(
    r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
)
REFERENCE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no 0/O, 1/I


def now_utc() -> datetime:
    return datetime.now(UTC)


def new_reference() -> str:
    return "TD-" + "".join(secrets.choice(REFERENCE_ALPHABET) for _ in range(6))


def sender_key(email: str, pepper: str) -> str:
    """A salted hash of the address, only used to count how many notices one sender files."""
    return hashlib.sha256(f"{pepper}|takedown|{email.strip().lower()}".encode()).hexdigest()[:32]


def find_recording_id(text: str) -> UUID | None:
    """The first recording id in an address or a pasted line, or None."""
    match = UUID_PATTERN.search(text or "")
    return UUID(match.group(0)) if match else None


@dataclass(frozen=True)
class Filed:
    request: TakedownRequest
    duplicate: bool = False


async def _unique_reference(session: AsyncSession) -> str:
    for _ in range(8):
        reference = new_reference()
        taken = await session.scalar(
            select(TakedownRequest.id).where(TakedownRequest.reference == reference)
        )
        if taken is None:
            return reference
    raise HTTPException(status_code=503, detail="Please try again in a moment.")


async def link_recording(
    session: AsyncSession, request: TakedownRequest, recording_id: UUID
) -> None:
    recording = await session.get(Recording, recording_id)
    if recording is None:
        raise HTTPException(status_code=404, detail="Recording not found")
    request.recording_id = recording.id
    request.recording_title = recording.title[:200]
    request.audio_sha256 = recording.audio_sha256


async def file_notice(
    session: AsyncSession,
    *,
    name: str,
    organization: str | None,
    email: str,
    phone: str | None,
    address: str | None,
    recording_ref: str,
    work_description: str,
    claim_description: str | None,
    good_faith: bool,
    accuracy: bool,
    signature: str,
    pepper: str,
    source: str = "web",
) -> Filed:
    """Store a notice. Never hides anything. Returns the existing one for a repeat of the same
    sender and recording, so pressing the button twice makes one request."""
    key = sender_key(email, pepper)
    since = now_utc() - timedelta(days=1)
    total = await session.scalar(
        select(func.count())
        .select_from(TakedownRequest)
        .where(TakedownRequest.kind == "notice", TakedownRequest.created_at >= since)
    )
    if (total or 0) >= FLOOD_WARN_PER_DAY:
        # Accepted anyway, as "new" (nothing is acted on before the team reads it).
        logger.warning("takedown notices: %d new in the last day, check the queue", total)
    recent = (
        await session.scalars(
            select(TakedownRequest).where(
                TakedownRequest.kind == "notice",
                TakedownRequest.sender_key == key,
                TakedownRequest.created_at >= since,
            )
        )
    ).all()
    wanted = recording_ref.strip().lower()
    for earlier in recent:
        if earlier.recording_ref.strip().lower() == wanted and earlier.status == "new":
            return Filed(earlier, duplicate=True)
    if len(recent) >= MAX_PER_SENDER_PER_DAY:
        raise HTTPException(
            status_code=429,
            detail="You have sent several requests today. We will answer them; please wait.",
        )
    request = TakedownRequest(
        reference=await _unique_reference(session),
        kind="notice",
        status="new",
        recording_ref=recording_ref.strip(),
        sender_name=name.strip(),
        sender_org=(organization or "").strip() or None,
        sender_email=email.strip().lower(),
        sender_phone=(phone or "").strip() or None,
        sender_address=(address or "").strip() or None,
        work_description=work_description.strip(),
        claim_description=(claim_description or "").strip() or None,
        statement_good_faith=good_faith,
        statement_accuracy=accuracy,
        signature=signature.strip(),
        source=source,
        sender_key=key,
    )
    found = find_recording_id(recording_ref)
    session.add(request)
    if found is not None:
        recording = await session.get(Recording, found)
        if recording is not None:
            request.recording_id = recording.id
            request.recording_title = recording.title[:200]
            request.audio_sha256 = recording.audio_sha256
    await session.commit()
    await session.refresh(request)
    return Filed(request)


# --------------------------------------------------------------------------- the team's actions


def _require_notice(request: TakedownRequest) -> None:
    if request.kind != "notice":
        raise HTTPException(status_code=409, detail="This is a counter-notice, not a notice.")


def takedown_reason(request: TakedownRequest) -> str:
    return (
        f"A rights holder reported that it infringes their rights (reference {request.reference})"
    )


async def take_down(
    session: AsyncSession, request: TakedownRequest, *, by: str, note: str | None = None
) -> TakedownRequest:
    """Hide the recording, block its file, tell the uploader. Needs a linked recording."""
    _require_notice(request)
    if request.status not in ("new", "rejected"):
        raise HTTPException(status_code=409, detail=f"Already {request.status.replace('_', ' ')}.")
    if request.recording_id is None:
        raise HTTPException(
            status_code=422, detail="Link the recording first (it was not found from the address)."
        )
    recording = await session.get(Recording, request.recording_id)
    if recording is None:
        raise HTTPException(status_code=404, detail="Recording not found")
    reason = takedown_reason(request)
    notice: MemberNotice | None = None
    if recording.status != "removed":
        notice = await recordings_service.remove_recording(session, recording, reason=reason, by=by)
    request.recording_title = recording.title[:200]
    request.audio_sha256 = recording.audio_sha256
    await blocked_hashes.block(
        session, recording.audio_sha256, reason=reason, by=by, takedown_id=request.id
    )
    request.status = "taken_down"
    request.decided_by = by
    request.decided_at = now_utc()
    request.decision_reason = (note or "").strip() or None
    if notice is not None:
        letter = letter_to_author(request, recording)
        notice.title = letter.subject[:300]
        notice.body = letter.body
        payload = dict(notice.payload or {})
        payload.update(
            {
                "takedown_reference": request.reference,
                "takedown_id": str(request.id),
                "actions": ["counter_notice", "contact"],
            }
        )
        notice.payload = payload
        request.author_notified_at = now_utc()
    await session.commit()
    await session.refresh(request)
    return request


async def reject(
    session: AsyncSession, request: TakedownRequest, *, by: str, reason: str
) -> TakedownRequest:
    _require_notice(request)
    if request.status != "new":
        raise HTTPException(status_code=409, detail=f"Already {request.status.replace('_', ' ')}.")
    request.status = "rejected"
    request.decided_by = by
    request.decided_at = now_utc()
    request.decision_reason = reason.strip()
    await session.commit()
    await session.refresh(request)
    return request


async def file_counter_notice(
    session: AsyncSession,
    original: TakedownRequest,
    *,
    member_id: UUID,
    member_name: str,
    member_email: str | None,
    explanation: str,
    good_faith: bool,
    accuracy: bool,
    signature: str,
    contact: str | None,
    address: str | None,
    pepper: str,
) -> TakedownRequest:
    """The uploader answers a take-down. Only the recording's own uploader, once."""
    _require_notice(original)
    if original.status != "taken_down" or original.recording_id is None:
        raise HTTPException(status_code=409, detail="There is nothing to answer for this request.")
    recording = await session.get(Recording, original.recording_id)
    if recording is None or recording.author_id != member_id:
        raise HTTPException(status_code=404, detail="Request not found")
    existing = await session.scalar(
        select(TakedownRequest.id).where(
            TakedownRequest.kind == "counter_notice", TakedownRequest.related_id == original.id
        )
    )
    if existing is not None:
        raise HTTPException(status_code=409, detail="You already answered this request.")
    email = (member_email or contact or "").strip().lower()
    if "@" not in email:
        raise HTTPException(status_code=422, detail="Add an e-mail address where we can reach you.")
    counter = TakedownRequest(
        reference=await _unique_reference(session),
        kind="counter_notice",
        status="new",
        related_id=original.id,
        recording_ref=original.recording_ref,
        recording_id=original.recording_id,
        recording_title=original.recording_title,
        audio_sha256=original.audio_sha256,
        sender_name=member_name.strip() or "Member",
        sender_email=email,
        sender_address=(address or "").strip() or None,
        sender_member_id=member_id,
        work_description=explanation.strip(),
        statement_good_faith=good_faith,
        statement_accuracy=accuracy,
        signature=signature.strip(),
        source="app",
        sender_key=sender_key(email, pepper),
    )
    session.add(counter)
    original.status = "counter_received"
    await session.commit()
    await session.refresh(counter)
    return counter


async def forward_counter_notice(
    session: AsyncSession, counter: TakedownRequest, *, by: str
) -> TakedownRequest:
    """The team passed the counter-notice to the claimant: the waiting time starts now."""
    if counter.kind != "counter_notice":
        raise HTTPException(status_code=409, detail="Only a counter-notice can be forwarded.")
    if counter.status != "new":
        raise HTTPException(status_code=409, detail=f"Already {counter.status.replace('_', ' ')}.")
    counter.status = "forwarded"
    counter.forwarded_at = now_utc()
    counter.decided_by = by
    await session.commit()
    await session.refresh(counter)
    return counter


def waiting_until(counter: TakedownRequest) -> datetime | None:
    if counter.forwarded_at is None:
        return None
    forwarded = counter.forwarded_at
    if forwarded.tzinfo is None:
        forwarded = forwarded.replace(tzinfo=UTC)
    return forwarded + timedelta(days=COUNTER_WAIT_DAYS)


async def _original_of(session: AsyncSession, counter: TakedownRequest) -> TakedownRequest | None:
    if counter.related_id is None:
        return None
    return await session.get(TakedownRequest, counter.related_id)


HOLDING_STATUSES = ("taken_down", "counter_received", "closed")


async def _other_holds(
    session: AsyncSession, original: TakedownRequest, recording: Recording
) -> list[str]:
    """References of the OTHER notices that still hold this recording or its file: taken down,
    answered and waiting, or closed (a legal process). Restoring is refused while any exists."""
    same_thing = [TakedownRequest.recording_id == recording.id]
    if recording.audio_sha256:
        same_thing.append(TakedownRequest.audio_sha256 == recording.audio_sha256)
    rows = await session.scalars(
        select(TakedownRequest.reference).where(
            TakedownRequest.kind == "notice",
            TakedownRequest.id != original.id,
            TakedownRequest.status.in_(HOLDING_STATUSES),
            or_(*same_thing),
        )
    )
    return sorted(rows.all())


async def restore(
    session: AsyncSession,
    counter: TakedownRequest,
    *,
    by: str,
    claimant_withdrew: bool = False,
) -> TakedownRequest:
    """Put the recording back. Only after the waiting time, unless the claimant withdrew."""
    if counter.kind != "counter_notice":
        raise HTTPException(status_code=409, detail="Restore from the counter-notice.")
    if counter.status != "forwarded":
        raise HTTPException(
            status_code=409, detail="Forward the counter-notice to the claimant first."
        )
    until = waiting_until(counter)
    if not claimant_withdrew and until is not None and now_utc() < until:
        raise HTTPException(
            status_code=409,
            detail=(
                f"The waiting time ends {until.date().isoformat()}. If the claimant withdrew the "
                "request, say so."
            ),
        )
    original = await _original_of(session, counter)
    if original is None or original.status != "counter_received":
        # The request this counter-notice answered was closed or decided in the meantime.
        raise HTTPException(
            status_code=409, detail="The request this answers is no longer waiting for it."
        )
    if counter.recording_id is None:
        raise HTTPException(status_code=422, detail="There is no recording to restore.")
    recording = await session.get(Recording, counter.recording_id)
    if recording is None:
        raise HTTPException(status_code=404, detail="Recording not found")
    holding = await _other_holds(session, original, recording)
    if holding:
        raise HTTPException(
            status_code=409,
            detail=(
                "Another request still holds this recording or file ("
                + ", ".join(holding)
                + "). Settle it first; one request cannot undo another."
            ),
        )
    if recording.status == "removed":
        await recordings_service.restore_recording(session, recording, by=by)
    if counter.audio_sha256 or original.audio_sha256:
        # only this request's own row: any other request's row keeps the file blocked
        await blocked_hashes.unblock(
            session, (counter.audio_sha256 or original.audio_sha256 or ""), takedown_id=original.id
        )
    counter.status = "restored"
    counter.decided_by = by
    counter.decided_at = now_utc()
    counter.decision_reason = "claimant withdrew" if claimant_withdrew else "waiting time passed"
    if original is not None:
        original.status = "restored"
    await session.commit()
    await session.refresh(counter)
    return counter


async def close(
    session: AsyncSession, request: TakedownRequest, *, by: str, reason: str
) -> TakedownRequest:
    """The claimant started a legal process, or the matter is over: the recording stays down."""
    if request.status in ("restored", "closed"):
        raise HTTPException(status_code=409, detail=f"Already {request.status}.")
    request.status = "closed"
    request.decided_by = by
    request.decided_at = now_utc()
    request.decision_reason = reason.strip()
    if request.kind == "counter_notice":
        original = await _original_of(session, request)
        if original is not None and original.status == "counter_received":
            original.status = "closed"
    await session.commit()
    await session.refresh(request)
    return request


async def queue(
    session: AsyncSession, *, status: str | None, limit: int, offset: int
) -> tuple[list[TakedownRequest], int]:
    conditions = [TakedownRequest.status == status] if status else []
    total = await session.scalar(
        select(func.count()).select_from(TakedownRequest).where(*conditions)
    )
    rows = (
        await session.scalars(
            select(TakedownRequest)
            .where(*conditions)
            .order_by(TakedownRequest.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
    ).all()
    return list(rows), int(total or 0)


# --------------------------------------------------------------------------- the two letters

SIGN_OFF = "Prabhat Samgiita AI team"


@dataclass(frozen=True)
class Letter:
    subject: str
    body: str


def letter_to_author(request: TakedownRequest, recording: Recording | None) -> Letter:
    """What the uploader reads (in the app's notices) when a recording is taken down."""
    title = request.recording_title or (recording.title if recording else "your recording")
    org = f" ({request.sender_org})" if request.sender_org else ""
    subject = f"“{title}” was taken down after a rights holder's request"
    body = (
        f"We removed “{title}” from the library.\n\n"
        f"A rights holder, {request.sender_name}{org}, told us that this recording infringes their "
        f"rights in: {request.work_description[:400]}\n"
        f"Reference: {request.reference}.\n\n"
        "We have not decided who is right. We act on such requests quickly and we hide the "
        "recording until it is clear. The file can no longer be uploaded while this stands.\n\n"
        "If you believe this was a mistake, or you have the right to share it, you can send a "
        "counter-notice from this message. You will be asked to explain why, to confirm that you "
        "believe in good faith that it was removed by mistake, and to give your name and an "
        "address where you can be reached. We pass your answer to the person who asked for the "
        "removal. If they do not start a legal process within about "
        f"{COUNTER_WAIT_DAYS} days, we put the recording back.\n\n"
        "If you do not answer, the recording stays removed.\n\n"
        "This message is not legal advice. If you are unsure of your rights, ask a lawyer.\n\n"
        f"{SIGN_OFF}"
    )
    return Letter(subject, body)


def letter_to_claimant(request: TakedownRequest, *, outcome: str | None = None) -> Letter:
    """The reply to the rights holder. `outcome` defaults to what the request's status says."""
    which = outcome or request.status
    ref = request.reference
    subject = f"Your request {ref}"
    greeting = f"Dear {request.sender_name},\n\n"
    ending = f"\n\nWith respect,\n{SIGN_OFF}\n\nThis message is not legal advice."
    if which == "new":
        body = (
            "Thank you for writing. We received your request about "
            f"“{request.recording_ref[:200]}” and a person on our team will read it. We will write "
            f"again with what we decided. Please quote {ref} if you write to us."
        )
    elif which == "taken_down":
        body = (
            "We removed the recording you reported and stopped it from being uploaded again. We "
            "told the person who uploaded it and gave them a way to answer. If they send a "
            "counter-notice we will pass it to you, and you will have about "
            f"{COUNTER_WAIT_DAYS} days to tell us that you have started a legal process; "
            "otherwise we may put the recording back."
        )
    elif which == "rejected":
        why = request.decision_reason or "we could not match it to a recording or to your rights"
        body = (
            "We looked at your request and did not remove anything yet, because "
            f"{why}. If you can send the exact address of the recording or the missing details, "
            "write to us again quoting the reference and we will look again."
        )
    elif which in ("counter_received", "forwarded"):
        body = (
            "The person who uploaded the recording sent a counter-notice. It says the recording "
            "was removed by mistake or that they have the right to share it. We are passing it "
            "to you with this letter. If you do not tell us within about "
            f"{COUNTER_WAIT_DAYS} days that you have started a legal process, we may put the "
            "recording back."
        )
    elif which == "restored":
        body = (
            "We did not hear that a legal process was started, so we put the recording back. If "
            "that changes, tell us and quote the reference."
        )
    else:
        body = "Your request is closed. The recording stays removed."
    return Letter(subject, greeting + body + ending)
