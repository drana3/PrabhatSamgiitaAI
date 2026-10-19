"""Language-specific review agents that sit *on top of* the rule-based engine.

Architecture (strict order)
---------------------------
1. ``transliterate()`` runs first — the deterministic Roman Saṃskṛta ruleset
   is always the source of the Devanagari candidate.
2. Language agents (Hindi / Bengali / Saṃskṛta / Urdu) review that candidate
   against *language-specific orthography conventions*, but they may never
   invent mappings outside the ruleset or rewrite the original Roman.
3. Suggestions are always ``pending_review`` and are never auto-applied.
4. Optional LLM calls (when enabled) receive the same ruleset context and the
   same guardrails as :mod:`app.services.transliteration.ai_review`.

Cross-validation
----------------
``cross_validate()`` runs two or more agents and reports agreement /
disagreement so a human (or HITL workflow) can resolve conflicts. Agreement
does **not** upgrade status to ``manually_verified``.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any

from app.services.ai import TextProvider
from app.services.transliteration.ai_review import AIReviewResult, ai_review
from app.services.transliteration.mapping import RULESET_VERSION

# Shared restatement of *our* conversion rules — every agent prompt/check
# is grounded in this. Agents may add language orthography notes, never
# override the mapping table.
RULESET_CONTEXT = (
    f"Ruleset v{RULESET_VERSION} (P.R. Sarkar Roman Saṃskṛta). "
    "Á=ā(आ/ा), II=ī(ई/ी), Ú=ū(ऊ/ू); SH=श, Ś=ष, S=स; "
    "T́/t'=ट, D́/d'=ड, Ń/n'=ण; Ŕ=ड़, ŔH=ढ़; Ḿ/m'=ं; "
    "aspirates KH GH CH JH TH DH PH BH; word-final bare consonants take ्; "
    "clusters form conjuncts. Do NOT invent unmapped characters. "
    "Do NOT rewrite or translate the Roman lyrics."
)


class ReviewLanguage(StrEnum):
    HINDI = "hindi"
    BENGALI = "bengali"
    SAMSKRTA = "samskrta"
    URDU = "urdu"
    # Eastern Indo-Aryan varieties: Hindi orthography layer + dialect notes.
    MAGAHI = "magahi"
    MAITHILI = "maithili"
    ANGIKA = "angika"
    BHOJPURI = "bhojpuri"


#: Default set for cross-validation (regional agents are opt-in via API).
CORE_REVIEW_LANGUAGES: tuple[ReviewLanguage, ...] = (
    ReviewLanguage.HINDI,
    ReviewLanguage.BENGALI,
    ReviewLanguage.SAMSKRTA,
    ReviewLanguage.URDU,
)

#: Regional agents that reuse Hindi deterministic orthography fixes.
HINDI_FAMILY_LANGUAGES: frozenset[ReviewLanguage] = frozenset(
    {
        ReviewLanguage.HINDI,
        ReviewLanguage.URDU,
        ReviewLanguage.MAGAHI,
        ReviewLanguage.MAITHILI,
        ReviewLanguage.ANGIKA,
        ReviewLanguage.BHOJPURI,
    }
)


# Language-specific orthography notes layered *on* the shared ruleset.
_LANGUAGE_NOTES: dict[ReviewLanguage, str] = {
    ReviewLanguage.HINDI: (
        "Hindi orthography on top of the ruleset: "
        "insert य/व glide for vowel hiatus (इ+आ→इया, उ+आ→उवा) so DUNIÁ→दुनिया "
        "not दुनिआ; Roman VÁNLO/VANLO is the Hindi vocative वालों (N marks "
        "nasalization ं, not consonant न्) so DUNIÁVÁNLO→दुनियावालों not "
        "दुनिआवान्लो; prefer vocalic ऋ/ृ for KRŚŃA→कृष्ण when Roman clearly "
        "intends that; nukta फ़ ज़ क़ for foreign f/z/q; schwa deletion is "
        "NOT applied automatically by our engine — only flag if the generated "
        "form is clearly unreadable as Hindi."
    ),
    ReviewLanguage.BENGALI: (
        "Bengali orthography on top of the ruleset: "
        "KEEP vowel hiatus literally (JÁI→जाइ, DÁO→दाओ, OI→ओइ) — do NOT insert "
        "य/व glides; final short a often written/sung as o but our engine keeps "
        "inherent अ — do not rewrite UPAL→उपलो; BA vs VA: corpus often uses BA; "
        "do not force VA. Retroflex and sibilant distinctions from the ruleset "
        "must be preserved."
    ),
    ReviewLanguage.SAMSKRTA: (
        "Saṃskṛta orthography on top of the ruleset: "
        "prefer vocalic ऋ/ृ (and ॠ) when Roman R sits between consonants "
        "(e.g. KRŚŃA→कृष्ण, VRIN→वृन्); preserve visarga where Roman has "
        "AH/ḥ endings; anusvāra Ḿ→ं; do NOT apply Hindi schwa deletion; "
        "vowel hiatus is kept (no य-glide insertion) unless the Roman "
        "already writes Y/V."
    ),
    ReviewLanguage.URDU: (
        "Urdu (Devanagari script) orthography on top of the ruleset: "
        "same hiatus-glide convention as Hindi (DUNIÁ→दुनिया); same VÁNLO→वालों "
        "vocative nasalization (DUNIÁVÁNLO→दुनियावालों); nukta required "
        "for f/z/q (फ़ ज़ क़); AE/AO diphthongs map to ऐ/औ per ruleset but "
        "review common Urdu spellings (FAORAN→फ़ौरन); do NOT invent Perso-"
        "Arabic letters outside Devanagari+nukta."
    ),
    ReviewLanguage.MAGAHI: (
        "Magahi (on Hindi orthography layer): keep sung vowel length from Roman; "
        "do not force Bengali hiatus spellings; apply Hindi य/व glides where "
        "hiatus is clearly Hindi-like; flag English/loan nukta forms; never invent "
        "glyphs outside the ruleset."
    ),
    ReviewLanguage.MAITHILI: (
        "Maithili (on Hindi orthography layer): preserve long Á/ई from Roman; "
        "watch endings (-ahi/-ain) without inventing glyphs; Hindi hiatus glides "
        "apply when Roman clearly intends them; keep dialect lexicon literal."
    ),
    ReviewLanguage.ANGIKA: (
        "Angika / Aungiká (on Hindi orthography layer): keep dialect lexicon "
        "literal from Roman; do not Bengali-glide vowel hiatus; Hindi य/व glides "
        "only when hiatus matches Hindi conventions."
    ),
    ReviewLanguage.BHOJPURI: (
        "Bhojpuri (on Hindi orthography layer): preserve nasalization (Ḿ/ं); "
        "common -ba/-wa endings stay as written in Roman; Hindi hiatus/vocative "
        "conventions apply; do not invent Perso-Arabic letters."
    ),
}


def language_note(language: ReviewLanguage | str) -> str:
    """Public accessor for orthography notes (admin / HITL copy)."""
    lang = ReviewLanguage(language) if not isinstance(language, ReviewLanguage) else language
    return _LANGUAGE_NOTES[lang]


_I_LIKE = set("इईिी")  # short/long i (independent or matra)
_U_LIKE = set("उऊुू")
_AA = "आ"


@dataclass
class AgentSuggestion:
    """One language-agent finding. Never mutates the engine output."""

    agent: str
    scope: str  # "word" | "line" | "token"
    target_roman: str
    engine_devanagari: str
    suggested_devanagari: str
    problem: str
    reason: str
    evidence: str
    rule_basis: str  # always cites ruleset + language note
    status: str = "pending_review"
    source: str = "deterministic"  # "deterministic" | "llm"
    model_self_reported_confidence: str | None = None

    def as_dict(self) -> dict[str, Any]:
        return {
            "agent": self.agent,
            "scope": self.scope,
            "target_roman": self.target_roman,
            "engine_devanagari": self.engine_devanagari,
            "suggested_devanagari": self.suggested_devanagari,
            "problem": self.problem,
            "reason": self.reason,
            "evidence": self.evidence,
            "rule_basis": self.rule_basis,
            "status": self.status,
            "source": self.source,
            "model_self_reported_confidence": self.model_self_reported_confidence,
        }


@dataclass
class AgentReview:
    language: str
    available: bool = True
    assessment: str = "ok"  # ok | suggest_changes | unavailable
    overall_comment: str = ""
    suggestions: list[AgentSuggestion] = field(default_factory=list)
    ruleset_version: str = RULESET_VERSION
    method: str = "rules_plus_language_agent"

    def as_dict(self) -> dict[str, Any]:
        return {
            "language": self.language,
            "available": self.available,
            "assessment": self.assessment,
            "overall_comment": self.overall_comment,
            "ruleset_version": self.ruleset_version,
            "method": self.method,
            "suggestions": [s.as_dict() for s in self.suggestions],
        }


@dataclass
class CrossValidationResult:
    """Comparison across language agents. Never auto-applies anything."""

    engine_devanagari: str | None
    ruleset_version: str
    agents: list[AgentReview]
    agreements: list[dict[str, Any]] = field(default_factory=list)
    disagreements: list[dict[str, Any]] = field(default_factory=list)
    consensus: str = "no_consensus"  # all_ok | agree_on_changes | conflict | no_consensus
    caveat: str = (
        "Language-agent suggestions are advisory and pending human review. "
        "They sit on top of the rule-based engine and never replace it. "
        "Cross-agent agreement is not measured accuracy."
    )

    def as_dict(self) -> dict[str, Any]:
        return {
            "engine_devanagari": self.engine_devanagari,
            "ruleset_version": self.ruleset_version,
            "consensus": self.consensus,
            "caveat": self.caveat,
            "agreements": self.agreements,
            "disagreements": self.disagreements,
            "agents": [a.as_dict() for a in self.agents],
        }


def _nfc(text: str) -> str:
    return unicodedata.normalize("NFC", text)


def _words(text: str) -> list[str]:
    # Split on whitespace/punctuation but keep Devanagari clusters intact.
    return [w for w in re.split(r"([\s,;.!?()\"'“”‘’—–]+)", text) if w]


def _roman_words(text: str) -> list[str]:
    return [w for w in re.split(r"([\s,;.!?()\"'`]+)", text) if w]


def _pair_words(roman: str, devanagari: str) -> list[tuple[str, str]]:
    """Best-effort word pairing for review (not a full aligner)."""
    punct_r = r"[\s,;.!?()\"'`]+"
    punct_d = r"[\s,;.!?()\"'“”‘’—–]+"
    rw = [w for w in _roman_words(roman) if w.strip() and not re.fullmatch(punct_r, w)]
    dw = [w for w in _words(devanagari) if w.strip() and not re.fullmatch(punct_d, w)]
    n = min(len(rw), len(dw))
    return list(zip(rw[:n], dw[:n], strict=False))


def _has_i_aa_hiatus(dev_word: str) -> bool:
    """True if generated Devanagari has इ/ई/ि/ी immediately followed by आ."""
    w = _nfc(dev_word)
    for i, ch in enumerate(w[:-1]):
        if ch in _I_LIKE and w[i + 1] == _AA:
            return True
    return False


def _insert_ya_glide_after_i(dev_word: str) -> str:
    """Insert य between i-like vowel and following आ → …िया (Hindi/Urdu).

    Independent आ after the glide becomes dependent ा on य, so दुनिआ → दुनिया
    (not दुनियआ).
    """
    w = list(_nfc(dev_word))
    out: list[str] = []
    i = 0
    while i < len(w):
        out.append(w[i])
        if i + 1 < len(w) and w[i] in _I_LIKE and w[i + 1] == _AA:
            out.append("य")
            out.append("\u093e")  # ा
            i += 2
            continue
        i += 1
    return "".join(out)


def _has_u_aa_hiatus(dev_word: str) -> bool:
    w = _nfc(dev_word)
    for i, ch in enumerate(w[:-1]):
        if ch in _U_LIKE and w[i + 1] == _AA:
            return True
    return False


def _insert_va_glide_after_u(dev_word: str) -> str:
    """Insert व between u-like vowel and following आ → …ुवा."""
    w = list(_nfc(dev_word))
    out: list[str] = []
    i = 0
    while i < len(w):
        out.append(w[i])
        if i + 1 < len(w) and w[i] in _U_LIKE and w[i + 1] == _AA:
            out.append("व")
            out.append("\u093e")  # ा
            i += 2
            continue
        i += 1
    return "".join(out)


# Roman patterns that often intend vocalic ṛ in Saṃskṛta / Hindi (between
# consonants). Deterministic flag only — suggestion still pending_review.
_VOCALIC_R_RE = re.compile(
    r"(?i)(?P<pre>[KGCTDJPBSMHLV])R(?P<post>[ŚSŃNMTDKGCBPH])"
)


def _suggest_vocalic_r(roman_word: str, engine_word: str) -> str | None:
    """If Roman has C+R+C and engine rendered र, suggest ऋ/ृ form tentatively."""
    if not _VOCALIC_R_RE.search(_nfc(roman_word)):
        return None
    # Only suggest when engine clearly used र (not already ऋ/ृ).
    if "ऋ" in engine_word or "\u0943" in engine_word:  # ृ
        return None
    if "र" not in engine_word:
        return None
    # Pattern: क् + र → कृ  (replace virama+र with ृ on the consonant).
    consonants = set("कखगघङचछजझञटठडढणतथदधनपफबभमयरलवशषसह")
    chars = list(_nfc(engine_word))
    for i, ch in enumerate(chars):
        if ch != "र" or i == 0:
            continue
        if i >= 2 and chars[i - 1] == "्" and chars[i - 2] in consonants:
            # C ् र [्] X → C ृ X  (कृष्ण from क्र्ष्ण)
            chars[i - 1] = "\u0943"
            del chars[i]  # drop र
            if i < len(chars) and chars[i] == "्":
                del chars[i]  # drop conjunct virama that followed र
            return "".join(chars)
        if chars[i - 1] in consonants:
            chars[i] = "\u0943"
            return "".join(chars)
    return None


def _roman_has_vanlo(roman_word: str) -> bool:
    """True when Roman writes VÁNLO/VANLO (Hindi/Urdu vocative wāloṅ)."""
    up = _nfc(roman_word).upper()
    return "VÁNLO" in up or "VANLO" in up


def _apply_vanlo_fix(dev_word: str) -> str:
    """वान्लो (literal ruleset) → वालों (Hindi vocative with anusvara)."""
    return _nfc(dev_word).replace("वान्लो", "वालों").replace("वानलो", "वालों")


def _hindi_urdu_orthography_pass(roman_word: str, engine_word: str) -> tuple[str, list[str]]:
    """Apply stacked Hindi/Urdu orthography fixes on top of engine output.

    Returns (suggested, list of problem codes applied). Never invents mappings
    outside documented Hindi/Urdu conventions layered on the ruleset.
    """
    sug = engine_word
    problems: list[str] = []
    if _has_i_aa_hiatus(sug):
        nxt = _insert_ya_glide_after_i(sug)
        if nxt != sug:
            sug = nxt
            problems.append("hiatus_ya_glide")
    if _has_u_aa_hiatus(sug):
        nxt = _insert_va_glide_after_u(sug)
        if nxt != sug:
            sug = nxt
            problems.append("hiatus_va_glide")
    if _roman_has_vanlo(roman_word):
        nxt = _apply_vanlo_fix(sug)
        if nxt != sug:
            sug = nxt
            problems.append("vanlo_vocative")
    return sug, problems


def _deterministic_hindi_urdu(
    language: ReviewLanguage, roman: str, devanagari: str
) -> list[AgentSuggestion]:
    suggestions: list[AgentSuggestion] = []
    note = _LANGUAGE_NOTES[language]
    for rw, dw in _pair_words(roman, devanagari):
        sug, problems = _hindi_urdu_orthography_pass(rw, dw)
        if sug != dw and problems:
            reason_parts = []
            evidence_parts = []
            if "hiatus_ya_glide" in problems:
                reason_parts.append("insert य between i and ā")
                evidence_parts.append("इ+आ → इया (DUNIÁ → दुनिया)")
            if "hiatus_va_glide" in problems:
                reason_parts.append("insert व between u and ā")
                evidence_parts.append("उ+आ → उवा")
            if "vanlo_vocative" in problems:
                reason_parts.append(
                    "Roman VÁNLO marks nasalized वालों, not वान्लो"
                )
                evidence_parts.append(
                    "DUNIÁVÁNLO → दुनियावालों (vocative 'O people of the world')"
                )
            suggestions.append(
                AgentSuggestion(
                    agent=language.value,
                    scope="word",
                    target_roman=rw,
                    engine_devanagari=dw,
                    suggested_devanagari=sug,
                    problem="; ".join(problems),
                    reason=(
                        f"{language.value.title()} orthography on ruleset: "
                        + "; ".join(reason_parts)
                    ),
                    evidence="; ".join(evidence_parts),
                    rule_basis=f"{RULESET_CONTEXT} | {note}",
                    source="deterministic",
                )
            )
        # Vocalic-ṛ is a separate optional suggestion (may compose with above).
        vocalic_base = sug if sug != dw else dw
        vocalic = _suggest_vocalic_r(rw, vocalic_base)
        if vocalic and vocalic != vocalic_base and vocalic != dw:
            suggestions.append(
                AgentSuggestion(
                    agent=language.value,
                    scope="word",
                    target_roman=rw,
                    engine_devanagari=dw,
                    suggested_devanagari=vocalic,
                    problem="possible vocalic ṛ rendered as consonant र",
                    reason="Roman C+R+C often means ऋ/ृ in Hindi/Saṃskṛta",
                    evidence="ruleset flags bare R between consonants as ambiguous",
                    rule_basis=f"{RULESET_CONTEXT} | {note}",
                    source="deterministic",
                )
            )
    return suggestions


def _roman_has_i_aa_without_y(roman_word: str) -> bool:
    """True when Roman has IÁ (hiatus) and does not already write IYÁ/IYA."""
    up = _nfc(roman_word).upper()
    if "IYÁ" in up or "IYA" in up or "IY'A" in up:
        return False
    return "IÁ" in up or "I'A" in up


def _deterministic_bengali(roman: str, devanagari: str) -> list[AgentSuggestion]:
    """Bengali agent: keep hiatus; flag if a Hindi-style य-glide was forced."""
    suggestions: list[AgentSuggestion] = []
    note = _LANGUAGE_NOTES[ReviewLanguage.BENGALI]
    for rw, dw in _pair_words(roman, devanagari):
        # Protective check: if Roman omitted Y but Devanagari has या after i
        # (and not the engine's natural इआ hiatus), flag for Bengali.
        if _roman_has_i_aa_without_y(rw) and "या" in dw and not _has_i_aa_hiatus(dw):
            suggestions.append(
                AgentSuggestion(
                    agent="bengali",
                    scope="word",
                    target_roman=rw,
                    engine_devanagari=dw,
                    suggested_devanagari=dw.replace("या", "आ", 1),
                    problem="य-glide present but Roman omitted Y (Bengali keeps hiatus)",
                    reason="Bengali/Saṃskṛta keep इआ; do not insert य",
                    evidence="JÁI→जाइ, DÁO→दाओ convention in ruleset notes",
                    rule_basis=f"{RULESET_CONTEXT} | {note}",
                    source="deterministic",
                )
            )
    return suggestions


def _deterministic_samskrta(roman: str, devanagari: str) -> list[AgentSuggestion]:
    suggestions: list[AgentSuggestion] = []
    note = _LANGUAGE_NOTES[ReviewLanguage.SAMSKRTA]
    for rw, dw in _pair_words(roman, devanagari):
        vocalic = _suggest_vocalic_r(rw, dw)
        if vocalic and vocalic != dw:
            suggestions.append(
                AgentSuggestion(
                    agent="samskrta",
                    scope="word",
                    target_roman=rw,
                    engine_devanagari=dw,
                    suggested_devanagari=vocalic,
                    problem="possible vocalic ṛ rendered as consonant र",
                    reason="Saṃskṛta prefers ऋ/ृ for C+R+C roots (e.g. कृष्ण)",
                    evidence="ruleset: bare R between consonants is ambiguous",
                    rule_basis=f"{RULESET_CONTEXT} | {note}",
                    source="deterministic",
                )
            )
        if _roman_has_i_aa_without_y(rw) and "या" in dw and not _has_i_aa_hiatus(dw):
            suggestions.append(
                AgentSuggestion(
                    agent="samskrta",
                    scope="word",
                    target_roman=rw,
                    engine_devanagari=dw,
                    suggested_devanagari=dw.replace("या", "आ", 1),
                    problem="य-glide not licensed by Roman (Saṃskṛta keeps hiatus)",
                    reason="Do not insert य unless Roman writes Y",
                    evidence="ruleset + Saṃskṛta note",
                    rule_basis=f"{RULESET_CONTEXT} | {note}",
                    source="deterministic",
                )
            )
    return suggestions


def review_deterministic(
    language: ReviewLanguage | str,
    roman: str,
    engine_devanagari: str | None,
) -> AgentReview:
    """Run the offline language agent on top of engine output."""
    lang = ReviewLanguage(language) if not isinstance(language, ReviewLanguage) else language
    if engine_devanagari is None:
        return AgentReview(
            language=lang.value,
            assessment="suggest_changes",
            overall_comment="Engine produced no Devanagari; nothing to language-review.",
        )
    if lang in HINDI_FAMILY_LANGUAGES:
        suggestions = _deterministic_hindi_urdu(lang, roman, engine_devanagari)
    elif lang is ReviewLanguage.BENGALI:
        suggestions = _deterministic_bengali(roman, engine_devanagari)
    else:
        suggestions = _deterministic_samskrta(roman, engine_devanagari)

    assessment = "suggest_changes" if suggestions else "ok"
    comment = (
        f"{lang.value} agent reviewed engine output against ruleset "
        f"v{RULESET_VERSION} plus {_LANGUAGE_NOTES[lang][:80]}…"
    )
    return AgentReview(
        language=lang.value,
        assessment=assessment,
        overall_comment=comment,
        suggestions=suggestions,
    )


def _llm_to_agent_suggestions(
    language: ReviewLanguage, llm: AIReviewResult, engine_devanagari: str | None
) -> list[AgentSuggestion]:
    out: list[AgentSuggestion] = []
    note = _LANGUAGE_NOTES[language]
    for s in llm.suggestions:
        if not s.is_devanagari or not s.roman_preserved:
            continue  # drop invalid suggestions
        out.append(
            AgentSuggestion(
                agent=language.value,
                scope=s.scope,
                target_roman=s.target,
                engine_devanagari=engine_devanagari or "",
                suggested_devanagari=s.suggested_devanagari,
                problem=s.problem,
                reason=s.reason,
                evidence=s.evidence,
                rule_basis=f"{RULESET_CONTEXT} | {note}",
                status="pending_review",
                source="llm",
                model_self_reported_confidence=s.model_self_reported_confidence,
            )
        )
    return out


async def review_with_optional_llm(
    language: ReviewLanguage | str,
    roman: str,
    engine_devanagari: str | None,
    *,
    use_llm: bool = False,
    provider: TextProvider | None = None,
) -> AgentReview:
    """Deterministic language review, optionally enriched by a ruleset-grounded LLM."""
    lang = ReviewLanguage(language) if not isinstance(language, ReviewLanguage) else language
    base = review_deterministic(lang, roman, engine_devanagari)
    if not use_llm:
        return base

    # LLM sees shared ruleset + language note; still cannot rewrite Roman.
    llm = await ai_review(
        roman,
        engine_devanagari,
        language_hint=f"{lang.value} | {_LANGUAGE_NOTES[lang]}",
        provider=provider,
    )
    if not llm.available:
        base.overall_comment += f" | LLM unavailable ({llm.overall_comment})"
        return base

    llm_sugs = _llm_to_agent_suggestions(lang, llm, engine_devanagari)
    # Deduplicate by (target, suggested).
    seen = {(s.target_roman, s.suggested_devanagari) for s in base.suggestions}
    for s in llm_sugs:
        key = (s.target_roman, s.suggested_devanagari)
        if key not in seen:
            base.suggestions.append(s)
            seen.add(key)
    if base.suggestions:
        base.assessment = "suggest_changes"
    base.method = "rules_plus_language_agent_plus_llm"
    base.overall_comment += f" | LLM assessment={llm.assessment}"
    return base


def _build_cross_validation(
    engine_devanagari: str | None, agents: list[AgentReview]
) -> CrossValidationResult:
    """Compute agreements / conflicts / language-dependent splits from agent reviews."""
    buckets: dict[tuple[str, str], list[str]] = {}
    for agent in agents:
        for s in agent.suggestions:
            buckets.setdefault((s.target_roman, s.suggested_devanagari), []).append(
                agent.language
            )

    agreements: list[dict[str, Any]] = []
    conflicts: list[dict[str, Any]] = []
    by_target: dict[str, list[tuple[str, str]]] = {}
    for (target, suggested), langs_hit in buckets.items():
        by_target.setdefault(target, []).append((suggested, ",".join(langs_hit)))
        if len(langs_hit) >= 2:
            agreements.append(
                {
                    "target_roman": target,
                    "suggested_devanagari": suggested,
                    "agents": langs_hit,
                }
            )

    for target, variants in by_target.items():
        if len({v[0] for v in variants}) > 1:
            conflicts.append(
                {
                    "kind": "conflict",
                    "target_roman": target,
                    "variants": [
                        {"suggested_devanagari": sug, "agents": langs}
                        for sug, langs in variants
                    ],
                }
            )

    language_dependent: list[dict[str, Any]] = []
    agent_names = {a.language for a in agents}
    for (target, suggested), langs_hit in buckets.items():
        silent = sorted(agent_names - set(langs_hit))
        if silent and langs_hit:
            language_dependent.append(
                {
                    "kind": "language_dependent",
                    "target_roman": target,
                    "suggested_devanagari": suggested,
                    "suggesting_agents": langs_hit,
                    "silent_agents": silent,
                }
            )

    if all(a.assessment == "ok" for a in agents):
        consensus = "all_ok"
    elif conflicts:
        consensus = "conflict"
    elif language_dependent:
        # e.g. Hindi/Urdu want दुनिया; Bengali/Saṃskṛta keep दुनिआ.
        consensus = "language_dependent"
    elif agreements:
        consensus = "agree_on_changes"
    elif any(a.suggestions for a in agents):
        consensus = "no_consensus"
    else:
        consensus = "all_ok"

    return CrossValidationResult(
        engine_devanagari=engine_devanagari,
        ruleset_version=RULESET_VERSION,
        agents=agents,
        agreements=agreements,
        disagreements=conflicts + language_dependent,
        consensus=consensus,
    )


def cross_validate(
    roman: str,
    engine_devanagari: str | None,
    languages: list[str] | None = None,
) -> CrossValidationResult:
    """Run multiple language agents and report agreement / conflict.

    Deterministic only (no LLM) so it is safe for batch / HITL prep.
    """
    langs = languages or [lang.value for lang in CORE_REVIEW_LANGUAGES]
    agents = [review_deterministic(lang, roman, engine_devanagari) for lang in langs]
    return _build_cross_validation(engine_devanagari, agents)


async def cross_validate_async(
    roman: str,
    engine_devanagari: str | None,
    languages: list[str] | None = None,
    *,
    use_llm: bool = False,
    provider: TextProvider | None = None,
) -> CrossValidationResult:
    """Cross-validate with optional per-agent LLM enrichment."""
    if not use_llm:
        return cross_validate(roman, engine_devanagari, languages)

    langs = languages or [lang.value for lang in CORE_REVIEW_LANGUAGES]
    agents = [
        await review_with_optional_llm(
            lang, roman, engine_devanagari, use_llm=True, provider=provider
        )
        for lang in langs
    ]
    return _build_cross_validation(engine_devanagari, agents)
