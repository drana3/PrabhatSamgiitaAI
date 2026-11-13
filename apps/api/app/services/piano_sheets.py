"""Piano sheets: offering, reading, reporting, reviewing (docs/piano-notation.md).

A sheet is rows of steps (the keys of a melody, relative to Sa). The server checks the shape, the
limits and the text around it; it does NOT check that the notes are the right ones and says so.

Who goes live at once: a team member, and the author of the recording (the account that uploaded
it). Everybody else waits as `pending` for the team, who reject with a reason (the author gets a
notice) or restore. A sheet with a link always waits, unless the team posted it: the team looks at
every link.

Limits are the chord sheets' limits: 10 sheets a day and 6 an hour per member (the team: no daily
limit, 120 an hour), three live sheets per member per target. Unlike chord offers, a deleted sheet
gives its place in the day back (there is no ledger table for notes).

The rule that must not break: a PUBLIC view of an anonymous sheet carries no trace of its author
(see `public_out`). Everything that knows the author is `admin_out` and team-only.
"""

from __future__ import annotations

import ipaddress
import json
from datetime import timedelta
from typing import Any
from urllib.parse import urlsplit
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import UserAccount
from app.models.piano_sheets import PIANO_LINK_MAX_LENGTH, PianoSheet, PianoSheetReport
from app.models.recordings import MemberNotice, Recording
from app.schemas.piano_sheets import (
    MAX_LABEL,
    MAX_STEPS,
    MIN_SOUNDING_STEPS,
    AdminPianoSheetOut,
    PianoAuthor,
    PianoBasedOn,
    PianoRow,
    PianoSheetCreate,
    PianoSheetOut,
)
from app.services import song_chords as shared
from app.services.extras_common import display_name, one_line
from app.services.recordings import RateLimiter, now_utc
from app.services.song_comments import link_count

DAILY_SHEETS = shared.DAILY_PROPOSALS
HOURLY_SHEETS = shared.HOURLY_PROPOSALS
HOURLY_SHEETS_TEAM = shared.HOURLY_PROPOSALS_TEAM
OPEN_PER_TARGET = 3
DAILY_LIMIT_CODE = "piano_daily_limit"
DUPLICATE_CODE = "piano_duplicate"
OPEN_LIMIT_CODE = "piano_open_limit"
NOT_EDITABLE_CODE = "piano_not_editable"
NOTICE_PUBLISHED = "piano_published"
NOTICE_REJECTED = "piano_rejected"
# The kinds of recording a sheet may be attached to: the ones that have chords.
SHEET_KINDS = ("kiirtan", "bhajan", "devotional_song", "prabhat_samgiita", "spiritual_song")

limiter = RateLimiter()


# --------------------------------------------------------------------------- the content


def recording_key(recording_id: UUID) -> str:
    return f"recording:{recording_id}"


def song_key(song_number: int) -> str:
    return f"song:{song_number}"


def clean_link(raw: str | None) -> str | None:
    """A link to notes kept elsewhere: https only, a real host, no login in it, no address of a
    machine. Returned as the person pasted it, trimmed (the app only opens it)."""
    text = one_line(raw, PIANO_LINK_MAX_LENGTH + 100)
    if not text:
        return None
    if len(text) > PIANO_LINK_MAX_LENGTH:
        raise HTTPException(status_code=422, detail="This link is too long.")
    if " " in text:
        raise HTTPException(status_code=422, detail="The link must be one address.")
    parts = urlsplit(text)
    host = (parts.hostname or "").lower()
    bad = (
        parts.scheme != "https"
        or "." not in host
        or parts.username is not None
        or parts.password is not None
        or host == "localhost"
        or host.endswith((".local", ".internal"))
    )
    if not bad:
        try:
            ipaddress.ip_address(host)
            bad = True
        except ValueError:
            pass
    if bad:
        raise HTTPException(
            status_code=422, detail="The link must be a web address that starts with https://."
        )
    return text


def clean_note(raw: str | None) -> str | None:
    note = one_line(raw, 300) or None
    if note is not None and link_count(note) > 0:
        raise HTTPException(status_code=422, detail="Please leave web links out of the note.")
    return note


