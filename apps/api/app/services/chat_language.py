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


DEFAULT_PREFERRED_LANGUAGE = "english"


def normalize_preferred_language(value: str | None) -> str | None:
    if not value:
        return None
    cleaned = value.strip().casefold()
    if cleaned in {"en", "english"}:
        return "en"
    if cleaned in {"hi", "hindi", "hin", "devanagari"}:
        return "hi"
    if cleaned in REGIONAL_LANGUAGE_NAMES:
        return "other"
    return None


def resolve_preferred_language(value: str | None) -> str:
    return normalize_preferred_language(value) or "en"


def language_companion_hint(language: str) -> str:
    if language == "hi":
        return 'Replying in Hindi · say "in English" to switch'
    if language == "other":
        return 'Replying in your chosen language · say "in English" to switch'
    return 'Replying in English · say "in Hindi" to switch'


def language_switch_acknowledgment(
    prior: str | None,
    target: str,
    *,
    target_label: str | None = None,
) -> str:
    if prior == target:
        if target == "hi":
            return (
                "हम पहले से हिंदी में बात कर रहे हैं। "
                "इस गीत के बारे में आप क्या जानना चाहेंगे?"
            )
        if target == "en":
            return (
                "We're already chatting in English. "
                "What would you like to explore about this song?"
            )
        return (
            "I'll keep replying in your chosen language. "
            "What would you like to ask about this song?"
        )
    if target == "hi":
        return (
            "ठीक है — अब मैं हिंदी में उत्तर दूँगा। "
            "इस गीत के बारे में आप क्या जानना चाहेंगे?"
        )
    if target == "en":
        return (
            "Sure — I'll continue in English. "
            "What would you like to explore about this song?"
        )
    label = target_label or "your chosen language"
    return f"Sure — I'll continue in {label}. What would you like to explore about this song?"


def is_one_shot_language_request(query: str) -> bool:
    """Substantive ask with an embedded language (e.g. explain in Punjabi) — one answer only."""
    cleaned = query.strip()
    if not cleaned or is_language_rephrase(cleaned):
        return False
    return explicit_response_language(cleaned) is not None


def session_language(
    history: list[tuple[str, str]] | None,
    *,
    preferred_language: str | None = None,
) -> str:
    established = _established_language_from_history(history)
    if established:
        return established
    return resolve_preferred_language(preferred_language)


def _established_language_from_history(history: list[tuple[str, str]] | None) -> str | None:
    """Session language from language-only switches or writing habit — not one-shot requests."""
    established: str | None = None
    for role, content in history or []:
        if role != "user":
            continue
        if is_one_shot_language_request(content):
            continue
        if is_language_rephrase(content):
            explicit = explicit_response_language(content)
            if explicit:
                established = explicit
            continue
        language = _detect_text_language(content)
        if language != "en":
            established = language
        elif established is None and not re.fullmatch(r"\d{1,4}", content.strip()):
            established = "en"
    return established


def established_language_from_history(
    history: list[tuple[str, str]] | None,
) -> str | None:
    return _established_language_from_history(history)


def detect_response_language(
    query: str,
    history: list[tuple[str, str]] | None = None,
    *,
    preferred_language: str | None = None,
) -> str:
    cleaned = query.strip()
    explicit = explicit_response_language(cleaned)
    if explicit and is_one_shot_language_request(cleaned):
        return explicit

    if is_language_rephrase(cleaned) and explicit:
        return explicit

    current = _detect_text_language(cleaned)
    if current != "en":
        return current

    return session_language(history, preferred_language=preferred_language)


def conversation_language_from_user_messages(
    messages: list[str],
    *,
    preferred_language: str | None = None,
) -> str:
    if not messages:
        return resolve_preferred_language(preferred_language)
    latest = messages[-1].strip()
    if is_one_shot_language_request(latest):
        history = [("user", message) for message in messages[:-1]]
        return session_language(history, preferred_language=preferred_language)
    history = [("user", message) for message in messages[:-1]]
    return detect_response_language(
        messages[-1],
        history,
        preferred_language=preferred_language,
    )
