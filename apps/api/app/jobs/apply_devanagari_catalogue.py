"""Apply rule-based Devanagari catalogue into songs.json as provisional.

Does **not** overwrite songs that are already ``approved`` or ``pending_review``
unless ``--force`` is passed.

    python -m app.jobs.apply_devanagari_catalogue
    python -m app.jobs.apply_devanagari_catalogue --force
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parents[4]
SONGS_JSON = _REPO_ROOT / "data" / "generated" / "songs.json"
CATALOGUE_JSON = _REPO_ROOT / "data" / "generated" / "transliteration_catalogue.json"

PRESERVE = {"approved", "pending_review"}


def apply(*, force: bool = False) -> dict[str, int]:
    songs = json.loads(SONGS_JSON.read_text(encoding="utf-8"))
    catalogue = json.loads(CATALOGUE_JSON.read_text(encoding="utf-8"))
    by_number = {s["song_number"]: s for s in catalogue.get("songs", [])}

    updated = skipped_preserve = missing = 0
    for song in songs:
        number = song.get("number")
        cat = by_number.get(number)
        if not cat:
            missing += 1
            continue
        current_status = song.get("devanagari_status") or "none"
        if not force and current_status in PRESERVE:
            skipped_preserve += 1
            continue
        text = (cat.get("devanagari") or {}).get("text")
        if not text:
            continue
        song["lyrics_devanagari"] = text
        song["devanagari_status"] = "provisional"
        meta = dict(song.get("metadata_json") or {})
        meta["devanagari"] = {
            "origin": "rule_based",
            "ruleset_version": catalogue.get("ruleset_version"),
            "engine_version": catalogue.get("engine_version"),
            "verification_status": (cat.get("provenance") or {}).get("verification_status"),
        }
        song["metadata_json"] = meta
        updated += 1

    SONGS_JSON.write_text(
        json.dumps(songs, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return {
        "updated": updated,
        "skipped_preserve": skipped_preserve,
        "missing_in_catalogue": missing,
        "total_songs": len(songs),
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Apply Devanagari catalogue to songs.json")
    parser.add_argument(
        "--force",
        action="store_true",
        help="overwrite approved/pending_review songs too",
    )
    args = parser.parse_args(argv)
    if not CATALOGUE_JSON.exists():
        print(f"catalogue missing: {CATALOGUE_JSON}")
        print("Run: python -m app.jobs.import_prabhata_catalogue --export-json")
        return 1
    summary = apply(force=args.force)
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