def clean_rows(payload: PianoSheetCreate) -> tuple[dict[str, Any], int, str]:
    """The score as stored, how many sounding steps it holds, and its level."""
    rows: list[dict[str, Any]] = []
    total = 0
    sounding = 0
    two_hands = False
    for row in payload.rows:
        label = one_line(row.label, MAX_LABEL) or None
        if label is not None and link_count(label) > 0:
            raise HTTPException(status_code=422, detail="Please leave web links out of a label.")
        steps = [{"k": list(step.k), "b": step.b} for step in row.steps]
        total += len(steps)
        sounding += sum(1 for step in steps if step["k"])
        two_hands = two_hands or row.hand == "left"
        rows.append({"label": label, "repeat": row.repeat, "hand": row.hand, "steps": steps})
    if total > MAX_STEPS:
        raise HTTPException(status_code=422, detail="Too many notes for one sheet.")
    if sounding < MIN_SOUNDING_STEPS:
        raise HTTPException(status_code=422, detail="Add at least two notes before sending.")
    return {"rows": rows}, sounding, "two_hands" if two_hands else "one_finger"


def fingerprint(score: dict[str, Any], sa_key: str) -> str:
    return json.dumps([sa_key, score], sort_keys=True, separators=(",", ":"))


async def check_target(session: AsyncSession, recording_id: UUID) -> Recording:
    recording = await session.get(Recording, recording_id)
    if recording is None or recording.kind not in SHEET_KINDS:
        raise HTTPException(
            status_code=422, detail="Piano notes are for Kiirtans, Bhajans and Prabhat Samgiita."
        )
    return recording


# --------------------------------------------------------------------------- presenting


def _rows(sheet: PianoSheet) -> list[PianoRow]:
    return [PianoRow.model_validate(row) for row in (sheet.score or {}).get("rows", [])]


def public_out(
    sheet: PianoSheet,
    author: UserAccount | None,
    *,
    viewer_id: UUID | None,
    team: bool,
    replaced_by: UUID | str | None = None,
    credits: dict[UUID, PianoBasedOn] | None = None,
) -> PianoSheetOut:
    """What every reader gets. `author` is filled only for a NAMED sheet."""
    mine = viewer_id is not None and sheet.member_id == viewer_id
    shown = None
    if not sheet.is_anonymous and author is not None:
        shown = PianoAuthor(name=display_name(author))
    return PianoSheetOut(
        id=str(sheet.id),
        recording_id=str(sheet.recording_id) if sheet.recording_id else None,
        song_number=sheet.song_id,
        sa_key=sheet.sa_key,  # type: ignore[arg-type]
        level=sheet.level,  # type: ignore[arg-type]
        rows=_rows(sheet),
        steps_count=sheet.steps_count,
        link_url=sheet.link_url,
        note=sheet.note,
        created_at=sheet.created_at,
        is_anonymous=sheet.is_anonymous,
        author=shown,
        by_recording_author=sheet.by_recording_author,
        based_on=(credits or {}).get(sheet.id),
        archived=bool(mine and sheet.archived_at is not None),
        replaced_by=str(replaced_by) if (mine and replaced_by) else None,
        replaces=str(sheet.replaces_id) if (mine and sheet.replaces_id) else None,
        mine=mine,
        status=sheet.status,  # type: ignore[arg-type]
        rejected_reason=sheet.rejected_reason if (mine or team) else None,
        can_review=team,
    )


def admin_out(
    sheet: PianoSheet,
    author: UserAccount | None,
    *,
    credits: dict[UUID, PianoBasedOn] | None = None,
) -> AdminPianoSheetOut:
    base = public_out(sheet, author, viewer_id=None, team=True, credits=credits)
    return AdminPianoSheetOut(
        **base.model_dump(),
        author_id=str(sheet.member_id),
        author_name=display_name(author),
        reports_count=sheet.reports_count,
        reviewed_at=sheet.reviewed_at,
        reviewed_by=sheet.reviewed_by,
        published_at=sheet.published_at,
    )


# --------------------------------------------------------------------------- reading


async def list_for_target(
    session: AsyncSession, target_key: str, *, viewer_id: UUID | None
) -> list[tuple[PianoSheet, UserAccount | None]]:
    """Published sheets of one target, oldest first (the first good one keeps its place), plus the
    viewer's own waiting ones. A sheet a newer version replaced is hidden from everybody."""
    visible = PianoSheet.status == "published"
    if viewer_id is not None:
        own_waiting = (PianoSheet.member_id == viewer_id) & (PianoSheet.status == "pending")
        visible = visible | own_waiting
    rows = (
        await session.execute(
            select(PianoSheet, UserAccount)
            .join(UserAccount, UserAccount.id == PianoSheet.member_id, isouter=True)
            .where(
                PianoSheet.target_key == target_key,
                visible,
                PianoSheet.archived_at.is_(None),
            )
            .order_by(PianoSheet.created_at.asc(), PianoSheet.id.asc())
        )
    ).all()
    return [(s, a) for s, a in rows]


