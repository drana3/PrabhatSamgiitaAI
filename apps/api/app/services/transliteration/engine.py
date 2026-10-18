"""Longest-match tokenizer + context-sensitive Devanagari builder.

The engine never performs naive global replacements. It:

1. Normalises Unicode (NFC) and apostrophe variants *without* discarding
   meaningful diacritics.
2. Tokenises the input with a longest-match-first scan so that multi-character
   tokens (``II``, ``KH``, ``T́H``, ``T'H`` …) win over their components.
3. Builds Devanagari with proper orthography: inherent vowels, dependent
   vowel signs (mātrā), virāma / conjuncts, independent vowels at word
   start, anusvāra and visarga.
4. Preserves the original input verbatim and records every token decision so
   the independent verifier (and humans) can audit the result.
"""

from __future__ import annotations

import unicodedata
from dataclasses import dataclass, field

from app.services.transliteration.mapping import (
    MAPPING,
    RULESET_VERSION,
    VIRAMA,
    ConsonantRule,
    MarkRule,
    VowelRule,
)

#: Version of the tokenizer/builder algorithm (independent of the mapping).
ENGINE_VERSION = "1.0.0"


@dataclass
class Token:
    """One tokenization decision over the (normalised) input."""

    surface: str  # exact normalised substring consumed
    kind: str  # "mapped" | "literal" | "unknown"
    rule_id: str | None = None
    devanagari: str = ""
    note: str = ""
    ambiguous: bool = False
    foreign: bool = False


@dataclass
class TransliterationResult:
    original: str
    normalized: str
    devanagari: str | None
    tokens: list[Token]
    ruleset_version: str = RULESET_VERSION
    engine_version: str = ENGINE_VERSION
    warnings: list[str] = field(default_factory=list)
    unsupported_tokens: list[str] = field(default_factory=list)
    ambiguous_tokens: list[str] = field(default_factory=list)

    @property
    def method(self) -> str:
        return "rule_based"


def _normalize(text: str) -> str:
    text = unicodedata.normalize("NFC", text)
    for variant in ("\u2019", "\u2018", "`"):
        text = text.replace(variant, "'")
    return text


def _is_letterish(ch: str) -> bool:
    """Characters that participate in tokens (letters + the acute combiner + apostrophe)."""
    return ch.isalpha() or ch == "'" or ch == "\u0301"


def _tokenize(normalized: str) -> list[Token]:
    """Longest-match-first tokenizer. Non-letter runs are preserved as literals."""
    tokens: list[Token] = []
    i = 0
    n = len(normalized)
    max_len = MAPPING.max_len
    while i < n:
        ch = normalized[i]
        if not _is_letterish(ch):
            # Preserve punctuation, whitespace, digits, newlines verbatim.
            tokens.append(Token(surface=ch, kind="literal"))
            i += 1
            continue

        matched = False
        upper_slice_cache = normalized.upper()
        for length in range(min(max_len, n - i), 0, -1):
            candidate = upper_slice_cache[i : i + length]
            rule = MAPPING.lookup(candidate)
            if rule is None:
                continue
            surface = normalized[i : i + length]
            if isinstance(rule, VowelRule):
                tokens.append(
                    Token(
                        surface=surface,
                        kind="mapped",
                        rule_id=rule.rule_id,
                        note=rule.note,
                        ambiguous=not rule.unambiguous,
                    )
                )
            elif isinstance(rule, ConsonantRule):
                tokens.append(
                    Token(
                        surface=surface,
                        kind="mapped",
                        rule_id=rule.rule_id,
                        devanagari=rule.glyph,
                        note=rule.note,
                        ambiguous=not rule.unambiguous,
                        foreign=rule.foreign,
                    )
                )
            elif isinstance(rule, MarkRule):
                tokens.append(
                    Token(
                        surface=surface,
                        kind="mapped",
                        rule_id=rule.rule_id,
                        devanagari=rule.glyph,
                        note=rule.note,
                        ambiguous=not rule.unambiguous,
                    )
                )
            i += length
            matched = True
            break

        if not matched:
            if ch in ("'", "\u0301"):
                # A bare apostrophe not forming a diacritic token is ordinary
                # punctuation (elision/quote); a stray combining acute is a
                # source artifact. Preserve verbatim rather than flag as
                # unsupported input.
                tokens.append(Token(surface=ch, kind="literal"))
            else:
                # Unknown letter (e.g. X). Never guess its meaning.
                tokens.append(Token(surface=ch, kind="unknown"))
            i += 1
    return tokens


