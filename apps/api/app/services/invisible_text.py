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

Tag characters (U+E0020 to U+E007F) are dropped too, except the three flag sequences: the waving
black flag U+1F3F4, tags spelling exactly gbeng, gbsct or gbwls, and the cancel tag U+E007F
(England, Scotland, Wales). Any other tag run, however short, is dropped, because tags can carry
hidden text that a person cannot see and a model later reads.

A combining mark or variation selector with no base character before it is dropped too (a value
made only of them is empty), and no base keeps more than 4 marks (zalgo text).

Blank-looking characters (Hangul fillers, braille blank, combining grapheme joiner, Khmer inherent
vowels) are dropped, so a value made only of them is empty.

Leading, trailing, doubled, and next to a Latin letter, a space or a digit, they are dropped:
"Adm‍in" is "Admin". (The staff and look-alike checks ignore joiners separately: they fold
them away in the skeleton, so a joiner never hides a name from them.)
"""

from __future__ import annotations

import unicodedata

JOINERS = ("\u200c", "\u200d")
# Most marks kept on one base character. Real writing needs up to 3 (Arabic shadda, vowel sign and
# dagger alef; Vietnamese; Thai, Khmer and Myanmar vowel, tone and sign); more is zalgo text.
MAX_MARKS_PER_BASE = 4
BLACK_FLAG = "\U0001f3f4"
TAG_FIRST, TAG_LAST_LETTER, TAG_CANCEL = 0xE0020, 0xE007E, "\U000e007f"
# The only tag sequences kept: the flags of England, Scotland and Wales (ISO 3166-2 codes).
FLAG_SUBDIVISIONS = frozenset({"gbeng", "gbsct", "gbwls"})
MAX_FLAG_TAGS = 5
# Characters that look blank (or are blank) and are not covered by the Unicode "format" class:
# the Hangul fillers, the Khmer inherent vowels (invisible), the combining grapheme joiner and the
# braille blank. A name or note made only of them would look empty, so they are dropped
# everywhere, except the braille blank, which is a blank cell and so becomes a space (which the
# caller's space folding then trims at the edges).
BLANKS = frozenset("\u3164\u115f\u1160\uffa0\u17b4\u17b5\u034f\u2800\u180e")
BLANK_AS_SPACE = frozenset("\u2800")
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


def _flag_tags_end(text: str, start: int) -> int | None:
    """If `text[start]` is the waving black flag followed by EXACTLY the tags of England, Scotland
    or Wales and the cancel tag, the index just after the sequence; else None. Any other tag run
    (hidden text, an unknown subdivision) is not kept, so tags cannot carry a message."""
    if text[start] != BLACK_FLAG:
        return None
    index = start + 1
    letters: list[str] = []
    while index < len(text) and TAG_FIRST <= ord(text[index]) <= TAG_LAST_LETTER:
        if len(letters) >= MAX_FLAG_TAGS:
            return None
        letters.append(chr(ord(text[index]) - TAG_FIRST + 0x20))
        index += 1
    if "".join(letters) in FLAG_SUBDIVISIONS and index < len(text) and text[index] == TAG_CANCEL:
        return index + 1
    return None


def _is_base(char: str) -> bool:
    """A character a mark can sit on: a letter, number, symbol or punctuation mark. Combining
    marks (Mn, Mc, Me, which include the variation selectors), spaces, controls and the format
    class are not."""
    return unicodedata.category(char)[0] in "LNSP"


def strip_invisible(text: str | None) -> str:
    """The text without the characters that draw nothing or draw as blank (see the module note).

    A combining mark or variation selector is kept only while it is attached to a base character
    before it (a Devanagari matra after its consonant, a Vietnamese tone after its vowel, VS16
    after an emoji). One that stands first, or after a space or a line break, has nothing to sit
    on and is dropped; so a value made only of marks comes out empty. A value that is only blank
    characters and spaces comes out empty after the caller folds spaces
    (`" ".join(value.split())`), which is how every surface tells "empty"."""
    value = text or ""
    out: list[str] = []
    attached = False  # does a base character, with only marks since, end `out`?
    marks = 0  # marks kept on that base so far
    index = 0
    while index < len(value):
        char = value[index]
        if char == BLACK_FLAG:
            end = _flag_tags_end(value, index)
            if end is not None:
                out.append(value[index:end])
                attached = True
                marks = 0
                index = end
                continue
        category = unicodedata.category(char)
        if char in BLANKS:
            if char in BLANK_AS_SPACE:
                out.append(" ")
                attached = False
                marks = 0
        elif category == "Cf":
            if char in JOINERS and joiner_belongs(value, index):
                out.append(char)  # neutral: the letters around it decide
        elif category[0] == "M":
            if attached and marks < MAX_MARKS_PER_BASE:
                out.append(char)
                marks += 1
        else:
            out.append(char)
            attached = _is_base(char)
            marks = 0
        index += 1
    return "".join(out)
