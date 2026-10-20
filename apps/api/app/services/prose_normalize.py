"""Normalize soft-wrapped catalog prose for Meaning / Central idea display."""

from __future__ import annotations

import re

_SOFT_BREAK = re.compile(r"[ \t]*\n[ \t]*")
_MULTI_SPACE = re.compile(r" {2,}")
_PARA_SPLIT = re.compile(r"\n\s*\n")


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
