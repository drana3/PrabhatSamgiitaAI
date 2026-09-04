from __future__ import annotations

import json
import re
from collections.abc import Iterable
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Notation, Song, UserAccount
from app.models.sargam_capture import NotationCapture
from app.services.catalog import CatalogService, refresh_catalog_song
from app.services.notation_links import ANDROMEDA_ARCHIVE

PROTECTED_BOOKLET_SONGS = frozenset({1, 2, 27})
BOOKLET_LATIN = {
    "S": "Sa",
    "r": "re",
    "R": "Re",
    "g": "ga",
    "G": "Ga",
    "m": "ma",
    "M": "Ma",
    "P": "Pa",
    "d": "dha",
    "D": "Dha",
    "n": "ni",
    "N": "Ni",
}


def sargam_attribution_payload(
    metadata: dict[str, Any] | None, status: str | None
) -> dict[str, Any] | None:
    if status != "admin_submitted":
        return None
    name = str((metadata or {}).get("submitted_by_display_name") or "").strip()
    if not name:
        return None
    submitted_at = (metadata or {}).get("submitted_at")
    return {
        "display_name": name,
        "submitted_at": str(submitted_at) if submitted_at else None,
    }


def admin_display_name(member: UserAccount) -> str:
    name = (member.display_name or "").strip()
    if name:
        return name
    email = (member.email or "").strip()
    if "@" in email:
        return email.split("@", 1)[0]
    return "Admin"


def split_lyric_lines(text: str | None) -> list[str]:
    normalized = (text or "").strip()
    if not normalized:
        return []
    by_newline = [line.strip() for line in normalized.splitlines() if line.strip()]
    if len(by_newline) > 1:
        return by_newline
    by_punct = [
        part.strip() for part in re.split(r"\s*(?:\||।|॥|/)\s*", normalized) if part.strip()
    ]
    if len(by_punct) > 1:
        return by_punct
    return by_newline


def is_notation_enabled(metadata: dict[str, Any] | None) -> bool:
    if not metadata or "learner_visible" not in metadata:
        return False
    return bool(metadata.get("learner_visible"))


def is_learner_playable_notation(
    song_number: int,
    verification_status: str | None,
    notation_text: str | None,
    metadata: dict[str, Any] | None = None,
) -> bool:
    if not notation_text or not str(notation_text).strip().startswith("{"):
        return False
    if song_number in PROTECTED_BOOKLET_SONGS:
        return metadata is None or metadata.get("learner_visible") is not False
    if not is_notation_enabled(metadata):
        return False
    if verification_status in {"admin_submitted", "expert_verified"}:
        return True
    return False


def published_sargam_song_numbers(notations: Iterable[Any]) -> set[int]:
    """Learner-playable sargam for Explore — booklet demos plus admin captures."""
    numbers: set[int] = set(PROTECTED_BOOKLET_SONGS)
    for notation in notations:
        if is_learner_playable_notation(
            notation.song_number,
            notation.verification_status,
            notation.notation_text,
            notation.metadata_json,
        ):
            numbers.add(int(notation.song_number))
    return numbers


def duration_beats(duration_sec: float, tempo_bpm: int) -> float:
    beat_sec = 60 / max(1, tempo_bpm)
    return max(0.25, float(duration_sec) / beat_sec)


def booklet_sargam_from_events(
    events: list[dict[str, Any]],
    tempo_bpm: int = 100,
    group_size: int = 4,
) -> str:
    parts: list[str] = []
    cycle = 0
    for event in events:
        token = str(event.get("sargam") or "").replace(".", "").replace("'", "")
        latin = BOOKLET_LATIN.get(token, token or "Sa")
        if str(event.get("sargam") or "").startswith("."):
            latin = f".{latin}"
        beats = max(1, int(round(duration_beats(float(event.get("durationSec") or 1), tempo_bpm))))
        if cycle > 0 and cycle % group_size == 0:
            parts.append("|")
        parts.append(latin)
        for _ in range(1, beats):
            parts.append("á")
        cycle += beats
    return " ".join(parts)


def events_to_notation_line(
    line_number: int,
    lyric: str,
    events: list[dict[str, Any]],
    transliteration: str | None = None,
    tempo_bpm: int = 100,
) -> dict[str, Any]:
    beats = []
    for index, event in enumerate(events, start=1):
        duration = duration_beats(float(event.get("durationSec") or 1), tempo_bpm)
        western = str(event.get("western") or "")
        octave = "middle"
        if western and western[-1:].isdigit():
            number = int(western[-1])
            if number <= 3:
                octave = "lower"
            elif number >= 5:
                octave = "upper"
        beats.append(
            {
                "beat": index,
                "notes": [
                    {
                        "sargam": str(event.get("sargam") or "S"),
                        "western": western or None,
                        "duration": duration,
                        "octave": octave,
                    }
                ],
            }
        )
    return {
        "line_number": line_number,
        "lyrics": lyric,
        "transliteration": transliteration,
        "measures": [{"beats": beats or [{"beat": 1, "notes": []}]}],
    }


