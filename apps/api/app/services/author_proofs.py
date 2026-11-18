"""Proof of identity for claiming recordings (docs/author-profiles.md, "Proof of identity").

Dada's decisions of 2026-11-18, as code:

* ONE proof per PAGE, not per recording: a channel or social link that shows the name and links back
  to the page, or a reply from the e-mail address listed on that channel (the team sends a one-time
  code to it), or, only when there is no public page, a voice or video note. A famous name (more
  than `FAMOUS_AFTER` library recordings under it) or a group needs TWO proofs, or one team member
  who knows them (that counts for two). A name alone is never a proof.
* The team answers within 3 days. After 5 days the team gets a reminder. A request the person does
  not answer closes after 14 days with the note `no_proof`; sending a proof opens it again.
* While a request waits nothing about it is visible to anybody else, and the uploader of a recording
  is told only once a claim is approved (that is in `author_claims.py`, not here).
* A look-alike name never goes through here: it always waits for the team (the ladder).
"""

from __future__ import annotations

import asyncio
import hashlib
import hmac
import re
import secrets
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.author_profiles import (
    AuthorClaim,
    AuthorClaimEvent,
    AuthorClaimProof,
    AuthorProfile,
)
from app.models.member import UserAccount
from app.models.recordings import Recording
from app.schemas.author_proofs import (
    AdminProofOut,
    PageDetail,
    ProofOut,
    RequestState,
)
from app.services import author_claims as claims_service
from app.services import author_rules as rules
from app.services.acs_email import send_transactional_email
from app.services.author_profiles import AuthorError, admin_verify, now_utc
from app.services.recordings import VISIBLE

# ---- the knobs (one place each) --------------------------------------------------------------

ANSWER_DAYS = 3  # the team's target
REMIND_TEAM_DAYS = 5  # after this the team gets a reminder
CLOSE_DAYS = 14  # a request the person does not answer closes
PROOFS_MAX = 6  # live proofs per page
CODE_TTL_HOURS = 48
CODE_TRIES_MAX = 5
TEAM_VOUCH_WEIGHT = 2  # one team member who knows the person is worth two proofs
NO_PROOF = "no_proof"  # the decision note of a request that closed by itself

LIVE = ("waiting", "code_sent", "more_needed", "ok")
OPEN_FOR_TEAM = ("waiting", "code_sent", "more_needed")
_EMAIL = re.compile(r"^[^@\s]{1,64}@[^@\s]{1,200}\.[^@\s]{2,}$")


def _aware(moment: datetime | None) -> datetime | None:
    """SQLite gives back naive times; the app stores UTC."""
    if moment is None:
        return None
    return moment if moment.tzinfo else moment.replace(tzinfo=UTC)


# --------------------------------------------------------------------------- reading


async def proofs_of(session: AsyncSession, profile: AuthorProfile) -> list[AuthorClaimProof]:
    rows = await session.scalars(
        select(AuthorClaimProof)
        .where(AuthorClaimProof.profile_id == profile.id)
        .order_by(AuthorClaimProof.created_at, AuthorClaimProof.id)
    )
    return list(rows.all())


def proof_out(row: AuthorClaimProof) -> ProofOut:
    return ProofOut(
        id=str(row.id),
        kind=row.kind,  # type: ignore[arg-type]
        value=row.value,
        note=row.note,
        status=row.status,  # type: ignore[arg-type]
        code_sent=row.status == "code_sent",
        code_confirmed=row.code_confirmed,
        team_note=row.team_note,
        created_at=row.created_at,
        decided_at=row.decided_at,
    )


def admin_proof_out(
    row: AuthorClaimProof, profile: AuthorProfile, now: datetime | None = None
) -> AdminProofOut:
    moment = now or now_utc()
    clock = _aware(row.clock_at) or moment
    return AdminProofOut(
        **proof_out(row).model_dump(),
        profile_id=str(profile.id),
        profile_slug=profile.slug,
        profile_name=profile.display_name,
        decided_by=row.decided_by,
        overdue=row.status == "waiting"
        and row.kind != "request"
        and clock <= moment - timedelta(days=REMIND_TEAM_DAYS),
    )


