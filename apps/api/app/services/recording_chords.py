"""Chord sheets of recordings: offering, reading, reporting, reviewing (docs/recording-extras.md).

A recording has no lyric lines in the app to hang chords on, so a sheet is a plain-text chart the
member types: chords on a line of their own over the words, or `[Am]` inside the words. The server
cleans the text, checks it holds chords and keeps it as typed. It does NOT check the chords are
musically right and says so.

Review is the one of the song chord proposals: a team member's sheet is live at once, everybody
else's waits as `pending`; the team rejects with a reason (the author gets a notice) and restores;
the author may change a waiting or rejected sheet, or delete their own for good. The daily and the
hourly allowance are SHARED with the song chord proposals (the same `song_chord_offers` ledger and
the same limiter bucket): one member cannot double the allowance by using both kinds.

The rule that must not break: a PUBLIC view of an anonymous sheet carries no trace of its author
(see `public_out`). Everything that knows the author is `admin_out` and team-only.
"""

from __future__ import annotations

import re
import textwrap
import unicodedata
from datetime import timedelta
from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import UserAccount
from app.models.recording_extras import (
    SHEET_MAX_LINE_LENGTH,
    SHEET_MAX_LINES,
    SHEET_TEXT_MAX_LENGTH,
    RecordingChordReport,
    RecordingChordSheet,
)
from app.models.recordings import MemberNotice, Recording
from app.models.song_chords import SongChordOffer, SongChordProposal
from app.schemas.recording_extras import AdminSheetOut, SheetAuthor, SheetCreate, SheetOut
from app.schemas.song_chords import CHORD_PATTERN
from app.services import song_chords as shared
from app.services.extras_common import display_name, one_line
from app.services.recordings import now_utc
from app.services.song_comments import link_count, strip_invisible

DAILY_SHEETS = shared.DAILY_PROPOSALS
HOURLY_SHEETS = shared.HOURLY_PROPOSALS
HOURLY_SHEETS_TEAM = shared.HOURLY_PROPOSALS_TEAM
# One member may keep at most this many live (pending or published) sheets per recording and
# instrument.
OPEN_PER_RECORDING_INSTRUMENT = 3
MAX_CHORDS = 2000
DAILY_LIMIT_CODE = shared.DAILY_LIMIT_CODE
DUPLICATE_CODE = shared.DUPLICATE_CODE
OPEN_LIMIT_CODE = shared.OPEN_LIMIT_CODE
NOT_EDITABLE_CODE = shared.NOT_EDITABLE_CODE
NOTICE_REJECTED = shared.NOTICE_REJECTED
NOTICE_PUBLISHED = shared.NOTICE_PUBLISHED

# Same limiter object as the song chord proposals, same "offer" bucket: one hourly allowance.
limiter = shared.limiter

# Marks that may sit between chords on a chord line without making it a line of words.
_SEPARATOR = re.compile(r"\|{1,2}|[-–—/%:]|\(?[xX]\d{1,2}\)?|N\.?C\.?|\.{2,}")
_INLINE = re.compile(r"\[([^\[\]\s]{1,16})\]")
_CONTROL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


def is_chord(token: str) -> bool:
    return CHORD_PATTERN.fullmatch(token) is not None


# A chord that is only a letter with an optional sharp or flat: "A", "Bb", "F#". On its own it is
# also a word ("A"), so it does not prove a chart is a chart (QA-053).
_PLAIN_CHORD = re.compile(r"[A-G][#b\u266f\u266d]?")


def chord_line_tokens(line: str) -> list[str]:
    """The chords of a CHORD LINE: a line made only of chords and the usual separators (bars,
    dashes, "x2", "N.C."). Empty when the line is words (or empty)."""
    tokens = line.split()
    chords: list[str] = []
    for token in tokens:
        if is_chord(token):
            chords.append(token)
        elif not _SEPARATOR.fullmatch(token):
            return []
    return chords


def chord_line_count(line: str) -> int:
    return len(chord_line_tokens(line))


def line_chord_tokens(line: str) -> list[str]:
    """Chords on one line: the chord line's tokens, or the `[Am]` marks in the words."""
    return chord_line_tokens(line) or [
        found.group(1) for found in _INLINE.finditer(line) if is_chord(found.group(1))
    ]


def line_chords(line: str) -> int:
    return len(line_chord_tokens(line))


