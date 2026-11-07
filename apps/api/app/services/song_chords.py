"""Chord proposals: offering, reading, reporting, reviewing (apps/mobile/docs/chord-proposals.md).

A team member's proposal is published at once. Everybody else's waits as `pending` until the team
approves it. Anyone may report a published chart; the team rejects with a reason (the author gets a
notice) and can restore. The author may delete their own proposal for good.

The rule that must not break: a PUBLIC view of an anonymous proposal carries no trace of its author
(see `public_out`). Everything that knows the author is `admin_out` and team-only.
"""

from __future__ import annotations

import json
from datetime import timedelta
from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import UserAccount
from app.models.recordings import PS_SONG_COUNT, MemberNotice
from app.models.song_chords import SongChordOffer, SongChordProposal, SongChordReport
from app.schemas.song_chords import (
    AdminChordProposalOut,
    ChordAuthor,
    ChordLineOut,
    ChordPlacementOut,
    ChordProposalCreate,
    ChordProposalOut,
)
from app.services.recordings import RateLimiter, clean_text, now_utc

DAILY_PROPOSALS = 10
HOURLY_PROPOSALS = 6
HOURLY_PROPOSALS_TEAM = 120
# One member may keep at most this many live (pending or published) charts per song and instrument.
OPEN_PER_SONG_INSTRUMENT = 3
DAILY_LIMIT_CODE = "chords_daily_limit"
DUPLICATE_CODE = "chords_duplicate"
OPEN_LIMIT_CODE = "chords_open_limit"
NOT_EDITABLE_CODE = "chords_not_editable"
FALLBACK_NAME = "Member"
NOTICE_REJECTED = "chords_rejected"
NOTICE_PUBLISHED = "chords_published"

limiter = RateLimiter()


def check_song(song_id: int) -> int:
    if not 1 <= song_id <= PS_SONG_COUNT:
        raise HTTPException(status_code=422, detail="Unknown song number.")
    return song_id


def display_name(member: UserAccount) -> str:
    """The name shown beside a named proposal. An address is never shown as a name."""
    name = clean_text(member.display_name, 80)
    if not name or "@" in name:
        return FALLBACK_NAME
    return name


def clean_note(raw: str | None) -> str | None:
    text = clean_text(raw, 300)
    return text or None


def normalise_chart(payload: ChordProposalCreate) -> tuple[dict[str, Any], int]:
    """The stored chart: one entry per lyric line; per line the placements sorted by word, one per
    word (the first wins, the same rule the page's `wordColumns` applies). Returns the chart and the
    number of placements kept."""
    lines: list[dict[str, Any]] = []
    kept = 0
    for line in payload.lines:
        seen: set[int] = set()
        placements: list[dict[str, Any]] = []
        for placement in sorted(line.placements, key=lambda p: p.word):
            if placement.word in seen:
                continue
            seen.add(placement.word)
            placements.append({"word": placement.word, "chord": placement.chord})
        kept += len(placements)
        lines.append({"placements": placements})
    # trailing lines without a chord carry no information
    while lines and not lines[-1]["placements"]:
        lines.pop()
    return {"lines": lines}, kept


def chart_lines(proposal: SongChordProposal) -> list[ChordLineOut]:
    raw = (proposal.chart or {}).get("lines", [])
    return [
        ChordLineOut(
            placements=[
                ChordPlacementOut(word=int(p["word"]), chord=str(p["chord"]))
                for p in (line.get("placements") or [])
            ]
        )
        for line in raw
    ]