async def required_for(session: AsyncSession, profile: AuthorProfile) -> tuple[int, str]:
    """How many proofs this page needs: (2, "group"), (2, "famous") or (1, "one")."""
    if profile.author_type == "group":
        return 2, "group"
    names = [
        n.strip().lower() for n in (profile.display_name, profile.claimed_name or "") if n.strip()
    ]
    if names:
        count = await session.scalar(
            select(func.count())
            .select_from(Recording)
            .where(
                Recording.status.in_(VISIBLE),
                Recording.author_id.is_(None),
                func.lower(Recording.author).in_(names),
            )
        )
        if int(count or 0) > claims_service.FAMOUS_AFTER:
            return 2, "famous"
    return 1, "one"


def have_of(proofs: list[AuthorClaimProof]) -> int:
    return sum(TEAM_VOUCH_WEIGHT if p.kind == "team" else 1 for p in proofs if p.status == "ok")


async def _claim_counts(session: AsyncSession, profile: AuthorProfile) -> dict[str, int]:
    rows = (
        await session.execute(
            select(AuthorClaim.status, func.count())
            .where(AuthorClaim.profile_id == profile.id)
            .group_by(AuthorClaim.status)
        )
    ).all()
    return {status: int(n) for status, n in rows}


async def _system_closed(session: AsyncSession, profile: AuthorProfile) -> int:
    return int(
        await session.scalar(
            select(func.count())
            .select_from(AuthorClaim)
            .where(
                AuthorClaim.profile_id == profile.id,
                AuthorClaim.status == "rejected",
                AuthorClaim.decided_by == "system",
                AuthorClaim.decision_note == NO_PROOF,
            )
        )
        or 0
    )


async def _last_pending(session: AsyncSession, profile: AuthorProfile) -> datetime | None:
    return _aware(
        await session.scalar(
            select(func.max(AuthorClaim.created_at)).where(
                AuthorClaim.profile_id == profile.id, AuthorClaim.status == "pending"
            )
        )
    )


def stage_of(
    profile: AuthorProfile, proofs: list[AuthorClaimProof], *, pending: int, closed: int
) -> str:
    """Where the request stands (see `RequestStage`)."""
    if profile.verified:
        return "verified"
    if pending == 0 and closed:
        return "closed"
    live = [p for p in proofs if p.status in OPEN_FOR_TEAM]
    if any(p.status == "code_sent" for p in live):
        return "code"
    if any(p.status == "waiting" and p.kind != "request" for p in live):
        return "with_team"
    if any(p.status == "more_needed" for p in live):
        return "need_more"
    return "no_proof"


def _clock(proofs: list[AuthorClaimProof], last_pending: datetime | None) -> datetime | None:
    moves = [
        c for p in proofs if p.status in OPEN_FOR_TEAM and (c := _aware(p.clock_at)) is not None
    ]
    if last_pending:
        moves.append(last_pending)
    return max(moves) if moves else None


async def request_state(session: AsyncSession, profile: AuthorProfile) -> RequestState:
    proofs = await proofs_of(session, profile)
    counts = await _claim_counts(session, profile)
    closed = await _system_closed(session, profile)
    pending = int(counts.get("pending", 0))
    stage = stage_of(profile, proofs, pending=pending, closed=closed)
    required, why = await required_for(session, profile)
    clock = _clock(proofs, await _last_pending(session, profile))
    answer_by = closes_at = None
    if clock and stage == "with_team":
        answer_by = clock + timedelta(days=ANSWER_DAYS)
    if clock and stage in ("no_proof", "need_more", "code") and pending:
        closes_at = clock + timedelta(days=CLOSE_DAYS)
    return RequestState(
        stage=stage,  # type: ignore[arg-type]
        verified=profile.verified,
        required=required,
        have=have_of(proofs),
        why_required=why,  # type: ignore[arg-type]
        proofs=[proof_out(p) for p in proofs if p.kind != "request" or p.status == "more_needed"],
        pending_claims=pending,
        approved_claims=int(counts.get("approved", 0)),
        answer_by=answer_by,
        closes_at=closes_at,
    )


