"""The languages a recording can be sung in: ISO 639 codes, one list.

The phone keeps the same list in `apps/mobile/lib/kirtan/languages.ts` (with the labels in three
languages); `tests/test_recording_sets_languages.py` and `__tests__/kirtanLanguages.test.ts` each
pin their side. To add a language: add its code here and there, and a `lang.<code>` label in the
three locale dictionaries (`locales/recordings.ts`). The database stores the code only, so a new
language needs no migration.

`other` is the escape hatch: the uploader names the language in free text (`language_other`),
which is cleaned and cut to 80 characters before it is stored.
"""

from __future__ import annotations

OTHER = "other"

# (code, English name). ISO 639-1 where one exists, ISO 639-3 otherwise.
LANGUAGES: tuple[tuple[str, str], ...] = (
    ("bn", "Bengali"),
    ("sa", "Sanskrit"),
    ("hi", "Hindi"),
    ("en", "English"),
    ("ru", "Russian"),
    ("es", "Spanish"),
    ("pt", "Portuguese"),
    ("de", "German"),
    ("fr", "French"),
    ("it", "Italian"),
    ("pl", "Polish"),
    ("uk", "Ukrainian"),
    ("ta", "Tamil"),
    ("te", "Telugu"),
    ("ne", "Nepali"),
    ("zh", "Chinese"),
    ("ja", "Japanese"),
    ("id", "Indonesian"),
    ("vi", "Vietnamese"),
    ("sw", "Swahili"),
    ("eo", "Esperanto"),
    ("ar", "Arabic"),
    ("tr", "Turkish"),
    ("nl", "Dutch"),
    ("cs", "Czech"),
    ("ko", "Korean"),
    ("th", "Thai"),
    ("ml", "Malayalam"),
    ("kn", "Kannada"),
    ("mr", "Marathi"),
    ("gu", "Gujarati"),
    ("pa", "Punjabi"),
    ("ur", "Urdu"),
    ("or", "Odia"),
    ("as", "Assamese"),
    ("mai", "Maithili"),
    ("bho", "Bhojpuri"),
    ("hu", "Hungarian"),
    ("ro", "Romanian"),
    ("bg", "Bulgarian"),
    ("sr", "Serbian"),
    ("el", "Greek"),
    ("he", "Hebrew"),
    ("fa", "Persian"),
    ("fi", "Finnish"),
    ("sv", "Swedish"),
    ("tl", "Tagalog"),
    ("my", "Burmese"),
    ("si", "Sinhala"),
)
LANGUAGE_CODES = tuple(code for code, _ in LANGUAGES)
# The five words the first version of the form stored. They are read as the codes below.
LEGACY_LANGUAGE_WORDS: dict[str, str] = {
    "bengali": "bn",
    "sanskrit": "sa",
    "hindi": "hi",
    "english": "en",
    "other": OTHER,
}
LANGUAGE_OTHER_MAX = 80
# "Russian" is read as "ru": a table or a script may use the English name.
_CODE_OF_NAME: dict[str, str] = {name.lower(): code for code, name in LANGUAGES}


def normalize_language(value: str | None) -> str | None:
    """The code for what the client sent: a catalog code, its English name, `other` or an old word.

    Empty or None is None (no language). Anything else raises ValueError (the schema turns it into
    a 422), so a typo never reaches the database.
    """
    if value is None:
        return None
    word = value.strip().lower()
    if not word:
        return None
    word = LEGACY_LANGUAGE_WORDS.get(word) or _CODE_OF_NAME.get(word, word)
    if word == OTHER or word in LANGUAGE_CODES:
        return word
    raise ValueError("Choose a language from the list, or Other and write its name.")


def clean_language_other(value: str | None) -> str | None:
    """The free-text language name, safe to store: one line, no control characters, 80 chars."""
    if not value:
        return None
    kept = "".join(ch for ch in value if ch.isprintable() or ch.isspace())
    cleaned = " ".join(kept.split())[:LANGUAGE_OTHER_MAX].strip()
    return cleaned or None