def proves_a_chart(chords: list[str]) -> bool:
    """A chart needs more than one lonely letter: at least two DIFFERENT chords, or one chord that
    is plainly a chord (a quality, a number or a bass note: Am, G7, D/F#). So "Am" over words and
    "Am" + "G" pass; a body of just "A" does not."""
    if len(set(chords)) >= 2:
        return True
    return any(not _PLAIN_CHORD.fullmatch(chord) for chord in chords)


def clean_sheet(raw: str) -> tuple[str, int]:
    """The text as it will be stored, and how many chords it holds.

    Invisible characters (bidi marks, zero-width, soft hyphen) and control characters go (QA-010).
    Odd spaces (no-break, em space) and tabs become ordinary spaces, because chords are lined
    up over words by their columns. Line ends are trimmed, a common left margin is removed, blank
    lines at the ends go and no more than one blank line in a row stays. Spaces INSIDE a line
    are kept.
    """
    text = strip_invisible(raw).replace("\r\n", "\n").replace("\r", "\n")
    text = text.replace("\u2028", "\n").replace("\u2029", "\n").replace("\t", "    ")
    text = _CONTROL.sub("", text)
    text = "".join(" " if unicodedata.category(c) == "Zs" else c for c in text)
    lines = [line.rstrip() for line in text.split("\n")]
    lines = _collapse_blank(lines)
    body = textwrap.dedent("\n".join(lines)).strip("\n")
    if not body.strip():
        raise HTTPException(status_code=422, detail="Write the chords before sending.")
    out = body.split("\n")
    if len(out) > SHEET_MAX_LINES:
        raise HTTPException(
            status_code=422, detail=f"A chord chart can have {SHEET_MAX_LINES} lines at most."
        )
    if any(len(line) > SHEET_MAX_LINE_LENGTH for line in out):
        raise HTTPException(
            status_code=422,
            detail=f"A line is longer than {SHEET_MAX_LINE_LENGTH} characters. Please split it.",
        )
    if len(body) > SHEET_TEXT_MAX_LENGTH:
        raise HTTPException(status_code=422, detail="This chord chart is too long.")
    if link_count(body) > 0:
        raise HTTPException(status_code=422, detail="Please leave web links out of a chord chart.")
    found = [chord for line in out for chord in line_chord_tokens(line)]
    chords = len(found)
    if chords == 0:
        raise HTTPException(
            status_code=422,
            detail="Add at least one chord, for example Am or G7, over the words.",
        )
    if not proves_a_chart(found):
        raise HTTPException(
            status_code=422,
            detail=(
                "A single plain letter is not a chord chart. Add a second chord, "
                "or write the chord in full, for example Am or G7."
            ),
        )
    if chords > MAX_CHORDS:
        raise HTTPException(status_code=422, detail="Too many chords for one chart.")
    return body, chords


def _collapse_blank(lines: list[str]) -> list[str]:
    out: list[str] = []
    for line in lines:
        if not line and (not out or not out[-1]):
            continue
        out.append(line)
    while out and not out[-1]:
        out.pop()
    return out


def same_sheet_key(body: str) -> str:
    """What "the same chart" means: the text with every run of spaces collapsed."""
    return "\n".join(" ".join(line.split()) for line in body.split("\n"))


def clean_note(raw: str | None) -> str | None:
    """The note under a chart: one short line, no web links (the same rule as the chart itself and
    as a video title)."""
    note = one_line(raw, 300) or None
    if note is not None and link_count(note) > 0:
        raise HTTPException(status_code=422, detail="Please leave web links out of the note.")
    return note


def public_out(
    sheet: RecordingChordSheet,
    author: UserAccount | None,
    *,
    viewer_id: UUID | None,
    team: bool,
) -> SheetOut:
    """What every reader gets. `author` is filled only for a NAMED sheet."""
    mine = viewer_id is not None and sheet.member_id == viewer_id
    shown = None
    if not sheet.is_anonymous and author is not None:
        shown = SheetAuthor(name=display_name(author))
    return SheetOut(
        id=str(sheet.id),
        recording_id=str(sheet.recording_id),
        instrument=sheet.instrument,  # type: ignore[arg-type]
        chart_key=sheet.chart_key,
        body=sheet.body,
        chords_count=sheet.chords_count,
        note=sheet.note,
        played_it=sheet.played_it,
        created_at=sheet.created_at,
        is_anonymous=sheet.is_anonymous,
        author=shown,
        mine=mine,
        status=sheet.status,  # type: ignore[arg-type]
        # the reason is the author's and the team's business only
        rejected_reason=sheet.rejected_reason if (mine or team) else None,
        can_review=team,
    )


