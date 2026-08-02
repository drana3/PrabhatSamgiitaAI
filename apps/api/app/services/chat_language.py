from __future__ import annotations

import re

INDIC_SCRIPT = re.compile(
    r"[\u0900-\u097F\u0980-\u09FF\u0A80-\u0AFF\u0B00-\u0B7F\u0B80-\u0BFF"
    r"\u0C00-\u0C7F\u0C80-\u0CFF\u0D00-\u0D7F\u0A00-\u0A7F]"
)
ROMANIZED_HINDI = re.compile(
    r"\b(?:gaane|gaana|gana|arth|matlab|batao|bataiye|samjha|samjhaiye|kya|hai|"
    r"mera|tum|aap|pyar|prem|bhakti|shanti|prashn|pichhla|hindi|hindustani|"
    r"sandarbh|bhav|ruhani|adhyatmik)\b",
    re.IGNORECASE,
)


def detect_response_language(query: str, history: list[tuple[str, str]] | None = None) -> str:
    for role, content in reversed(history or []):
        if role != "user":
            continue
        language = _detect_text_language(content)
        if language != "en":
            return language
    return _detect_text_language(query)


def _detect_text_language(text: str) -> str:
    cleaned = text.strip()
    if not cleaned:
        return "en"
    if re.search(r"[\u0900-\u097F]", cleaned):
        return "hi"
    if INDIC_SCRIPT.search(cleaned):
        return "other"
    if ROMANIZED_HINDI.search(cleaned):
        return "hi"
    return "en"
