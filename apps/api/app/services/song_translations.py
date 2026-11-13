"""Song translations: what the public sees, what the team does, the official import.

Design: docs/ps-translations.md. Rules kept here (the table refuses the worst of them as well):

- The public sees only `published` rows with a trust a reader can rely on: `official`, `verified`
  ("Checked") and `reviewed` ("Read by an editor"). A text nobody on the team has looked at
  (`unchecked`) is never served, and a literal translation is served only when it is `verified`.
  (Dada, 2026-11-08: unchecked literal translations are not shown to members.)
- Members do not offer translations. Only the team adds them, and "Checked" is a separate step.
- The code never splits or joins a text on its own. A text with no marking is ONE segment.
- The import reads `songs.english_meaning` and never changes it.
"""

from __future__ import annotations

import hashlib
import re
from collections.abc import Iterable, Sequence
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import Select, and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.song import Song
from app.models.song_translations import TRANSLATION_KINDS, SongTranslation
from app.schemas.song_translations import (
    AdminFilter,
    AdminTranslationOut,
    Availability,
    ImportReport,
    Segment,
    TranslationCreate,
    TranslationOut,
)

OFFICIAL_SOURCE_KEY = "official-lyrics-page"
OFFICIAL_CREDIT = "Official English translation, from the lyrics page of Prabhat Samgiita"
TEAM_SOURCE_KEY = "team"
KIND_ORDER = {kind: index for index, kind in enumerate(TRANSLATION_KINDS)}
# The official page joins two versions of one translation with a line of dashes.
VERSION_SPLIT = re.compile(r"^[ \t]*-{3,}[ \t]*$", re.MULTILINE)
IMPORT_CHUNK = 400

# --------------------------------------------------------------------------- what the public sees


def publicly_visible(kind: str, trust: str, status: str) -> bool:
    """The one rule for what is served to readers. Pure, so the tests can pin it down."""
    if status != "published":
        return False
    if kind == "literal":
        return trust == "verified"
    return trust in ("official", "verified", "reviewed")


def label_of(trust: str) -> str:
    """The word a reader sees: official, checked or reviewed (a row with no label is not served)."""
    return {"official": "official", "verified": "checked", "reviewed": "reviewed"}.get(
        trust, "reviewed"
    )


def _visible_clause() -> Any:
    return and_(
        SongTranslation.status == "published",
        or_(
            and_(SongTranslation.kind == "literal", SongTranslation.trust == "verified"),
            and_(
                SongTranslation.kind != "literal",
                SongTranslation.trust.in_(("official", "verified", "reviewed")),
            ),
        ),
    )


def _segments(row: SongTranslation) -> list[Segment]:
    return [Segment.model_validate(item) for item in (row.segments or [])]


def public_out(row: SongTranslation) -> TranslationOut:
    return TranslationOut(
        id=row.id,
        song_id=row.song_id,
        kind=row.kind,  # type: ignore[arg-type]
        language=row.language,
        position=row.position,
        alignment=row.alignment,  # type: ignore[arg-type]
        segments=_segments(row),
        text=row.plain_text,
        label=label_of(row.trust),  # type: ignore[arg-type]
        checked=row.trust == "verified",
        credit_line=row.credit_line,
        commentary=(row.commentary or "").strip() or None,
        updated_at=row.updated_at,
    )


def admin_out(row: SongTranslation) -> AdminTranslationOut:
    base = public_out(row)
    return AdminTranslationOut(
        **base.model_dump(),
        status=row.status,  # type: ignore[arg-type]
        trust=row.trust,  # type: ignore[arg-type]
        author_kind=row.author_kind,  # type: ignore[arg-type]
        author_label=row.author_label,
        source_key=row.source_key,
        source_ref=row.source_ref,
        license_note=row.license_note,
        doubts=row.doubts,
        reviewed_by=row.reviewed_by,
        reviewed_at=row.reviewed_at,
        verified_by=row.verified_by,
        verified_at=row.verified_at,
        verified_note=row.verified_note,
        rejected_reason=row.rejected_reason,
        replaces_id=row.replaces_id,
        created_at=row.created_at,
    )