def can_submit_lines(lines: list[dict[str, Any]]) -> bool:
    if not lines:
        return False
    return all(str(line.get("status")) == "confirmed" and line.get("events") for line in lines)


def apply_take(
    lines: list[dict[str, Any]],
    line_number: int,
    events: list[dict[str, Any]],
    tempo_bpm: int = 100,
) -> list[dict[str, Any]]:
    updated = []
    found = False
    for line in lines:
        if int(line["line_number"]) != line_number:
            updated.append(line)
            continue
        found = True
        if str(line.get("status")) == "confirmed":
            raise ValueError("Line is already confirmed")
        if not events:
            raise ValueError("Record at least one note")
        updated.append(
            {
                **line,
                "status": "recorded",
                "events": events,
                "sargam": booklet_sargam_from_events(events, tempo_bpm),
            }
        )
    if not found:
        raise ValueError("Line not found")
    return updated


def confirm_line(lines: list[dict[str, Any]], line_number: int) -> list[dict[str, Any]]:
    updated = []
    found = False
    for line in lines:
        if int(line["line_number"]) != line_number:
            updated.append(line)
            continue
        found = True
        if not line.get("events") or str(line.get("status")) == "empty":
            raise ValueError("Record this line before confirming")
        updated.append({**line, "status": "confirmed"})
    if not found:
        raise ValueError("Line not found")
    return updated


def retake_line(lines: list[dict[str, Any]], line_number: int) -> list[dict[str, Any]]:
    updated = []
    found = False
    for line in lines:
        if int(line["line_number"]) != line_number:
            updated.append(line)
            continue
        found = True
        updated.append({**line, "status": "empty", "events": [], "sargam": None})
    if not found:
        raise ValueError("Line not found")
    return updated


def build_published_notation(
    source_scale: str, tempo_bpm: int, lines: list[dict[str, Any]]
) -> dict[str, Any]:
    return {
        "version": 1,
        "source_scale": source_scale,
        "tempo_bpm": tempo_bpm,
        "tala": None,
        "lines": [
            events_to_notation_line(
                int(line["line_number"]),
                str(line.get("lyric") or ""),
                list(line.get("events") or []),
                line.get("lyric_original"),
                tempo_bpm,
            )
            for line in lines
        ],
    }


def _seed_lines(song: Song) -> list[dict[str, Any]]:
    roman = split_lyric_lines(song.transliteration or song.lyrics_original or song.first_line)
    original = split_lyric_lines(song.lyrics_original)
    if not roman and (song.first_line or song.title):
        roman = [(song.first_line or song.title or "").strip()]
    lines = []
    for index, lyric in enumerate(roman, start=1):
        lines.append(
            {
                "line_number": index,
                "lyric": lyric,
                "lyric_original": original[index - 1] if index <= len(original) else None,
                "status": "empty",
                "events": [],
                "sargam": None,
            }
        )
    return lines


async def _song_or_404(session: AsyncSession, number: int) -> Song:
    song = await CatalogService(session).get_song(number)
    if not song:
        raise LookupError("Song not found")
    return song


async def get_or_create_capture(
    session: AsyncSession,
    member: UserAccount,
    song_number: int,
) -> NotationCapture:
    song = await _song_or_404(session, song_number)
    result = await session.execute(
        select(NotationCapture).where(
            NotationCapture.song_number == song_number,
            NotationCapture.admin_id == member.id,
        )
    )
    row = result.scalar_one_or_none()
    if row:
        return row
    row = NotationCapture(
        song_number=song_number,
        admin_id=member.id,
        lines_json=_seed_lines(song),
    )
    session.add(row)
    await session.commit()
    await session.refresh(row)
    return row


def capture_payload(
    song: Song,
    row: NotationCapture,
    notation: Notation | None = None,
    listen_url: str | None = None,
) -> dict[str, Any]:
    lines = list(row.lines_json or [])
    return {
        "song_number": song.number,
        "title": song.title,
        "booklet_locked": song.number in PROTECTED_BOOKLET_SONGS,
        "source_scale": row.source_scale,
        "tempo_bpm": row.tempo_bpm,
        "can_submit": can_submit_lines(lines) and song.number not in PROTECTED_BOOKLET_SONGS,
        "submitted": row.status == "admin_submitted",
        "notation_enabled": is_notation_enabled(notation.metadata_json if notation else None),
        "listen_url": listen_url,
        "lines": lines,
    }


