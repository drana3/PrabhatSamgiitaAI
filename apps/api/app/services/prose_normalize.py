"""Normalize soft-wrapped catalog prose for Meaning / Central idea display."""

from __future__ import annotations

import re
from difflib import SequenceMatcher

_SOFT_BREAK = re.compile(r"[ \t]*\n[ \t]*")
_MULTI_SPACE = re.compile(r" {2,}")
_PARA_SPLIT = re.compile(r"\n\s*\n")
_NON_WORD = re.compile(r"[^\w\u0900-\u097F\u0980-\u09FF]+", re.UNICODE)


def normalize_prose_block(text: str) -> str:
    """Join HTML-style soft line wraps; keep blank-line paragraph breaks."""
    cleaned = text.strip()
    if not cleaned:
        return ""
    paragraphs: list[str] = []
    for block in _PARA_SPLIT.split(cleaned):
        line = _MULTI_SPACE.sub(" ", _SOFT_BREAK.sub(" ", block)).strip()
        if line:
            paragraphs.append(line)
    if not paragraphs:
        return ""
    # Translators sometimes turn each poem line into its own paragraph.
    if len(paragraphs) >= 4:
        short = sum(1 for part in paragraphs if len(part) < 90)
        if short / len(paragraphs) >= 0.7:
            return _MULTI_SPACE.sub(" ", " ".join(paragraphs)).strip()
    return "\n\n".join(paragraphs)


def prose_fingerprint(text: str) -> str:
    """Collapse whitespace/punctuation for near-duplicate checks."""
    collapsed = _NON_WORD.sub(" ", (text or "").casefold())
    return _MULTI_SPACE.sub(" ", collapsed).strip()


def is_near_duplicate_prose(
    left: str | None,
    right: str | None,
    *,
    threshold: float = 0.88,
) -> bool:
    """True when two prose blocks are the same meaning restated (or identical)."""
    a = prose_fingerprint(left or "")
    b = prose_fingerprint(right or "")
    if not a or not b:
        return False
    if a == b:
        return True
    # A "Central idea" nearly as long as the meaning is almost always a copy.
    shorter, longer = (a, b) if len(a) <= len(b) else (b, a)
    if len(longer) >= 80 and len(shorter) / len(longer) >= 0.82:
        if SequenceMatcher(None, a, b).ratio() >= threshold:
            return True
    return SequenceMatcher(None, a, b).ratio() >= threshold