def _ordered(rows: Iterable[SongTranslation]) -> list[SongTranslation]:
    return sorted(rows, key=lambda r: (KIND_ORDER.get(r.kind, 9), r.position, str(r.id)))


async def list_for_song(
    session: AsyncSession, song_id: int, language: str = "en"
) -> list[SongTranslation]:
    """The rows a reader may see for a song, in the order the page shows them."""
    rows = (
        await session.scalars(
            select(SongTranslation).where(
                SongTranslation.song_id == song_id,
                SongTranslation.language == language,
                _visible_clause(),
            )
        )
    ).all()
    return _ordered(r for r in rows if publicly_visible(r.kind, r.trust, r.status))


async def availability(session: AsyncSession, language: str = "en") -> Availability:
    rows = (
        await session.execute(
            select(SongTranslation.song_id, SongTranslation.kind)
            .where(SongTranslation.language == language, _visible_clause())
            .distinct()
        )
    ).all()
    out: dict[str, set[int]] = {kind: set() for kind in TRANSLATION_KINDS}
    for song_id, kind in rows:
        out[kind].add(song_id)
    return Availability(
        language=language,
        official=sorted(out["official"]),
        poetic=sorted(out["poetic"]),
        literal=sorted(out["literal"]),
    )


# --------------------------------------------------------------------------- the text itself


def normalize_text(text: str) -> str:
    """Newlines and the outer whitespace only. The words of a translation are never corrected."""
    lines = [line.rstrip() for line in text.replace("\r\n", "\n").replace("\r", "\n").split("\n")]
    return "\n".join(lines).strip()


def text_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def alignment_of(segments: Sequence[Segment]) -> str:
    """Derived, never typed: one segment is the whole song, one line per segment is line by line."""
    if len(segments) <= 1:
        return "whole"
    if all(s.to is not None and s.to == s.from_ for s in segments):
        return "line"
    return "stanza"


def check_segments(segments: Sequence[Segment]) -> None:
    """Segments go in order and never overlap. Raises ValueError with the reason."""
    last_end = -1
    for index, segment in enumerate(segments):
        if segment.from_ <= last_end:
            raise ValueError(f"segment {index + 1} starts inside the one before it")
        if segment.to is None and index != len(segments) - 1:
            raise ValueError("only the last segment may run to the end of the song")
        last_end = segment.to if segment.to is not None else 10**9
    return None


def joined_text(segments: Sequence[Segment]) -> str:
    return "\n".join(normalize_text(s.text) for s in segments)


# --------------------------------------------------------------------------- the team