# --------------------------------------------------------------------------- the person


def _check_value(kind: str, raw: str) -> str:
    value = rules.clean_line(raw, 500)
    if not value:
        raise AuthorError("proof_empty", 422, "Write what you are sending")
    if kind == "link":
        try:
            return rules.normalize_link("website", value)["url"]
        except rules.LinkError as exc:
            raise AuthorError("proof_link_invalid", 422, "This is not a usable link") from exc
    if kind == "email":
        if not _EMAIL.match(value):
            raise AuthorError("proof_email_invalid", 422, "This is not an e-mail address")
        return value.lower()
    return value


async def _log_claim(session: AsyncSession, claim: AuthorClaim, actor: str, action: str) -> None:
    session.add(
        AuthorClaimEvent(claim_id=claim.id, at=now_utc(), actor=actor, action=action, note=None)
    )


async def reopen_closed(session: AsyncSession, profile: AuthorProfile, actor: str) -> int:
    """A request that closed by itself (`no_proof`) opens again when the person sends a proof."""
    rows = (
        await session.scalars(
            select(AuthorClaim).where(
                AuthorClaim.profile_id == profile.id,
                AuthorClaim.status == "rejected",
                AuthorClaim.decided_by == "system",
                AuthorClaim.decision_note == NO_PROOF,
            )
        )
    ).all()
    for row in rows:
        row.status = "pending"
        row.decided_by = row.decided_at = row.decision_note = None
        await _log_claim(session, row, actor, "reopened")
    return len(rows)


async def submit(
    session: AsyncSession,
    profile: AuthorProfile,
    member_id: UUID,
    *,
    kind: str,
    value: str,
    note: str | None,
) -> ProofOut:
    if profile.status == "suspended":
        raise AuthorError("page_suspended", 403, "This page is suspended")
    clean = _check_value(kind, value)
    proofs = await proofs_of(session, profile)
    live = [p for p in proofs if p.status in LIVE and p.kind != "request"]
    if len(live) >= PROOFS_MAX:
        raise AuthorError("proofs_limit", 429, "Too many proofs")
    if any(p.kind == kind and p.value == clean for p in live):
        raise AuthorError("proof_repeated", 409, "You already sent this")
    moment = now_utc()
    row = AuthorClaimProof(
        profile_id=profile.id,
        kind=kind,
        value=clean,
        note=rules.clean_line(note, 500) or None,
        status="waiting",
        clock_at=moment,
    )
    session.add(row)
    for old in proofs:  # the team's question is answered
        if old.kind == "request" and old.status == "more_needed":
            old.status = "withdrawn"
    await reopen_closed(session, profile, f"member:{member_id}")
    await session.commit()
    return proof_out(row)


async def withdraw_proof(session: AsyncSession, profile: AuthorProfile, proof_id: UUID) -> None:
    row = await session.get(AuthorClaimProof, proof_id)
    if row is None or row.profile_id != profile.id or row.kind == "request":
        raise AuthorError("proof_not_found", 404, "Proof not found")
    if row.status not in ("waiting", "code_sent", "more_needed"):
        raise AuthorError("proof_closed", 409, "The team already answered this")
    row.status = "withdrawn"
    row.clock_at = now_utc()
    await session.commit()


def _hash(proof_id: UUID, code: str) -> str:
    return hashlib.sha256(f"{proof_id}:{code}".encode()).hexdigest()


async def confirm_code(
    session: AsyncSession, profile: AuthorProfile, proof_id: UUID, code: str
) -> ProofOut:
    row = await session.get(AuthorClaimProof, proof_id)
    if row is None or row.profile_id != profile.id or row.kind != "email":
        raise AuthorError("proof_not_found", 404, "Proof not found")
    if row.status != "code_sent" or not row.code_hash:
        raise AuthorError("code_not_sent", 409, "No code is waiting")
    expires = _aware(row.code_expires_at)
    if expires is None or expires < now_utc():
        row.status, row.code_hash = "waiting", None
        await session.commit()
        raise AuthorError("code_expired", 410, "This code is too old. Ask the team for a new one")
    row.code_tries += 1
    if not hmac.compare_digest(row.code_hash, _hash(row.id, code.strip())):
        if row.code_tries >= CODE_TRIES_MAX:
            row.status, row.code_hash = "waiting", None
            await session.commit()
            raise AuthorError("code_locked", 429, "Too many wrong codes. Ask for a new one")
        await session.commit()
        raise AuthorError("code_wrong", 422, "This is not the code")
    row.code_confirmed, row.code_hash, row.status = True, None, "waiting"
    row.clock_at = now_utc()
    await session.commit()
    return proof_out(row)


