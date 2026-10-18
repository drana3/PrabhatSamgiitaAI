"""Versioned, machine-readable Roman Saṃskṛta → Devanagari mapping spec.

Every mapping in this module is traceable to one of two sources:

* ``spec`` — the official Roman Saṃskṛta alphabet published at
  https://www.prabhatasamgiita.net/romansamskrta.html
* ``corpus`` — the exact Unicode characters observed in the authoritative
  local catalogue (``data/generated/songs.json``). The catalogue writes the
  retroflex / long-vowel diacritics with a *combining acute accent*
  (U+0301) on ``T`` and ``D`` and with precomposed ``Á Ú Ń Ś Ŕ Ḿ Ñ``.

Two input conventions are supported and are exactly equivalent:

* the *accent* convention used by the catalogue (``Á Ú Ń Ś T́ D́ Ŕ Ḿ``)
* the *apostrophe* convention used by the website URLs / booklets
  (``a' u' n' s' t' d' r' m'``)

Nothing here performs naive global string replacement; the strings below are
*tokens* consumed by the longest-match tokenizer in
:mod:`app.services.transliteration.engine`.
"""

from __future__ import annotations

import unicodedata
from dataclasses import dataclass, field
from enum import StrEnum

#: Semantic version of the mapping ruleset. Bump on any mapping change so that
#: stored provenance can be matched to the exact rules that produced it.
RULESET_VERSION = "1.0.0"

VIRAMA = "\u094d"  # ्  (halanta)
ANUSVARA = "\u0902"  # ं
VISARGA = "\u0903"  # ः
CHANDRABINDU = "\u0901"  # ँ
NUKTA = "\u093c"  # ़


class TokenKind(StrEnum):
    VOWEL = "vowel"
    CONSONANT = "consonant"
    ANUSVARA = "anusvara"
    VISARGA = "visarga"


@dataclass(frozen=True)
class VowelRule:
    rule_id: str
    independent: str  # e.g. आ
    matra: str  # dependent sign, "" for inherent short a
    is_short_a: bool
    source: str
    note: str = ""
    unambiguous: bool = True
    kind: TokenKind = TokenKind.VOWEL


@dataclass(frozen=True)
class ConsonantRule:
    rule_id: str
    glyph: str  # base consonant WITHOUT inherent vowel handling
    source: str
    note: str = ""
    unambiguous: bool = True
    foreign: bool = False
    kind: TokenKind = TokenKind.CONSONANT


@dataclass(frozen=True)
class MarkRule:
    rule_id: str
    glyph: str
    kind: TokenKind
    source: str
    note: str = ""
    unambiguous: bool = True


Rule = VowelRule | ConsonantRule | MarkRule


def _nfc(text: str) -> str:
    return unicodedata.normalize("NFC", text)


# Combining-acute diacritic forms exactly as they appear post-NFC in the corpus.
_T_RETRO = _nfc("T\u0301")  # T́  → ट
_D_RETRO = _nfc("D\u0301")  # D́  → ड


# ---------------------------------------------------------------------------
# Vowels (spec: romansamskrta.html alphabet table)
# ---------------------------------------------------------------------------
_VOWELS: dict[str, VowelRule] = {
    "A": VowelRule("V_A", "अ", "", True, "spec", "short a / inherent vowel"),
    "Á": VowelRule("V_AA", "आ", "\u093e", False, "corpus", "long ā (a')"),
    "A'": VowelRule("V_AA_APOS", "आ", "\u093e", False, "spec", "apostrophe form of ā"),
    "I": VowelRule("V_I", "इ", "\u093f", False, "spec", "short i"),
    "II": VowelRule("V_II", "ई", "\u0940", False, "spec", "long ī (written 'ii')"),
    "U": VowelRule("V_U", "उ", "\u0941", False, "spec", "short u"),
    "Ú": VowelRule("V_UU", "ऊ", "\u0942", False, "corpus", "long ū (u')"),
    "U'": VowelRule("V_UU_APOS", "ऊ", "\u0942", False, "spec", "apostrophe form of ū"),
    "E": VowelRule("V_E", "ए", "\u0947", False, "spec", "e"),
    "AE": VowelRule(
        "V_AE", "ऐ", "\u0948", False, "spec",
        "diphthong ae; only short-a+e, long Á+E is ā+e not this token",
        unambiguous=False,
    ),
    "O": VowelRule("V_O", "ओ", "\u094b", False, "spec", "o"),
    "AO": VowelRule(
        "V_AO", "औ", "\u094c", False, "spec",
        "diphthong ao; only short-a+o",
        unambiguous=False,
    ),
}