async def list_mine(
    session: AsyncSession, member_id: UUID
) -> list[tuple[PianoSheet, Recording | None]]:
    rows = (
        await session.execute(
            select(PianoSheet, Recording)
            .join(Recording, Recording.id == PianoSheet.recording_id, isouter=True)
            .where(PianoSheet.member_id == member_id)
            .order_by(PianoSheet.created_at.desc())
        )
    ).all()
    return [(s, r) for s, r in rows]


async def recording_ids_with_sheets(session: AsyncSession, *, limit: int = 5000) -> list[str]:
    """Recordings people can see that have a live (published, not archived) sheet."""
    rows = (
        await session.scalars(
            select(PianoSheet.recording_id)
            .join(Recording, Recording.id == PianoSheet.recording_id)
            .where(
                PianoSheet.recording_id.is_not(None),
                PianoSheet.status == "published",
                PianoSheet.archived_at.is_(None),
                Recording.status.in_(("published", "flagged")),
            )
            .distinct()
            .limit(limit)
        )
    ).all()
    return [str(row) for row in rows if row is not None]


async def credit_map(session: AsyncSession, sheets: list[PianoSheet]) -> dict[UUID, PianoBasedOn]:
    """The "based on" credit of each sheet that has one, worked out from the original NOW: a name
    only while the original exists, is published, is not anonymous and its author is there."""
    wanted = {s.based_on_id for s in sheets if s.based_on_id is not None}
    if not wanted:
        return {}
    rows = (
        await session.execute(
            select(PianoSheet, UserAccount)
            .join(UserAccount, UserAccount.id == PianoSheet.member_id, isouter=True)
            .where(PianoSheet.id.in_(wanted))
        )
    ).all()
    now: dict[UUID, PianoBasedOn] = {}
    for original, author in rows:
        named = author is not None and not original.is_anonymous and original.status == "published"
        now[original.id] = PianoBasedOn(
            id=str(original.id), name=display_name(author) if named else None
        )
    return {
        s.id: now[s.based_on_id]
        for s in sheets
        if s.based_on_id is not None and s.based_on_id in now
    }


async def replaced_by_map(session: AsyncSession, ids: list[UUID]) -> dict[UUID, UUID]:
    if not ids:
        return {}
    rows = (
        await session.execute(
            select(PianoSheet.replaces_id, PianoSheet.id)
            .where(PianoSheet.replaces_id.in_(ids), PianoSheet.status == "published")
            .order_by(PianoSheet.published_at.asc())
        )
    ).all()
    found: dict[UUID, UUID] = {}
    for old_id, new_id in rows:
        if old_id is not None:
            found[old_id] = new_id
    return found


async def present(
    session: AsyncSession,
    rows: list[tuple[PianoSheet, UserAccount | None]],
    *,
    viewer_id: UUID | None,
    team: bool,
) -> list[PianoSheetOut]:
    sheets = [s for s, _ in rows]
    credits = await credit_map(session, sheets)
    replaced = await replaced_by_map(session, [s.id for s in sheets if s.archived_at is not None])
    return [
        public_out(
            s, a, viewer_id=viewer_id, team=team, replaced_by=replaced.get(s.id), credits=credits
        )
        for s, a in rows
    ]


# --------------------------------------------------------------------------- offering


async def sheets_in_last_day(session: AsyncSession, member_id: UUID) -> int:
    since = now_utc() - timedelta(hours=24)
    total = await session.scalar(
        select(func.count())
        .select_from(PianoSheet)
        .where(PianoSheet.member_id == member_id, PianoSheet.created_at >= since)
    )
    return int(total or 0)


async def ensure_daily_allowance(
    session: AsyncSession, member_id: UUID, *, team: bool, limit: int = DAILY_SHEETS
) -> None:
    if team:
        return
    if await sheets_in_last_day(session, member_id) >= limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"You can offer up to {limit} piano sheets a day. Please come back tomorrow.",
            headers={"X-Error-Code": DAILY_LIMIT_CODE},
        )


