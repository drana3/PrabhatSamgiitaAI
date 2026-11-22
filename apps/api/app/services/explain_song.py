from __future__ import annotations

import re

_EXPLICIT_SONG_NUMBER = re.compile(
    r"\b(?:song|ps|prabhat\s+(?:samgiita|sangeet))\s*(?:number|no\.?|#)?\s*(\d{1,4})\b",
    re.IGNORECASE,
)

_CATALOG_BROWSE_RE = re.compile(
    r"\b(?:suggest|morning|evening|peace|calm|meditation|devotion|recommend|which song|"
    r"what song|tell me about|prabhat samgiita|festival|theme|how many|who composed|"
    r"what is prabhat)\b",
    re.IGNORECASE,
)

_RELATED_SONGS_RE = re.compile(
    r"\b(?:related|similar|songs?\s+like|another\s+song|other\s+songs?)\b",
    re.IGNORECASE,
)

_SONG_FOCUSED_RE = re.compile(
    r"\b(this song|the song|explain this|meaning of this|line by line)\b",
    re.IGNORECASE,
)


def explicit_song_number_from_prompt(prompt: str | None) -> int | None:
    text = (prompt or "").strip()
    if not text:
        return None
    match = _EXPLICIT_SONG_NUMBER.search(text)
    if match:
        number = int(match.group(1))
        if 1 <= number <= 5018:
            return number
    if re.fullmatch(r"\d{1,4}", text):
        number = int(text)
        if 1 <= number <= 5018:
            return number
    return None


def prefers_catalog_companion(prompt: str | None) -> bool:
    text = (prompt or "").strip()
    if not text:
        return False
    if _SONG_FOCUSED_RE.search(text):
        return False
    if _RELATED_SONGS_RE.search(text):
        return False
    return _CATALOG_BROWSE_RE.search(text) is not None


def resolve_explain_song_number(
    payload_number: int | None,
    prompt: str | None,
) -> int | None:
    explicit = explicit_song_number_from_prompt(prompt)
    if explicit is not None:
        return explicit
    if prefers_catalog_companion(prompt):
        return None
    if payload_number is not None:
        return payload_number
    return None