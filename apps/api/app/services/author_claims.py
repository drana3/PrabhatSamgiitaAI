"""Claiming recordings that somebody else added: find the ones that may be a performer's own, put
a claim on each, and let the team decide the ones that need a person. Rules and the reasons for
them are in docs/author-profiles.md ("Claiming recordings").

How a claim is decided (the ladder; the uploader is NOT asked, Dada's decision):

* `self`  approved at once: the page is published and verified by the team, nothing is flagged on
          it, it is a solo page, the credit names ONE person, it is the same name (not just alike),
          and the name is not a famous or protected one and nobody else holds it.
* `team`  everything else waits for the team desk, with the first reason that applied:
          protected_name, famous_name, taken_by_other, group_credit, group_page, not_same_name,
          unverified_page, draft_page, review_flag.

An approved claim puts the recording on the page (`author_profiles.attribution`); the recording is
never changed. One recording may sit on several pages. All plays of the recording count (the
numbers are about the recording, not about the day it was claimed). The uploader gets an
information notice once a claim is approved, without a button and without a question.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from uuid import UUID

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.author_profiles import (
    AuthorAlias,
    AuthorClaim,
    AuthorClaimEvent,
    AuthorProfile,
)
from app.models.recordings import MemberNotice, Recording, public_kind
from app.schemas.author_claims import (
    AdminClaimOut,
    AliasOut,
    ClaimCandidate,
    ClaimOut,
    ClaimRecording,
    ClaimResult,
    ClaimsCreated,
    ClaimSummary,
    DeskSummary,
    ShownOnPages,
    ShownPage,
)
from app.services import author_claim_rules as match
from app.services import author_rules as rules
from app.services.author_profiles import (
    AuthorError,
    attribution,
    now_utc,
    refresh_snapshot,
)
from app.services.recordings import VISIBLE

# ---- the knobs (one place each) --------------------------------------------------------------

# No daily number and no pause after refusals (Dada, 2026-11-08): a person may ask for as many
# recordings as are theirs. What stays: the waiting list below, the alias rules, the call size
# and the per-hour call limit of the router, which stop a script and never a person.
OPEN_CLAIMS_MAX = 200  # claims waiting for the team, per page
MAX_ALIASES = 5
BATCH_MAX = 50
# A name credited on MORE than this many library recordings is a famous one: the team decides
# (Dada, 2026-11-08: more than 15; it was 25).
FAMOUS_AFTER = 15
SCAN_CREDITS = 5000  # distinct credits looked at when searching by name
SUGGESTION_MAX = 200
SEARCH_MAX = 200
SEARCH_MIN_CHARS = 2

LIVE_STATUSES = ("pending", "approved")
# Which reason is told when several apply (the first one in this list).
REASON_ORDER = (
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
)


# --------------------------------------------------------------------------- names


async def aliases_of(session: AsyncSession, profile: AuthorProfile) -> list[AuthorAlias]:
    rows = await session.scalars(
        select(AuthorAlias)
        .where(AuthorAlias.profile_id == profile.id)
        .order_by(AuthorAlias.added_at, AuthorAlias.alias)
    )
    return list(rows.all())


async def names_of(session: AsyncSession, profile: AuthorProfile) -> list[str]:
    """Every way this person's name is known: the page name, "known as", and the aliases."""
    seen: set[str] = set()
    out: list[str] = []
    candidates = [profile.display_name, profile.claimed_name or ""]
    candidates += [a.alias for a in await aliases_of(session, profile)]
    for name in candidates:
        cleaned = rules.clean_line(name, 120)
        key = match.match_key(cleaned)
        if cleaned and key and key not in seen:
            seen.add(key)
            out.append(cleaned)
    return out