def public_out(
    proposal: SongChordProposal,
    author: UserAccount | None,
    *,
    viewer_id: UUID | None,
    team: bool,
) -> ChordProposalOut:
    """What every reader gets. `author` is filled only for a NAMED proposal."""
    mine = viewer_id is not None and proposal.member_id == viewer_id
    shown = None
    if not proposal.is_anonymous and author is not None:
        shown = ChordAuthor(name=display_name(author))
    return ChordProposalOut(
        id=str(proposal.id),
        song_id=proposal.song_id,
        instrument=proposal.instrument,  # type: ignore[arg-type]
        base_key=proposal.base_key,
        capo=proposal.capo,
        strum=proposal.strum,
        lines=chart_lines(proposal),
        note=proposal.note,
        played_it=proposal.played_it,
        created_at=proposal.created_at,
        is_anonymous=proposal.is_anonymous,
        author=shown,
        mine=mine,
        status=proposal.status,  # type: ignore[arg-type]
        # the reason is the author's and the team's business only
        rejected_reason=proposal.rejected_reason if (mine or team) else None,
        can_review=team,
    )


def admin_out(proposal: SongChordProposal, author: UserAccount | None) -> AdminChordProposalOut:
    base = public_out(proposal, author, viewer_id=None, team=True)
    return AdminChordProposalOut(
        **base.model_dump(),
        author_id=str(proposal.member_id),
        author_name=display_name(author) if author is not None else FALLBACK_NAME,
        reports_count=proposal.reports_count,
        reviewed_at=proposal.reviewed_at,
        reviewed_by=proposal.reviewed_by,
        published_at=proposal.published_at,
    )


# --------------------------------------------------------------------------- reading


async def list_for_song(
    session: AsyncSession,
    song_id: int,
    *,
    viewer_id: UUID | None,
    instrument: str | None = None,
) -> list[tuple[SongChordProposal, UserAccount | None]]:
    """Published charts of one song, oldest first (the first good one keeps its place), plus the
    viewer's own pending ones (marked `mine`, status `pending`)."""
    visible = SongChordProposal.status == "published"
    if viewer_id is not None:
        visible = visible | (
            (SongChordProposal.member_id == viewer_id) & (SongChordProposal.status == "pending")
        )
    query = (
        select(SongChordProposal, UserAccount)
        .join(UserAccount, UserAccount.id == SongChordProposal.member_id, isouter=True)
        .where(SongChordProposal.song_id == song_id, visible)
        .order_by(SongChordProposal.created_at.asc(), SongChordProposal.id.asc())
    )
    if instrument:
        query = query.where(SongChordProposal.instrument == instrument)
    rows = (await session.execute(query)).all()
    return [(p, a) for p, a in rows]


async def list_mine(
    session: AsyncSession, member_id: UUID
) -> list[tuple[SongChordProposal, UserAccount | None]]:
    rows = (
        await session.execute(
            select(SongChordProposal, UserAccount)
            .join(UserAccount, UserAccount.id == SongChordProposal.member_id, isouter=True)
            .where(SongChordProposal.member_id == member_id)
            .order_by(SongChordProposal.created_at.desc())
        )
    ).all()
    return [(p, a) for p, a in rows]


# --------------------------------------------------------------------------- offering


async def proposals_in_last_day(session: AsyncSession, member_id: UUID) -> int:
    """Charts the member offered in 24 hours, the ones they deleted since included.

    Every offer leaves a row in the ledger that outlives the chart, so taking a chart back does
    not give its place in the day back. Charts stored before the ledger existed are counted too.
    """
    since = now_utc() - timedelta(hours=24)
    offered = await session.scalar(
        select(func.count())
        .select_from(SongChordOffer)
        .where(SongChordOffer.member_id == member_id, SongChordOffer.created_at >= since)
    )
    stored = await session.scalar(
        select(func.count())
        .select_from(SongChordProposal)
        .where(SongChordProposal.member_id == member_id, SongChordProposal.created_at >= since)
    )
    return max(int(offered or 0), int(stored or 0))


async def ensure_daily_allowance(
    session: AsyncSession, member_id: UUID, *, team: bool, limit: int = DAILY_PROPOSALS
) -> None:
    """At most DAILY_PROPOSALS per member in 24 hours (rejected count). The team has no limit."""
    if team:
        return
    if await proposals_in_last_day(session, member_id) >= limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"You can offer up to {limit} charts a day. Please come back tomorrow.",
            headers={"X-Error-Code": DAILY_LIMIT_CODE},
        )