def _rule_for(token: Token):  # type: ignore[no-untyped-def]
    return MAPPING.lookup(_normalize(token.surface).upper())


def _build_devanagari(tokens: list[Token]) -> tuple[str, list[str]]:
    """Context-sensitive Devanagari construction. Returns (text, warnings)."""
    out: list[str] = []
    warnings: list[str] = []
    pending_consonant = False  # a consonant glyph awaiting its vowel/next element

    for idx, token in enumerate(tokens):
        if token.kind == "unknown":
            # Flush any pending consonant as halanta, then keep char verbatim.
            if pending_consonant:
                out.append(VIRAMA)
                pending_consonant = False
            out.append(token.surface)
            continue

        if token.kind == "literal":
            if pending_consonant:
                out.append(VIRAMA)  # word-final consonant → halanta (HAS'ANTA)
                pending_consonant = False
            out.append(token.surface)
            continue

        rule = _rule_for(token)
        if isinstance(rule, ConsonantRule):
            if pending_consonant:
                out.append(VIRAMA)  # consonant cluster → conjunct
            # Vocalic-R ambiguity: a bare "R" between consonants may be ऋ.
            if rule.rule_id == "C_RA":
                nxt = tokens[idx + 1] if idx + 1 < len(tokens) else None
                nxt_rule = _rule_for(nxt) if nxt and nxt.kind == "mapped" else None
                if pending_consonant and isinstance(nxt_rule, ConsonantRule):
                    token.ambiguous = True
                    token.note = (token.note + "; possible vocalic ṛ").strip("; ")
            out.append(rule.glyph)
            token.devanagari = rule.glyph
            pending_consonant = True
        elif isinstance(rule, VowelRule):
            if pending_consonant:
                if not rule.is_short_a:
                    out.append(rule.matra)
                    token.devanagari = rule.matra
                else:
                    token.devanagari = ""  # inherent
                pending_consonant = False
            else:
                out.append(rule.independent)
                token.devanagari = rule.independent
        elif isinstance(rule, MarkRule):
            # Anusvara/visarga attach to the current syllable; the pending
            # consonant keeps its inherent vowel.
            pending_consonant = False
            out.append(rule.glyph)
            token.devanagari = rule.glyph
        else:  # pragma: no cover - defensive
            warnings.append(f"no rule resolved for token {token.surface!r}")

    if pending_consonant:
        out.append(VIRAMA)
    return "".join(out), warnings


def transliterate(text: str) -> TransliterationResult:
    """Transliterate Roman Saṃskṛta → Devanagari deterministically.

    The returned :class:`TransliterationResult` always preserves ``original``
    exactly and exposes every unsupported or ambiguous token. ``devanagari`` is
    ``None`` only when the input contains no mappable content.
    """
    original = text
    normalized = _normalize(text)
    tokens = _tokenize(normalized)
    built, warnings = _build_devanagari(tokens)
    devanagari: str | None = built

    unsupported = [t.surface for t in tokens if t.kind == "unknown"]
    foreign = sorted({t.surface for t in tokens if t.foreign})
    ambiguous = sorted({t.surface for t in tokens if t.ambiguous})

    if foreign:
        warnings.append(
            "foreign (non-Saṃskṛta) consonants present and rendered with nukta: "
            + ", ".join(foreign)
        )
    if any(t.kind == "mapped" for t in tokens) is False:
        devanagari = None

    return TransliterationResult(
        original=original,
        normalized=normalized,
        devanagari=devanagari,
        tokens=tokens,
        warnings=warnings,
        unsupported_tokens=sorted(set(unsupported)),
        ambiguous_tokens=ambiguous,
    )
