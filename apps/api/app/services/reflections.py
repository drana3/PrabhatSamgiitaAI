from __future__ import annotations

import hashlib
import re
import unicodedata
from datetime import date

from app.models import ReflectionQuote
from app.services.domain_catalog import fixed_reviewed_festival
from app.services.world_context import observance_for_day

FIXED_CONTEXTS = {
    (1, 1): ("new-year", "New Year"),
    (5, 1): ("labour-day", "Labour Day"),
    (8, 15): ("independence-day-india", "India Independence Day"),
    (9, 21): ("international-day-of-peace", "International Day of Peace"),
    (12, 10): ("human-rights-day", "Human Rights Day"),
}

BOOK_SOURCE_MARKERS = (
    "ananda sutram",
    "ananda vacanamrtam",
    "ananda vachanamritam",
    "caryacarya",
    "prout in a nutshell",
)


def _slug(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value.casefold())
    plain = "".join(character for character in normalized if not unicodedata.combining(character))
    return re.sub(r"[^a-z0-9]+", "-", plain).strip("-")


def has_book_provenance(source_title: str) -> bool:
    normalized = unicodedata.normalize("NFKD", source_title.casefold())
    plain = "".join(
        character for character in normalized if not unicodedata.combining(character)
    )
    return any(marker in plain for marker in BOOK_SOURCE_MARKERS)


def reflection_context(day: date, requested_theme: str | None = None) -> tuple[str, str]:
    if requested_theme:
        return _slug(requested_theme), requested_theme
    festival = fixed_reviewed_festival(day.month, day.day, day.year)
    if festival:
        festival_slug = _slug(festival)
        if "birthday" in festival_slug or "ananda" in festival_slug:
            return "ananda-purnima", festival
        return festival_slug, festival
    fixed = FIXED_CONTEXTS.get((day.month, day.day))
    if fixed:
        return fixed
    observance = observance_for_day(day)
    if observance:
        return _slug(observance.title), observance.title
    return "daily-practice", "Daily spiritual reflection"


def select_reflection(
    quotes: list[ReflectionQuote], day: date, requested_theme: str | None = None
) -> tuple[ReflectionQuote | None, str]:
    context_slug, context_label = reflection_context(day, requested_theme)
    eligible = [
        quote
        for quote in quotes
        if quote.is_active and quote.verification_status == "source_verified"
        and has_book_provenance(quote.source_title)
    ]
    if not eligible:
        return None, context_label

    def score(quote: ReflectionQuote) -> tuple[int, str]:
        observances = {
            str(value) for value in (quote.observances or {}).get("values", [])
        }
        themes = {str(value) for value in (quote.themes or {}).get("values", [])}
        exact_observance = 100 if context_slug in observances else 0
        theme_match = 30 if context_slug in {_slug(theme) for theme in themes} else 0
        stable_key = hashlib.sha256(f"{day.isoformat()}:{quote.source_url}".encode()).hexdigest()
        return exact_observance + theme_match, stable_key

    ranked = sorted(eligible, key=score, reverse=True)
    highest = score(ranked[0])[0]
    if highest:
        ranked = [quote for quote in ranked if score(quote)[0] == highest]
    index = int(hashlib.sha256(day.isoformat().encode()).hexdigest(), 16) % len(ranked)
    return ranked[index], context_label