def _fingerprint(chart: dict[str, Any]) -> str:
    return json.dumps(chart, sort_keys=True, separators=(",", ":"))


async def create_proposal(
    session: AsyncSession,
    *,
    member: UserAccount,
    payload: ChordProposalCreate,
    team: bool,
) -> SongChordProposal:
    chart, kept = normalise_chart(payload)
    if kept == 0:
        raise HTTPException(status_code=422, detail="Put at least one chord over a word.")
    await ensure_daily_allowance(session, member.id, team=team)
    live = (
        await session.scalars(
            select(SongChordProposal).where(
                SongChordProposal.member_id == member.id,
                SongChordProposal.song_id == payload.song_id,
                SongChordProposal.instrument == payload.instrument,
                SongChordProposal.status.in_(("pending", "published")),
            )
        )
    ).all()
    wanted = _fingerprint(chart)
    for row in live:
        if (
            row.base_key == payload.base_key
            and row.capo == payload.capo
            and _fingerprint(row.chart) == wanted
        ):
            raise HTTPException(
                status_code=409,
                detail="You already offered exactly this chart.",
                headers={"X-Error-Code": DUPLICATE_CODE},
            )
    if not team and len(live) >= OPEN_PER_SONG_INSTRUMENT:
        raise HTTPException(
            status_code=409,
            detail=(
                f"You already have {OPEN_PER_SONG_INSTRUMENT} charts of this song for this "
                "instrument waiting or live. Delete one first, or wait for the review."
            ),
            headers={"X-Error-Code": OPEN_LIMIT_CODE},
        )
    # Only a chart that passed every check above uses up the hourly allowance: a refused one
    # (empty, duplicate, over the cap) must not make the member wait for a new try.
    limiter.hit(
        "offer",
        str(member.id),
        limit=HOURLY_PROPOSALS_TEAM if team else HOURLY_PROPOSALS,
        window_seconds=3600,
    )
    now = now_utc()
    session.add(SongChordOffer(member_id=member.id))
    proposal = SongChordProposal(
        song_id=payload.song_id,
        member_id=member.id,
        instrument=payload.instrument,
        base_key=payload.base_key,
        capo=payload.capo,
        strum=payload.strum,
        chart=chart,
        placements_count=kept,
        played_it=payload.played_it,
        note=clean_note(payload.note),
        is_anonymous=payload.is_anonymous,
        status="published" if team else "pending",
        published_at=now if team else None,
        reviewed_at=now if team else None,
        reviewed_by="team" if team else None,
    )
    session.add(proposal)
    await session.commit()
    await session.refresh(proposal)
    return proposal


