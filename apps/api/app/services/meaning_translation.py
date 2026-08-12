from __future__ import annotations

from dataclasses import dataclass

from app.models import Song
from app.services.song_meanings import (
    LANGUAGE_LABELS,
    language_display_name,
    normalize_language_code,
)

# Prefer Hindi as the bridge for Indic-language meaning work when it exists in the catalog.
INDIC_BRIDGE_LANGUAGE_CODES = frozenset(
    {
        "hi",
        "bn",
        "ta",
        "ur",
        "mai",
        "mag",
        "as",
        "gu",
        "kn",
        "ml",
        "mr",
        "ne",
        "or",
        "pa",
        "sa",
        "te",
    }
)

FAITHFUL_TRANSLATION_RULES = """
You translate verified Prabhat Samgiita meaning text for devotees.
Rules:
1. Translate ONLY what the source says. Do not add interpretation, commentary,
   theology, or new imagery.
2. Preserve the devotional tone and spiritual register of the source.
3. Use correct, natural grammar and spelling in the target language.
4. If the source is line-by-line, keep the same line breaks and order.
5. Do not mention song numbers, AI, translation, or your process.
6. When both Hindi and English sources are provided, treat Hindi as the closer
   authority for Indic targets.
""".strip()


@dataclass(frozen=True, slots=True)
class MeaningSourceBundle:
    english: str | None
    hindi: str | None
    purport: str | None
    canonical_source_url: str | None
    title: str | None
    first_line: str | None
    transliteration: str | None


def meaning_source_bundle(song: Song) -> MeaningSourceBundle:
    metadata = song.metadata_json or {}
    purport = metadata.get("purport")
    return MeaningSourceBundle(
        english=(song.english_meaning or "").strip() or None,
        hindi=(song.hindi_meaning or "").strip() or None,
        purport=purport.strip() if isinstance(purport, str) and purport.strip() else None,
        canonical_source_url=(song.canonical_source_url or "").strip() or None,
        title=(song.title or "").strip() or None,
        first_line=(song.first_line or "").strip() or None,
        transliteration=(song.transliteration or "").strip() or None,
    )


def pick_meaning_source(
    song: Song,
    target_language: str,
    *,
    english_override: str | None = None,
) -> tuple[str, str]:
    """Return (source_text, source_language_code) for meaning translation."""
    target_code = normalize_language_code(target_language) or target_language.casefold()
    if english_override and english_override.strip():
        return english_override.strip(), "en"

    bundle = meaning_source_bundle(song)
    if target_code == "hi" and bundle.hindi:
        return bundle.hindi, "hi"
    if target_code in INDIC_BRIDGE_LANGUAGE_CODES and bundle.hindi:
        return bundle.hindi, "hi"
    if bundle.english:
        return bundle.english, "en"
    if bundle.hindi:
        return bundle.hindi, "hi"
    return "", ""


def _source_language_label(code: str) -> str:
    return LANGUAGE_LABELS.get(code, code)


def build_meaning_translation_prompt(
    song: Song,
    target_language: str,
    *,
    english_override: str | None = None,
) -> str:
    target_code = normalize_language_code(target_language) or target_language.casefold()
    target_label = language_display_name(target_language)
    source_text, source_code = pick_meaning_source(
        song,
        target_language,
        english_override=english_override,
    )
    if not source_text:
        raise ValueError("No source meaning available for translation.")

    bundle = meaning_source_bundle(song)
    context_lines = [
        f"Song number: {song.number}",
        f"Title: {bundle.title or ''}",
        f"First line: {bundle.first_line or ''}",
    ]
    if bundle.transliteration:
        context_lines.append(f"Transliteration: {bundle.transliteration}")
    if bundle.canonical_source_url:
        context_lines.append(f"Canonical source: {bundle.canonical_source_url}")
    if bundle.purport:
        context_lines.append(
            f"Purport (reference only; do not invent beyond this): {bundle.purport}"
        )
    if bundle.hindi and source_code != "hi":
        context_lines.append(f"Hindi meaning (reference): {bundle.hindi}")
    if bundle.english and source_code != "en":
        context_lines.append(f"English meaning (reference): {bundle.english}")

    return "\n".join(
        [
            FAITHFUL_TRANSLATION_RULES,
            (
                f"Translate the PRIMARY source meaning below from "
                f"{_source_language_label(source_code)} ({source_code}) into "
                f"{target_label} ({target_code})."
            ),
            "Return only the translated meaning text — no JSON, no commentary, no headings.",
            "Context (for fidelity only; translate the PRIMARY source, not a rewrite of context):",
            "\n".join(context_lines),
            f"PRIMARY source ({source_code}):",
            source_text,
        ]
    )


def build_localization_prompt(
    song: Song,
    target_language: str,
    explanation: str | None = None,
) -> str:
    target_code = normalize_language_code(target_language) or target_language.casefold()
    target_label = language_display_name(target_language)
    bundle = meaning_source_bundle(song)
    source_text, source_code = pick_meaning_source(song, target_language)
    source_block = source_text or bundle.english or bundle.hindi or ""
    if not source_block:
        raise ValueError("No source meaning available for localization.")

    context_lines = [
        f"Song number: {song.number}",
        f"Title: {bundle.title or ''}",
        f"First line: {bundle.first_line or ''}",
        f"Transliteration: {bundle.transliteration or ''}",
        f"English meaning: {bundle.english or ''}",
        f"Hindi meaning: {bundle.hindi or ''}",
        f"Purport: {bundle.purport or ''}",
        f"Canonical source: {bundle.canonical_source_url or ''}",
        f"Grounded explanation (translate faithfully if present): {explanation or ''}",
        f"PRIMARY meaning source ({source_code}): {source_block}",
    ]
    return "\n".join(
        [
            FAITHFUL_TRANSLATION_RULES,
            f"Localize this Prabhat Samgiita song into {target_label} ({target_code}).",
            "Return only valid JSON with these keys:",
            "localized_title, localized_first_line, localized_meaning, localized_explanation",
            "Field rules:",
            "- localized_meaning: faithful translation of the PRIMARY meaning source only.",
            (
                "- localized_title / localized_first_line: translate only when natural; "
                "otherwise keep source text."
            ),
            (
                "- localized_explanation: faithful translation of the grounded explanation, "
                "or null if absent."
            ),
            "Do not add facts or devotional commentary beyond the source.",
            "Source material:",
            "\n".join(line for line in context_lines if line.split(":", 1)[-1].strip()),
        ]
    )