def _live_statement(member_id: UUID, target_key: str) -> Any:
    return select(PianoSheet).where(
        PianoSheet.member_id == member_id,
        PianoSheet.target_key == target_key,
        PianoSheet.status.in_(("pending", "published")),
        PianoSheet.archived_at.is_(None),
    )


def _is_twin(row: PianoSheet, payload: PianoSheetCreate, score: dict[str, Any]) -> bool:
    return fingerprint(row.score, row.sa_key) == fingerprint(score, payload.sa_key)


def _parse_id(raw: str | None) -> UUID | None:
    if raw is None:
        return None
    try:
        return UUID(raw)
    except ValueError:
        return None


async def _replaceable(
    session: AsyncSession, *, member_id: UUID, target_key: str, payload: PianoSheetCreate
) -> PianoSheet | None:
    """The live sheet of the author that a new version may replace. Anything else is ignored (the
    sheet is then a new one): a stranger's id must not tell the sender anything."""
    old_id = _parse_id(payload.replaces_id)
    if old_id is None:
        return None
    old = await session.get(PianoSheet, old_id)
    if (
        old is None
        or old.member_id != member_id
        or old.status != "published"
        or old.archived_at is not None
        or old.target_key != target_key
    ):
        return None
    return old


async def _credit(
    session: AsyncSession, *, member_id: UUID, target_key: str, payload: PianoSheetCreate
) -> UUID | None:
    original_id = _parse_id(payload.based_on_id)
    if original_id is None:
        return None
    original = await session.get(PianoSheet, original_id)
    if (
        original is None
        or original.member_id == member_id
        or original.status != "published"
        or original.archived_at is not None
        or original.target_key != target_key
    ):
        return None
    return original.id


async def _archive_replaced(session: AsyncSession, sheet: PianoSheet) -> None:
    if sheet.replaces_id is None:
        return
    old = await session.get(PianoSheet, sheet.replaces_id)
    if (
        old is not None
        and old.id != sheet.id
        and old.status == "published"
        and old.archived_at is None
    ):
        old.archived_at = now_utc()


def _duplicate() -> HTTPException:
    return HTTPException(
        status_code=409,
        detail="You already offered exactly these notes.",
        headers={"X-Error-Code": DUPLICATE_CODE},
    )


def _too_many() -> HTTPException:
    return HTTPException(
        status_code=409,
        detail=(
            f"You already have {OPEN_PER_TARGET} piano sheets here waiting or live. "
            "Delete one first, or wait for the review."
        ),
        headers={"X-Error-Code": OPEN_LIMIT_CODE},
    )


def goes_live(*, team: bool, owner: bool, link: str | None) -> bool:
    """A team member's sheet is live at once. So is the author of the recording's, unless it has
    a link (every link is looked at by the team before others see it)."""
    return team or (owner and link is None)


async def create_sheet(
    session: AsyncSession,
    *,
    member: UserAccount,
    recording_id: UUID | None,
    song_number: int | None,
    payload: PianoSheetCreate,
    team: bool,
) -> PianoSheet:
    owner = False
    if recording_id is not None:
        recording = await check_target(session, recording_id)
        owner = recording.author_id is not None and recording.author_id == member.id
        target_key = recording_key(recording_id)
    else:
        assert song_number is not None
        target_key = song_key(song_number)
    # Content first: notes refused for what is in them cost nothing, not even an hourly place.
    score, sounding, level = clean_rows(payload)
    link = clean_link(payload.link_url)
    note = clean_note(payload.note)
    await ensure_daily_allowance(session, member.id, team=team)
    live = (await session.scalars(_live_statement(member.id, target_key))).all()
    replaced = await _replaceable(
        session, member_id=member.id, target_key=target_key, payload=payload
    )
    based_on_id = await _credit(
        session, member_id=member.id, target_key=target_key, payload=payload
    )
    if any(_is_twin(row, payload, score) for row in live):
        raise _duplicate()
    staying = [row for row in live if replaced is None or row.id != replaced.id]
    if not team and len(staying) >= OPEN_PER_TARGET:
        raise _too_many()
    limiter.hit(
        "offer",
        str(member.id),
        limit=HOURLY_SHEETS_TEAM if team else HOURLY_SHEETS,
        window_seconds=3600,
    )
    live_now = goes_live(team=team, owner=owner, link=link)
    now = now_utc()
    sheet = PianoSheet(
        recording_id=recording_id,
        song_id=song_number,
        target_key=target_key,
        member_id=member.id,
        sa_key=payload.sa_key,
        level=level,
        score=score,
        steps_count=sounding,
        link_url=link,
        note=note,
        is_anonymous=payload.is_anonymous,
        by_recording_author=owner and not team,
        status="published" if live_now else "pending",
        published_at=now if live_now else None,
        reviewed_at=now if live_now else None,
        reviewed_by=("team" if team else "recording author") if live_now else None,
        replaces_id=replaced.id if replaced is not None else None,
        based_on_id=based_on_id,
    )
    session.add(sheet)
    await session.flush()
    if live_now:
        await _archive_replaced(session, sheet)
    await session.commit()
    await session.refresh(sheet)
    return sheet


