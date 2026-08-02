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


REVIEWED_FESTIVAL_DATES_2026 = {
    (1, 25): "R.U. Day",
    (2, 12): "Niilakanth'a Divasa",
    (3, 4): "Vasantotsava",
    (3, 5): "Dadhicii Divas",
    (4, 14): "Navavarsa",
    (5, 1): "Ánanda Purnimá",
    (6, 5): "PROUT Day",
    (8, 28): "Shrávanii Purnimá",
    (9, 6): "Kaoshiki Divas",
    (9, 14): "Prabháta Saḿgiita Divasa",
    (10, 1): "Sharadotsava",
    (10, 2): "Public Day",
    (10, 3): "Fine Arts Day",
    (10, 4): "Music Day",
    (10, 5): "Vijayotsava",
    (10, 8): "Kiirtana Divas",
    (10, 25): "Navánna",
    (11, 8): "Diipavalii",
    (11, 11): "Bhrátrdvitiiyá",
}

REVIEWED_FESTIVAL_COLLECTIONS_2026: dict[tuple[int, int], dict[str, str]] = {
    (3, 4): {"season": "spring", "meditation_context": "Vasantotsava"},
    (4, 14): {"festival": "New Year", "meditation_context": "Navavarsa"},
    (5, 1): {"festival": "Bábá Birthday", "meditation_context": "Ánanda Purnimá"},
    (6, 5): {"theme": "PROUT", "meditation_context": "PROUT Day"},
    (8, 28): {
        "festival": "Shravanii Purnima Day",
        "meditation_context": "Shrávanii Purnimá",
    },
    (10, 1): {"season": "autumn", "theme": "Children"},
    (10, 5): {"festival": "Victory Day", "meditation_context": "Vijayotsava"},
    (11, 8): {
        "festival": "Dipavali (Colour Festival) Day",
        "meditation_context": "Diipavalii",
    },
}

# Only collections whose source explicitly associates songs with the observance
# may be presented as festival-specific homepage recommendations.
REVIEWED_FESTIVAL_COLLECTION_LABELS_2026: dict[tuple[int, int], tuple[str, ...]] = {
    (4, 14): ("New Year Songs",),
    (5, 1): ("Bábá Birthday Songs",),
    (6, 5): ("PROUT Song",),
    (8, 28): ("Shravanii Purnima Day Song",),
    (10, 5): ("Victory Day Song",),
    (11, 8): ("Dipavali (Colour Festival) Day Songs",),
}

FIXED_FESTIVAL_COLLECTION_LABELS: dict[tuple[int, int], tuple[str, ...]] = {
    (5, 21): ("Bábá Birthday Songs",),
}


def fixed_reviewed_festival(month: int, day: int, year: int | None = None) -> str | None:
    # Bábá's birthday is a fixed civil-calendar observance. Other entries are
    # year-specific because lunar and festival dates must never be guessed.
    if (month, day) == (5, 21):
        return "Bábá Birthday"
    if year == 2026:
        return REVIEWED_FESTIVAL_DATES_2026.get((month, day))
    return None


def reviewed_festival_context(month: int, day: int, year: int) -> dict[str, str]:
    title = fixed_reviewed_festival(month, day, year)
    if not title:
        return {}
    return {
        "title": title,
        **REVIEWED_FESTIVAL_COLLECTIONS_2026.get((month, day), {}),
    }


def reviewed_festival_collection_labels(
    month: int, day: int, year: int
) -> tuple[str, ...]:
    if not fixed_reviewed_festival(month, day, year):
        return ()
    fixed = FIXED_FESTIVAL_COLLECTION_LABELS.get((month, day))
    if fixed:
        return fixed
    if year == 2026:
        return REVIEWED_FESTIVAL_COLLECTION_LABELS_2026.get((month, day), ())
    return ()


def reviewed_festival_song_numbers(month: int, day: int, year: int) -> tuple[int, ...]:
    labels = set(reviewed_festival_collection_labels(month, day, year))
    if not labels:
        return ()
    return tuple(
        sorted(
            {
                int(number)
                for row in load_rows("theme_collections.json")
                if str(row.get("label")) in labels
                for number in row.get("song_numbers", [])
            }
        )
    )