async def add_alias(session: AsyncSession, profile: AuthorProfile, raw: str) -> list[AliasOut]:
    alias = rules.clean_line(raw, 120)
    key = rules.name_key(alias)
    if len(key) < rules.NAME_MIN:
        raise AuthorError("alias_invalid", 422, "Write a name")
    if rules.protected_name_hit(alias) or rules.staff_hit(alias):
        raise AuthorError("alias_not_allowed", 422, "This name cannot be added")
    others = (
        await session.execute(
            select(AuthorProfile.display_name, AuthorProfile.claimed_name).where(
                AuthorProfile.id != profile.id, AuthorProfile.status != "suspended"
            )
        )
    ).all()
    for display, claimed in others:
        if any(
            n and (match.same_name(alias, n) or match.alike_name(alias, n))
            for n in (display, claimed)
        ):
            raise AuthorError("alias_taken", 422, "This name belongs to another page")
    existing = await aliases_of(session, profile)
    if any(a.alias_key == key for a in existing) or key == rules.name_key(profile.display_name):
        return [AliasOut(alias=a.alias, key=a.alias_key) for a in existing]
    if len(existing) >= MAX_ALIASES:
        raise AuthorError("alias_limit", 422, "Too many names")
    session.add(AuthorAlias(profile_id=profile.id, alias=alias, alias_key=key, added_at=now_utc()))
    await session.commit()
    return [AliasOut(alias=a.alias, key=a.alias_key) for a in await aliases_of(session, profile)]


async def remove_alias(session: AsyncSession, profile: AuthorProfile, key: str) -> None:
    row = await session.scalar(
        select(AuthorAlias).where(
            AuthorAlias.profile_id == profile.id, AuthorAlias.alias_key == key
        )
    )
    if row is None:
        raise AuthorError("alias_not_found", 404, "Name not found")
    await session.delete(row)
    await session.commit()


# --------------------------------------------------------------------------- the ladder


def _clean_library(profile: AuthorProfile) -> Any:
    """Recordings somebody else added (or the library import): never the page owner's own uploads,
    which the page already handles by its own rule."""
    return and_(
        Recording.status.in_(VISIBLE),
        or_(Recording.author_id.is_(None), Recording.author_id != profile.member_id),
    )


def _not_on_page(profile: AuthorProfile) -> Any:
    return ~Recording.id.in_(select(Recording.id).where(attribution(profile)))


@dataclass
class Standing:
    """What the ladder says about one recording for one page."""

    level: str
    matched_text: str
    route: str
    team_reason: str | None


class Ladder:
    """The ladder for one page, with the per-credit questions asked once and remembered."""

    def __init__(self, session: AsyncSession, profile: AuthorProfile, names: list[str]) -> None:
        self.session = session
        self.profile = profile
        self.names = names
        # Only names the team has looked at may lead to an approval without a person: the page name
        # (checked when the page was made) and, once the team verified the page, the "known as"
        # name. An alias is something the owner typed alone, so a match that needs one never
        # approves itself.
        trusted = [profile.display_name]
        if profile.verified and profile.claimed_name:
            trusted.append(profile.claimed_name)
        self.trusted = [n for n in trusted if n and n.strip()]
        self._famous: dict[str, str | None] = {}

    async def _famous_reason(self, credit: str) -> str | None:
        """`protected_name`, `famous_name`, `taken_by_other`, or None, for one credit text."""
        key = credit.strip().lower()
        if key in self._famous:
            return self._famous[key]
        reason: str | None = None
        if rules.protected_name_hit(credit) or rules.staff_hit(credit):
            reason = "protected_name"
        if reason is None:
            count = await self.session.scalar(
                select(func.count())
                .select_from(Recording)
                .where(
                    Recording.status.in_(VISIBLE),
                    Recording.author_id.is_(None),
                    func.lower(Recording.author) == key,
                )
            )
            if int(count or 0) > FAMOUS_AFTER:
                reason = "famous_name"
        if reason is None:
            others = (
                await self.session.execute(
                    select(AuthorProfile.display_name, AuthorProfile.claimed_name).where(
                        AuthorProfile.id != self.profile.id,
                        AuthorProfile.verified.is_(True),
                        AuthorProfile.status == "published",
                    )
                )
            ).all()
            if any(
                match.same_name(credit, display) or (claimed and match.same_name(credit, claimed))
                for display, claimed in others
            ):
                reason = "famous_name"
        if reason is None:
            taken = await self.session.scalar(
                select(func.count())
                .select_from(AuthorClaim)
                .join(Recording, Recording.id == AuthorClaim.recording_id)
                .where(
                    AuthorClaim.profile_id != self.profile.id,
                    AuthorClaim.status.in_(LIVE_STATUSES),
                    func.lower(Recording.author) == key,
                )
            )
            if int(taken or 0):
                reason = "taken_by_other"
        self._famous[key] = reason
        return reason

    async def standing(self, recording: Recording, *, from_search: bool = False) -> Standing:
        credit = recording.author or ""
        level, part = match.level_of(credit, self.names)
        if level is None:
            level = "title" if match.title_has(recording.title, self.names) else "manual"
            part = credit
        reasons: set[str] = set()
        profile = self.profile
        if profile.status != "published":
            reasons.add("draft_page")
        elif profile.review_needed or profile.report_reason:
            reasons.add("review_flag")
        if not profile.verified:
            reasons.add("unverified_page")
        if profile.author_type == "group":
            reasons.add("group_page")
        if match.is_group_credit(credit):
            reasons.add("group_credit")
        if level != "same":
            reasons.add("not_same_name")
        elif match.level_of(credit, self.trusted)[0] != "same":
            reasons.add("alias_match")
        famous = await self._famous_reason(credit.strip()) if credit.strip() else None
        if part and part != credit:
            famous = famous or await self._famous_reason(part)
        if famous:
            reasons.add(famous)
        for reason in REASON_ORDER:
            if reason in reasons:
                return Standing(level, part or credit, "team", reason)
        return Standing(level, part or credit, "self", None)