async def update_sheet(
    session: AsyncSession, sheet: PianoSheet, *, payload: PianoSheetCreate, team: bool
) -> PianoSheet:
    """The author changes a sheet that is waiting or was not accepted, and sends it again. A live
    sheet is never edited in place (it would change on the page without a second look): the author
    offers a changed copy as a new sheet."""
    if sheet.status == "published":
        raise HTTPException(
            status_code=409,
            detail="Live notes cannot be changed. Offer a changed copy instead.",
            headers={"X-Error-Code": NOT_EDITABLE_CODE},
        )
    score, sounding, level = clean_rows(payload)
    link = clean_link(payload.link_url)
    note = clean_note(payload.note)
    owner = False
    if sheet.recording_id is not None:
        recording = await session.get(Recording, sheet.recording_id)
        owner = bool(recording and recording.author_id == sheet.member_id)
    others = [
        row
        for row in (await session.scalars(_live_statement(sheet.member_id, sheet.target_key))).all()
        if row.id != sheet.id
    ]
    if any(_is_twin(row, payload, score) for row in others):
        raise _duplicate()
    staying = [row for row in others if row.id != sheet.replaces_id]
    if not team and sheet.status == "rejected" and len(staying) >= OPEN_PER_TARGET:
        raise _too_many()
    limiter.hit("edit", str(sheet.member_id), limit=30, window_seconds=3600)
    live_now = goes_live(team=team, owner=owner, link=link)
    now = now_utc()
    sheet.sa_key = payload.sa_key
    sheet.level = level
    sheet.score = score
    sheet.steps_count = sounding
    sheet.link_url = link
    sheet.note = note
    sheet.is_anonymous = payload.is_anonymous
    sheet.by_recording_author = owner and not team
    sheet.status = "published" if live_now else "pending"
    sheet.rejected_reason = None
    sheet.published_at = now if live_now else None
    sheet.reviewed_at = now if live_now else None
    sheet.reviewed_by = ("team" if team else "recording author") if live_now else None
    if live_now:
        await _archive_replaced(session, sheet)
    await session.commit()
    await session.refresh(sheet)
    return sheet


async def delete_sheet(session: AsyncSession, sheet: PianoSheet) -> None:
    await session.execute(
        update(PianoSheet).where(PianoSheet.replaces_id == sheet.id).values(replaces_id=None)
    )
    await session.execute(
        update(PianoSheet).where(PianoSheet.based_on_id == sheet.id).values(based_on_id=None)
    )
    for report in (
        await session.scalars(select(PianoSheetReport).where(PianoSheetReport.sheet_id == sheet.id))
    ).all():
        await session.delete(report)
    await session.delete(sheet)
    await session.commit()


# --------------------------------------------------------------------------- reports


async def add_report(
    session: AsyncSession,
    *,
    sheet: PianoSheet,
    reporter_key: str,
    reporter_id: UUID | None,
    reason: str,
    note: str | None,
) -> bool:
    """Store a report. False when this reporter already reported it (one report each)."""
    already = await session.scalar(
        select(PianoSheetReport.id).where(
            PianoSheetReport.sheet_id == sheet.id, PianoSheetReport.reporter_key == reporter_key
        )
    )
    if already is not None:
        return False
    session.add(
        PianoSheetReport(
            sheet_id=sheet.id,
            reporter_key=reporter_key,
            reporter_id=reporter_id,
            reason=reason,
            note=one_line(note, 1000) or None,
        )
    )
    sheet.reports_count = (sheet.reports_count or 0) + 1
    await session.commit()
    return True


# --------------------------------------------------------------------------- review