async def update_proposal(
    session: AsyncSession,
    proposal: SongChordProposal,
    *,
    payload: ChordProposalCreate,
    team: bool,
) -> SongChordProposal:
    """The author changes a chart that is waiting or was not accepted, and sends it again.

    A live (published) chart is never edited in place: it would leave the song page, or change on it
    without a second look. The author offers a changed copy as a new chart instead. A song and an
    instrument belong to the chart for good. The chart goes back to `pending` (the team: straight to
    `published`) and the old reason of a rejection is cleared. The daily allowance is not charged
    again: it is the same chart.
    """
    if proposal.status == "published":
        raise HTTPException(
            status_code=409,
            detail="A live chart cannot be changed. Offer a changed copy instead.",
            headers={"X-Error-Code": NOT_EDITABLE_CODE},
        )
    if payload.song_id != proposal.song_id or payload.instrument != proposal.instrument:
        raise HTTPException(status_code=422, detail="A chart keeps its song and its instrument.")
    chart, kept = normalise_chart(payload)
    if kept == 0:
        raise HTTPException(status_code=422, detail="Put at least one chord over a word.")
    others = (
        await session.scalars(
            select(SongChordProposal).where(
                SongChordProposal.member_id == proposal.member_id,
                SongChordProposal.song_id == proposal.song_id,
                SongChordProposal.instrument == proposal.instrument,
                SongChordProposal.status.in_(("pending", "published")),
                SongChordProposal.id != proposal.id,
            )
        )
    ).all()
    wanted = _fingerprint(chart)
    for row in others:
        if (
            row.base_key == payload.base_key
            and row.capo == payload.capo
            and _fingerprint(row.chart) == wanted
        ):
            raise HTTPException(
                status_code=409,
                detail="You already offered exactly this chart.",
                headers={"X-Error-Code": DUPLICATE_CODE},
            )
    # A rejected chart that comes back is a live chart again: it counts against the cap.
    if not team and proposal.status == "rejected" and len(others) >= OPEN_PER_SONG_INSTRUMENT:
        raise HTTPException(
            status_code=409,
            detail=(
                f"You already have {OPEN_PER_SONG_INSTRUMENT} charts of this song for this "
                "instrument waiting or live. Delete one first, or wait for the review."
            ),
            headers={"X-Error-Code": OPEN_LIMIT_CODE},
        )
    limiter.hit("edit", str(proposal.member_id), limit=30, window_seconds=3600)
    now = now_utc()
    proposal.base_key = payload.base_key
    proposal.capo = payload.capo
    proposal.strum = payload.strum
    proposal.chart = chart
    proposal.placements_count = kept
    proposal.played_it = payload.played_it
    proposal.note = clean_note(payload.note)
    proposal.is_anonymous = payload.is_anonymous
    proposal.status = "published" if team else "pending"
    proposal.rejected_reason = None
    proposal.published_at = now if team else None
    proposal.reviewed_at = now if team else None
    proposal.reviewed_by = "team" if team else None
    await session.commit()
    await session.refresh(proposal)
    return proposal


async def delete_proposal(session: AsyncSession, proposal: SongChordProposal) -> None:
    for report in (
        await session.scalars(
            select(SongChordReport).where(SongChordReport.proposal_id == proposal.id)
        )
    ).all():
        await session.delete(report)
    await session.delete(proposal)
    await session.commit()


# --------------------------------------------------------------------------- reports


async def add_report(
    session: AsyncSession,
    *,
    proposal: SongChordProposal,
    reporter_key: str,
    reporter_id: UUID | None,
    reason: str,
    note: str | None,
) -> bool:
    """Store a report. False when this reporter already reported it (one report each)."""
    already = await session.scalar(
        select(SongChordReport.id).where(
            SongChordReport.proposal_id == proposal.id,
            SongChordReport.reporter_key == reporter_key,
        )
    )
    if already is not None:
        return False
    session.add(
        SongChordReport(
            proposal_id=proposal.id,
            reporter_key=reporter_key,
            reporter_id=reporter_id,
            reason=reason,
            note=clean_text(note, 1000) or None,
        )
    )
    proposal.reports_count = (proposal.reports_count or 0) + 1
    await session.commit()
    return True


# --------------------------------------------------------------------------- review


def _notice(
    proposal: SongChordProposal, *, kind: str, title: str, body: str, extra: dict[str, Any]
) -> MemberNotice:
    return MemberNotice(
        user_id=proposal.member_id,
        kind=kind,
        recording_id=None,
        title=title[:300],
        body=body,
        payload={
            "chord_proposal_id": str(proposal.id),
            "song_id": proposal.song_id,
            "instrument": proposal.instrument,
            **extra,
        },
    )


def _what(proposal: SongChordProposal) -> str:
    return f"{proposal.instrument} chords for PS {proposal.song_id}"


