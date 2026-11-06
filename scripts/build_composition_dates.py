#!/usr/bin/env python3
"""Compact table of composition dates for the mobile app ("composed on this day").

Reads data/generated/songs.json (metadata_json.date, as printed on the official lyrics pages, day/month/year)
and writes data/generated/composition_dates.json, indexed by the calendar day:

    {"version": 1, "byDay": {"9-14": [[1, 1982], [233, 1983], ...], ...}}

Only dates that are a real calendar date in 1900 to 2100 are kept (the same rule as parseCompositionDate in
apps/mobile/lib/songPage/aboutFacts.ts). A song whose date is damaged in the source ("28/9/82", "15/14?/06/1983",
"4/10/10984") is left out: nothing is repaired or guessed.
"""

from __future__ import annotations

import datetime
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SONGS_PATH = ROOT / "data" / "generated" / "songs.json"
OUT_PATH = ROOT / "data" / "generated" / "composition_dates.json"
PATTERN = re.compile(r"^\s*(\d{1,2})/(\d{1,2})/(\d{4})\s*$")


def parse(raw: object) -> tuple[int, int, int] | None:
    if not isinstance(raw, str):
        return None
    match = PATTERN.match(raw)
    if not match:
        return None
    day, month, year = (int(part) for part in match.groups())
    if year < 1900 or year > 2100:
        return None
    try:
        datetime.date(year, month, day)
    except ValueError:
        return None
    return year, month, day


def main() -> None:
    songs = json.loads(SONGS_PATH.read_text(encoding="utf-8"))
    by_day: dict[str, list[list[int]]] = {}
    for song in songs:
        parsed = parse((song.get("metadata_json") or {}).get("date"))
        if not parsed:
            continue
        year, month, day = parsed
        by_day.setdefault(f"{month}-{day}", []).append([int(song["number"]), year])
    for rows in by_day.values():
        rows.sort(key=lambda row: (row[1], row[0]))
    ordered = {key: by_day[key] for key in sorted(by_day, key=lambda k: tuple(int(p) for p in k.split("-")))}
    OUT_PATH.write_text(json.dumps({"version": 1, "byDay": ordered}, separators=(",", ":")) + "\n", encoding="utf-8")
    total = sum(len(rows) for rows in ordered.values())
    print(f"{total} songs with a usable composition date, {len(ordered)} calendar days -> {OUT_PATH.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
