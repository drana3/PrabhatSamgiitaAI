from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass

GUIDANCE = (
    "Please ask a specific Prabhat Samgiita question, for example: "
    "'Song 1', 'songs for morning meditation', or 'What does this song mean?'"
)
UNRELATED_GUIDANCE = (
    "I can help with Prabhat Samgiita songs — meaning, lyrics, meditation, and language. "
    "Please ask something specific about the song you are exploring."
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
INJECTION_PATTERNS = (
    r"https?://",
    r"<\s*script",
    r"\bignore\s+(?:all\s+)?previous\b",
    r"\bdisregard\s+(?:all\s+)?(?:prior|previous|above)\b",
    r"\bforget\s+(?:everything|all|your)\b",
    r"\bsystem\s+prompt\b",
    r"\b(?:reveal|show|print|repeat|dump)\s+(?:your|the)\s+(?:system|hidden|developer|secret)\s+(?:prompt|instructions)\b",
    r"\b(?:act|behave|pretend|roleplay)\s+(?:as|like)\b",
    r"\bdo anything now\b",
    r"\bDAN\b",
    r"\bjailbreak\b",
    r"\boverride\s+(?:your|the)\s+(?:rules|instructions|guidelines|policy)\b",
    r"\bnew instructions?\b",
    r"\byou are now\b",
    r"\bbypass\s+(?:the\s+)?(?:filter|safety|guard|rules)\b",
    r"\b(?:execute|run)\s+(?:this\s+)?(?:python|code|script|command)\b",
    r"\b(?:import\s+os|import\s+subprocess|subprocess\.|eval\s*\(|exec\s*\()\b",
    r"```(?:python|javascript|js|bash|sh)\b",
    r"\bdrop\s+table\b",
    r"\bunion\s+select\b",
    r"\brm\s+-rf\b",
    r"\bbase64\s+decode\b",
)
UNRELATED_TOPIC_PATTERNS = (
    r"\b(?:weather|forecast|temperature)\b",
    r"\b(?:stock|crypto|bitcoin|ethereum)\s+(?:price|market|trading)\b",
    r"\b(?:write|generate|create|build)\s+(?:a\s+)?(?:python|javascript|java|c\+\+)\s+(?:program|code|script|app)\b",
    r"\b(?:homework|assignment|essay)\s+(?:for|about)\b",
    r"\btell me a joke\b",
    r"\bwho is (?:the\s+)?(?:president|prime minister|ceo of)\b",
    r"\brecipe for\b",
    r"\btranslate this email\b",
    r"\b(?:solve|calculate)\s+(?:this|the)\s+(?:equation|math|problem)\b",
)
CODE_REQUEST_PATTERNS = (
    r"\b(?:python|javascript|java|c\+\+)\s+(?:program|code|script)\b",
    r"\bwrite(?: me)?(?: a)? code\b",
)
SONG_CONTEXT_PATTERN = re.compile(
    r"\b(?:"
    r"song|ps|prabhat|samgiita|sangeet|compare|meaning|mean|lyrics|notation|"
    r"explain|about|understand|arth|matlab|batao|samjha|gaane|gaana|gana|"
    r"dhyan|meditation|meditate|pronounc|pronunc|related|story|stories|"
    r"hindi|english|bengali|urdu|translate|imagery|spiritual|reflect|devotee|"
    r"this|it|that|line|message|overview|summary|recap|longing|surrender|devotion|"
    r"divine|light|peace|bliss|love|friend|bandhu|guru|krishna|shiva"
    r")\b",
    re.IGNORECASE,
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
VAGUE_FILLERS = frozenset(
    {
        "hi",
        "hey",
        "hello",
        "ok",
        "okay",
        "yes",
        "no",
        "why",
        "what",
        "help",
        "hmm",
        "thanks",
        "thank",
        "you",
    }
)
FOLLOW_UP_PHRASES = frozenset(
    {
        "ok",
        "okay",
        "yes",
        "yeah",
        "yep",
        "continue",
        "go on",
        "more",
        "in hindi",
        "in english",
        "hindi mein",
        "english mein",
        "tell me more",
        "explain more",
        "say more",
    }
)
INDIC_SCRIPT = re.compile(r"[\u0900-\u097F\u0980-\u09FF\u0B80-\u0BFF\u0C00-\u0C7F\u0600-\u06FF]")


@dataclass(frozen=True, slots=True)
class QueryAssessment:
    allowed: bool
    normalized: str
    reason: str | None = None
    guidance: str = GUIDANCE


def has_song_context(normalized: str) -> bool:
    return bool(SONG_CONTEXT_PATTERN.search(normalized))


def is_follow_up_phrase(normalized: str) -> bool:
    cleaned = normalized.casefold().strip()
    if cleaned in FOLLOW_UP_PHRASES:
        return True
    if cleaned.startswith("in ") and len(cleaned.split()) <= 4:
        return True
    return cleaned.endswith(" mein") or cleaned.endswith(" me")


def _matches_any(patterns: tuple[str, ...], normalized: str) -> bool:
    return any(re.search(pattern, normalized, re.IGNORECASE) for pattern in patterns)


def assess_query(
    value: str | None,
    *,
    max_length: int = 600,
    companion: bool = False,
    allow_follow_up: bool = False,
) -> QueryAssessment:
    normalized = " ".join(unicodedata.normalize("NFKC", value or "").split())
    if not normalized:
        return QueryAssessment(False, normalized, "empty")
    if len(normalized) > max_length:
        return QueryAssessment(False, normalized[:max_length], "too_long")
    if _matches_any(INJECTION_PATTERNS, normalized):
        return QueryAssessment(False, normalized, "unsafe_or_unrelated_instruction")
    if _matches_any(OUT_OF_SCOPE_PATTERNS, normalized):
        return QueryAssessment(
            False,
            normalized,
            "out_of_scope_request",
            OUT_OF_SCOPE_GUIDANCE,
        )
    if _matches_any(UNRELATED_TOPIC_PATTERNS, normalized):
        return QueryAssessment(False, normalized, "unrelated_topic", UNRELATED_GUIDANCE)
    if _matches_any(CODE_REQUEST_PATTERNS, normalized):
        return QueryAssessment(False, normalized, "code_request", UNRELATED_GUIDANCE)

    if normalized.casefold().startswith(COLLECTION_PROMPT_PREFIX):
        return QueryAssessment(True, normalized)

    if companion:
        if allow_follow_up and is_follow_up_phrase(normalized):
            return QueryAssessment(True, normalized)
        words = re.findall(r"[^\W\d_]+", normalized.casefold(), flags=re.UNICODE)
        if (
            not allow_follow_up
            and len(words) <= 2
            and not has_song_context(normalized)
            and not INDIC_SCRIPT.search(normalized)
            and (len(words) <= 1 or all(word in VAGUE_FILLERS for word in words))
        ):
            return QueryAssessment(False, normalized, "vague_or_unrelated", UNRELATED_GUIDANCE)

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
    if not companion and not has_song_context(normalized) and (
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
