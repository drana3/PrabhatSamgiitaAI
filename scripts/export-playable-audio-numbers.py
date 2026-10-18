#!/usr/bin/env python3
"""Export PS numbers with official prabhatasamgiita.net audio for the mobile app."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INVENTORY = ROOT / "data" / "generated" / "inventory.json"
OUTPUT = ROOT / "apps" / "mobile" / "assets" / "playable-audio-numbers.json"
MAX_NUMBER = 5018


def main() -> None:
    rows = json.loads(INVENTORY.read_text(encoding="utf-8"))
    numbers: set[int] = set()
    for row in rows:
        if row.get("source_kind") != "audio" or row.get("status") != "active":
            continue
        url = str(row.get("url") or "")
        if "prabhatasamgiita.net" not in url:
            continue
        name = url.rsplit("/", 1)[-1]
        match = re.match(r"^(\d+)", name)
        if not match:
            continue
        number = int(match.group(1))
        if 1 <= number <= MAX_NUMBER:
            numbers.add(number)
    ordered = sorted(numbers)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(ordered) + "\n", encoding="utf-8")
    print(
        json.dumps(
            {
                "playable_count": len(ordered),
                "catalog_total": MAX_NUMBER,
                "output": str(OUTPUT.relative_to(ROOT)),
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