def admin_out(sheet: RecordingChordSheet, author: UserAccount | None) -> AdminSheetOut:
    base = public_out(sheet, author, viewer_id=None, team=True)
    return AdminSheetOut(
        **base.model_dump(),
        author_id=str(sheet.member_id),
        author_name=display_name(author),
        reports_count=sheet.reports_count,
        reviewed_at=sheet.reviewed_at,
        reviewed_by=sheet.reviewed_by,
        published_at=sheet.published_at,
    )


# --------------------------------------------------------------------------- reading


async def list_for_recording(
    session: AsyncSession,
    recording_id: UUID,
    *,
    viewer_id: UUID | None,
    instrument: str | None = None,
) -> list[tuple[RecordingChordSheet, UserAccount | None]]:
    """Published sheets of one recording, oldest first (the first good one keeps its place), plus
    the viewer's own waiting ones (marked `mine`, status `pending`)."""
    visible = RecordingChordSheet.status == "published"
    if viewer_id is not None:
        visible = visible | (
            (RecordingChordSheet.member_id == viewer_id) & (RecordingChordSheet.status == "pending")
        )
    query = (
        select(RecordingChordSheet, UserAccount)
        .join(UserAccount, UserAccount.id == RecordingChordSheet.member_id, isouter=True)
        .where(RecordingChordSheet.recording_id == recording_id, visible)
        .order_by(RecordingChordSheet.created_at.asc(), RecordingChordSheet.id.asc())
    )
    if instrument:
        query = query.where(RecordingChordSheet.instrument == instrument)
    rows = (await session.execute(query)).all()
    return [(s, a) for s, a in rows]


async def list_mine(
    session: AsyncSession, member_id: UUID
) -> list[tuple[RecordingChordSheet, Recording | None]]:
    """The member's own sheets in every state, each with its recording (to show the title)."""
    rows = (
        await session.execute(
            select(RecordingChordSheet, Recording)
            .join(Recording, Recording.id == RecordingChordSheet.recording_id, isouter=True)
            .where(RecordingChordSheet.member_id == member_id)
            .order_by(RecordingChordSheet.created_at.desc())
        )
    ).all()
    return [(s, r) for s, r in rows]


# --------------------------------------------------------------------------- offering


async def sheets_in_last_day(session: AsyncSession, member_id: UUID) -> int:
    """Charts the member offered in 24 hours, songs and recordings together, the ones they deleted
    since included (every offer leaves a ledger row that outlives the chart)."""
    since = now_utc() - timedelta(hours=24)
    offered = await session.scalar(
        select(func.count())
        .select_from(SongChordOffer)
        .where(SongChordOffer.member_id == member_id, SongChordOffer.created_at >= since)
    )
    stored_songs = await session.scalar(
        select(func.count())
        .select_from(SongChordProposal)
        .where(SongChordProposal.member_id == member_id, SongChordProposal.created_at >= since)
    )
    stored_sheets = await session.scalar(
        select(func.count())
        .select_from(RecordingChordSheet)
        .where(RecordingChordSheet.member_id == member_id, RecordingChordSheet.created_at >= since)
    )
    return max(int(offered or 0), int(stored_songs or 0) + int(stored_sheets or 0))


async def ensure_daily_allowance(
    session: AsyncSession, member_id: UUID, *, team: bool, limit: int = DAILY_SHEETS
) -> None:
    """At most DAILY_SHEETS per member in 24 hours (rejected count). The team has no limit."""
    if team:
        return
    if await sheets_in_last_day(session, member_id) >= limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"You can offer up to {limit} charts a day. Please come back tomorrow.",
            headers={"X-Error-Code": DAILY_LIMIT_CODE},
        )


def _live_statement(member_id: UUID, recording_id: UUID, instrument: str) -> Any:
    return select(RecordingChordSheet).where(
        RecordingChordSheet.member_id == member_id,
        RecordingChordSheet.recording_id == recording_id,
        RecordingChordSheet.instrument == instrument,
        RecordingChordSheet.status.in_(("pending", "published")),
    )


def _is_twin(row: RecordingChordSheet, key: str | None, body_key: str) -> bool:
    return row.chart_key == key and same_sheet_key(row.body) == body_key


def _duplicate() -> HTTPException:
    return HTTPException(
        status_code=409,
        detail="You already offered exactly this chart.",
        headers={"X-Error-Code": DUPLICATE_CODE},
    )


