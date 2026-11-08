"""The team's queue of words authors write under "Add your own" (a main instrument, a style).

Dada, 8 Nov 2026: a custom value goes to a suggestion queue. The author sees the word at once; the
team accepts it, merges it into a listed value or rejects it; the word is normalized; one person may
bring at most three NEW words a week; only an instrument and a style work this way.

Normalization (`normalized_key`): case, spaces, punctuation, marks and accents do not matter, so
"Harmonium", " harmonium." and "HÁRMONIUM" are one word. A word that IS a listed value ("piano",
"Bass guitar", "Mridangam") is turned into its code at once and never reaches the queue. A word at
least 85% like a listed one ("harmonyum") still goes to the queue, with the listed value as a hint
for the team (`similar_to`); the form shows the same hint before the author sends it.

What the team's decision does to the recordings that used the word:
  * accepted: the word stays, now shown to everyone, and the form offers it as a pick;
  * merged:   the recordings take the listed value, the word is gone from them;
  * rejected: the recordings lose the word (the author is told in the notices). A rejected word is
    refused the next time ("choose from the list").

See docs/kiirtan-recording-info.md, "Add your own".
"""

from __future__ import annotations

import difflib
import unicodedata
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.recordings import (
    MemberNotice,
    Recording,
    ValueSuggestion,
    ValueSuggestionUse,
)
from app.services.invisible_text import strip_invisible
from app.services.recording_instruments import INSTRUMENTS, NAMES, OTHER_MAX, OTHER_MIN
from app.services.recording_styles import STYLES

INSTRUMENT = "instrument"
STYLE = "style"
FIELDS = (INSTRUMENT, STYLE)
# One person may bring this many NEW words in any seven days (words already in the queue are free).
NEW_WORDS_PER_WEEK = 3
WEEK = timedelta(days=7)
SIMILAR_RATIO = 0.85


def normalized_key(text: str | None) -> str:
    """The word without case, accents, punctuation and extra spaces: the identity of a word."""
    if not text:
        return ""
    decomposed = unicodedata.normalize("NFKD", strip_invisible(text))
    plain = "".join(ch for ch in decomposed if not unicodedata.combining(ch))
    letters = "".join(ch if ch.isalnum() else " " for ch in plain.lower())
    return " ".join(letters.split())[:80]


def clean_word(text: str | None) -> str:
    """The word as it is stored: one printable line, 2 to 40 characters. ValueError otherwise."""
    kept = "".join(ch for ch in strip_invisible(text or "") if ch.isprintable() or ch.isspace())
    word = " ".join(kept.split())
    if len(word) < OTHER_MIN:
        raise ValueError(f"Write at least {OTHER_MIN} letters.")
    if len(word) > OTHER_MAX:
        raise ValueError(f"Write at most {OTHER_MAX} characters.")
    return word


def listed_names(field: str) -> dict[str, tuple[str, ...]]:
    """Each listed code with the words that mean it (English)."""
    if field == INSTRUMENT:
        return NAMES
    return {code: (code,) for code in STYLES}


def listed_code(field: str, text: str | None) -> str | None:
    """The listed value a typed word is, or None."""
    key = normalized_key(text)
    if not key:
        return None
    for code, names in listed_names(field).items():
        if key == normalized_key(code.replace("_", " ")):
            return code
        if key in {normalized_key(name) for name in names}:
            return code
    return None


def similar_code(field: str, text: str | None) -> str | None:
    """The listed value the word is at least 85% like (a typo, a spelling), or None."""
    key = normalized_key(text)
    if not key:
        return None
    best: tuple[float, str] | None = None
    for code, names in listed_names(field).items():
        for name in (code.replace("_", " "), *names):
            ratio = difflib.SequenceMatcher(None, key, normalized_key(name)).ratio()
            if ratio >= SIMILAR_RATIO and (best is None or ratio > best[0]):
                best = (ratio, code)
    return best[1] if best else None


def _aware(moment: datetime) -> datetime:
    return moment if moment.tzinfo else moment.replace(tzinfo=UTC)


@dataclass
class Resolved:
    """What a written word turns into. `kind`: listed, merged, accepted, pending, rejected, new."""

    kind: str
    field: str
    label: str
    key: str
    code: str | None = None  # the listed value (listed, merged)
    suggestion: ValueSuggestion | None = None


async def resolve_word(session: AsyncSession, field: str, text: str | None) -> Resolved:
    """Look the word up. Raises ValueError for a word that is too short or too long."""
    label = clean_word(text)
    key = normalized_key(label)
    if len(key) < OTHER_MIN:
        raise ValueError(f"Write at least {OTHER_MIN} letters.")
    code = listed_code(field, label)
    if code is not None:
        return Resolved("listed", field, label, key, code=code)
    row = await session.scalar(
        select(ValueSuggestion).where(ValueSuggestion.field == field, ValueSuggestion.key == key)
    )
    if row is None:
        return Resolved("new", field, label, key)
    if row.status == "merged" and row.merged_into:
        return Resolved("merged", field, row.label, key, code=row.merged_into, suggestion=row)
    return Resolved(row.status, field, row.label, key, suggestion=row)


async def ensure_allowance(
    session: AsyncSession, member_id: UUID, fresh: int, *, team: bool = False
) -> None:
    """429 when this person already brought three new words in the last seven days."""
    if fresh <= 0 or team:
        return
    cutoff = datetime.now(UTC) - WEEK
    brought = await session.scalar(
        select(func.count())
        .select_from(ValueSuggestion)
        .where(ValueSuggestion.first_user_id == member_id, ValueSuggestion.created_at >= cutoff)
    )
    if int(brought or 0) + fresh > NEW_WORDS_PER_WEEK:
        raise HTTPException(
            status_code=429,
            detail=(
                f"You can add {NEW_WORDS_PER_WEEK} new words a week. "
                "Choose a value from the list, or try again next week."
            ),
        )


