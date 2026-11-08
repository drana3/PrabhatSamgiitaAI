"""Pure rules for finding recordings that may be a performer's own: how a credit is split into
names, how two spellings of a name are compared (also across scripts), and what level of match a
credit is. No database, no I/O (docs/author-profiles.md, "Claiming recordings").

Levels, from the most to the least certain:

* `same`   the same name written the same way up to case, accents, spaces, look-alike letters and
           the usual transliteration variants (Dhiiraj / Dhiraj, Shri / Sri, v / w, Devanagari or
           Bengali script).
* `alike`  a name a reader may still take for the same person (one letter off, words in another
           order, one name inside a longer one).
* `title`  the name is only found inside the TITLE of a recording (a night kiirtan "with Priya").
           Never automatic, only offered by the search page.
"""

from __future__ import annotations

import re
import unicodedata
from difflib import SequenceMatcher

from app.services import author_rules as rules

# A credit with several people in it ("Priya Devi & friends", "Anna, Ravi and the group"): the
# separators the app itself uses when it splits a credit (apps/mobile/lib/kirtan/artists.ts).
_SPLIT = re.compile(
    r"\s*(?:,|;|&|\+|/|\s+and\s+|\s+with\s+|\s+feat\.?\s+|\s+ft\.?\s+|\s+x\s+)\s*", re.I
)
_GROUP_WORDS = re.compile(r"\b(group|band|choir|ensemble|team|friends|sangha|dharmacakra)\b", re.I)

# --------------------------------------------------------------------------- other scripts

# Devanagari block (U+0900..U+097F) into Latin. Bengali is mapped onto Devanagari by position (the
# Unicode Indic blocks share one layout), then written the same way.
_VOWELS = {
    "अ": "a", "आ": "aa", "इ": "i", "ई": "ii", "उ": "u", "ऊ": "uu", "ऋ": "ri", "ए": "e", "ऐ": "ai",
    "ओ": "o", "औ": "au",
}  # fmt: skip
_MATRAS = {
    "ा": "aa", "ि": "i", "ी": "ii", "ु": "u", "ू": "uu", "ृ": "ri", "े": "e", "ै": "ai", "ो": "o",
    "ौ": "au",
}  # fmt: skip
_CONSONANTS = {
    "क": "k", "ख": "kh", "ग": "g", "घ": "gh", "ङ": "n", "च": "c", "छ": "ch", "ज": "j", "झ": "jh",
    "ञ": "n", "ट": "t", "ठ": "th", "ड": "d", "ढ": "dh", "ण": "n", "त": "t", "थ": "th", "द": "d",
    "ध": "dh", "न": "n", "प": "p", "फ": "ph", "ब": "b", "भ": "bh", "म": "m", "य": "y", "र": "r",
    "ल": "l", "व": "v", "श": "sh", "ष": "sh", "स": "s", "ह": "h",
}  # fmt: skip
_MARKS = {"ं": "n", "ँ": "n", "ः": "h"}
_VIRAMA = "्"


def _to_devanagari(char: str) -> str:
    """A Bengali letter as the Devanagari letter in the same place; anything else unchanged."""
    code = ord(char)
    if 0x0980 <= code <= 0x09FF:
        return chr(code - 0x80)
    return char


def has_indic(text: str) -> bool:
    return any(0x0900 <= ord(c) <= 0x09FF for c in text)


def transliterate(text: str) -> str:
    """Devanagari and Bengali letters written in Latin; other characters unchanged. A consonant
    keeps its inherent "a" except at the end of a word, as a name is read."""
    chars = [_to_devanagari(c) for c in text]
    out: list[str] = []
    i = 0
    while i < len(chars):
        c = chars[i]
        if c in _CONSONANTS:
            nxt = chars[i + 1] if i + 1 < len(chars) else ""
            out.append(_CONSONANTS[c])
            if nxt == _VIRAMA:
                i += 2
                continue
            if nxt in _MATRAS:
                out.append(_MATRAS[nxt])
                i += 2
                continue
            word_end = i + 1 >= len(chars) or not ("ऀ" <= nxt <= "ॿ")
            if not word_end:
                out.append("a")
        elif c in _VOWELS:
            out.append(_VOWELS[c])
        elif c in _MARKS:
            out.append(_MARKS[c])
        elif c in (_VIRAMA, "़"):
            pass
        elif "ऀ" <= c <= "ॿ":
            pass  # a sign with no sound for a name (accent marks, punctuation of the script)
        else:
            out.append(c)
        i += 1
    return "".join(out)