# --------------------------------------------------------------------------- looking for recordings


def recording_view(recording: Recording) -> ClaimRecording:
    return ClaimRecording(
        id=str(recording.id),
        kind=public_kind(recording.kind),
        title=recording.title,
        author=recording.author,
        added_by=recording.added_by,
        library=recording.author_id is None,
        duration_sec=recording.duration_sec,
        plays=recording.plays,
    )


async def _claims_by_recording(
    session: AsyncSession, profile: AuthorProfile, ids: list[UUID]
) -> dict[UUID, AuthorClaim]:
    if not ids:
        return {}
    rows = await session.scalars(
        select(AuthorClaim).where(
            AuthorClaim.profile_id == profile.id, AuthorClaim.recording_id.in_(ids)
        )
    )
    return {c.recording_id: c for c in rows.all()}


async def _candidates(
    session: AsyncSession, profile: AuthorProfile, recordings: list[Recording], ladder: Ladder
) -> list[ClaimCandidate]:
    claims = await _claims_by_recording(session, profile, [r.id for r in recordings])
    out: list[ClaimCandidate] = []
    for recording in recordings:
        standing = await ladder.standing(recording)
        claim = claims.get(recording.id)
        out.append(
            ClaimCandidate(
                recording=recording_view(recording),
                level=standing.level,  # type: ignore[arg-type]
                matched_text=standing.matched_text,
                route=standing.route,  # type: ignore[arg-type]
                team_reason=standing.team_reason,  # type: ignore[arg-type]
                claim_status=claim.status if claim else None,  # type: ignore[arg-type]
                claim_id=str(claim.id) if claim else None,
            )
        )
    return out


async def _credits_like(
    session: AsyncSession, profile: AuthorProfile, names: list[str]
) -> list[str]:
    """The credits (text as typed) that match one of `names`, same or alike."""
    credits = (
        await session.scalars(
            select(Recording.author)
            .where(_clean_library(profile), Recording.author != "")
            .distinct()
            .limit(SCAN_CREDITS)
        )
    ).all()
    return [c for c in credits if c and match.level_of(c, names)[0] is not None]


async def suggestions(
    session: AsyncSession, profile: AuthorProfile
) -> tuple[list[str], list[ClaimCandidate]]:
    """Recordings credited to a name like this page's, that are not on the page yet and have no
    claim in a final state that blocks them. Same-name first."""
    names = await names_of(session, profile)
    credits = await _credits_like(session, profile, names)
    if not credits:
        return names, []
    rows = (
        await session.scalars(
            select(Recording)
            .where(_clean_library(profile), _not_on_page(profile), Recording.author.in_(credits))
            .order_by(Recording.plays.desc(), Recording.created_at.desc())
            .limit(SUGGESTION_MAX)
        )
    ).all()
    ladder = Ladder(session, profile, names)
    found = await _candidates(session, profile, list(rows), ladder)
    found.sort(key=lambda c: (c.level != "same", -c.recording.plays))
    return names, found


