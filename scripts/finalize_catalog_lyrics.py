#!/usr/bin/env python3
"""Apply the standard lyrics pipeline to packaged songs.json (no HTML re-scrape)."""
from __future__ import annotations

import json
import sys
from pathlib import Path

_REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(_REPO / "apps" / "api"))
sys.path.insert(0, str(_REPO / "scripts"))

from sync_prabhata import (  # noqa: E402
    finalize_catalog_song_row,
    preserve_catalog_enrichment,
    write_json,
)

SONGS = _REPO / "data" / "generated" / "songs.json"


def main() -> None:
    rows = json.loads(SONGS.read_text(encoding="utf-8"))
    rows = [finalize_catalog_song_row(dict(row)) for row in rows]
    rows = preserve_catalog_enrichment(rows, SONGS)
    rows = [finalize_catalog_song_row(dict(row)) for row in rows]
    write_json(SONGS, rows)
    print(f"Finalized lyrics for {len(rows)} songs → {SONGS}")


if __name__ == "__main__":
    main()