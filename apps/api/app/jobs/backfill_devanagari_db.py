"""Backfill Neon ``songs.lyrics_devanagari`` from packaged ``songs.json``.

Skips English catalogue songs. Does not overwrite ``approved`` / ``pending_review``
unless ``--force``.

    DATABASE_URL=... python -m app.jobs.backfill_devanagari_db --dry-run
    DATABASE_URL=... python -m app.jobs.backfill_devanagari_db
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import re
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

_REPO_ROOT = Path(__file__).resolve().parents[4]
SONGS_JSON = _REPO_ROOT / "data" / "generated" / "songs.json"
PRESERVE = frozenset({"approved", "pending_review"})


def is_english_language(value: str | None) -> bool:
    token = (value or "").strip().lower()
    if not token:
        return False
    if token in {"en", "eng", "english"}:
        return True
    return bool(re.search(r"\benglish\b", token))


async def apply_db(*, dry_run: bool = False, force: bool = False) -> dict[str, Any]:
    if not os.environ.get("DATABASE_URL"):
        raise SystemExit("DATABASE_URL is required")
    if not SONGS_JSON.exists():
        raise SystemExit(f"missing {SONGS_JSON}")

    from sqlalchemy import select

    from app.core.db import SessionLocal
    from app.models import Song

    packaged = {
        int(row["number"]): row
        for row in json.loads(SONGS_JSON.read_text(encoding="utf-8"))
        if isinstance(row.get("number"), int)
    }

    updated = 0
    skipped_english = 0
    skipped_preserve = 0
    skipped_no_source = 0
    already = 0
    total_songs = 0
    numbers: list[int] = []

    async with SessionLocal() as session:
        rows = list((await session.execute(select(Song))).scalars().all())
        total_songs = len(rows)
        for song in rows:
            if is_english_language(song.language):
                skipped_english += 1
                continue
            if (song.lyrics_devanagari or "").strip():
                already += 1
                continue
            status = (song.devanagari_status or "none").strip() or "none"
            if not force and status in PRESERVE:
                skipped_preserve += 1
                continue
            src = packaged.get(int(song.number))
            text = ((src or {}).get("lyrics_devanagari") or "").strip()
            if not text:
                skipped_no_source += 1
                continue
            # Never reintroduce a rule-converted English theme as the last line.
            from app.services.lyrics_theme import strip_trailing_theme_from_devanagari

            meta = song.metadata_json if isinstance(song.metadata_json, dict) else {}
            known_theme = None
            if isinstance(meta, dict) and meta.get("official_theme_label"):
                known_theme = str(meta["official_theme_label"])
            known_theme = known_theme or song.theme
            if src and (src.get("theme") or (src.get("metadata_json") or {}).get("official_theme_label")):
                known_theme = known_theme or src.get("theme") or (
                    (src.get("metadata_json") or {}).get("official_theme_label")
                )
            text = (
                strip_trailing_theme_from_devanagari(
                    song.lyrics_original or (src or {}).get("lyrics_original"),
                    text,
                    known_theme=str(known_theme) if known_theme else None,
                )
                or ""
            ).strip()
            if not text:
                skipped_no_source += 1
                continue
            src_status = ((src or {}).get("devanagari_status") or "provisional").strip()
            if src_status == "none":
                src_status = "provisional"
            updated += 1
            numbers.append(int(song.number))
            if dry_run:
                continue
            song.lyrics_devanagari = text
            if status == "none":
                song.devanagari_status = src_status if src_status in {
                    "provisional",
                    "pending_review",
                    "approved",
                } else "provisional"
            song.updated_at = datetime.now(UTC)
        if not dry_run and updated:
            await session.commit()
        else:
            await session.rollback()

    return {
        "target": "neon",
        "updated": updated,
        "already_had_devanagari": already,
        "skipped_english": skipped_english,
        "skipped_preserve": skipped_preserve,
        "skipped_no_source": skipped_no_source,
        "sample_updated": numbers[:40],
        "dry_run": dry_run,
        "force": force,
        "total_songs": total_songs,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Backfill Neon Devanagari from packaged songs.json (skip English)"
    )
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument(
        "--force",
        action="store_true",
        help="also fill rows marked approved/pending_review when empty",
    )
    args = parser.parse_args(argv)
    summary = asyncio.run(apply_db(dry_run=args.dry_run, force=args.force))
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