async def approve(session: AsyncSession, proposal: SongChordProposal, *, by: str) -> bool:
    """Pending -> published. True when something changed. The author gets a short notice."""
    if proposal.status == "published":
        return False
    if proposal.status == "rejected":
        raise HTTPException(status_code=409, detail="Restore it first, or reject it for good.")
    now = now_utc()
    proposal.status = "published"
    proposal.published_at = now
    proposal.reviewed_at = now
    proposal.reviewed_by = by[:255]
    proposal.rejected_reason = None
    session.add(
        _notice(
            proposal,
            kind=NOTICE_PUBLISHED,
            title=f"Your {_what(proposal)} are live",
            body=(
                f"Thank you. Your {_what(proposal)} passed the review "
                "and now show on the song page."
            ),
            extra={},
        )
    )
    await session.commit()
    return True


async def reject(
    session: AsyncSession, proposal: SongChordProposal, *, reason: str, by: str
) -> None:
    """Any status -> rejected, with a reason the author reads."""
    if proposal.status == "rejected":
        raise HTTPException(status_code=409, detail="Already rejected")
    now = now_utc()
    clean_reason = clean_text(reason, 500)
    proposal.status = "rejected"
    proposal.rejected_reason = clean_reason
    proposal.reviewed_at = now
    proposal.reviewed_by = by[:255]
    session.add(
        _notice(
            proposal,
            kind=NOTICE_REJECTED,
            title=f"Your {_what(proposal)} were not published: {clean_reason}"[:300],
            body=(
                f"Your {_what(proposal)} were not published because: {clean_reason}. "
                "You can fix the chart and offer it again, or write to us from the app "
                "(Contact us) and we will look again."
            ),
            extra={"reason": clean_reason, "actions": ["offer_again", "contact"]},
        )
    )
    await session.commit()


async def restore(session: AsyncSession, proposal: SongChordProposal, *, by: str) -> None:
    """Rejected -> published (a mistake of the review)."""
    if proposal.status != "rejected":
        raise HTTPException(status_code=409, detail="Only a rejected chart can be restored")
    now = now_utc()
    proposal.status = "published"
    proposal.published_at = now
    proposal.reviewed_at = now
    proposal.reviewed_by = by[:255]
    proposal.rejected_reason = None
    session.add(
        _notice(
            proposal,
            kind=NOTICE_PUBLISHED,
            title=f"Your {_what(proposal)} are live",
            body=f"We looked again: your {_what(proposal)} are now on the song page.",
            extra={},
        )
    )
    await session.commit()


async def admin_queue(
    session: AsyncSession, *, which: str, limit: int, offset: int
) -> tuple[list[tuple[SongChordProposal, UserAccount | None]], int]:
    """pending = waiting for the first look (oldest first); reported = published and reported;
    published; rejected; all. Newest first, except `pending`."""
    conditions: list[Any]
    if which == "pending":
        conditions = [SongChordProposal.status == "pending"]
    elif which == "reported":
        conditions = [SongChordProposal.status == "published", SongChordProposal.reports_count > 0]
    elif which == "published":
        conditions = [SongChordProposal.status == "published"]
    elif which == "rejected":
        conditions = [SongChordProposal.status == "rejected"]
    else:
        conditions = []
    total = await session.scalar(
        select(func.count()).select_from(SongChordProposal).where(*conditions)
    )
    order = (
        SongChordProposal.created_at.asc()
        if which == "pending"
        else SongChordProposal.created_at.desc()
    )
    rows = (
        await session.execute(
            select(SongChordProposal, UserAccount)
            .join(UserAccount, UserAccount.id == SongChordProposal.member_id, isouter=True)
            .where(*conditions)
            .order_by(order, SongChordProposal.id.asc())
            .limit(limit)
            .offset(offset)
        )
    ).all()
    return [(p, a) for p, a in rows], int(total or 0)


async def pending_count(session: AsyncSession) -> int:
    total = await session.scalar(
        select(func.count())
        .select_from(SongChordProposal)
        .where(SongChordProposal.status == "pending")
    )
    return int(total or 0)