async def search(
    session: AsyncSession, profile: AuthorProfile, query: str, *, limit: int, offset: int
) -> tuple[list[ClaimCandidate], int]:
    """The "Find my recordings" page: what the person typed, looked for in credits and titles
    (also spelled a little differently), for recordings that are not on the page yet."""
    text = rules.clean_line(query, 80)
    if len(text) < SEARCH_MIN_CHARS:
        return [], 0
    names = await names_of(session, profile)
    fuzzy = await _credits_like(session, profile, [text])
    needle = "%" + text.lower().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
    like = or_(
        func.lower(Recording.title).like(needle, escape="\\"),
        func.lower(Recording.author).like(needle, escape="\\"),
    )
    rows = (
        await session.scalars(
            select(Recording)
            .where(
                _clean_library(profile),
                _not_on_page(profile),
                or_(like, Recording.author.in_(fuzzy)) if fuzzy else like,
            )
            .order_by(Recording.plays.desc(), Recording.created_at.desc())
            .limit(SEARCH_MAX)
        )
    ).all()
    ladder = Ladder(session, profile, names)
    items = await _candidates(session, profile, list(rows), ladder)
    items.sort(
        key=lambda c: ({"same": 0, "alike": 1, "title": 2}.get(c.level, 3), -c.recording.plays)
    )
    return items[offset : offset + limit], len(items)


async def summary(session: AsyncSession, profile: AuthorProfile) -> ClaimSummary:
    _, found = await suggestions(session, profile)
    rows = (
        await session.execute(
            select(AuthorClaim.status, func.count())
            .where(AuthorClaim.profile_id == profile.id)
            .group_by(AuthorClaim.status)
        )
    ).all()
    counts: dict[str, int] = {status: int(n) for status, n in rows}
    return ClaimSummary(
        suggested=sum(1 for c in found if c.claim_status is None and c.level != "title"),
        pending=int(counts.get("pending", 0)),
        approved=int(counts.get("approved", 0)),
    )


# --------------------------------------------------------------------------- making a claim


async def _log(
    session: AsyncSession, claim: AuthorClaim, actor: str, action: str, note: str | None = None
) -> None:
    session.add(
        AuthorClaimEvent(claim_id=claim.id, at=now_utc(), actor=actor, action=action, note=note)
    )


def _notice(
    user_id: UUID,
    kind: str,
    title: str,
    body: str,
    recording_id: UUID | None,
    payload: dict[str, Any],
) -> MemberNotice:
    return MemberNotice(
        user_id=user_id,
        kind=kind,
        recording_id=recording_id,
        title=title[:300],
        body=body,
        payload=payload,
    )


async def _tell_uploader(
    session: AsyncSession, profile: AuthorProfile, claim: AuthorClaim, recording: Recording
) -> None:
    """The uploader is told, never asked (no button, no way to refuse): one information notice."""
    if recording.author_id is None or recording.author_id == profile.member_id:
        return
    session.add(
        _notice(
            recording.author_id,
            "claim_on_your_recording",
            f"{profile.display_name} shows your recording",
            f"The author page of {profile.display_name} now shows “{recording.title}”, which you "
            f"added. The recording is still yours and nothing changes for you.",
            recording.id,
            {
                "profile_slug": profile.slug,
                "profile_id": str(profile.id),
                "page_name": profile.display_name,
                "recording_title": recording.title,
                "claim_id": str(claim.id),
            },
        )
    )


