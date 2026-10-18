"""Optional AI-assisted *review* of a rule-based transliteration.

This is a verifier, not a rewriter. Per the project rules:

* The AI must NOT freely rewrite lyrics. The original Roman is passed through
  verbatim and is re-checked after the model responds.
* Every suggestion must carry a reason and supporting evidence.
* Suggestions are returned as ``pending_review`` and are NEVER auto-applied.
* The model's self-reported confidence is explicitly labelled as NOT a measured
  metric and never drives status.

The reviewer reuses the existing provider abstraction in
``app.services.ai`` (falling back to the offline ``MockProvider``), so no new
AI infrastructure is introduced.
"""

from __future__ import annotations

import json
import re
import unicodedata
from dataclasses import dataclass, field
from typing import Any

from app.config import get_settings
from app.services.ai import TextProvider, select_provider

# Compact restatement of the authoritative rules the reviewer must respect.
_RULES_CONTEXT = (
    "Prabhat Samgiita uses P.R. Sarkar's Roman Samskrta scheme. Key rules: "
    "Á=ā(आ/ा), II=ī(ई/ी), Ú=ū(ऊ/ू); SH=श (palatal), Ś=ष (retroflex), S=स (dental); "
    "T́/t'=ट, D́/d'=ड, Ń/n'=ण retroflex; Ŕ=ड़, ŔH=ढ़; Ḿ/m'=anusvara(ं); "
    "aspirates are h-digraphs (KH GH CH JH TH DH PH BH); word-final bare "
    "consonants take halanta (्); consonant clusters form conjuncts. "
    "Bengali/Sanskrit keep vowel hiatus literally (JÁI→जाइ), but Hindi/Urdu "
    "insert a य/व glide (DUNIÁ→दुनिया). Vocalic ṛ (e.g. KRŚŃA→कृष्ण) is written "
    "with ऋ/ृ. Foreign f/z/q use nukta (फ़ ज़ क़)."
)


@dataclass
class AISuggestion:
    scope: str  # "line" | "token" | "word"
    target: str  # the roman/devanagari fragment the suggestion concerns
    problem: str
    suggested_devanagari: str
    reason: str
    evidence: str
    model_self_reported_confidence: str | None  # NOT a measured metric
    status: str = "pending_review"
    roman_preserved: bool = True
    is_devanagari: bool = True


@dataclass
class AIReviewResult:
    available: bool
    assessment: str  # "ok" | "suggest_changes" | "unavailable" | "unparseable"
    overall_comment: str = ""
    suggestions: list[AISuggestion] = field(default_factory=list)
    provider: str = ""
    caveat: str = (
        "AI suggestions are advisory and pending human review. Self-reported "
        "confidence is not a measured accuracy metric."
    )

    def as_dict(self) -> dict[str, Any]:
        return {
            "available": self.available,
            "assessment": self.assessment,
            "overall_comment": self.overall_comment,
            "provider": self.provider,
            "caveat": self.caveat,
            "suggestions": [
                {
                    "scope": s.scope,
                    "target": s.target,
                    "problem": s.problem,
                    "suggested_devanagari": s.suggested_devanagari,
                    "reason": s.reason,
                    "evidence": s.evidence,
                    "model_self_reported_confidence": s.model_self_reported_confidence,
                    "status": s.status,
                    "roman_preserved": s.roman_preserved,
                    "is_devanagari": s.is_devanagari,
                }
                for s in self.suggestions
            ],
        }


def _build_prompt(roman: str, devanagari: str | None, language_hint: str | None) -> str:
    hint = f"\nLikely language of this song: {language_hint}." if language_hint else ""
    return (
        "You are a careful VERIFIER of Devanagari transliteration. You must NOT "
        "rewrite or translate the lyrics. Only flag likely transliteration "
        "errors in the GENERATED Devanagari relative to the ORIGINAL Roman and "
        "the rules below.\n\n"
        f"RULES: {_RULES_CONTEXT}{hint}\n\n"
        f"ORIGINAL ROMAN:\n{roman}\n\n"
        f"GENERATED DEVANAGARI:\n{devanagari}\n\n"
        "Return ONLY valid minified JSON with this shape:\n"
        '{"assessment":"ok"|"suggest_changes","overall_comment":"...",'
        '"suggestions":[{"scope":"line|word|token","target":"<roman or dev '
        'fragment>","problem":"...","suggested_devanagari":"...","reason":"...",'
        '"evidence":"<which rule/why>","confidence":"low|medium|high"}]}\n'
        "Do not include the Roman text in suggested_devanagari. If the output "
        "looks correct, return assessment \"ok\" with an empty suggestions list."
    )


def _is_devanagari(text: str) -> bool:
    letters = [c for c in text if c.strip()]
    if not letters:
        return False
    return all(0x900 <= ord(c) <= 0x97F or c.isspace() for c in text)


def _contains_roman_letters(text: str) -> bool:
    return bool(re.search(r"[A-Za-z]", unicodedata.normalize("NFC", text)))


def _parse(raw: str, roman: str) -> AIReviewResult | None:
    # Extract the first JSON object from the model output.
    match = re.search(r"\{.*\}", raw, re.DOTALL)
    if not match:
        return None
    try:
        data = json.loads(match.group(0))
    except json.JSONDecodeError:
        return None

    suggestions: list[AISuggestion] = []
    for item in data.get("suggestions", []) or []:
        sug = str(item.get("suggested_devanagari", ""))
        # Guardrails: suggestion must be Devanagari and must not smuggle Roman
        # text back in; otherwise it is kept but clearly marked invalid.
        suggestions.append(
            AISuggestion(
                scope=str(item.get("scope", "line")),
                target=str(item.get("target", "")),
                problem=str(item.get("problem", "")),
                suggested_devanagari=sug,
                reason=str(item.get("reason", "")),
                evidence=str(item.get("evidence", "")),
                model_self_reported_confidence=item.get("confidence"),
                roman_preserved=not _contains_roman_letters(sug),
                is_devanagari=_is_devanagari(sug),
            )
        )
    assessment = str(data.get("assessment", "ok"))
    if assessment not in {"ok", "suggest_changes"}:
        assessment = "suggest_changes" if suggestions else "ok"
    return AIReviewResult(
        available=True,
        assessment=assessment,
        overall_comment=str(data.get("overall_comment", "")),
        suggestions=suggestions,
    )


async def ai_review(
    roman: str,
    devanagari: str | None,
    *,
    language_hint: str | None = None,
    provider: TextProvider | None = None,
) -> AIReviewResult:
    """Run an optional AI review. Never mutates the input; suggestions pend review."""
    prov = provider or select_provider(get_settings())
    provider_name = type(prov).__name__
    try:
        raw = await prov.complete(_build_prompt(roman, devanagari, language_hint))
    except Exception as exc:  # network / provider failure → degrade gracefully
        return AIReviewResult(
            available=False,
            assessment="unavailable",
            overall_comment=f"AI provider error: {exc}",
            provider=provider_name,
        )

    parsed = _parse(raw, roman)
    if parsed is None:
        return AIReviewResult(
            available=True,
            assessment="unparseable",
            overall_comment="AI response was not valid JSON; no suggestions applied.",
            provider=provider_name,
        )
    parsed.provider = provider_name
    return parsed
