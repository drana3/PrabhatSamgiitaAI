#!/usr/bin/env python3
"""Precompute mobile theme/category song lists for fast mood browse.

UI category chips (Songs tab) stay limited to a small visible set.
Common devotion/theme aliases resolve to those lists.

Catalog search (lyrics, song numbers, “Search Prabhat Samgiita for …”)
stays on the normal catalog API — already fast; do not replace it here.

Output: data/generated/mobile_category_songs.json
Also writes data/generated/complete_sargam_songs.json for website Explore.
"""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SONGS_PATH = ROOT / "data" / "generated" / "songs.json"
COLLECTIONS_PATH = ROOT / "data" / "generated" / "theme_collections.json"
PLAN_PATH = ROOT / "data" / "generated" / "sarkarverse_sargam_plan.json"
OUT_PATH = ROOT / "data" / "generated" / "mobile_category_songs.json"
COMPLETE_SARGAM_PATH = ROOT / "data" / "generated" / "complete_sargam_songs.json"
COLLECTION_TITLES_PATH = ROOT / "data" / "generated" / "collection_song_titles.json"

# Visible only on mobile Songs-tab CategoryGrid.
UI_CATEGORY_IDS = [
    "devotional",
    "nature",
    "love",
    "meditation",
    "morning",
    "evening",
    "rain",
    "festival",
    "guru",
    "peace",
]

# Theme chips only — languages / named collections use catalog search.
SEARCH_COLLECTION_LABELS: dict[str, list[str]] = {
    "devotional": [
        "Shiva Songs",
        "Krśńa Songs",
        "Krśńa and Devotees Songs",
        "Dharma Song",
        "Classicalised kiirtan-style song",
        "Neo-Humanism Songs",
        "Song with sanyasii spirit",
    ],
    "nature": [
        "Himalaya Songs",
        "River Songs",
        "Song for a Dust Particle",
        "Song for a Dewdrop",
        "Tree Planting Ceremony Song",
        "Spring Songs",
        "Summer Songs",
        "Autumn Songs (Sharat)",
        "Autumn Songs (Hemante)",
        "Winter Songs",
        "Rainy Season Songs",
        "Dry Season Songs",
    ],
    "love": [
        "National Day Song (or Song of Love for one's Country)",
        "Marriage Ceremony Song",
        "Women Songs",
    ],
    "meditation": [
        "Neo-Humanism Songs",
        "Guru Sakasha Song",
        "Classicalised kiirtan-style song",
        "Song with sanyasii spirit",
        "Dharma Song",
    ],
    "morning": ["Spring Songs", "Songs composed in Baba's youth"],
    "evening": ["Autumn Songs (Sharat)", "Autumn Songs (Hemante)", "Winter Songs"],
    "rain": [
        "Rainy Season Songs",
        "Songs to Attract Rain / Draught Songs / Farmer's Songs",
    ],
    "festival": [],  # filled from festival collections
    "guru": [
        "Gurukula Song",
        "Guru Sakasha Song",
        "Bábá Birthday Songs",
        "Ánanda Nagar Song",
        "Classicalised kiirtan-style song",
        "Song with sanyasii spirit",
    ],
    "peace": ["Neo-Humanism Songs", "PROUT Song", "AMURT Song"],
}

