from __future__ import annotations

import json
from functools import lru_cache
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Song
from app.services.catalog import catalog_song_snapshot
from app.services.seed_data import DATA_DIR, load_rows

RAGA_COLLECTIONS_PATH = DATA_DIR / "generated" / "raga_collections.json"
SONGS_PATH = DATA_DIR / "generated" / "songs.json"
MAX_SONG_NUMBER = 5018


@lru_cache(maxsize=1)
def load_raga_collections() -> tuple[dict[str, Any], ...]:
    if not RAGA_COLLECTIONS_PATH.exists():
        return ()
    rows = json.loads(RAGA_COLLECTIONS_PATH.read_text(encoding="utf-8"))
    if not isinstance(rows, list):
        return ()
    return tuple(_normalize_row(row) for row in rows if isinstance(row, dict))


def clear_raga_collections_cache() -> None:
    load_raga_collections.cache_clear()


def _normalize_row(row: dict[str, Any]) -> dict[str, Any]:
    label = str(row.get("label") or "").strip()
    value = str(row.get("value") or label).strip() or label
    numbers = sorted(
        {
            int(number)
            for number in row.get("song_numbers") or []
            if isinstance(number, int | float | str) and str(number).strip().isdigit()
        }
    )
    numbers = [number for number in numbers if 1 <= number <= MAX_SONG_NUMBER]
    description = row.get("description")
    return {
        "label": label,
        "category": "raga",
        "value": value,
        "description": (
            description if isinstance(description, str) and description.strip() else None
        ),
        "song_numbers": numbers,
        "count": len(numbers),
    }


def save_raga_collections(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    normalized = [_normalize_row(row) for row in rows if str(row.get("label") or "").strip()]
    if not normalized:
        raise ValueError("At least one raga collection is required")
    labels = [row["label"] for row in normalized]
    if len(labels) != len(set(labels)):
        raise ValueError("Raga collection labels must be unique")
    RAGA_COLLECTIONS_PATH.parent.mkdir(parents=True, exist_ok=True)
    RAGA_COLLECTIONS_PATH.write_text(
        json.dumps(normalized, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    clear_raga_collections_cache()
    return normalized


def known_song_numbers() -> frozenset[int]:
    return frozenset(song.number for song in catalog_song_snapshot())


def parse_song_numbers(raw: list[int]) -> tuple[list[int], list[int], list[int]]:
    """Return (valid, out_of_range, unknown_catalog)."""
    wanted = sorted({int(value) for value in raw})
    out_of_range = [number for number in wanted if number < 1 or number > MAX_SONG_NUMBER]
    in_range = [number for number in wanted if 1 <= number <= MAX_SONG_NUMBER]
    known = known_song_numbers()
    unknown = [number for number in in_range if number not in known]
    valid = [number for number in in_range if number in known]
    return valid, out_of_range, unknown


def raga_metadata_conflicts(
    session_songs: dict[int, Song | None],
    *,
    song_numbers: list[int],
    raga_label: str,
) -> list[dict[str, Any]]:
    conflicts: list[dict[str, Any]] = []
    for number in song_numbers:
        song = session_songs.get(number)
        existing = (song.raga if song else None) or None
        if existing and existing.strip() and existing.strip() != raga_label.strip():
            conflicts.append(
                {
                    "song_number": number,
                    "existing_raga": existing,
                    "new_raga": raga_label,
                }
            )
    return conflicts


def patch_songs_json_raga(updates: dict[int, str | None]) -> None:
    if not updates or not SONGS_PATH.exists():
        return
    rows = json.loads(SONGS_PATH.read_text(encoding="utf-8"))
    touched = False
    for row in rows:
        number = row.get("number")
        if number in updates:
            row["raga"] = updates[number]
            touched = True
    if touched:
        SONGS_PATH.write_text(
            json.dumps(rows, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        load_rows.cache_clear()


async def load_songs_for_numbers(
    session: AsyncSession, numbers: list[int]
) -> dict[int, Song | None]:
    if not numbers:
        return {}
    rows = (
        await session.execute(select(Song).where(Song.number.in_(numbers)))
    ).scalars().all()
    by_number = {song.number: song for song in rows}
    return {number: by_number.get(number) for number in numbers}


async def apply_raga_metadata(
    session: AsyncSession,
    *,
    song_numbers: list[int],
    raga_label: str,
) -> list[int]:
    """Set ``Song.raga`` and mirror into songs.json. Returns updated numbers."""
    songs_map = await load_songs_for_numbers(session, song_numbers)
    updated: list[int] = []
    json_updates: dict[int, str | None] = {}
    for number in song_numbers:
        song = songs_map.get(number)
        if song is None:
            continue
        song.raga = raga_label
        updated.append(number)
        json_updates[number] = raga_label
    if json_updates:
        patch_songs_json_raga(json_updates)
    return updated


def upsert_raga_row(
    *,
    label: str,
    song_numbers: list[int],
    description: str | None = None,
    value: str | None = None,
) -> dict[str, Any]:
    rows = [dict(row) for row in load_raga_collections()]
    payload = _normalize_row(
        {
            "label": label,
            "value": value or label,
            "description": description,
            "song_numbers": song_numbers,
        }
    )
    replaced = False
    for index, row in enumerate(rows):
        if row["label"] == payload["label"]:
            rows[index] = payload
            replaced = True
            break
    if not replaced:
        rows.append(payload)
    rows.sort(key=lambda row: row["label"].casefold())
    save_raga_collections(rows)
    return payload


def delete_raga_row(label: str) -> bool:
    rows = [dict(row) for row in load_raga_collections()]
    next_rows = [row for row in rows if row["label"] != label]
    if len(next_rows) == len(rows):
        return False
    save_raga_collections(next_rows)
    return True