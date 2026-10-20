"""Official English theme labels vs singing lyrics.

On prabhatasamgiita.net, some early songs place a short English label
(e.g. ``SONG OF FULFILMENT``) between Roman lyrics and the English meaning.
That label must not be treated as a lyric line or rule-converted to Devanagari.
"""

from __future__ import annotations

import re

# Primary official pattern (British/American spelling variants included).
_SONG_OF_RE = re.compile(r"(?i)^song\s+of\b")
# Roman-Saṃskṛta diacritics common in official lyrics — themes never use these.
_DIACRITIC_RE = re.compile(
    r"[ÁáÀàÂâÃãÄäÅåĀāĂăǍǎĆćČčḌḍÉéÈèÊêËëĒēĚěÍíÌìÎîÏïĪīǏǐ"
    r"ŃńÑñṆṇÓóÒòÔôÖöÕõŌōŎŏǑǒṚṛṜṝŚśṢṣṬṭÚúÙùÛûÜüŪūŬŭǓǔÝýŸÿŹźŽžḾḿ]"
)
_LATIN_LINE_RE = re.compile(r"^[A-Za-z0-9 ,.'’\-:/!?]+$")
_SMALL_WORDS = frozenset({"of", "the", "and", "a", "an", "to", "in", "for", "with"})


def is_english_theme_line(line: str) -> bool:
    """True when *line* is an official English theme label, not a lyric line."""
    text = (line or "").strip()
    if not text or len(text) > 80:
        return False
    if _DIACRITIC_RE.search(text):
        return False
    if not _LATIN_LINE_RE.fullmatch(text):
        return False
    words = text.split()
    if not (1 <= len(words) <= 10):
        return False
    if _SONG_OF_RE.match(text):
        return True
    # Rare ALL-CAPS English labels without "Song of" — keep strict.
    letters = [c for c in text if c.isalpha()]
    if not letters:
        return False
    if sum(1 for c in letters if c.isupper()) / len(letters) < 0.9:
        return False
    return bool(re.search(r"(?i)\b(song|liberation|fulfilment|fulfilment|neohumanism|awakening)\b", text))


def format_theme_label(raw: str) -> str:
    """Display form: ``SONG OF FULFILMENT`` → ``Song of Fulfilment``."""
    words = (raw or "").strip().split()
    if not words:
        return ""
    out: list[str] = []
    for index, word in enumerate(words):
        lower = word.lower()
        if index > 0 and lower in _SMALL_WORDS:
            out.append(lower)
            continue
        if word.isupper() or word.islower():
            out.append(word[:1].upper() + word[1:].lower())
        else:
            out.append(word)
    return " ".join(out)


def extract_trailing_english_theme(lyrics: str | None) -> tuple[str, str | None]:
    """Peel a trailing English theme label from Roman lyrics.

    Returns ``(cleaned_lyrics, theme_or_none)``. Blank lines after the theme
    are dropped with it; stanza blanks inside the song are preserved.
    """
    if not lyrics:
        return "", None
    # Preserve whether the source ended with a newline for round-trip friendliness.
    ends_with_newline = lyrics.endswith("\n")
    lines = lyrics.split("\n")
    # Walk back over trailing blanks.
    end = len(lines)
    while end > 0 and lines[end - 1].strip() == "":
        end -= 1
    if end == 0:
        return ("\n" if ends_with_newline and lyrics else lyrics), None
    candidate = lines[end - 1]
    if not is_english_theme_line(candidate):
        return lyrics, None
    theme = format_theme_label(candidate)
    kept = lines[: end - 1]
    # Drop trailing blanks left after peel.
    while kept and kept[-1].strip() == "":
        kept.pop()
    cleaned = "\n".join(kept)
    if ends_with_newline and cleaned:
        cleaned += "\n"
    return cleaned, theme or None


def drop_last_nonempty_line(text: str | None) -> str:
    """Remove the last non-empty line (used to drop a converted theme from Devanagari)."""
    if not text:
        return ""
    ends_with_newline = text.endswith("\n")
    lines = text.split("\n")
    end = len(lines)
    while end > 0 and lines[end - 1].strip() == "":
        end -= 1
    if end == 0:
        return text
    kept = lines[: end - 1]
    while kept and kept[-1].strip() == "":
        kept.pop()
    cleaned = "\n".join(kept)
    if ends_with_newline and cleaned:
        cleaned += "\n"
    return cleaned
