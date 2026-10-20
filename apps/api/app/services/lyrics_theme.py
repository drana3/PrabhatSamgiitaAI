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
    theme_words = r"(?i)\b(song|liberation|fulfilment|fulfilment|neohumanism|awakening)\b"
    return bool(re.search(theme_words, text))


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


# Rule-converted leftovers of ``SONG OF …`` (e.g. ``सोन्ग् ओफ़् फ़ुल्फ़िल्ल्मेन्त्``).
_CONVERTED_SONG_OF_RE = re.compile(r"(सोन्ग्|सोंग्|सोङ्ग्|सॉन्ग्)\s*(ओफ़्|ओफ्|अव्|ऑफ़्)")


def looks_like_converted_theme_line(line: str | None) -> bool:
    """True when a Devanagari line looks like a rule-converted English theme label."""
    text = (line or "").strip()
    if not text or len(text) > 80:
        return False
    if _CONVERTED_SONG_OF_RE.search(text):
        return True
    # Latin theme accidentally left inside Devanagari block.
    return is_english_theme_line(text)


def _last_nonempty_line(text: str) -> str | None:
    for line in reversed(text.split("\n")):
        if line.strip():
            return line
    return None


def strip_trailing_theme_from_devanagari(
    roman: str | None,
    devanagari: str | None,
    *,
    known_theme: str | None = None,
) -> str | None:
    """Drop a trailing theme line that was rule-converted into Devanagari.

    Strips when:
    - the last Devanagari line looks like a converted ``Song of …`` label, or
    - a theme is known (peeled from Roman, or passed via *known_theme*) and
      Devanagari has exactly one more non-empty line than cleaned Roman.
    """
    if not isinstance(devanagari, str) or not devanagari.strip():
        return None if not (devanagari or "").strip() else devanagari

    cleaned_roman, peeled = extract_trailing_english_theme(
        roman if isinstance(roman, str) else None
    )
    theme_hint = peeled or ((known_theme or "").strip() or None)
    last = _last_nonempty_line(devanagari)
    if last and looks_like_converted_theme_line(last):
        stripped = drop_last_nonempty_line(devanagari).strip()
        return stripped or None

    if not theme_hint:
        return devanagari

    roman_n = len([ln for ln in (cleaned_roman or "").split("\n") if ln.strip()])
    dev_n = len([ln for ln in devanagari.split("\n") if ln.strip()])
    if roman_n and dev_n == roman_n + 1:
        stripped = drop_last_nonempty_line(devanagari).strip()
        return stripped or None
    return devanagari

def normalize_prose_block(text: str | None) -> str | None:
    """Unwrap HTML soft line-breaks into readable prose paragraphs.

    Official Central idea / Purport blocks are continuous prose; source HTML
    wraps at ~70 columns. Preserving those wraps produces mid-sentence
    newlines in the UI. Blank lines still become paragraph breaks.
    """
    raw = (text or "").strip()
    if not raw:
        return None
    paragraphs: list[str] = []
    for block in re.split(r"\n\s*\n", raw):
        joined = re.sub(r"[ \t]*\n[ \t]*", " ", block.strip())
        joined = re.sub(r" {2,}", " ", joined).strip()
        if joined:
            paragraphs.append(joined)
    return "\n\n".join(paragraphs) if paragraphs else None
