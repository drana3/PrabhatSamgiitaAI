from __future__ import annotations

import re
from dataclasses import dataclass

from app.models import Song
from app.services.ai import TextProvider
from app.services.ingestion_language import validate_meaning_language
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

META_COMMENTARY_PATTERNS = (
    r"\bas an ai\b",
    r"\bi (?:cannot|can't) translate\b",
    r"\bhere is the translation\b",
    r"\btranslated (?:from|into)\b",
    r"\bthis translation\b",
    r"\bthe (?:draft|source) (?:meaning|text)\b",
)


@dataclass(frozen=True, slots=True)
class MeaningTranslationAudit:
    passed: bool
    issues: tuple[str, ...]


def audit_meaning_translation(
    source_text: str,
    draft_text: str,
    target_language: str,
) -> MeaningTranslationAudit:
    issues: list[str] = []
    source = source_text.strip()
    draft = draft_text.strip()
    if not draft:
        issues.append("The draft is empty.")
    if len(draft) < max(12, len(source) // 4):
        issues.append("The draft is too short compared with the source meaning.")
    if len(draft) > len(source) * 3 + 120:
        issues.append("The draft is much longer than the source and may add commentary.")

    source_lines = [line for line in source.splitlines() if line.strip()]
    draft_lines = [line for line in draft.splitlines() if line.strip()]
    if len(source_lines) >= 2 and len(draft_lines) < len(source_lines) - 1:
        issues.append("The draft does not preserve the source line structure.")

    if any(re.search(pattern, draft, re.IGNORECASE) for pattern in META_COMMENTARY_PATTERNS):
        issues.append("The draft contains AI or translation meta-commentary.")

    ok, message = validate_meaning_language(target_language, draft)
    if not ok:
        issues.append(message)

    return MeaningTranslationAudit(not issues, tuple(issues))


@dataclass(frozen=True, slots=True)
class MeaningSourceBundle:
    english: str | None
    hindi: str | None
    purport: str | None
    canonical_source_url: str | None
    title: str | None
    first_line: str | None
    transliteration: str | None


def is_english_song_language(value: str | None) -> bool:
    token = (value or "").casefold()
    return "english" in token or token in {"en", "eng"}


def meaning_source_bundle(song: Song) -> MeaningSourceBundle:
    metadata = song.metadata_json or {}
    purport = metadata.get("purport")
    english = (song.english_meaning or "").strip() or None
    if not english and is_english_song_language(song.language):
        english = (
            (song.lyrics_original or "").strip()
            or (song.first_line or "").strip()
            or (song.title or "").strip()
            or None
        )
    return MeaningSourceBundle(
        english=english,
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


def build_meaning_review_prompt(
    song: Song,
    target_language: str,
    *,
    source_text: str,
    source_code: str,
    draft_text: str,
    audit: MeaningTranslationAudit,
) -> str:
    target_code = normalize_language_code(target_language) or target_language.casefold()
    target_label = language_display_name(target_language)
    bundle = meaning_source_bundle(song)
    context_lines = [
        f"Song number: {song.number}",
        f"Title: {bundle.title or ''}",
        f"First line: {bundle.first_line or ''}",
    ]
    if bundle.canonical_source_url:
        context_lines.append(f"Canonical source: {bundle.canonical_source_url}")
    issue_block = (
        "No automated issues were detected, but still verify fidelity and grammar."
        if audit.passed
        else "\n".join(f"- {issue}" for issue in audit.issues)
    )
    return "\n".join(
        [
            "You are a senior reviewer of Prabhat Samgiita meaning translations.",
            FAITHFUL_TRANSLATION_RULES,
            (
                f"Review the DRAFT below against the PRIMARY source "
                f"({source_code}) and produce the best faithful meaning in "
                f"{target_label} ({target_code})."
            ),
            "Reviewer tasks:",
            "1. Keep every idea from the source; remove anything not grounded in the source.",
            "2. Fix grammar, spelling, idioms, and devotional register in the target language.",
            "3. Preserve source line breaks and order when the source is line-by-line.",
            "4. If the draft is already faithful and natural, return it unchanged.",
            "Return only the final meaning text — no JSON, headings, notes, or process text.",
            "Context:",
            "\n".join(context_lines),
            f"PRIMARY source ({source_code}):",
            source_text,
            f"DRAFT ({target_code}):",
            draft_text,
            "Automated review notes:",
            issue_block,
        ]
    )


async def refine_meaning_translation(
    provider: TextProvider,
    *,
    song: Song,
    target_language: str,
    source_text: str,
    source_code: str,
    draft_text: str,
) -> str:
    """Run a reviewer pass so meaning text is faithful and grammatically natural."""
    draft = draft_text.strip()
    if not draft:
        return draft

    audit = audit_meaning_translation(source_text, draft, target_language)
    review_prompt = build_meaning_review_prompt(
        song,
        target_language,
        source_text=source_text,
        source_code=source_code,
        draft_text=draft,
        audit=audit,
    )
    revised_text: str = (await provider.complete(review_prompt)).strip()
    if not revised_text:
        return draft

    revised_audit = audit_meaning_translation(source_text, revised_text, target_language)
    if revised_audit.passed or len(revised_audit.issues) < len(audit.issues):
        return revised_text
    return draft
