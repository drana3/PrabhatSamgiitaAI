from __future__ import annotations

from functools import lru_cache

from app.services.seed_data import load_rows

OCCASIONS = [
    {
        "slug": "morning-meditation",
        "name": "Morning Meditation",
        "category": "meditation",
        "description": "Songs suited to a calm morning practice.",
    },
    {
        "slug": "evening-meditation",
        "name": "Evening Meditation",
        "category": "meditation",
        "description": "Songs suited to evening reflection.",
    },
    {
        "slug": "dharma-cakra",
        "name": "Dharma Cakra",
        "category": "meditation",
        "description": "Collective meditation and spiritual gathering.",
    },
    {
        "slug": "collective-gathering",
        "name": "Collective Gathering",
        "category": "program",
        "description": "Songs for collective gatherings and programmes.",
    },
    {
        "slug": "children-programme",
        "name": "Children's Programme",
        "category": "program",
        "description": "Songs for children's cultural programmes.",
    },
    {
        "slug": "service-programme",
        "name": "Service Programme",
        "category": "service",
        "description": "Songs for service and welfare programmes.",
    },
    {
        "slug": "spiritual-retreat",
        "name": "Spiritual Retreat",
        "category": "retreat",
        "description": "Songs for retreats and extended spiritual practice.",
    },
    {
        "slug": "environmental-programme",
        "name": "Environmental Programme",
        "category": "service",
        "description": "Songs connected with ecology and care for life.",
    },
    {
        "slug": "marriage",
        "name": "Marriage",
        "category": "life-event",
        "description": "Reviewed songs for a marriage setting when available.",
    },
    {
        "slug": "memorial",
        "name": "Memorial",
        "category": "life-event",
        "description": "Reviewed songs for remembrance when available.",
    },
]


@lru_cache(maxsize=1)
def canonical_festivals() -> list[dict[str, object]]:
    counts: dict[str, int] = {}
    sources: dict[str, set[str]] = {}
    for row in load_rows("songs.json"):
        assignment = (row.get("metadata_json") or {}).get("canonical_theme_assignments") or {}
        for festival in assignment.get("festivals", []):
            counts[festival] = counts.get(festival, 0) + 1
            sources.setdefault(festival, set()).update(assignment.get("source_urls", []))
    return [
        {
            "slug": "-".join(name.lower().replace("á", "a").split()),
            "name": name,
            "song_count": counts[name],
            "verification_status": "canonical_source",
            "source_urls": sorted(sources.get(name, set())),
        }
        for name in sorted(counts)
    ]


def season_for_month(month: int) -> str:
    if month in {12, 1, 2}:
        return "winter"
    if month in {3, 4, 5}:
        return "spring"
    if month in {6, 7, 8, 9}:
        return "monsoon"
    return "autumn"


def time_of_day(hour: int) -> str:
    if 4 <= hour < 12:
        return "morning"
    if 12 <= hour < 17:
        return "afternoon"
    if 17 <= hour < 22:
        return "evening"
    return "night"


def fixed_reviewed_festival(month: int, day: int) -> str | None:
    # The composer's birthday is a fixed civil-calendar observance. Lunar dates
    # are intentionally not guessed; they must come from reviewed calendar data.
    return "Bábá Birthday" if (month, day) == (5, 21) else None
