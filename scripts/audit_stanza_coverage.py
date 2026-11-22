#!/usr/bin/env python3
"""Audit Roman lyric stanza gaps across the full PS catalogue.

Compares packaged ``data/generated/songs.json`` against post-processed lyrics
(``sanitize_catalog_lyrics_text`` / ``infer_stanza_blank_lines``) so we can
track .net-style paragraph breaks before release.

Usage:
    uv run --directory apps/api python scripts/audit_stanza_coverage.py
    uv run --directory apps/api python scripts/audit_stanza_coverage.py --json report.json
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

_REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(_REPO / "apps" / "api"))

from app.services.catalog_lyrics import (  # noqa: E402
    language_labels_from_metadata,
    sanitize_catalog_lyrics_text,
)

SONGS_JSON = _REPO / "data" / "generated" / "songs.json"


def stanza_gap_count(text: str) -> int:
    return sum(1 for line in text.split("\n") if not line.strip())


def main() -> None:
    parser = argparse.ArgumentParser(description="Audit stanza gaps for all PS lyrics")
    parser.add_argument("--json", type=Path, help="Write detailed report JSON")
    parser.add_argument("--limit", type=int, default=0, help="Only scan first N songs (debug)")
    args = parser.parse_args()

    songs = json.loads(SONGS_JSON.read_text(encoding="utf-8"))
    if args.limit:
        songs = songs[: args.limit]

    with_lyrics = 0
    gained_gaps = 0
    already_gapped = 0
    still_flat = 0
    examples_flat: list[int] = []

    for row in songs:
        raw = (row.get("lyrics_original") or "").strip()
        if not raw:
            continue
        with_lyrics += 1
        labels = language_labels_from_metadata(row.get("metadata_json"))
        prepared = sanitize_catalog_lyrics_text(
            raw,
            language=row.get("language"),
            language_labels=labels,
        )
        before = stanza_gap_count(raw)
        after = stanza_gap_count(prepared)
        if before > 0:
            already_gapped += 1
        elif after > 0:
            gained_gaps += 1
        else:
            still_flat += 1
            if len(examples_flat) < 25:
                examples_flat.append(int(row["number"]))

    summary = {
        "songs_total": len(songs),
        "with_lyrics": with_lyrics,
        "already_had_stanza_blanks": already_gapped,
        "inferred_stanza_blanks": gained_gaps,
        "still_no_stanza_gaps": still_flat,
        "coverage_with_gaps": round(
            (already_gapped + gained_gaps) / with_lyrics * 100, 2
        )
        if with_lyrics
        else 0.0,
        "examples_still_flat": examples_flat,
    }

    print(json.dumps(summary, indent=2, ensure_ascii=False))
    if args.json:
        args.json.write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"Wrote {args.json}", file=sys.stderr)

    if still_flat:
        sys.exit(1)


if __name__ == "__main__":
    main()