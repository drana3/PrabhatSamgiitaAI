#!/usr/bin/env python3
"""Build a compact lyric search payload for web + mobile.

Fields:
  n — song number
  t — display title
  o — opening / first line
  b — normalized romanized lyrics (never English meaning)
  e — optional normalized English meaning (separate lexical field)
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps" / "api"))

from app.services.lyric_search import _record_from_song, normalize_lyric_text  # noqa: E402
from app.services.catalog import catalog_song_snapshot  # noqa: E402

OUT = ROOT / "data" / "generated" / "lyric_search_index.json"
# Cap meaning text so the shared JSON stays mobile-friendly (~+1MB vs lyrics-only).
MEANING_CHAR_CAP = 240


def _meaning_field(song) -> str | None:
    raw = (song.english_meaning or "").strip()
    if not raw:
        return None
    # Prefer the first blank-line paragraph; verse lines use single newlines.
    paragraph = raw.split("\n\n", 1)[0].strip()
    normalized = normalize_lyric_text(paragraph.replace("\n", " "))
    if len(normalized) < 8:
        return None
    if len(normalized) > MEANING_CHAR_CAP:
        normalized = normalized[:MEANING_CHAR_CAP].rsplit(" ", 1)[0].strip()
    return normalized or None


def main() -> None:
    rows = []
    with_meaning = 0
    for song in catalog_song_snapshot():
        record = _record_from_song(song)
        row = {
            "n": record.number,
            "t": (song.title or "").strip(),
            "o": (song.first_line or song.title or "").strip(),
            "b": record.body,
        }
        meaning = _meaning_field(song)
        if meaning:
            row["e"] = meaning
            with_meaning += 1
        rows.append(row)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(rows, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(
        f"wrote {len(rows)} songs ({with_meaning} with meaning) -> {OUT} "
        f"({OUT.stat().st_size / 1e6:.2f} MB)"
    )


if __name__ == "__main__":
    main()
