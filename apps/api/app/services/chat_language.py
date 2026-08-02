from __future__ import annotations

import re

INDIC_SCRIPT = re.compile(
    r"[\u0900-\u097F\u0980-\u09FF\u0A80-\u0AFF\u0B00-\u0B7F\u0B80-\u0BFF"
    r"\u0C00-\u0C7F\u0C80-\u0CFF\u0D00-\u0D7F\u0A00-\u0A7F]"
)
ROMANIZED_HINDI = re.compile(
    r"\b(?:"
    r"gaane|gaana|gana|arth|matlab|batao|bataiye|bataiy|samjha|samjhaiye|samjh|"
    r"kya|hai|mera|tum|aap|pyar|prem|bhakti|shanti|prashn|pichhla|pichle|"
    r"hindi|hindustani|sandarbh|bhav|ruhani|adhyatmik|dhyan|uchcharan|"
    r"anuvad|bhasha|bhaasha"
    r")\b",
    re.IGNORECASE,
)
EXPLICIT_HINDI = re.compile(
    r"(?:"
    r"\b(?:in|into|to)\s+hindi\b|"
    r"\bhindi\s+me(?:in|ṃ|in)?\b|"
    r"\bhindi\s+(?:language|version|me)\b|"
    r"\btranslate(?:d)?\s+(?:to|in)\s+hindi\b|"
    r"[\u0900-\u097F].*[\u0900-\u097F]|"
    r"हिन्दी|हिंदी"
    r")",
    re.IGNORECASE,
)
EXPLICIT_ENGLISH = re.compile(
    r"\b(?:in|into|to)\s+english\b|\benglish\s+(?:me(?:in|ṃ|in)?|language|version)\b",
    re.IGNORECASE,
)
LANGUAGE_ONLY = re.compile(
    r"^(?:"
    r"(?:in|into|to)\s+(?:hindi|english|bengali|urdu)|"
    r"(?:hindi|english|bengali|urdu)\s+me(?:in|ṃ|in)?|"
    r"(?:hindi|english)\s+me(?:in|ṃ|in)?\s+batao|"
    r"translate(?:d)?\s+(?:to|in)\s+(?:hindi|english)"
    r")\s*[?.!]*$",
    re.IGNORECASE,
)
AMBIGUOUS_FOLLOW_UP = re.compile(
    r"^(?:yes|no|ok|okay|more|continue|why|thanks|thank you|sure|please)\s*[?.!]*$",
    re.IGNORECASE,
)


def explicit_response_language(text: str) -> str | None:
    cleaned = text.strip()
    if not cleaned:
        return None
    if EXPLICIT_ENGLISH.search(cleaned):
        return "en"
    if EXPLICIT_HINDI.search(cleaned):
        return "hi"
    return None


def is_language_rephrase(query: str) -> bool:
    return LANGUAGE_ONLY.match(query.strip()) is not None


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


def _inherits_language_from_history(query: str) -> bool:
    cleaned = query.strip()
    if not cleaned:
        return False
    if is_language_rephrase(cleaned):
        return True
    if _detect_text_language(cleaned) != "en":
        return False
    if re.fullmatch(r"\d{1,4}", cleaned):
        return False
    return AMBIGUOUS_FOLLOW_UP.fullmatch(cleaned) is not None


def detect_response_language(query: str, history: list[tuple[str, str]] | None = None) -> str:
    explicit = explicit_response_language(query)
    if explicit:
        return explicit

    current = _detect_text_language(query)
    if current != "en":
        return current

    if not _inherits_language_from_history(query):
        return "en"

    for role, content in reversed(history or []):
        if role != "user":
            continue
        language = _detect_text_language(content)
        if language != "en":
            return language
        return "en"

    return "en"


def conversation_language_from_user_messages(messages: list[str]) -> str:
    if not messages:
        return "en"
    latest = messages[-1].strip()
    if not latest:
        return "en"
    explicit = explicit_response_language(latest)
    if explicit:
        return explicit
    current = _detect_text_language(latest)
    if current != "en" or not _inherits_language_from_history(latest):
        return current
    for prior in reversed(messages[:-1]):
        language = _detect_text_language(prior)
        if language != "en":
            return language
    return "en"
