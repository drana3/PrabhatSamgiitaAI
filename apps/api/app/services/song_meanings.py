from __future__ import annotations

from app.models import Song
from app.services.ingestion_language import SUPPORTED_LANGUAGES

LANGUAGE_LABELS: dict[str, str] = {
    "en": "English",
    "hi": "Hindi",
    "bn": "Bengali",
    "ta": "Tamil",
    "ur": "Urdu",
    "mai": "Maithili",
    "mag": "Magahi",
    "as": "Assamese",
    "gu": "Gujarati",
    "kn": "Kannada",
    "ml": "Malayalam",
    "mr": "Marathi",
    "ne": "Nepali",
    "or": "Odia",
    "pa": "Punjabi",
    "sa": "Sanskrit",
    "te": "Telugu",
    "ar": "Arabic",
    "zh": "Chinese",
    "nl": "Dutch",
    "fr": "French",
    "de": "German",
    "id": "Indonesian",
    "it": "Italian",
    "ja": "Japanese",
    "ko": "Korean",
    "fa": "Persian",
    "pl": "Polish",
    "pt": "Portuguese",
    "ru": "Russian",
    "si": "Sinhala",
    "es": "Spanish",
    "sw": "Swahili",
    "th": "Thai",
    "tr": "Turkish",
    "vi": "Vietnamese",
}

_LABEL_TO_CODE = {label.casefold(): code for code, label in LANGUAGE_LABELS.items()}
_LABEL_TO_CODE.update({code: code for code in LANGUAGE_LABELS})


def normalize_language_code(language: str) -> str | None:
    token = language.strip().casefold()
    if not token:
        return None
    if token in SUPPORTED_LANGUAGES:
        return token
    return _LABEL_TO_CODE.get(token)


def language_display_name(language: str) -> str:
    code = normalize_language_code(language)
    if code:
        return LANGUAGE_LABELS.get(code, language.strip())
    return language.strip()


def collect_stored_meanings(song: Song) -> dict[str, str]:
    meanings: dict[str, str] = {}
    if song.english_meaning and song.english_meaning.strip():
        meanings["en"] = song.english_meaning.strip()
    if song.hindi_meaning and song.hindi_meaning.strip():
        meanings["hi"] = song.hindi_meaning.strip()
    localized = dict((song.metadata_json or {}).get("localized_meanings") or {})
    for code, text in localized.items():
        if isinstance(text, str) and text.strip():
            meanings[str(code).casefold()] = text.strip()
    return meanings


def stored_meaning_for_language(song: Song, language: str) -> str | None:
    code = normalize_language_code(language)
    if not code:
        return None
    return collect_stored_meanings(song).get(code)
