"""Peel official English theme labels out of lyrics in songs.json and/or Neon.

Also drops the matching trailing Devanagari line when Roman lost a theme line.

    python -m app.jobs.backfill_song_themes
    python -m app.jobs.backfill_song_themes --dry-run
    python -m app.jobs.backfill_song_themes --apply-db
    python -m app.jobs.backfill_song_themes --apply-db --dry-run
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from app.services.lyrics_theme import (
    extract_trailing_english_theme,
    strip_trailing_theme_from_devanagari,
)

_REPO_ROOT = Path(__file__).resolve().parents[4]
SONGS_JSON = _REPO_ROOT / "data" / "generated" / "songs.json"


def backfill_song(song: dict[str, Any]) -> bool:
    """Mutate one song row. Returns True when something changed."""
    roman = song.get("lyrics_original")
    cleaned, theme = extract_trailing_english_theme(roman if isinstance(roman, str) else None)
    meta = dict(song.get("metadata_json") or {})
    known_theme = theme or (str(meta.get("official_theme_label") or "").strip() or None)
    if not known_theme:
        known_theme = (song.get("theme") or "").strip() or None

    changed = False
    if theme and cleaned != (roman or ""):
        song["lyrics_original"] = cleaned or None
        changed = True

    if theme:
        if meta.get("official_theme_label") != theme:
            meta["official_theme_label"] = theme
            song["metadata_json"] = meta
            changed = True

        # Prefer official label when theme is empty; do not clobber collection themes
        # that look different (comma-joined assignments from seed merge).
        current_theme = (song.get("theme") or "").strip()
        if not current_theme:
            song["theme"] = theme
            changed = True
        elif current_theme.lower() == theme.lower():
            if song.get("theme") != theme:
                song["theme"] = theme
                changed = True

    roman_for_strip = cleaned if theme else (roman if isinstance(roman, str) else None)
    dev = song.get("lyrics_devanagari")
    if isinstance(dev, str) and dev.strip():
        stripped_dev = strip_trailing_theme_from_devanagari(
            roman_for_strip,
            dev,
            known_theme=known_theme,
        )
        if stripped_dev != dev:
            song["lyrics_devanagari"] = stripped_dev
            changed = True

    return changed


def apply_json(*, dry_run: bool = False) -> dict[str, Any]:
    songs = json.loads(SONGS_JSON.read_text(encoding="utf-8"))
    updated = 0
    numbers: list[int] = []
    for song in songs:
        if backfill_song(song):
            updated += 1
            if isinstance(song.get("number"), int):
                numbers.append(song["number"])
    if not dry_run and updated:
        SONGS_JSON.write_text(
            json.dumps(songs, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
    return {
        "target": "songs.json",
        "updated": updated,
        "song_numbers": numbers,
        "total_songs": len(songs),
        "dry_run": dry_run,
    }


async def apply_db(*, dry_run: bool = False) -> dict[str, Any]:
    """Peel themes on Neon ``songs`` rows (production or any DATABASE_URL)."""
    if not os.environ.get("DATABASE_URL"):
        raise SystemExit("DATABASE_URL is required for --apply-db")

    from sqlalchemy import select

    from app.core.db import SessionLocal
    from app.models import Song

    updated = 0
    numbers: list[int] = []
    async with SessionLocal() as session:
        rows = list((await session.execute(select(Song))).scalars().all())
        for song in rows:
            payload: dict[str, Any] = {
                "lyrics_original": song.lyrics_original,
                "lyrics_devanagari": song.lyrics_devanagari,
                "theme": song.theme,
                "metadata_json": dict(song.metadata_json or {}),
            }
            if not backfill_song(payload):
                continue
            updated += 1
            numbers.append(int(song.number))
            if dry_run:
                continue
            song.lyrics_original = payload.get("lyrics_original")
            song.lyrics_devanagari = payload.get("lyrics_devanagari")
            song.theme = payload.get("theme")
            song.metadata_json = payload.get("metadata_json") or {}
            # Ensure catalog poll sees the change immediately.
            song.updated_at = datetime.now(UTC)
        if not dry_run and updated:
            await session.commit()
        else:
            await session.rollback()

    return {
        "target": "neon",
        "updated": updated,
        "song_numbers": numbers,
        "total_songs": len(rows),
        "dry_run": dry_run,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Backfill English theme labels from lyrics")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument(
        "--apply-db",
        action="store_true",
        help="Apply peel to Neon (DATABASE_URL) instead of/in addition to songs.json",
    )
    parser.add_argument(
        "--json-too",
        action="store_true",
        help="With --apply-db, also rewrite local songs.json",
    )
    args = parser.parse_args(argv)

    summaries: list[dict[str, Any]] = []
    if args.apply_db:
        summaries.append(asyncio.run(apply_db(dry_run=args.dry_run)))
        if args.json_too:
            if not SONGS_JSON.exists():
                print(f"missing {SONGS_JSON}")
                return 1
            summaries.append(apply_json(dry_run=args.dry_run))
    else:
        if not SONGS_JSON.exists():
            print(f"missing {SONGS_JSON}")
            return 1
        summaries.append(apply_json(dry_run=args.dry_run))

    print(json.dumps(summaries if len(summaries) > 1 else summaries[0], indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