# ---------------------------------------------------------------------------
# Consonants (spec alphabet table). Aspirates are digraphs with H; retroflex
# uses the combining-acute / apostrophe diacritic; sibilant distinction:
#   SH → श (palatal), Ś/s' → ष (retroflex), S → स (dental).
# ---------------------------------------------------------------------------
_CONSONANTS: dict[str, ConsonantRule] = {
    # velar
    "K": ConsonantRule("C_KA", "क", "spec"),
    "KH": ConsonantRule("C_KHA", "ख", "spec"),
    "G": ConsonantRule("C_GA", "ग", "spec"),
    "GH": ConsonantRule("C_GHA", "घ", "spec"),
    "Ṅ": ConsonantRule("C_NGA", "ङ", "spec", "velar nasal (rare; usually anusvara)"),
    # palatal
    "C": ConsonantRule("C_CA", "च", "spec"),
    "CH": ConsonantRule("C_CHA", "छ", "spec"),
    "J": ConsonantRule("C_JA", "ज", "spec"),
    "JH": ConsonantRule("C_JHA", "झ", "spec"),
    "Ñ": ConsonantRule("C_NYA", "ञ", "corpus", "palatal nasal"),
    # retroflex (accent form)
    _T_RETRO: ConsonantRule("C_TTA", "ट", "corpus", "retroflex ṭa (T́)"),
    _nfc("T\u0301H"): ConsonantRule("C_TTHA", "ठ", "corpus", "retroflex ṭha (T́h)"),
    _D_RETRO: ConsonantRule("C_DDA", "ड", "corpus", "retroflex ḍa (D́)"),
    _nfc("D\u0301H"): ConsonantRule("C_DDHA", "ढ", "corpus", "retroflex ḍha (D́h)"),
    "Ń": ConsonantRule("C_NNA", "ण", "corpus", "retroflex ṇa"),
    "Ŕ": ConsonantRule("C_RRA", "ड़", "corpus", "retroflex flap ṛ (r'/ŕ)"),
    "ŔH": ConsonantRule("C_RRHA", "ढ़", "corpus", "retroflex flap aspirate ṛh"),
    # retroflex (apostrophe form)
    "T'": ConsonantRule("C_TTA", "ट", "spec", "apostrophe retroflex ṭa"),
    "T'H": ConsonantRule("C_TTHA", "ठ", "spec", "apostrophe retroflex ṭha"),
    "D'": ConsonantRule("C_DDA", "ड", "spec", "apostrophe retroflex ḍa"),
    "D'H": ConsonantRule("C_DDHA", "ढ", "spec", "apostrophe retroflex ḍha"),
    "N'": ConsonantRule("C_NNA", "ण", "spec", "apostrophe retroflex ṇa"),
    "R'": ConsonantRule("C_RRA", "ड़", "spec", "apostrophe retroflex flap"),
    "R'H": ConsonantRule("C_RRHA", "ढ़", "spec", "apostrophe retroflex flap aspirate"),
    # dental
    "T": ConsonantRule("C_TA", "त", "spec"),
    "TH": ConsonantRule("C_THA", "थ", "spec"),
    "D": ConsonantRule("C_DA", "द", "spec"),
    "DH": ConsonantRule("C_DHA", "ध", "spec"),
    "N": ConsonantRule("C_NA", "न", "spec"),
    # labial
    "P": ConsonantRule("C_PA", "प", "spec"),
    "PH": ConsonantRule("C_PHA", "फ", "spec"),
    "B": ConsonantRule("C_BA", "ब", "spec"),
    "BH": ConsonantRule("C_BHA", "भ", "spec"),
    "M": ConsonantRule("C_MA", "म", "spec"),
    # semivowels / liquids
    "Y": ConsonantRule("C_YA", "य", "spec"),
    "R": ConsonantRule("C_RA", "र", "spec"),
    "L": ConsonantRule("C_LA", "ल", "spec"),
    "V": ConsonantRule("C_VA", "व", "spec"),
    "W": ConsonantRule("C_WA", "व", "spec", "non-tantric; pronunciation aid only"),
    # sibilants + h
    "SH": ConsonantRule("C_SHA", "श", "spec", "palatal sibilant"),
    "Ś": ConsonantRule("C_SSA", "ष", "corpus", "retroflex sibilant (s')"),
    "S'": ConsonantRule("C_SSA", "ष", "spec", "apostrophe retroflex sibilant"),
    "S": ConsonantRule("C_SA", "स", "spec", "dental sibilant"),
    "H": ConsonantRule("C_HA", "ह", "spec"),
    # foreign consonants (not part of Saṃskṛta; flagged by the engine)
    "F": ConsonantRule(
        "C_FA", "फ" + NUKTA, "spec", "foreign (fa)", unambiguous=False, foreign=True
    ),
    "Z": ConsonantRule(
        "C_ZA", "ज" + NUKTA, "spec", "foreign (za)", unambiguous=False, foreign=True
    ),
    "Q": ConsonantRule(
        "C_QA", "क" + NUKTA, "spec", "foreign (qa)", unambiguous=False, foreign=True
    ),
}


