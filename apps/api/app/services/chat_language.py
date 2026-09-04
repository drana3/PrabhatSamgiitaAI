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
REGIONAL_LANGUAGE_NAMES = (
    "magahi",
    "maithili",
    "bengali",
    "bangla",
    "urdu",
    "tamil",
    "telugu",
    "marathi",
    "punjabi",
    "gujarati",
    "odia",
    "oriya",
    "assamese",
    "nepali",
    "sanskrit",
    "kannada",
    "malayalam",
)
REGIONAL_LANGUAGE_PATTERN = re.compile(
    rf"\b(?:in|into|to)\s+(?:{'|'.join(REGIONAL_LANGUAGE_NAMES)})\b|"
    rf"\b(?:{'|'.join(REGIONAL_LANGUAGE_NAMES)})\s+me(?:in|ṃ|in)?\b",
    re.IGNORECASE,
)
LANGUAGE_ONLY = re.compile(
    r"^(?:"
    r"(?:in|into|to)\s+(?:hindi|english|bengali|urdu|magahi|maithili|tamil|telugu|marathi|punjabi|gujarati|nepali|odia|assamese|sanskrit|kannada|malayalam)|"
    r"(?:hindi|english|bengali|urdu|magahi|maithili)\s+me(?:in|ṃ|in)?|"
    r"(?:hindi|english)\s+me(?:in|ṃ|in)?\s+batao|"
    r"translate(?:d)?\s+(?:to|in)\s+(?:hindi|english|magahi|maithili|bengali|urdu)"
    r")\s*[?.!]*$",
    re.IGNORECASE,
)


def prefers_devanagari_hindi(query: str) -> bool:
    """Prefer Devanagari for Hindi replies unless the user wrote Romanized Hindi."""
    cleaned = query.strip()
    if not cleaned:
        return True
    if re.search(r"[\u0900-\u097F]", cleaned):
        return True
    # Explicit "in hindi" / "translate to hindi" → proper Devanagari explanation.
    if EXPLICIT_HINDI.search(cleaned) and not ROMANIZED_HINDI.search(
        re.sub(r"\bhindi\b", " ", cleaned, flags=re.IGNORECASE)
    ):
        return True
    if ROMANIZED_HINDI.search(cleaned):
        return False
    return True


def explicit_target_language_label(text: str) -> str | None:
    cleaned = text.strip()
    if not cleaned:
        return None
    match = re.search(
        rf"\b(?:in|into|to)\s+({'|'.join(REGIONAL_LANGUAGE_NAMES)})\b",
        cleaned,
        re.IGNORECASE,
    )
    if match:
        return match.group(1).title()
    match = re.search(
        rf"\b({'|'.join(REGIONAL_LANGUAGE_NAMES)})\s+me(?:in|ṃ|in)?\b",
        cleaned,
        re.IGNORECASE,
    )
    if match:
        return match.group(1).title()
    return None


def explicit_response_language(text: str) -> str | None:
    cleaned = text.strip()
    if not cleaned:
        return None
    if EXPLICIT_ENGLISH.search(cleaned):
        return "en"
    if EXPLICIT_HINDI.search(cleaned):
        return "hi"
    if explicit_target_language_label(cleaned):
        return "other"
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


def _established_language_from_history(history: list[tuple[str, str]] | None) -> str | None:
    """Conversation language locked by prior user turns (explicit request or first clear choice)."""
    established: str | None = None
    for role, content in history or []:
        if role != "user":
            continue
        explicit = explicit_response_language(content)
        if explicit:
            established = explicit
            continue
        if is_language_rephrase(content):
            continue
        language = _detect_text_language(content)
        if language != "en":
            established = language
        elif established is None and not re.fullmatch(r"\d{1,4}", content.strip()):
            established = "en"
    return established


def detect_response_language(query: str, history: list[tuple[str, str]] | None = None) -> str:
    cleaned = query.strip()
    explicit = explicit_response_language(cleaned)
    if explicit:
        return explicit

    established = _established_language_from_history(history)
    current = _detect_text_language(cleaned)
    if current != "en":
        return current

    if established:
        return established

    if re.fullmatch(r"\d{1,4}", cleaned):
        return "en"
    return current


def conversation_language_from_user_messages(messages: list[str]) -> str:
    if not messages:
        return "en"
    history = [("user", message) for message in messages[:-1]]
    return detect_response_language(messages[-1], history)
