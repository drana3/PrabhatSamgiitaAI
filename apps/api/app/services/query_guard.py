from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass

GUIDANCE = (
    "Please ask a specific Prabhat Samgiita question, for example: "
    "'Song 1', 'songs for morning meditation', or 'What does this song mean?'"
)
COLLECTION_PROMPT_PREFIX = "search prabhat samgiita for "
SONG_RANGE_GUIDANCE = (
    "Prabhat Samgiita song numbers run from 1 to 5,018. Please enter a number within that range."
)
OUT_OF_SCOPE_GUIDANCE = (
    "I'm your Prabhat Samgiita companion — I help with song meaning, lyrics, themes, "
    "meditation, and related spiritual questions. I can't help with general programming, "
    "homework coding, or unrelated tech tasks. Ask me about a song or spiritual theme."
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
# General-purpose coding / tool misuse (OWASP LLM01 scope abuse + LLM10 cost).
OUT_OF_SCOPE_PATTERNS = (
    r"\b(?:write|create|generate|build|make|code|develop)\b.{0,40}\b(?:python|javascript|"
    r"typescript|java|golang|rust|kotlin|swift|c\+\+|c#|php|ruby|sql|bash|powershell)\b"
    r".{0,40}\b(?:program|script|code|function|class|app|application|module|snippet)\b",
    r"\b(?:python|javascript|typescript|java|golang|rust|kotlin|swift|c\+\+|c#|php|ruby|"
    r"sql)\s+(?:program|script|code|function|class|app)\b",
    r"\b(?:write|create|generate)\s+(?:a\s+)?(?:program|script|function|class)\b",
    r"\b(?:leetcode|hackerrank|coding\s+interview|debug\s+this\s+code)\b",
    r"\b(?:write|generate)\s+(?:me\s+)?(?:an?\s+)?(?:essay|homework|assignment)\b"
    r"(?!.{0,40}\b(?:song|samgiita|sangeet|prabhat|lyric|meaning)\b)",
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
    if any(re.search(pattern, normalized, re.IGNORECASE) for pattern in OUT_OF_SCOPE_PATTERNS):
        return QueryAssessment(
            False,
            normalized,
            "out_of_scope_request",
            OUT_OF_SCOPE_GUIDANCE,
        )

    if normalized.casefold().startswith(COLLECTION_PROMPT_PREFIX):
        return QueryAssessment(True, normalized)

    explicit_song_number = re.search(
        r"\b(?:song|ps|prabhat\s+(?:samgiita|sangeet))\s*"
        r"(?:number|no\.?|#)?\s*(\d{1,6})\b",
        normalized,
        re.IGNORECASE,
    )
    if explicit_song_number:
        number = int(explicit_song_number.group(1))
        if not 1 <= number <= 5018:
            return QueryAssessment(
                False,
                normalized,
                "song_number_out_of_range",
                SONG_RANGE_GUIDANCE,
            )

    numeric_parts = re.findall(r"\d+", normalized)
    has_song_context = re.search(
        r"\b(?:"
        r"song|ps|prabhat|samgiita|sangeet|compare|meaning|mean|lyrics|notation|"
        r"explain|about|understand|arth|matlab|batao|samjha|gaane|gaana|gana|"
        r"dhyan|meditation|meditate|pronounc|pronunc|related|story|stories|"
        r"hindi|english|bengali|urdu|translate|imagery|spiritual|reflect|devotee|"
        r"this|it|line|message|overview|summary|recap"
        r")\b",
        normalized,
        re.IGNORECASE,
    )
    if not has_song_context and (
        len(numeric_parts) > 1 or any(len(part) > 4 for part in numeric_parts)
    ):
        return QueryAssessment(False, normalized, "unrelated_numeric_sequence")

    compact = "".join(
        character
        for character in normalized
        if character.isalnum() or unicodedata.category(character).startswith("M")
    )
    if not compact:
        return QueryAssessment(False, normalized, "no_meaningful_text")
    if compact.isdigit():
        number = int(compact)
        if len(compact) > 4:
            return QueryAssessment(False, normalized, "unrelated_numeric_sequence")
        return QueryAssessment(
            1 <= number <= 5018,
            normalized,
            None if 1 <= number <= 5018 else "song_number_out_of_range",
            GUIDANCE if 1 <= number <= 5018 else SONG_RANGE_GUIDANCE,
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
        vowel_ratio = sum(letter in "aeiouy" for letter in ascii_letters) / len(ascii_letters)
        if len(words) == 1 and len(ascii_letters) >= 12 and vowel_ratio < 0.22:
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
