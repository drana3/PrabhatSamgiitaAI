from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass

GUIDANCE = (
    "Please ask a specific Prabhat Samgiita question, for example: "
    "'Song 1', 'songs for morning meditation', or 'What does this song mean?'"
)
BLOCKED_PATTERNS = (
    r"https?://",
    r"<\s*script",
    r"\bignore\s+(?:all\s+)?previous\b",
    r"\bsystem\s+prompt\b",
    r"\bjailbreak\b",
    r"\bdrop\s+table\b",
    r"\brm\s+-rf\b",
)
KEYBOARD_RUNS = ("qwerty", "asdf", "zxcv", "qazwsx", "poiuy", "lkjhg")
LOW_VALUE_WORDS = {"fuck", "shit", "bitch", "idiot", "stupid", "testtest", "blah"}


@dataclass(frozen=True, slots=True)
class QueryAssessment:
    allowed: bool
    normalized: str
    reason: str | None = None
    guidance: str = GUIDANCE


def assess_query(value: str | None, *, max_length: int = 600) -> QueryAssessment:
    normalized = " ".join(unicodedata.normalize("NFKC", value or "").split())
    if not normalized:
        return QueryAssessment(False, normalized, "empty")
    if len(normalized) > max_length:
        return QueryAssessment(False, normalized[:max_length], "too_long")
    if any(re.search(pattern, normalized, re.IGNORECASE) for pattern in BLOCKED_PATTERNS):
        return QueryAssessment(False, normalized, "unsafe_or_unrelated_instruction")

    compact = "".join(
        character
        for character in normalized
        if character.isalnum() or unicodedata.category(character).startswith("M")
    )
    if not compact:
        return QueryAssessment(False, normalized, "no_meaningful_text")
    if compact.isdigit():
        number = int(compact)
        return QueryAssessment(
            1 <= number <= 5018,
            normalized,
            None if 1 <= number <= 5018 else "song_number_out_of_range",
        )

    if re.search(r"(.)\1{4,}", compact, re.IGNORECASE):
        return QueryAssessment(False, normalized, "repeated_characters")
    if len(set(compact.casefold())) / len(compact) < 0.28 and len(compact) >= 10:
        return QueryAssessment(False, normalized, "low_character_variety")

    words = re.findall(r"[^\W\d_]+", normalized.casefold(), flags=re.UNICODE)
    if words and all(word in LOW_VALUE_WORDS for word in words):
        return QueryAssessment(False, normalized, "abusive_or_low_value")

    ascii_letters = "".join(
        character for character in compact.casefold() if "a" <= character <= "z"
    )
    latin_only = len(ascii_letters) == len(compact)
    if latin_only:
        if any(run in ascii_letters for run in KEYBOARD_RUNS):
            return QueryAssessment(False, normalized, "keyboard_mashing")
        if len(ascii_letters) >= 7 and not any(vowel in ascii_letters for vowel in "aeiouy"):
            return QueryAssessment(False, normalized, "unlikely_word_sequence")

    symbol_count = sum(
        not character.isalnum()
        and not character.isspace()
        and not unicodedata.category(character).startswith("M")
        for character in normalized
    )
    if symbol_count / len(normalized) > 0.35:
        return QueryAssessment(False, normalized, "too_many_symbols")
    return QueryAssessment(True, normalized)