def capture_mutation_payload(
    song: Song,
    row: NotationCapture,
    *,
    line_number: int | None = None,
    notation_enabled: bool | None = None,
) -> dict[str, Any]:
    lines = list(row.lines_json or [])
    payload: dict[str, Any] = {
        "song_number": song.number,
        "source_scale": row.source_scale,
        "tempo_bpm": row.tempo_bpm,
        "can_submit": can_submit_lines(lines) and song.number not in PROTECTED_BOOKLET_SONGS,
        "submitted": row.status == "admin_submitted",
    }
    if line_number is not None:
        line = next(
            (item for item in lines if int(item["line_number"]) == line_number),
            None,
        )
        if line is None:
            raise ValueError("Line not found")
        payload["line"] = line
    if notation_enabled is not None:
        payload["notation_enabled"] = notation_enabled
    return payload


async def save_take(
    session: AsyncSession,
    member: UserAccount,
    song_number: int,
    line_number: int,
    events: list[dict[str, Any]],
    source_scale: str | None = None,
    tempo_bpm: int | None = None,
) -> NotationCapture:
    row = await get_or_create_capture(session, member, song_number)
    row.lines_json = apply_take(
        list(row.lines_json or []),
        line_number,
        events,
        tempo_bpm or row.tempo_bpm,
    )
    if source_scale:
        row.source_scale = source_scale
    if tempo_bpm:
        row.tempo_bpm = tempo_bpm
    await session.commit()
    await session.refresh(row)
    return row


async def confirm_capture_line(
    session: AsyncSession,
    member: UserAccount,
    song_number: int,
    line_number: int,
) -> NotationCapture:
    row = await get_or_create_capture(session, member, song_number)
    row.lines_json = confirm_line(list(row.lines_json or []), line_number)
    await session.commit()
    await session.refresh(row)
    return row


async def retake_capture_line(
    session: AsyncSession,
    member: UserAccount,
    song_number: int,
    line_number: int,
) -> NotationCapture:
    row = await get_or_create_capture(session, member, song_number)
    row.lines_json = retake_line(list(row.lines_json or []), line_number)
    await session.commit()
    await session.refresh(row)
    return row


async def submit_capture(
    session: AsyncSession,
    member: UserAccount,
    song_number: int,
) -> NotationCapture:
    if song_number in PROTECTED_BOOKLET_SONGS:
        raise PermissionError("Songs 1, 2, and 27 already have booklet sargam")
    row = await get_or_create_capture(session, member, song_number)
    lines = list(row.lines_json or [])
    if not can_submit_lines(lines):
        raise ValueError("Confirm every lyric line before submitting")
    payload = build_published_notation(row.source_scale, row.tempo_bpm, lines)
    display = admin_display_name(member)
    submitted_at = datetime.now(UTC).isoformat()
    result = await session.execute(select(Notation).where(Notation.song_number == song_number))
    notation = result.scalar_one_or_none()
    existing_visible = (notation.metadata_json or {}).get("learner_visible") if notation else None
    metadata = {
        "source_kind": "admin_sargam_capture",
        "submitted_by": str(member.id),
        "submitted_by_display_name": display,
        "submitted_at": submitted_at,
        "requires_human_review": False,
        "learner_notice": f"Sargam submitted by {display}",
        "archive_url": ANDROMEDA_ARCHIVE,
        "learner_visible": False if existing_visible is None else bool(existing_visible),
    }
    if notation is None:
        notation = Notation(
            song_number=song_number,
            source_url=ANDROMEDA_ARCHIVE,
            notation_text=json.dumps(payload, ensure_ascii=False),
            scale=row.source_scale,
            verification_status="admin_submitted",
            metadata_json=metadata,
        )
        session.add(notation)
    else:
        notation.notation_text = json.dumps(payload, ensure_ascii=False)
        notation.scale = row.source_scale
        notation.verification_status = "admin_submitted"
        notation.metadata_json = {**(notation.metadata_json or {}), **metadata}
    row.status = "admin_submitted"
    await session.commit()
    await session.refresh(row)
    await refresh_catalog_song(session, song_number)
    return row


async def set_notation_visibility(
    session: AsyncSession,
    song_number: int,
    enabled: bool,
) -> Notation | None:
    await _song_or_404(session, song_number)
    result = await session.execute(select(Notation).where(Notation.song_number == song_number))
    notation = result.scalar_one_or_none()
    snapshot = None if notation else await CatalogService(session).get_notation(song_number)
    source = notation or snapshot
    metadata = {**(source.metadata_json if source else {}), "learner_visible": bool(enabled)}
    if notation is None:
        notation = Notation(
            song_number=song_number,
            source_url=source.source_url if source else ANDROMEDA_ARCHIVE,
            notation_text=source.notation_text if source else None,
            scale=source.scale if source else None,
            verification_status=source.verification_status if source else "pending",
            metadata_json=metadata,
        )
        session.add(notation)
    else:
        notation.metadata_json = metadata
    await session.commit()
    await refresh_catalog_song(session, song_number)
    return notation