async def claim(
    session: AsyncSession, member_id: UUID, profile: AuthorProfile, recording_ids: list[UUID]
) -> ClaimsCreated:
    """Put a claim on each recording. Each gets its own outcome; the waiting-list rule stops the
    whole call. There is no daily number and no pause."""
    if profile.status == "suspended":
        raise AuthorError("page_suspended", 403, "This page is suspended")
    open_now = int(
        await session.scalar(
            select(func.count())
            .select_from(AuthorClaim)
            .where(AuthorClaim.profile_id == profile.id, AuthorClaim.status == "pending")
        )
        or 0
    )
    wanted = list(dict.fromkeys(recording_ids))
    names = await names_of(session, profile)
    ladder = Ladder(session, profile, names)
    recordings = {
        r.id: r
        for r in (
            await session.scalars(
                select(Recording).where(Recording.id.in_(wanted), Recording.status.in_(VISIBLE))
            )
        ).all()
    }
    existing = await _claims_by_recording(session, profile, wanted)
    on_page = set(
        (
            await session.scalars(
                select(Recording.id).where(Recording.id.in_(wanted), attribution(profile))
            )
        ).all()
    )
    results: list[ClaimResult] = []
    approved = pending = 0
    actor = f"member:{member_id}"
    for rid in wanted:
        recording = recordings.get(rid)
        if recording is None:
            results.append(ClaimResult(recording_id=str(rid), outcome="not_found"))
            continue
        if recording.author_id == profile.member_id:
            results.append(ClaimResult(recording_id=str(rid), outcome="already_yours"))
            continue
        old = existing.get(rid)
        if old is not None:
            blocked = {
                "pending": "already_pending",
                "approved": "already_approved",
                "rejected": "rejected_before",
                "revoked": "revoked_before",
            }.get(old.status)
            if blocked:
                results.append(
                    ClaimResult(recording_id=str(rid), outcome=blocked, claim_id=str(old.id))  # type: ignore[arg-type]
                )
                continue
        elif rid in on_page:
            results.append(ClaimResult(recording_id=str(rid), outcome="already_on_page"))
            continue
        standing = await ladder.standing(recording)
        if standing.route == "team" and open_now >= OPEN_CLAIMS_MAX:
            raise AuthorError("claims_waiting", 429, "Too many claims are waiting")
        status = "approved" if standing.route == "self" else "pending"
        row = old
        if row is None:
            row = AuthorClaim(profile_id=profile.id, recording_id=rid)
            session.add(row)
        row.matched_text = standing.matched_text[:255]
        row.match_level = standing.level
        row.route = standing.route
        row.status = status
        row.team_reason = standing.team_reason
        row.decided_by = "system" if status == "approved" else None
        row.decided_at = now_utc() if status == "approved" else None
        row.decision_note = None
        await session.flush()
        await _log(session, row, actor, "claimed", standing.team_reason)
        if status == "approved":
            await _log(session, row, "system", "approved", "same name on a verified page")
            await _tell_uploader(session, profile, row, recording)
            approved += 1
        else:
            pending += 1
            open_now += 1
        results.append(
            ClaimResult(
                recording_id=str(rid),
                outcome=status,  # type: ignore[arg-type]
                claim_id=str(row.id),
                team_reason=standing.team_reason,  # type: ignore[arg-type]
            )
        )
    await session.commit()
    if approved:
        await refresh_snapshot(session, profile, force=True)  # the page's numbers move at once
    return ClaimsCreated(results=results, approved=approved, pending=pending)


def claim_out(row: AuthorClaim, recording: Recording) -> ClaimOut:
    return ClaimOut(
        id=str(row.id),
        recording=recording_view(recording),
        level=row.match_level,  # type: ignore[arg-type]
        matched_text=row.matched_text,
        route=row.route,  # type: ignore[arg-type]
        status=row.status,  # type: ignore[arg-type]
        team_reason=row.team_reason,  # type: ignore[arg-type]
        decision_note=row.decision_note,
        created_at=row.created_at,
        decided_at=row.decided_at,
    )


