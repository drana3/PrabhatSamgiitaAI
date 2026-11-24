"""Map Ananda Marga observance titles to canonical theme collection labels."""

from __future__ import annotations

from app.services.search import CanonicalCollectionMatch, infer_canonical_collection
from app.services.seed_data import load_rows

from app.services.search import normalize_filter_text


def _normalize_observance(value: str) -> str:
    return normalize_filter_text(value)


# Aliases aligned with packages/core/src/festivalCatalogSearch.ts
OBSERVANCE_COLLECTION_ALIASES: dict[str, str] = {
    "new year s day": "Year-end Song",
    "new years day": "Year-end Song",
    "ru day": "AMURT Song",
    "niilakantha divasa": "Dharma Song",
    "nilakantha divasa": "Dharma Song",
    "vasantotsava": "Spring Songs",
    "dadhicii divas": "AMURT Song",
    "dadicii divas": "AMURT Song",
    "kaoshiki divas": "Marching Song",
    "prabhata samgiita divasa": "Classicalised kiirtan-style song",
    "prabhat samgiita divasa": "Classicalised kiirtan-style song",
    "prabhat samgiita day": "Classicalised kiirtan-style song",
    "ps divasa": "Classicalised kiirtan-style song",
    "kiirtana divas": "Classicalised kiirtan-style song",
    "kiirtan divas": "Classicalised kiirtan-style song",
    "fine arts day": "Neo-Humanism Songs",
    "music day": "Classicalised kiirtan-style song",
    "navanna": "Autumn Songs (Sharat)",
    "bhratrdvitiya": "Songs in memory of one's family members",
    "bhratr dvitiya": "Songs in memory of one's family members",
    "navavarsa": "New Year Songs",
    "navavarsh": "New Year Songs",
    "ananda purnima": "Bábá Birthday Songs",
    "ananda purrima": "Bábá Birthday Songs",
    "baba birthday": "Bábá Birthday Songs",
    "prout day": "PROUT Song",
    "shravani purnima": "Shravanii Purnima Day Song",
    "shravanii purnima": "Shravanii Purnima Day Song",
    "vijayotsava": "Victory Day Song",
    "victory day": "Victory Day Song",
    "sharadotsava": "Children Songs",
    "children s day": "Children Songs",
    "public day": "National Day Song (or Song of Love for one's Country)",
    "national day": "National Day Song (or Song of Love for one's Country)",
    "diwali": "Dipavali (Colour Festival) Day Songs",
    "dipavali": "Dipavali (Colour Festival) Day Songs",
    "diipavalii": "Dipavali (Colour Festival) Day Songs",
}

PS_DIVASA_SONG_NUMBERS = frozenset({1, 68, 135, 647, 1418, 4281, 5018})


def infer_observance_collection(query: str) -> CanonicalCollectionMatch | None:
    normalized = _normalize_observance(query)
    if not normalized:
        return None

    label = OBSERVANCE_COLLECTION_ALIASES.get(normalized)
    if not label:
        for alias, collection_label in OBSERVANCE_COLLECTION_ALIASES.items():
            if len(alias) >= 4 and (alias in normalized or normalized in alias):
                label = collection_label
                break
    if not label:
        return None

    rows = load_rows("theme_collections.json")
    for row in rows:
        if str(row.get("label")) != label:
            continue
        numbers = frozenset(int(number) for number in row.get("song_numbers", []))
        if "ps divasa" in normalized or "samgiita divasa" in normalized:
            numbers = PS_DIVASA_SONG_NUMBERS
        if not numbers:
            return None
        return CanonicalCollectionMatch(
            label=label,
            category=str(row.get("category", "festival")),
            value=str(row.get("value", label)),
            song_numbers=numbers,
        )
    return None


def infer_canonical_collection_with_observances(query: str) -> CanonicalCollectionMatch | None:
    existing = infer_canonical_collection(query)
    if existing:
        return existing
    return infer_observance_collection(query)