# --------------------------------------------------------------------------- the team


async def admin_list_proofs(
    session: AsyncSession, *, status: str | None, limit: int, offset: int
) -> tuple[list[AdminProofOut], int]:
    conditions: list[Any] = [AuthorClaimProof.kind != "request"]
    if status:
        conditions.append(AuthorClaimProof.status == status)
    total = int(
        await session.scalar(select(func.count()).select_from(AuthorClaimProof).where(*conditions))
        or 0
    )
    rows = (
        await session.execute(
            select(AuthorClaimProof, AuthorProfile)
            .join(AuthorProfile, AuthorProfile.id == AuthorClaimProof.profile_id)
            .where(*conditions)
            .order_by(AuthorClaimProof.clock_at)
            .limit(limit)
            .offset(offset)
        )
    ).all()
    now = now_utc()
    return [admin_proof_out(p, prof, now) for p, prof in rows], total


async def desk_counts(session: AsyncSession) -> tuple[int, int]:
    """(proofs waiting for the team, requests older than the reminder day)."""
    waiting = int(
        await session.scalar(
            select(func.count())
            .select_from(AuthorClaimProof)
            .where(AuthorClaimProof.status == "waiting", AuthorClaimProof.kind != "request")
        )
        or 0
    )
    cutoff = now_utc() - timedelta(days=REMIND_TEAM_DAYS)
    overdue = int(
        await session.scalar(
            select(func.count())
            .select_from(AuthorClaimProof)
            .where(
                AuthorClaimProof.status == "waiting",
                AuthorClaimProof.kind != "request",
                AuthorClaimProof.clock_at <= cutoff,
            )
        )
        or 0
    )
    return waiting, overdue


async def page_detail(session: AsyncSession, profile_id: UUID) -> PageDetail:
    profile = await session.get(AuthorProfile, profile_id)
    if profile is None:
        raise AuthorError("page_not_found", 404, "Page not found")
    proofs = await proofs_of(session, profile)
    counts = await _claim_counts(session, profile)
    closed = await _system_closed(session, profile)
    required, why = await required_for(session, profile)
    now = now_utc()
    return PageDetail(
        profile_id=str(profile.id),
        slug=profile.slug,
        name=profile.display_name,
        author_type=profile.author_type,  # type: ignore[arg-type]
        status=profile.status,
        verified=profile.verified,
        claimed_name=profile.claimed_name,
        country=profile.country,
        city=profile.city,
        bio=profile.bio,
        links=list(profile.links or []),
        names=await claims_service.names_of(session, profile),
        created_at=profile.created_at,
        stage=stage_of(  # type: ignore[arg-type]
            profile, proofs, pending=int(counts.get("pending", 0)), closed=closed
        ),
        required=required,
        have=have_of(proofs),
        why_required=why,  # type: ignore[arg-type]
        proofs=[admin_proof_out(p, profile, now) for p in proofs if p.kind != "request"],
        pending=int(counts.get("pending", 0)),
        approved=int(counts.get("approved", 0)),
        rejected=int(counts.get("rejected", 0)),
    )


