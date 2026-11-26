#!/usr/bin/env python3
"""Ensure Magahi Songs language collection (catalog metadata; no official index page)."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COLLECTIONS_PATH = ROOT / "data" / "generated" / "theme_collections.json"
SONGS_PATH = ROOT / "data" / "generated" / "songs.json"
MAGAHI_SONGS = (4513,)


def _magahi_numbers(songs: list[dict]) -> list[int]:
    numbers: list[int] = []
    for row in songs:
        category = str((row.get("metadata_json") or {}).get("category") or "").lower()
        anchor = str((row.get("metadata_json") or {}).get("anchor") or "").lower()
        if "magah" in category or "magah" in anchor:
            numbers.append(int(row["number"]))
    return sorted(set(numbers) | set(MAGAHI_SONGS))


def main() -> None:
    songs = json.loads(SONGS_PATH.read_text(encoding="utf-8"))
    numbers = _magahi_numbers(songs)
    if numbers != list(MAGAHI_SONGS):
        print(f"Magahi catalogue drift: expected {MAGAHI_SONGS}, metadata scan {numbers}", file=sys.stderr)

    magahi_row = {
        "label": "Magahi Songs",
        "category": "language",
        "value": "Magahi",
        "source_url": "https://prabhatasamgiita.net/1-5018.htm",
        "song_numbers": numbers,
        "count": len(numbers),
    }

    collections = json.loads(COLLECTIONS_PATH.read_text(encoding="utf-8"))
    out: list[dict] = []
    inserted = False
    for row in collections:
        label = str(row.get("label") or "")
        if label == "Magahi Songs":
            if not inserted:
                out.append(magahi_row)
                inserted = True
            continue
        out.append(row)
        if label == "Maethili Song" and not inserted:
            out.append(magahi_row)
            inserted = True
    if not inserted:
        out.append(magahi_row)

    COLLECTIONS_PATH.write_text(
        json.dumps(out, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"Magahi Songs: {len(numbers)} {numbers}")


if __name__ == "__main__":
    main()