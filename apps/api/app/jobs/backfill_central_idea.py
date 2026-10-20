"""Backfill songs.central_idea from metadata.purport / glued meaning labels.

Catalog-only (songs table / songs.json). Does not touch user data.

    python -m app.jobs.backfill_central_idea
    python -m app.jobs.backfill_central_idea --dry-run
    python -m app.jobs.backfill_central_idea --apply-db
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

CENTRAL_IDEA_LABEL_RE = re.compile(
    r"(?is)^(.*?)\n?(central\s*idea|purport)\s*:\s*(.*)$"
)


def peel_central_idea_from_meaning(meaning: str | None) -> tuple[str | None, str | None]:
    """If meaning contains a Central idea / Purport label, split it out."""
    text = (meaning or "").strip()
    if not text:
        return None, None
    match = CENTRAL_IDEA_LABEL_RE.match(text)
    if not match:
        return text or None, None
    before = (match.group(1) or "").strip() or None
    idea = (match.group(3) or "").strip() or None
    return before, idea


def backfill_song(song: dict[str, Any]) -> bool:
    changed = False
    meta = dict(song.get("metadata_json") or {})
    current = (song.get("central_idea") or "").strip() or None
    purport = meta.get("purport")
    purport_text = purport.strip() if isinstance(purport, str) else None

    meaning, glued = peel_central_idea_from_meaning(
        song.get("english_meaning") if isinstance(song.get("english_meaning"), str) else None
    )
    if glued:
        if (song.get("english_meaning") or "").strip() != (meaning or ""):
            song["english_meaning"] = meaning
            changed = True
        if not current:
            current = glued
            song["central_idea"] = glued
            changed = True

    if not current and purport_text:
        song["central_idea"] = purport_text
        current = purport_text
        changed = True

    if current and meta.get("purport") != current:
        meta["purport"] = current
        song["metadata_json"] = meta
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
    with_idea = sum(1 for s in songs if (s.get("central_idea") or "").strip())
    return {
        "target": "songs.json",
        "updated": updated,
        "with_central_idea": with_idea,
        "song_numbers": numbers[:40],
        "dry_run": dry_run,
    }


async def apply_db(*, dry_run: bool = False) -> dict[str, Any]:
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
                "english_meaning": song.english_meaning,
                "central_idea": getattr(song, "central_idea", None),
                "metadata_json": dict(song.metadata_json or {}),
            }
            if not backfill_song(payload):
                continue
            updated += 1
            numbers.append(int(song.number))
            if dry_run:
                continue
            song.english_meaning = payload.get("english_meaning")
            song.central_idea = payload.get("central_idea")
            song.metadata_json = payload.get("metadata_json") or {}
            song.updated_at = datetime.now(UTC)
        if not dry_run and updated:
            await session.commit()
        else:
            await session.rollback()

    return {
        "target": "neon",
        "updated": updated,
        "song_numbers": numbers[:40],
        "dry_run": dry_run,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Backfill central_idea from purport")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--apply-db", action="store_true")
    parser.add_argument("--json-too", action="store_true")
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