async def get_row(session: AsyncSession, row_id: UUID) -> SongTranslation:
    row = await session.get(SongTranslation, row_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Translation not found")
    return row


def _admin_query(
    which: AdminFilter, song_id: int | None, kind: str | None
) -> Select[tuple[SongTranslation]]:
    query = select(SongTranslation)
    if which == "published":
        query = query.where(SongTranslation.status == "published")
    elif which == "unchecked":
        query = query.where(
            SongTranslation.status == "published", SongTranslation.trust != "verified"
        )
    elif which == "checked":
        query = query.where(SongTranslation.trust == "verified")
    elif which == "archived":
        query = query.where(SongTranslation.status == "archived")
    if song_id is not None:
        query = query.where(SongTranslation.song_id == song_id)
    if kind is not None:
        query = query.where(SongTranslation.kind == kind)
    return query


async def admin_list(
    session: AsyncSession,
    *,
    which: AdminFilter,
    song_id: int | None,
    kind: str | None,
    limit: int,
    offset: int,
) -> tuple[list[SongTranslation], int]:
    query = _admin_query(which, song_id, kind)
    total = await session.scalar(select(func.count()).select_from(query.subquery())) or 0
    rows = (
        await session.scalars(
            query.order_by(SongTranslation.song_id, SongTranslation.kind, SongTranslation.position)
            .limit(limit)
            .offset(offset)
        )
    ).all()
    return list(rows), int(total)


async def create_translation(
    session: AsyncSession, payload: TranslationCreate, *, by: str
) -> SongTranslation:
    """The team adds a text. It lands `published` unless `publish` is false. Never `verified`."""
    if payload.segments is not None:
        segments = list(payload.segments)
    else:
        segments = [Segment(**{"from": 0, "to": None, "text": payload.text or ""})]
    try:
        check_segments(segments)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    segments = [
        Segment(**{"from": s.from_, "to": s.to, "text": normalize_text(s.text), "doubt": s.doubt})
        for s in segments
    ]
    plain = joined_text(segments)
    if not plain:
        raise HTTPException(status_code=422, detail="The text is empty")
    old: SongTranslation | None = None
    if payload.replaces_id is not None:
        old = await get_row(session, payload.replaces_id)
        if old.song_id != payload.song_id or old.kind != payload.kind:
            raise HTTPException(
                status_code=422, detail="A new version must be for the same song and kind"
            )
    if payload.trust == "official":
        author_kind = "official"
    else:
        author_kind = "team"
    source_ref = payload.source_ref
    clash = await session.scalar(
        select(SongTranslation.id).where(
            SongTranslation.song_id == payload.song_id,
            SongTranslation.language == payload.language,
            SongTranslation.kind == payload.kind,
            SongTranslation.status != "archived",
            SongTranslation.text_hash == text_hash(plain),
        )
    )
    if clash is not None:
        raise HTTPException(status_code=409, detail="This text is already there")
    taken = (
        await session.scalars(
            select(SongTranslation.position).where(
                SongTranslation.song_id == payload.song_id,
                SongTranslation.language == payload.language,
                SongTranslation.kind == payload.kind,
                SongTranslation.status != "archived",
            )
        )
    ).all()
    position = 0 if old is not None else (max(taken) + 1 if taken else 0)
    now = datetime.now(UTC)
    row = SongTranslation(
        song_id=payload.song_id,
        language=payload.language,
        kind=payload.kind,
        position=old.position if old is not None else position,
        segments=[s.model_dump(by_alias=True) for s in segments],
        alignment=alignment_of(segments),
        plain_text=plain,
        text_hash=text_hash(plain),
        author_kind=author_kind,
        author_label=(payload.author_label or "").strip() or None,
        source_key=TEAM_SOURCE_KEY,
        # one team text per position keeps the unique import key honest
        source_ref=source_ref or f"team:{now.strftime('%Y%m%d%H%M%S%f')}",
        credit_line=(payload.credit_line or "").strip() or None,
        license_note=(payload.license_note or "").strip() or None,
        trust=payload.trust,
        status="published" if payload.publish else "draft",
        commentary=(payload.commentary or "").strip() or None,
        reviewed_by=by if payload.trust in ("reviewed", "official") else None,
        reviewed_at=now if payload.trust in ("reviewed", "official") else None,
        replaces_id=old.id if old is not None else None,
        published_at=now if payload.publish else None,
    )
    session.add(row)
    if old is not None and payload.publish:
        old.status = "archived"
    await session.commit()
    await session.refresh(row)
    return row


async def verify(
    session: AsyncSession, row: SongTranslation, *, by: str, note: str | None
) -> SongTranslation:
    """Put "Checked" on a text: the team compared it with the Bengali (checker and time)."""
    if row.trust == "machine":
        raise HTTPException(status_code=409, detail="A machine text cannot be checked")
    if row.status != "published":
        raise HTTPException(status_code=409, detail="Only a published text can be checked")
    row.trust = "verified"
    row.verified_by = by
    row.verified_at = datetime.now(UTC)
    row.verified_note = (note or "").strip() or None
    await session.commit()
    await session.refresh(row)
    return row


async def unverify(session: AsyncSession, row: SongTranslation) -> SongTranslation:
    """Take "Checked" off again. The text goes back to what it was before: official or reviewed."""
    if row.trust != "verified":
        raise HTTPException(status_code=409, detail="This text is not marked as checked")
    row.trust = "official" if row.author_kind == "official" else "reviewed"
    row.verified_by = None
    row.verified_at = None
    row.verified_note = None
    await session.commit()
    await session.refresh(row)
    return row


async def archive(session: AsyncSession, row: SongTranslation) -> SongTranslation:
    """Take a text off the song page. It is kept (never deleted), the team can bring it back."""
    row.status = "archived"
    await session.commit()
    await session.refresh(row)
    return row


async def restore(session: AsyncSession, row: SongTranslation) -> SongTranslation:
    if row.status != "archived":
        raise HTTPException(status_code=409, detail="This text is not archived")
    row.status = "published"
    row.published_at = row.published_at or datetime.now(UTC)
    await session.commit()
    await session.refresh(row)
    return row


# --------------------------------------------------------------------------- the import


def split_versions(raw: str | None) -> list[str]:
    """The versions of an official translation. The lyrics page joins a second version to the first
    with a line of dashes; both are kept, in that order."""
    if not raw or not raw.strip():
        return []
    unified = raw.replace("\r\n", "\n").replace("\r", "\n")
    parts = [normalize_text(part) for part in VERSION_SPLIT.split(unified)]
    return [part for part in parts if part]


async def import_official(session: AsyncSession, *, dry_run: bool) -> ImportReport:
    """Official English translations: one row per version of `songs.english_meaning`.

    Idempotent. The key is (song, language, kind, source, reference, position) and the hash of
    the text. A run that finds the same text does nothing. A text that changed upstream is updated
    only while nobody on the team touched the row (not checked, not archived); otherwise it is left
    alone and counted. `songs.english_meaning` is only read.
    """
    report = {
        "songs_with_text": 0,
        "created": 0,
        "updated": 0,
        "unchanged": 0,
        "skipped_team_edited": 0,
        "songs_with_two_versions": 0,
        "songs_with_more_than_two": 0,
    }
    existing: dict[tuple[int, int], SongTranslation] = {}
    for row in (
        await session.scalars(
            select(SongTranslation).where(
                SongTranslation.language == "en",
                SongTranslation.kind == "official",
                SongTranslation.source_key == OFFICIAL_SOURCE_KEY,
            )
        )
    ).all():
        existing[(row.song_id, row.position)] = row

    songs = (
        await session.execute(
            select(Song.number, Song.english_meaning, Song.canonical_source_url)
            .where(Song.english_meaning.is_not(None))
            .order_by(Song.number)
        )
    ).all()
    pending = 0
    now = datetime.now(UTC)
    for number, raw, url in songs:
        versions = split_versions(raw)
        if not versions or not 1 <= number <= 5018:
            continue
        report["songs_with_text"] += 1
        if len(versions) == 2:
            report["songs_with_two_versions"] += 1
        elif len(versions) > 2:
            report["songs_with_more_than_two"] += 1
        for position, text in enumerate(versions):
            digest = text_hash(text)
            current = existing.get((number, position))
            if current is None:
                report["created"] += 1
                if not dry_run:
                    session.add(_official_row(number, position, text, digest, url or "", now))
                    pending += 1
            elif current.text_hash == digest:
                report["unchanged"] += 1
            elif current.verified_by is None and current.status == "published":
                report["updated"] += 1
                if not dry_run:
                    current.segments = [{"from": 0, "to": None, "text": text, "doubt": None}]
                    current.plain_text = text
                    current.text_hash = digest
                    pending += 1
            else:
                report["skipped_team_edited"] += 1
        if pending >= IMPORT_CHUNK:
            await session.commit()
            pending = 0
    if not dry_run and pending:
        await session.commit()
    return ImportReport(dry_run=dry_run, **report)


def _official_row(
    number: int, position: int, text: str, digest: str, url: str, now: datetime
) -> SongTranslation:
    return SongTranslation(
        song_id=number,
        language="en",
        kind="official",
        position=position,
        # one segment over the whole song: the code does not mark lines on its own
        segments=[{"from": 0, "to": None, "text": text, "doubt": None}],
        alignment="whole",
        plain_text=text,
        text_hash=digest,
        author_kind="official",
        author_label="Official lyrics page",
        source_key=OFFICIAL_SOURCE_KEY,
        source_ref=url[:512],
        credit_line=OFFICIAL_CREDIT,
        license_note="Read from songs.english_meaning (the official lyrics page) by the import.",
        trust="official",
        status="published",
        published_at=now,
    )
