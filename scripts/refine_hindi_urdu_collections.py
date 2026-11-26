#!/usr/bin/env python3
"""Make Hindi Songs and Urdu Songs disjoint via scored language verification."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps" / "api"))
from app.services.hindi_urdu_language import (  # noqa: E402
    partition_collections_from_verification,
    verify_all_hindi_urdu,
    write_verification_report,
)

COLLECTIONS_PATH = ROOT / "data" / "generated" / "theme_collections.json"


def main() -> None:
    verified = verify_all_hindi_urdu(apply_llm_merge=True)
    write_verification_report(verified)
    hindi_numbers, urdu_numbers = partition_collections_from_verification(verified)

    collections = json.loads(COLLECTIONS_PATH.read_text(encoding="utf-8"))
    by_label = {str(row["label"]): row for row in collections}
    hindi_row = by_label["Hindi Songs"]
    urdu_row = by_label["Urdu Songs"]

    hindi_row["song_numbers"] = hindi_numbers
    hindi_row["count"] = len(hindi_numbers)
    urdu_row["song_numbers"] = urdu_numbers
    urdu_row["count"] = len(urdu_numbers)

    COLLECTIONS_PATH.write_text(
        json.dumps(collections, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    low = sum(1 for row in verified if row.confidence == "low")
    print(
        f"Hindi Songs: {hindi_row['count']} · Urdu Songs: {urdu_row['count']} "
        f"({len(verified)} verified; {low} low-confidence)"
    )
    print(f"Wrote {ROOT / 'data/generated/hindi_urdu_language_verification.json'}")


if __name__ == "__main__":
    main()