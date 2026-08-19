#!/usr/bin/env python3
"""Build a compact lyric search payload for the mobile app (normalized body + display titles)."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps" / "api"))

from app.services.lyric_search import _record_from_song  # noqa: E402
from app.services.catalog import catalog_song_snapshot  # noqa: E402

OUT = ROOT / "data" / "generated" / "lyric_search_index.json"


def main() -> None:
    rows = []
    for song in catalog_song_snapshot():
        record = _record_from_song(song)
        rows.append(
            {
                "n": record.number,
                "t": (song.title or "").strip(),
                "o": (song.first_line or song.title or "").strip(),
                "b": record.body,
            }
        )
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(rows, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"wrote {len(rows)} songs -> {OUT} ({OUT.stat().st_size / 1e6:.2f} MB)")


if __name__ == "__main__":
    main()