async def my_claims(
    session: AsyncSession,
    profile: AuthorProfile,
    *,
    status: str | None,
    limit: int,
    offset: int,
) -> tuple[list[ClaimOut], int]:
    conditions: list[Any] = [AuthorClaim.profile_id == profile.id]
    if status:
        conditions.append(AuthorClaim.status == status)
    total = int(
        await session.scalar(select(func.count()).select_from(AuthorClaim).where(*conditions)) or 0
    )
    rows = (
        await session.execute(
            select(AuthorClaim, Recording)
            .join(Recording, Recording.id == AuthorClaim.recording_id)
            .where(*conditions)
            .order_by(AuthorClaim.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
    ).all()
    return [claim_out(c, r) for c, r in rows], total


async def withdraw(
    session: AsyncSession, profile: AuthorProfile, claim_id: UUID, actor: str
) -> None:
    """The person takes a claim back: a waiting one, or an approved one (the recording leaves the
    page; it can be claimed again)."""
    row = await session.get(AuthorClaim, claim_id)
    if row is None or row.profile_id != profile.id:
        raise AuthorError("claim_not_found", 404, "Claim not found")
    if row.status not in LIVE_STATUSES:
        raise AuthorError("claim_closed", 409, "This claim is already closed")
    row.status = "withdrawn"
    row.decided_by = actor
    row.decided_at = now_utc()
    await _log(session, row, actor, "withdrawn")
    await session.commit()
    await refresh_snapshot(session, profile, force=True)


# --------------------------------------------------------------------------- the team desk


def admin_claim_out(
    row: AuthorClaim, recording: Recording, profile: AuthorProfile
) -> AdminClaimOut:
    return AdminClaimOut(
        id=str(row.id),
        profile_id=str(profile.id),
        profile_slug=profile.slug,
        profile_name=profile.display_name,
        profile_verified=profile.verified,
        recording=recording_view(recording),
        level=row.match_level,  # type: ignore[arg-type]
        matched_text=row.matched_text,
        route=row.route,  # type: ignore[arg-type]
        status=row.status,  # type: ignore[arg-type]
        team_reason=row.team_reason,  # type: ignore[arg-type]
        created_at=row.created_at,
        decided_by=row.decided_by,
        decision_note=row.decision_note,
    )


async def admin_list(
    session: AsyncSession,
    *,
    status: str | None,
    profile_id: UUID | None,
    reason: str | None,
    limit: int,
    offset: int,
) -> tuple[list[AdminClaimOut], int]:
    conditions: list[Any] = []
    if status:
        conditions.append(AuthorClaim.status == status)
    if profile_id:
        conditions.append(AuthorClaim.profile_id == profile_id)
    if reason:
        conditions.append(AuthorClaim.team_reason == reason)
    total = int(
        await session.scalar(select(func.count()).select_from(AuthorClaim).where(*conditions)) or 0
    )
    rows = (
        await session.execute(
            select(AuthorClaim, Recording, AuthorProfile)
            .join(Recording, Recording.id == AuthorClaim.recording_id)
            .join(AuthorProfile, AuthorProfile.id == AuthorClaim.profile_id)
            .where(*conditions)
            .order_by(AuthorClaim.profile_id, AuthorClaim.created_at)
            .limit(limit)
            .offset(offset)
        )
    ).all()
    return [admin_claim_out(c, r, p) for c, r, p in rows], total


_NEXT = {
    "approve": ("approved", ("pending", "rejected", "withdrawn", "revoked")),
    "reject": ("rejected", ("pending",)),
    "revoke": ("revoked", ("approved",)),
    # the desk's Undo: a decision goes back to "waiting". Nobody is told; the log keeps it.
    "reopen": ("pending", ("approved", "rejected", "revoked")),
}


async def admin_decide(
    session: AsyncSession,
    claim_ids: list[UUID] | None,
    *,
    profile_id: UUID | None,
    action: str,
    by: str,
    note: str | None,
) -> int:
    """Approve, reject or revoke one claim, a list of them, or (no ids) every claim of a page that
    waits. The page's owner gets one notice for the whole call, the uploaders one each (approve)."""
    target, allowed = _NEXT[action]
    conditions: list[Any] = [AuthorClaim.status.in_(allowed)]
    if claim_ids is not None:
        conditions.append(AuthorClaim.id.in_(claim_ids))
    elif profile_id is not None and action != "revoke":
        conditions.append(AuthorClaim.status == "pending")
    if profile_id is not None:
        conditions.append(AuthorClaim.profile_id == profile_id)
    if claim_ids is None and profile_id is None:
        raise AuthorError("nothing_selected", 422, "Choose claims")
    if claim_ids is not None and not claim_ids:
        return 0
    rows = (
        await session.execute(
            select(AuthorClaim, Recording, AuthorProfile)
            .join(Recording, Recording.id == AuthorClaim.recording_id)
            .join(AuthorProfile, AuthorProfile.id == AuthorClaim.profile_id)
            .where(*conditions)
        )
    ).all()
    cleaned = rules.clean_paragraphs(note, 1000) or None
    per_profile: dict[UUID, tuple[AuthorProfile, int]] = {}
    reopening = action == "reopen"
    for row, recording, profile in rows:
        row.status = target
        row.decided_by = None if reopening else by
        row.decided_at = None if reopening else now_utc()
        row.decision_note = None if reopening else cleaned
        await _log(session, row, by, "reopened" if reopening else target, cleaned)
        if target == "approved":
            await _tell_uploader(session, profile, row, recording)
        per_profile[profile.id] = (profile, per_profile.get(profile.id, (profile, 0))[1] + 1)
    if reopening:
        await session.commit()
        for profile, _ in per_profile.values():
            await refresh_snapshot(session, profile, force=True)
        return len(rows)
    kinds = {"approve": "claim_approved", "reject": "claim_rejected", "revoke": "claim_revoked"}
    words = {
        "approve": "Your page now shows",
        "reject": "The team did not accept",
        "revoke": "The team took off your page",
    }
    for profile, count in per_profile.values():
        what = "recording" if count == 1 else "recordings"
        body = f"{words[action]} {count} {what}."
        if cleaned:
            body += f" {cleaned}"
        session.add(
            _notice(
                profile.member_id,
                kinds[action],
                f"Claimed recordings: {target}",
                body,
                None,
                {
                    "profile_slug": profile.slug,
                    "profile_id": str(profile.id),
                    "count": count,
                    "note": cleaned,
                },
            )
        )
    await session.commit()
    for profile, _ in per_profile.values():
        await refresh_snapshot(session, profile, force=True)
    return len(rows)


async def desk_summary(session: AsyncSession) -> DeskSummary:
    """What waits on the team's desk: counts per status, and the waiting ones per reason, so the
    screen can show a badge and filter chips without loading every row."""
    by_status = {
        status: int(n)
        for status, n in (
            await session.execute(
                select(AuthorClaim.status, func.count()).group_by(AuthorClaim.status)
            )
        ).all()
    }
    by_reason = {
        (reason or "other"): int(n)
        for reason, n in (
            await session.execute(
                select(AuthorClaim.team_reason, func.count())
                .where(AuthorClaim.status == "pending")
                .group_by(AuthorClaim.team_reason)
            )
        ).all()
    }
    return DeskSummary(
        pending=by_status.get("pending", 0),
        approved=by_status.get("approved", 0),
        rejected=by_status.get("rejected", 0),
        revoked=by_status.get("revoked", 0),
        by_reason=by_reason,
    )


async def pages_of_my_recordings(session: AsyncSession, member_id: UUID) -> list[ShownOnPages]:
    """For "My uploads": which of the member's own recordings are now shown on somebody else's
    author page (an approved claim on a published page that is not the member's own)."""
    rows = (
        await session.execute(
            select(AuthorClaim.recording_id, AuthorProfile, AuthorClaim.decided_at)
            .join(Recording, Recording.id == AuthorClaim.recording_id)
            .join(AuthorProfile, AuthorProfile.id == AuthorClaim.profile_id)
            .where(
                Recording.author_id == member_id,
                Recording.status.in_(VISIBLE),
                AuthorClaim.status == "approved",
                AuthorProfile.status == "published",
                AuthorProfile.member_id != member_id,
            )
            .order_by(AuthorClaim.decided_at)
        )
    ).all()
    grouped: dict[UUID, list[ShownPage]] = {}
    for recording_id, profile, _ in rows:
        grouped.setdefault(recording_id, []).append(
            ShownPage(id=str(profile.id), slug=profile.slug, name=profile.display_name)
        )
    return [ShownOnPages(recording_id=str(rid), pages=pages) for rid, pages in grouped.items()]
