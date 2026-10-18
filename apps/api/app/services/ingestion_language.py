from __future__ import annotations

import re

from app.services.chat_language import _detect_text_language

SUPPORTED_LANGUAGES = {
    "en",
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
    "ar",
    "zh",
    "nl",
    "fr",
    "de",
    "id",
    "it",
    "ja",
    "ko",
    "fa",
    "pl",
    "pt",
    "ru",
    "si",
    "es",
    "sw",
    "th",
    "tr",
    "vi",
}

SCRIPT_PATTERNS: dict[str, re.Pattern[str]] = {
    "hi": re.compile(r"[\u0900-\u097F]"),
    "bn": re.compile(r"[\u0980-\u09FF]"),
    "ta": re.compile(r"[\u0B80-\u0BFF]"),
    "ur": re.compile(r"[\u0600-\u06FF]"),
    "gu": re.compile(r"[\u0A80-\u0AFF]"),
    "kn": re.compile(r"[\u0C80-\u0CFF]"),
    "ml": re.compile(r"[\u0D00-\u0D7F]"),
    "mr": re.compile(r"[\u0900-\u097F]"),
    "ne": re.compile(r"[\u0900-\u097F]"),
    "or": re.compile(r"[\u0B00-\u0B7F]"),
    "pa": re.compile(r"[\u0A00-\u0A7F]"),
    "sa": re.compile(r"[\u0900-\u097F]"),
    "te": re.compile(r"[\u0C00-\u0C7F]"),
    "ar": re.compile(r"[\u0600-\u06FF]"),
    "zh": re.compile(r"[\u4E00-\u9FFF]"),
    "ja": re.compile(r"[\u3040-\u30FF\u4E00-\u9FFF]"),
    "ko": re.compile(r"[\uAC00-\uD7AF]"),
    "ru": re.compile(r"[\u0400-\u04FF]"),
    "th": re.compile(r"[\u0E00-\u0E7F]"),
}


def validate_meaning_language(language: str, text: str) -> tuple[bool, str]:
    # Lazy import avoids a circular dependency with song_meanings.
    from app.services.song_meanings import normalize_language_code

    code = normalize_language_code(language) or language.strip().casefold()
    cleaned = text.strip()
    if not cleaned:
        return True, ""
    if code not in SUPPORTED_LANGUAGES:
        return False, f"Unsupported language code: {language}"

    if code == "en":
        detected = _detect_text_language(cleaned)
        if detected == "hi":
            return False, "Text looks like Hindi but English was selected"
        if detected == "other":
            return False, "Text appears to use a non-Latin script but English was selected"
        return True, ""

    pattern = SCRIPT_PATTERNS.get(code)
    if pattern and not pattern.search(cleaned):
        return (
            False,
            f"Text does not appear to match the selected language ({language})",
        )
    return True, ""