async def send_code(session: AsyncSession, proof_id: UUID, by: str) -> bool:
    """Send a one-time code to the address the person gave. False when e-mail is not set up on this
    server (nothing left it; the proof stays as it was)."""
    row = await session.get(AuthorClaimProof, proof_id)
    if row is None or row.kind == "request":
        raise AuthorError("proof_not_found", 404, "Proof not found")
    if row.kind != "email":
        raise AuthorError("proof_not_email", 422, "Only an e-mail proof has a code")
    if row.status not in ("waiting", "code_sent") or row.code_confirmed:
        raise AuthorError("proof_closed", 409, "This proof does not need a code")
    code = f"{secrets.randbelow(10**6):06d}"
    sent = await asyncio.to_thread(
        send_transactional_email,
        to_address=row.value,
        subject="Your confirmation code",
        plain_text=(
            f"Your code is {code}.\n\nEnter it in the app to confirm that this address is yours. "
            f"It works for {CODE_TTL_HOURS} hours. If you did not ask for it, ignore this message."
        ),
    )
    if not sent:
        return False
    moment = now_utc()
    row.code_hash = _hash(row.id, code)
    row.code_expires_at = moment + timedelta(hours=CODE_TTL_HOURS)
    row.code_tries = 0
    row.status = "code_sent"
    row.clock_at = moment
    row.decided_by = by
    await session.commit()
    return True


async def _tell(
    session: AsyncSession, profile: AuthorProfile, kind: str, title: str, body: str, **payload: Any
) -> None:
    session.add(
        claims_service._notice(
            profile.member_id,
            kind,
            title,
            body,
            None,
            {"profile_slug": profile.slug, "profile_id": str(profile.id), **payload},
        )
    )


async def decide_proof(
    session: AsyncSession,
    proof_id: UUID,
    *,
    action: str,
    by: str,
    note: str | None,
    approve_waiting: bool = False,
) -> tuple[AuthorClaimProof, bool]:
    """The team's answer to one proof: `ok`, `decline` or `more` (ask for more). Returns the proof
    and whether the page became verified by this answer."""
    row = await session.get(AuthorClaimProof, proof_id)
    if row is None or row.kind == "request":
        raise AuthorError("proof_not_found", 404, "Proof not found")
    if row.status not in OPEN_FOR_TEAM:
        raise AuthorError("proof_closed", 409, "This proof is already decided")
    profile = await session.get(AuthorProfile, row.profile_id)
    assert profile is not None
    cleaned = rules.clean_paragraphs(note, 1000) or None
    if action == "more" and not cleaned:
        raise AuthorError("note_needed", 422, "Write what else is needed")
    moment = now_utc()
    row.team_note, row.decided_by, row.clock_at = cleaned, by, moment
    verified_now = False
    if action == "ok":
        row.status, row.decided_at = "ok", moment
        proofs = await proofs_of(session, profile)
        required, _ = await required_for(session, profile)
        if not profile.verified and have_of(proofs) >= required:
            verified_now = True
        await _tell(
            session,
            profile,
            "claim_proof_ok",
            "Your proof was accepted",
            "The team accepted your proof."
            + (" Your page is verified." if verified_now else " One more proof is needed."),
            verified=verified_now,
        )
    elif action == "decline":
        row.status, row.decided_at = "declined", moment
        await _tell(
            session,
            profile,
            "claim_proof_declined",
            "Your proof was not accepted",
            "The team could not accept this proof." + (f" {cleaned}" if cleaned else ""),
            note=cleaned,
        )
    else:
        row.status = "more_needed"
        await _tell(
            session,
            profile,
            "claim_more_proof",
            "The team needs one more thing",
            cleaned or "",
            note=cleaned,
        )
    await session.commit()
    if verified_now:
        await admin_verify(session, profile, by, True)
        if approve_waiting:
            ids = (
                await session.scalars(
                    select(AuthorClaim.id).where(
                        AuthorClaim.profile_id == profile.id,
                        AuthorClaim.status == "pending",
                        AuthorClaim.team_reason == "unverified_page",
                        AuthorClaim.match_level == "same",
                    )
                )
            ).all()
            if ids:
                await claims_service.admin_decide(
                    session,
                    list(ids),
                    profile_id=profile.id,
                    action="approve",
                    by=by,
                    note="Proof accepted",
                )
    return row, verified_now