SEARCH_KEYWORDS: dict[str, list[str]] = {
    "devotional": [
        "devotion",
        "devotee",
        "devotees",
        "devotional",
        "bhakti",
        "bhajan",
        "bhajans",
        "kirtan",
        "kiirtan",
        "kiirtana",
        "worship",
        "prayer",
        "prayers",
        "divine",
        "lord",
        "prabhu",
        "god",
        "spiritual",
        "spirituality",
        "sacred",
        "holy",
        "praise",
        "hymn",
        "surrender",
        "offering",
        "adoration",
        "reverence",
        "puja",
        "aarti",
        "arati",
        "sadhana",
        "ishta",
        "nama",
        "namah",
        "bliss",
        "grace",
        "blessing",
        "faith",
        "soul",
    ],
    "nature": [
        "nature",
        "river",
        "sky",
        "earth",
        "forest",
        "flower",
        "bird",
        "mountain",
        "tree",
        "cloud",
        "garden",
        "breeze",
        "ocean",
        "sea",
        "leaf",
    ],
    "love": ["love", "beloved", "heart", "affection", "dear", "romance", "friend"],
    "meditation": [
        "meditation",
        "meditate",
        "mind",
        "silence",
        "still",
        "quiet",
        "inner",
        "contempl",
        "dhyan",
    ],
    "morning": ["morning", "dawn", "sunrise", "daybreak", "early", "awakening", "awake"],
    "evening": ["evening", "dusk", "sunset", "twilight", "nightfall", "night"],
    "rain": ["rain", "monsoon", "cloud", "shower", "storm", "drought", "farmer"],
    "festival": [
        "festival",
        "celebration",
        "birthday",
        "diwali",
        "dipavali",
        "new year",
        "victory",
    ],
    "guru": [
        "guru",
        "baba",
        "master",
        "teacher",
        "gurukula",
        "sakasha",
        "sadguru",
        "gurudev",
        "guruji",
        "preceptor",
        "anandamurti",
        "ananda murti",
    ],
    "peace": ["peace", "peaceful", "calm", "harmony", "tranqu", "serene", "gentle", "stress", "anxious"],
    "harmonium": [],
}

SEARCH_LABELS = {
    "devotional": "Devotional",
    "nature": "Nature",
    "love": "Love",
    "meditation": "Meditation",
    "morning": "Morning",
    "evening": "Evening",
    "rain": "Rain",
    "festival": "Festival",
    "guru": "Guru",
    "peace": "Peace",
}

MAX_KEYWORD_HITS = 80


def haystack(song: dict) -> str:
    parts = [
        song.get("title") or "",
        song.get("first_line") or "",
        song.get("transliteration") or "",
        song.get("english_meaning") or "",
        song.get("hindi_meaning") or "",
        song.get("theme") or "",
        song.get("mood") or "",
        song.get("occasion") or "",
        song.get("festival") or "",
        song.get("season") or "",
        song.get("meditation_context") or "",
    ]
    return " ".join(str(part) for part in parts).lower()


def roman_sargam_numbers() -> list[int]:
    """Songs with Roman RS_* sargam. Bengali PDF sources are excluded."""
    if not PLAN_PATH.exists():
        return []
    plan = json.loads(PLAN_PATH.read_text(encoding="utf-8"))
    numbers = [
        int(number)
        for number, row in (plan.get("songs") or {}).items()
        if int(number) > 0 and str((row or {}).get("script") or "") == "roman"
    ]
    return sorted(set(numbers))


def complete_notation_entry(_songs: list[dict]) -> dict:
    numbers = roman_sargam_numbers()
    return {
        "label": "Full Sargam",
        "ui": False,
        "collection_labels": [],
        "song_numbers": numbers,
        "curated_count": len(numbers),
        "total_count": len(numbers),
    }


def complete_sargam_web_payload(songs: list[dict]) -> dict:
    entry = complete_notation_entry(songs)
    by_number = {int(song["number"]): song for song in songs}
    summaries = []
    for number in entry["song_numbers"]:
        song = by_number.get(number, {})
        summaries.append(
            {
                "number": number,
                "title": song.get("title") or f"Song {number}",
                "first_line": song.get("first_line"),
                "theme": song.get("theme"),
                "mood": song.get("mood"),
                "language": song.get("language"),
                "is_verified": bool(song.get("is_verified")),
            }
        )
    return {
        "label": "Full Sargam",
        "query": "full sargam",
        "count": len(summaries),
        "songs": summaries,
        "note": "Roman RS_* sargam only. Bengali PDF sources are not listed.",
    }