def _too_many() -> HTTPException:
    return HTTPException(
        status_code=409,
        detail=(
            f"You already have {OPEN_PER_RECORDING_INSTRUMENT} charts of this recording for this "
            "instrument waiting or live. Delete one first, or wait for the review."
        ),
        headers={"X-Error-Code": OPEN_LIMIT_CODE},
    )


async def create_sheet(
    session: AsyncSession,
    *,
    member: UserAccount,
    recording_id: UUID,
    payload: SheetCreate,
    team: bool,
) -> RecordingChordSheet:
    # Content first: a chart refused for what is in it costs nothing, not even an hourly place.
    body, chords = clean_sheet(payload.body)
    note = clean_note(payload.note)
    await ensure_daily_allowance(session, member.id, team=team)
    live = (
        await session.scalars(_live_statement(member.id, recording_id, payload.instrument))
    ).all()
    wanted = same_sheet_key(body)
    if any(_is_twin(row, payload.chart_key, wanted) for row in live):
        raise _duplicate()
    if not team and len(live) >= OPEN_PER_RECORDING_INSTRUMENT:
        raise _too_many()
    # Only a chart that passed every check above uses up the hourly allowance.
    limiter.hit(
        "offer",
        str(member.id),
        limit=HOURLY_SHEETS_TEAM if team else HOURLY_SHEETS,
        window_seconds=3600,
    )
    now = now_utc()
    session.add(SongChordOffer(member_id=member.id))
    sheet = RecordingChordSheet(
        recording_id=recording_id,
        member_id=member.id,
        instrument=payload.instrument,
        chart_key=payload.chart_key,
        body=body,
        chords_count=chords,
        played_it=payload.played_it,
        note=note,
        is_anonymous=payload.is_anonymous,
        status="published" if team else "pending",
        published_at=now if team else None,
        reviewed_at=now if team else None,
        reviewed_by="team" if team else None,
    )
    session.add(sheet)
    await session.commit()
    await session.refresh(sheet)
    return sheet


async def update_sheet(
    session: AsyncSession,
    sheet: RecordingChordSheet,
    *,
    payload: SheetCreate,
    team: bool,
) -> RecordingChordSheet:
    """The author changes a sheet that is waiting or was not accepted, and sends it again.

    A live sheet is never edited in place (it would change on the page without a second look): the
    author offers a changed copy as a new sheet. The recording and the instrument belong to the
    sheet for good. It goes back to `pending` (the team: straight to `published`) and the reason of
    an earlier rejection is cleared. The daily allowance is not charged again: same chart.
    """
    if sheet.status == "published":
        raise HTTPException(
            status_code=409,
            detail="A live chart cannot be changed. Offer a changed copy instead.",
            headers={"X-Error-Code": NOT_EDITABLE_CODE},
        )
    if payload.instrument != sheet.instrument:
        raise HTTPException(status_code=422, detail="A chart keeps its instrument.")
    body, chords = clean_sheet(payload.body)
    note = clean_note(payload.note)
    others = [
        row
        for row in (
            await session.scalars(
                _live_statement(sheet.member_id, sheet.recording_id, sheet.instrument)
            )
        ).all()
        if row.id != sheet.id
    ]
    wanted = same_sheet_key(body)
    if any(_is_twin(row, payload.chart_key, wanted) for row in others):
        raise _duplicate()
    # A rejected chart that comes back is a live chart again: it counts against the cap.
    if not team and sheet.status == "rejected" and len(others) >= OPEN_PER_RECORDING_INSTRUMENT:
        raise _too_many()
    limiter.hit("edit", str(sheet.member_id), limit=30, window_seconds=3600)
    now = now_utc()
    sheet.chart_key = payload.chart_key
    sheet.body = body
    sheet.chords_count = chords
    sheet.played_it = payload.played_it
    sheet.note = note
    sheet.is_anonymous = payload.is_anonymous
    sheet.status = "published" if team else "pending"
    sheet.rejected_reason = None
    sheet.published_at = now if team else None
    sheet.reviewed_at = now if team else None
    sheet.reviewed_by = "team" if team else None
    await session.commit()
    await session.refresh(sheet)
    return sheet


async def delete_sheet(session: AsyncSession, sheet: RecordingChordSheet) -> None:
    for report in (
        await session.scalars(
            select(RecordingChordReport).where(RecordingChordReport.sheet_id == sheet.id)
        )
    ).all():
        await session.delete(report)
    await session.delete(sheet)
    await session.commit()


# --------------------------------------------------------------------------- reports


