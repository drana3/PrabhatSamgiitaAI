"""One place that decides which invisible characters of typed text are dropped.

Used by author pages (names, bios), song comments, chord notes, recording extras and playlist
titles (`song_comments.strip_invisible` is this function).

Everything that draws nothing is dropped: zero-width space, word joiner, byte-order mark, soft
hyphen, bidi overrides, isolates and direction marks, and the rest of the Unicode "format" class
(Cf). The one exception is the zero-width joiner and non-joiner (U+200D, U+200C) where they change
how text is DRAWN and cannot hide anything:

- between two letters or marks of an Indic script (Devanagari, Bengali, Tamil, ... U+0900 to
  U+0DFF), as in the half-form of क्‍ष or ক্‍ষ, where a virama U+094D or U+09CD sits before it;
- between two letters or marks of the Arabic script (Persian and Urdu: "می‌خواهم");
- between two emoji, as in the family sequence of 👨‍👩‍👧.

Leading, trailing, doubled, and next to a Latin letter, a space or a digit, they are dropped:
"Adm‍in" is "Admin". (The staff and look-alike checks ignore joiners separately: they fold
them away in the skeleton, so a joiner never hides a name from them.)
"""

from __future__ import annotations

import unicodedata

JOINERS = ("‌", "‍")
_INDIC = (0x0900, 0x0DFF)
# Arabic, Arabic Supplement, Arabic Extended-A, presentation forms (not U+FEFF, the byte-order mark)
_ARABIC = ((0x0600, 0x06FF), (0x0750, 0x077F), (0x08A0, 0x08FF), (0xFB50, 0xFDFF), (0xFE70, 0xFEFC))
_LETTER_OR_MARK = ("Lo", "Mn", "Mc")


def _in(code: int, low: int, high: int) -> bool:
    return low <= code <= high


def _script_letter(char: str) -> bool:
    """A letter or combining mark of an Indic or Arabic-script alphabet."""
    if unicodedata.category(char) not in _LETTER_OR_MARK:
        return False
    code = ord(char)
    return _in(code, *_INDIC) or any(_in(code, low, high) for low, high in _ARABIC)


def _emoji(char: str, *, following: bool) -> bool:
    """An emoji, or (before a joiner only) the variation selector or skin tone that ends one."""
    code = ord(char)
    if code >= 0x1F000 or _in(code, 0x2190, 0x2BFF) or _in(code, 0x2600, 0x27BF):
        return True
    return (not following) and code == 0xFE0F


def joiner_belongs(text: str, index: int) -> bool:
    """Is the joiner at `text[index]` between two characters that make it meaningful?"""
    if index <= 0 or index + 1 >= len(text):
        return False
    before, after = text[index - 1], text[index + 1]
    if _script_letter(before) and _script_letter(after):
        return True
    return _emoji(before, following=False) and _emoji(after, following=True)


def strip_invisible(text: str | None) -> str:
    out: list[str] = []
    value = text or ""
    for index, char in enumerate(value):
        if unicodedata.category(char) == "Cf" and not (
            char in JOINERS and joiner_belongs(value, index)
        ):
            continue
        out.append(char)
    return "".join(out)