async def _what(session: AsyncSession, sheet: PianoSheet) -> str:
    if sheet.recording_id is not None:
        recording = await session.get(Recording, sheet.recording_id)
        title = one_line(recording.title if recording else "", 60)
        return f"piano notes for “{title}”" if title else "piano notes"
    return f"piano notes for song {sheet.song_id}"


def _notice(
    sheet: PianoSheet, *, kind: str, title: str, body: str, extra: dict[str, Any]
) -> MemberNotice:
    return MemberNotice(
        user_id=sheet.member_id,
        kind=kind,
        recording_id=sheet.recording_id,
        title=title[:300],
        body=body,
        payload={
            "piano_sheet_id": str(sheet.id),
            "recording_id": str(sheet.recording_id) if sheet.recording_id else None,
            "song_number": sheet.song_id,
            **extra,
        },
    )


async def approve(session: AsyncSession, sheet: PianoSheet, *, by: str) -> bool:
    if sheet.status == "published":
        return False
    if sheet.status == "rejected":
        raise HTTPException(status_code=409, detail="Restore it first, or reject it for good.")
    what = await _what(session, sheet)
    now = now_utc()
    sheet.status = "published"
    sheet.published_at = now
    sheet.reviewed_at = now
    sheet.reviewed_by = by[:255]
    sheet.rejected_reason = None
    await _archive_replaced(session, sheet)
    session.add(
        _notice(
            sheet,
            kind=NOTICE_PUBLISHED,
            title=f"Your {what} are live",
            body=f"Thank you. Your {what} passed the review and now show on the page.",
            extra={},
        )
    )
    await session.commit()
    return True


async def reject(session: AsyncSession, sheet: PianoSheet, *, reason: str, by: str) -> None:
    if sheet.status == "rejected":
        raise HTTPException(status_code=409, detail="Already rejected")
    what = await _what(session, sheet)
    clean_reason = one_line(reason, 500)
    sheet.status = "rejected"
    sheet.rejected_reason = clean_reason
    sheet.reviewed_at = now_utc()
    sheet.reviewed_by = by[:255]
    session.add(
        _notice(
            sheet,
            kind=NOTICE_REJECTED,
            title=f"Your {what} were not published: {clean_reason}"[:300],
            body=(
                f"Your {what} were not published because: {clean_reason}. "
                "You can fix the notes and offer them again, or write to us from the app "
                "(Contact us) and we will look again."
            ),
            extra={"reason": clean_reason},
        )
    )
    await session.commit()


async def restore(session: AsyncSession, sheet: PianoSheet, *, by: str) -> None:
    if sheet.status != "rejected":
        raise HTTPException(status_code=409, detail="Only rejected notes can be restored")
    what = await _what(session, sheet)
    now = now_utc()
    sheet.status = "published"
    sheet.published_at = now
    sheet.reviewed_at = now
    sheet.reviewed_by = by[:255]
    sheet.rejected_reason = None
    await _archive_replaced(session, sheet)
    session.add(
        _notice(
            sheet,
            kind=NOTICE_PUBLISHED,
            title=f"Your {what} are live",
            body=f"We looked again: your {what} are now on the page.",
            extra={},
        )
    )
    await session.commit()


async def admin_queue(
    session: AsyncSession, *, which: str, limit: int, offset: int
) -> tuple[list[tuple[PianoSheet, UserAccount | None]], int]:
    conditions: list[Any]
    if which == "pending":
        conditions = [PianoSheet.status == "pending"]
    elif which == "reported":
        conditions = [PianoSheet.status == "published", PianoSheet.reports_count > 0]
    elif which == "published":
        conditions = [PianoSheet.status == "published"]
    elif which == "rejected":
        conditions = [PianoSheet.status == "rejected"]
    else:
        conditions = []
    total = await session.scalar(select(func.count()).select_from(PianoSheet).where(*conditions))
    order = PianoSheet.created_at.asc() if which == "pending" else PianoSheet.created_at.desc()
    rows = (
        await session.execute(
            select(PianoSheet, UserAccount)
            .join(UserAccount, UserAccount.id == PianoSheet.member_id, isouter=True)
            .where(*conditions)
            .order_by(order, PianoSheet.id.asc())
            .limit(limit)
            .offset(offset)
        )
    ).all()
    return [(s, a) for s, a in rows], int(total or 0)


async def pending_count(session: AsyncSession) -> int:
    total = await session.scalar(
        select(func.count()).select_from(PianoSheet).where(PianoSheet.status == "pending")
    )
    return int(total or 0)