async def add_report(
    session: AsyncSession,
    *,
    sheet: RecordingChordSheet,
    reporter_key: str,
    reporter_id: UUID | None,
    reason: str,
    note: str | None,
) -> bool:
    """Store a report. False when this reporter already reported it (one report each)."""
    already = await session.scalar(
        select(RecordingChordReport.id).where(
            RecordingChordReport.sheet_id == sheet.id,
            RecordingChordReport.reporter_key == reporter_key,
        )
    )
    if already is not None:
        return False
    session.add(
        RecordingChordReport(
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


async def _what(session: AsyncSession, sheet: RecordingChordSheet) -> str:
    recording = await session.get(Recording, sheet.recording_id)
    title = one_line(recording.title if recording else "", 60)
    return f"{sheet.instrument} chords for “{title}”" if title else f"{sheet.instrument} chords"


def _notice(
    sheet: RecordingChordSheet, *, kind: str, title: str, body: str, extra: dict[str, Any]
) -> MemberNotice:
    return MemberNotice(
        user_id=sheet.member_id,
        kind=kind,
        recording_id=sheet.recording_id,
        title=title[:300],
        body=body,
        payload={
            "recording_chord_sheet_id": str(sheet.id),
            "recording_id": str(sheet.recording_id),
            "instrument": sheet.instrument,
            **extra,
        },
    )


async def approve(session: AsyncSession, sheet: RecordingChordSheet, *, by: str) -> bool:
    """Pending -> published. True when something changed. The author gets a short notice."""
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
    session.add(
        _notice(
            sheet,
            kind=NOTICE_PUBLISHED,
            title=f"Your {what} are live",
            body=f"Thank you. Your {what} passed the review and now show on the recording.",
            extra={},
        )
    )
    await session.commit()
    return True


async def reject(
    session: AsyncSession, sheet: RecordingChordSheet, *, reason: str, by: str
) -> None:
    """Any status -> rejected, with a reason the author reads."""
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
                "You can fix the chart and offer it again, or write to us from the app "
                "(Contact us) and we will look again."
            ),
            extra={"reason": clean_reason, "actions": ["offer_again", "contact"]},
        )
    )
    await session.commit()


async def restore(session: AsyncSession, sheet: RecordingChordSheet, *, by: str) -> None:
    """Rejected -> published (a mistake of the review)."""
    if sheet.status != "rejected":
        raise HTTPException(status_code=409, detail="Only a rejected chart can be restored")
    what = await _what(session, sheet)
    now = now_utc()
    sheet.status = "published"
    sheet.published_at = now
    sheet.reviewed_at = now
    sheet.reviewed_by = by[:255]
    sheet.rejected_reason = None
    session.add(
        _notice(
            sheet,
            kind=NOTICE_PUBLISHED,
            title=f"Your {what} are live",
            body=f"We looked again: your {what} are now on the recording.",
            extra={},
        )
    )
    await session.commit()


async def admin_queue(
    session: AsyncSession, *, which: str, limit: int, offset: int
) -> tuple[list[tuple[RecordingChordSheet, UserAccount | None]], int]:
    """pending = waiting for the first look (oldest first); reported = published and reported;
    published; rejected; all. Newest first, except `pending`."""
    conditions: list[Any]
    if which == "pending":
        conditions = [RecordingChordSheet.status == "pending"]
    elif which == "reported":
        conditions = [
            RecordingChordSheet.status == "published",
            RecordingChordSheet.reports_count > 0,
        ]
    elif which == "published":
        conditions = [RecordingChordSheet.status == "published"]
    elif which == "rejected":
        conditions = [RecordingChordSheet.status == "rejected"]
    else:
        conditions = []
    total = await session.scalar(
        select(func.count()).select_from(RecordingChordSheet).where(*conditions)
    )
    order = (
        RecordingChordSheet.created_at.asc()
        if which == "pending"
        else RecordingChordSheet.created_at.desc()
    )
    rows = (
        await session.execute(
            select(RecordingChordSheet, UserAccount)
            .join(UserAccount, UserAccount.id == RecordingChordSheet.member_id, isouter=True)
            .where(*conditions)
            .order_by(order, RecordingChordSheet.id.asc())
            .limit(limit)
            .offset(offset)
        )
    ).all()
    return [(s, a) for s, a in rows], int(total or 0)


async def pending_count(session: AsyncSession) -> int:
    total = await session.scalar(
        select(func.count())
        .select_from(RecordingChordSheet)
        .where(RecordingChordSheet.status == "pending")
    )
    return int(total or 0)