# ---------------------------------------------------------------------------
# Nasalisation / visarga marks.
# ---------------------------------------------------------------------------
_MARKS: dict[str, MarkRule] = {
    "Ḿ": MarkRule(
        "M_ANUSVARA", ANUSVARA, TokenKind.ANUSVARA, "corpus", "anusvara / nasalisation (m')"
    ),
    "M'": MarkRule("M_ANUSVARA", ANUSVARA, TokenKind.ANUSVARA, "spec", "apostrophe anusvara"),
    "Ḥ": MarkRule("M_VISARGA", VISARGA, TokenKind.VISARGA, "spec", "visarga (ah)"),
}


def _normalise_match_key(text: str) -> str:
    """Canonical lookup form: NFC, apostrophe variants unified, upper-cased."""
    text = _nfc(text)
    for variant in ("\u2019", "\u2018", "`"):  # curly quotes / backtick → ASCII '
        text = text.replace(variant, "'")
    return text.upper()


@dataclass
class MappingTable:
    """Immutable, pre-indexed view used by the tokenizer."""

    tokens: dict[str, Rule]
    max_len: int = field(init=False)

    def __post_init__(self) -> None:
        self.max_len = max(len(k) for k in self.tokens)

    def lookup(self, token: str) -> Rule | None:
        return self.tokens.get(token)


def _build_table() -> MappingTable:
    merged: dict[str, Rule] = {}
    for table in (_VOWELS, _CONSONANTS, _MARKS):
        for key, rule in table.items():
            merged[_normalise_match_key(key)] = rule
    return MappingTable(tokens=merged)


#: The ready-to-use, longest-match-indexed mapping table.
MAPPING = _build_table()


def all_rules() -> list[tuple[str, Rule]]:
    """Return ``(match_key, rule)`` pairs for every mapping (for the audit report)."""
    return sorted(MAPPING.tokens.items(), key=lambda kv: (len(kv[0]), kv[0]))