def refuse_rejected(resolved: Resolved) -> None:
    if resolved.kind == "rejected":
        raise HTTPException(
            status_code=422,
            detail="The team did not accept this word. Choose a value from the list.",
        )


async def register_use(
    session: AsyncSession, resolved: Resolved, *, member_id: UUID, recording_id: UUID
) -> None:
    """Count one recording's use of a word; a new word is opened in the queue. No commit here."""
    if resolved.kind not in ("new", "pending", "accepted"):
        return
    moment = datetime.now(UTC)
    row = resolved.suggestion
    if row is None:
        row = ValueSuggestion(
            field=resolved.field,
            key=resolved.key,
            label=resolved.label,
            status="pending",
            similar_to=similar_code(resolved.field, resolved.label),
            first_user_id=member_id,
            recordings_count=0,
            people_count=0,
            created_at=moment,
        )
        session.add(row)
        await session.flush()
    already = await session.scalar(
        select(func.count())
        .select_from(ValueSuggestionUse)
        .where(ValueSuggestionUse.suggestion_id == row.id, ValueSuggestionUse.user_id == member_id)
    )
    session.add(
        ValueSuggestionUse(
            suggestion_id=row.id, user_id=member_id, recording_id=recording_id, created_at=moment
        )
    )
    row.recordings_count = (row.recordings_count or 0) + 1
    if not already:
        row.people_count = (row.people_count or 0) + 1


async def accepted_words(session: AsyncSession, field: str) -> list[ValueSuggestion]:
    return list(
        (
            await session.scalars(
                select(ValueSuggestion)
                .where(ValueSuggestion.field == field, ValueSuggestion.status == "accepted")
                .order_by(ValueSuggestion.label)
            )
        ).all()
    )


async def list_suggestions(
    session: AsyncSession, *, status: str | None, field: str | None
) -> list[ValueSuggestion]:
    query = select(ValueSuggestion)
    if status:
        query = query.where(ValueSuggestion.status == status)
    if field:
        query = query.where(ValueSuggestion.field == field)
    query = query.order_by(ValueSuggestion.people_count.desc(), ValueSuggestion.created_at)
    return list((await session.scalars(query)).all())


def _recording_field_names(field: str) -> tuple[str, str]:
    if field == INSTRUMENT:
        return ("lead_instrument", "lead_instrument_other")
    return ("style", "style_other")


async def _recordings_of(session: AsyncSession, row: ValueSuggestion) -> list[Recording]:
    ids = [
        rid
        for rid in (
            await session.scalars(
                select(ValueSuggestionUse.recording_id).where(
                    ValueSuggestionUse.suggestion_id == row.id
                )
            )
        ).all()
        if rid is not None
    ]
    if not ids:
        return []
    return list((await session.scalars(select(Recording).where(Recording.id.in_(ids)))).all())


async def decide(
    session: AsyncSession,
    row: ValueSuggestion,
    *,
    action: str,
    by: str,
    merge_into: str | None = None,
    label: str | None = None,
) -> list[MemberNotice]:
    """The team's answer. Returns the notices made for the authors (already added, committed)."""
    if row.status != "pending":
        raise HTTPException(status_code=409, detail="This word was already decided.")
    code_name, other_name = _recording_field_names(row.field)
    recordings = await _recordings_of(session, row)
    notices: list[MemberNotice] = []
    if action == "accept":
        if label:
            try:
                row.label = clean_word(label)
            except ValueError as exc:
                raise HTTPException(status_code=422, detail=str(exc)) from exc
        row.status = "accepted"
        for rec in recordings:
            if getattr(rec, code_name) == "other":
                setattr(rec, other_name, row.label)
                if row.field == INSTRUMENT:
                    rec.lead_instrument_checked = True
    elif action == "merge":
        if merge_into not in (INSTRUMENTS if row.field == INSTRUMENT else STYLES):
            raise HTTPException(status_code=422, detail="Choose the listed value to merge into.")
        row.status = "merged"
        row.merged_into = merge_into
        for rec in recordings:
            if getattr(rec, code_name) == "other":
                setattr(rec, code_name, merge_into)
                setattr(rec, other_name, None)
                if row.field == INSTRUMENT:
                    rec.lead_instrument_checked = False
    elif action == "reject":
        row.status = "rejected"
        for rec in recordings:
            if getattr(rec, code_name) == "other":
                if row.field == INSTRUMENT:
                    rec.lead_instrument = None
                    rec.lead_instrument_other = None
                    rec.lead_instrument_checked = False
                else:
                    # a Kiirtan must keep a style: it stays "other", without the word
                    rec.style_other = None
                if rec.author_id is not None:
                    what = "main instrument" if row.field == INSTRUMENT else "style"
                    notice = MemberNotice(
                        user_id=rec.author_id,
                        kind="value_rejected",
                        recording_id=rec.id,
                        title="The team did not accept a word",
                        body=(
                            f"For “{rec.title}” you wrote “{row.label}” as the {what}. The team "
                            "did not accept it, so it is not shown. You can pick a value from the "
                            "list when you edit the recording."
                        ),
                        payload={"field": row.field, "word": row.label},
                    )
                    session.add(notice)
                    notices.append(notice)
    else:
        raise HTTPException(status_code=422, detail="Choose accept, merge or reject.")
    row.decided_by = by
    row.decided_at = datetime.now(UTC)
    await session.commit()
    return notices