def build_entry(
    search_id: str,
    collection_labels: list[str],
    by_label: dict[str, list[int]],
    song_text: dict[int, str],
    by_number: dict[int, dict],
) -> dict:
    curated: set[int] = set()
    for label in collection_labels:
        curated.update(by_label.get(label, []))

    keywords = SEARCH_KEYWORDS.get(search_id, [])
    scored: list[tuple[int, int]] = []
    for number, text in song_text.items():
        if number in curated:
            continue
        hits = sum(1 for keyword in keywords if keyword in text)
        if hits:
            scored.append((hits, number))
    scored.sort(key=lambda item: (-item[0], item[1]))
    keyword_nums = [number for _, number in scored[:MAX_KEYWORD_HITS]]

    ordered: list[int] = []
    seen: set[int] = set()
    for number in [*sorted(curated), *keyword_nums]:
        if number in seen:
            continue
        seen.add(number)
        ordered.append(number)

    return {
        "label": SEARCH_LABELS[search_id],
        "ui": search_id in UI_CATEGORY_IDS,
        "collection_labels": collection_labels,
        "song_numbers": ordered,
        "songs": song_summaries(ordered, by_number),
        "curated_count": len(curated),
        "total_count": len(ordered),
    }


def write_collection_titles(collections: list[dict], by_number: dict[int, dict]) -> None:
    """Titles for verified collection lists so mobile rows are not 'Song 123'."""
    numbers: set[int] = set()
    for row in collections:
        for raw in row.get("song_numbers") or []:
            number = int(raw)
            if number > 0:
                numbers.add(number)
    payload = {
        str(number): {
            "title": (by_number.get(number) or {}).get("title")
            or (by_number.get(number) or {}).get("first_line")
            or f"Song {number}",
            "first_line": (by_number.get(number) or {}).get("first_line"),
        }
        for number in sorted(numbers)
    }
    COLLECTION_TITLES_PATH.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"collection titles {len(payload):3} -> {COLLECTION_TITLES_PATH}")


def song_summaries(numbers: list[int], by_number: dict[int, dict]) -> list[dict]:
    """Titles shipped with the app so theme chips do not need the live catalog."""
    summaries = []
    for number in numbers:
        song = by_number.get(number, {})
        summaries.append(
            {
                "number": number,
                "title": song.get("title") or f"Song {number}",
                "first_line": song.get("first_line"),
                "theme": song.get("theme"),
                "mood": song.get("mood"),
                "language": song.get("language"),
                "is_verified": bool(song.get("is_verified")),
            }
        )
    return summaries


def main() -> None:
    songs = json.loads(SONGS_PATH.read_text(encoding="utf-8"))
    collections = json.loads(COLLECTIONS_PATH.read_text(encoding="utf-8"))
    by_label = {
        str(row["label"]): [int(n) for n in row.get("song_numbers", [])]
        for row in collections
    }

    labels = dict(SEARCH_COLLECTION_LABELS)
    labels["festival"] = [
        str(row["label"]) for row in collections if row.get("category") == "festival"
    ]

    song_text = {int(song["number"]): haystack(song) for song in songs}
    by_number = {int(song["number"]): song for song in songs}
    searches: dict[str, dict] = {}
    for search_id, collection_labels in labels.items():
        entry = build_entry(search_id, collection_labels, by_label, song_text, by_number)
        searches[search_id] = entry
        print(f"ui {search_id:14} curated={entry['curated_count']:3} total={entry['total_count']:3}")

    write_collection_titles(collections, by_number)

    complete_sargam = complete_sargam_web_payload(songs)
    COMPLETE_SARGAM_PATH.write_text(
        json.dumps(complete_sargam, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"web Full Sargam   count={complete_sargam['count']:3} -> {COMPLETE_SARGAM_PATH}")

    payload = {
        "version": 4,
        "ui_category_ids": UI_CATEGORY_IDS,
        "categories": {cid: searches[cid] for cid in UI_CATEGORY_IDS},
        "searches": searches,
        "note": "Theme/mood lists only. Catalog (lyrics, numbers, collections) stays on API search.",
    }
    OUT_PATH.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {OUT_PATH} ({len(searches)} theme searches)")


if __name__ == "__main__":
    main()