async def ask_more(session: AsyncSession, profile_id: UUID, *, by: str, note: str) -> None:
    """The team asks for more proof when the page has nothing to attach the question to."""
    profile = await session.get(AuthorProfile, profile_id)
    if profile is None:
        raise AuthorError("page_not_found", 404, "Page not found")
    cleaned = rules.clean_paragraphs(note, 1000)
    if not cleaned:
        raise AuthorError("note_needed", 422, "Write what else is needed")
    session.add(
        AuthorClaimProof(
            profile_id=profile.id,
            kind="request",
            value="",
            status="more_needed",
            team_note=cleaned,
            decided_by=by,
            clock_at=now_utc(),
        )
    )
    await _tell(
        session, profile, "claim_more_proof", "The team needs one more thing", cleaned, note=cleaned
    )
    await session.commit()


# --------------------------------------------------------------------------- the clock


async def _admins(session: AsyncSession) -> list[UUID]:
    return list((await session.scalars(select(UserAccount.id).where(UserAccount.is_admin))).all())


async def run_timers(session: AsyncSession, now: datetime | None = None) -> int:
    """Once a day: remind the team of what waited more than 5 days, and close a request the person
    did not answer for 14 days. Returns how many things changed."""
    moment = now or now_utc()
    changed = 0
    remind_cut = moment - timedelta(days=REMIND_TEAM_DAYS)
    close_cut = moment - timedelta(days=CLOSE_DAYS)

    # --- the team's reminder: proofs and claims that waited past the target, once each
    reminded = 0
    waiting = (
        await session.scalars(
            select(AuthorClaimProof).where(
                AuthorClaimProof.status == "waiting",
                AuthorClaimProof.kind != "request",
                AuthorClaimProof.reminded_at.is_(None),
            )
        )
    ).all()
    for proof in waiting:
        if (_aware(proof.clock_at) or moment) <= remind_cut:
            proof.reminded_at = moment
            reminded += 1
    profile_ids = set(
        (
            await session.scalars(
                select(AuthorClaim.profile_id).where(AuthorClaim.status == "pending").distinct()
            )
        ).all()
    )
    for profile_id in profile_ids:
        profile = await session.get(AuthorProfile, profile_id)
        if profile is None or profile.status == "suspended":
            continue
        proofs = await proofs_of(session, profile)
        pending_rows = (
            await session.scalars(
                select(AuthorClaim).where(
                    AuthorClaim.profile_id == profile.id, AuthorClaim.status == "pending"
                )
            )
        ).all()
        stage = stage_of(profile, proofs, pending=len(pending_rows), closed=0)
        clock = _clock(proofs, max(_aware(c.created_at) or moment for c in pending_rows))
        # the person's turn and silent for 14 days: close
        if stage in ("no_proof", "need_more", "code") and clock and clock <= close_cut:
            for claim in pending_rows:
                claim.status = "rejected"
                claim.decided_by = "system"
                claim.decided_at = moment
                claim.decision_note = NO_PROOF
                await _log_claim(session, claim, "system", "closed")
            for proof in proofs:
                if proof.status in ("more_needed", "code_sent"):
                    proof.status, proof.code_hash = "withdrawn", None
            await _tell(
                session,
                profile,
                "claim_closed_no_proof",
                "Your request was closed",
                "We did not receive a proof, so the request was closed. Send a proof any time and "
                "it opens again.",
                count=len(pending_rows),
            )
            changed += len(pending_rows)
            continue
        # the team's turn: one reminder per claim that waited past the target
        if stage != "verified" and stage != "with_team":
            continue
        for claim in pending_rows:
            if (_aware(claim.created_at) or moment) > remind_cut:
                continue
            done = await session.scalar(
                select(func.count())
                .select_from(AuthorClaimEvent)
                .where(AuthorClaimEvent.claim_id == claim.id, AuthorClaimEvent.action == "reminded")
            )
            if not done:
                await _log_claim(session, claim, "system", "reminded")
                reminded += 1
    if reminded:
        for admin_id in await _admins(session):
            session.add(
                claims_service._notice(
                    admin_id,
                    "claim_team_reminder",
                    "Claims are waiting for the team",
                    f"{reminded} request(s) have waited more than {REMIND_TEAM_DAYS} days.",
                    None,
                    {"count": reminded},
                )
            )
        changed += reminded
    await session.commit()
    return changed