# --------------------------------------------------------------------------- one comparable key

# Spelling variants of the same sound, applied after accents and case are gone. Aspirates lose
# their h (Dhiraj = Diraj), long vowels become short, sh/ch/w follow the usual Sanskrit habit.
_SOUND = (
    ("sh", "s"),
    ("ch", "c"),
    ("dh", "d"),
    ("bh", "b"),
    ("kh", "k"),
    ("gh", "g"),
    ("ph", "p"),
    ("th", "t"),
    ("jh", "j"),
    ("ee", "i"),
    ("oo", "u"),
    ("ii", "i"),
    ("aa", "a"),
    ("uu", "u"),
    ("w", "v"),
    ("y", "i"),
    ("z", "j"),
)


def match_key(text: str | None) -> str:
    """The comparable key of a name: transliterated, accents and look-alikes folded, and the common
    spelling variants of one sound made equal. Two names with one key are "the same name"."""
    plain = transliterate(text or "") if has_indic(text or "") else (text or "")
    key = rules.confusable_key(plain)
    for old, new in _SOUND:
        key = key.replace(old, new)
    return re.sub(
        r"(.)\1+", r"\1", key
    )  # a doubled letter is one ("Ananda" = "Ananda", "Radha" = "Rada")


def split_credit(credit: str | None) -> list[str]:
    """The names inside a credit. "Priya Devi" is one; "Priya Devi & friends" is two."""
    parts = [rules.clean_line(p, 120) for p in _SPLIT.split(credit or "")]
    return [p for p in parts if p]


def is_group_credit(credit: str | None) -> bool:
    """A credit that names more than one person, or a group by its words."""
    text = credit or ""
    return len(split_credit(text)) > 1 or bool(_GROUP_WORDS.search(text))


def same_name(a: str | None, b: str | None) -> bool:
    ka, kb = match_key(a), match_key(b)
    return bool(ka) and ka == kb


def alike_name(a: str | None, b: str | None) -> bool:
    """Not the same, but a reader may take them for one person."""
    if same_name(a, b):
        return False
    ka, kb = match_key(a), match_key(b)
    if not ka or not kb:
        return False
    if rules.names_alike(transliterate(a or ""), transliterate(b or "")):
        return True
    shorter, longer = sorted((ka, kb), key=len)
    if len(shorter) >= 6 and shorter in longer and len(shorter) / len(longer) >= 0.6:
        return True
    return SequenceMatcher(None, ka, kb).ratio() >= rules.NAME_SIMILARITY


def level_of(credit: str | None, names: list[str]) -> tuple[str | None, str | None]:
    """How well a credit matches any of `names` (display name, claimed name, aliases): the level
    ("same" or "alike", None when there is no match) and the part of the credit that matched."""
    best: tuple[str | None, str | None] = (None, None)
    parts = split_credit(credit) or ([] if not (credit or "").strip() else [credit or ""])
    for part in parts:
        for name in names:
            if same_name(part, name):
                return "same", part
            if best[0] is None and alike_name(part, name):
                best = ("alike", part)
    return best


def title_has(title: str | None, names: list[str]) -> bool:
    """Is one of the names written inside a title (word boundaries, same spelling rules)?"""
    words = re.findall(r"\w+", unicodedata.normalize("NFC", title or ""))
    if not words:
        return False
    for name in names:
        size = len(re.findall(r"\w+", name))
        if size == 0 or size > len(words):
            continue
        for start in range(len(words) - size + 1):
            if same_name(" ".join(words[start : start + size]), name):
                return True
    return False
