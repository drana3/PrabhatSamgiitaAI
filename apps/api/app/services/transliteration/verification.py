"""Independent verification of a transliteration result.

This module deliberately does **not** trust the engine. It re-tokenises the
original text, re-derives expectations, and cross-checks the engine output
against the selected ruleset and deterministic structural invariants.

It never reports a numeric confidence (no calibrated method exists yet), and
it never upgrades status to ``reference_matched`` / ``manually_verified`` —
those require an authoritative reference or a human, which live outside this
module.
"""

from __future__ import annotations

import unicodedata
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any

from app.services.transliteration.engine import TransliterationResult, transliterate
from app.services.transliteration.mapping import (
    ANUSVARA,
    CHANDRABINDU,
    NUKTA,
    VISARGA,
)

_DEV_MATRAS = {
    "\u093e", "\u093f", "\u0940", "\u0941", "\u0942",
    "\u0947", "\u0948", "\u094b", "\u094c", "\u0943",
}
_DEV_COMBINING = _DEV_MATRAS | {"\u094d", ANUSVARA, VISARGA, CHANDRABINDU, NUKTA}


class VerificationStatus(StrEnum):
    RULES_PASSED = "rules_passed"
    REFERENCE_MATCHED = "reference_matched"
    NEEDS_REVIEW = "needs_review"
    UNSUPPORTED_INPUT = "unsupported_input"
    MANUALLY_VERIFIED = "manually_verified"


@dataclass
class VerificationIssue:
    code: str
    message: str
    severity: str = "warning"  # "error" | "warning" | "info"


@dataclass
class VerificationReport:
    status: VerificationStatus
    confidence: None = None  # intentionally always None: no calibrated metric
    issues: list[VerificationIssue] = field(default_factory=list)
    reference_source: str | None = None

    def as_dict(self) -> dict[str, Any]:
        return {
            "status": self.status.value,
            "confidence": self.confidence,
            "reference_source": self.reference_source,
            "issues": [
                {"code": i.code, "message": i.message, "severity": i.severity}
                for i in self.issues
            ],
        }


def _count_lines(text: str) -> int:
    return len(text.split("\n"))


def _valid_devanagari_marks(text: str) -> bool:
    """Combining marks must never start a string or follow whitespace/newline."""
    prev = ""
    for ch in text:
        if ch in _DEV_COMBINING:
            if prev == "" or prev.isspace():
                return False
        prev = ch
    return True


def verify(
    result: TransliterationResult,
    reference_devanagari: str | None = None,
) -> VerificationReport:
    """Independently verify ``result`` against the ruleset and invariants.

    If ``reference_devanagari`` is supplied (an authoritative Devanagari text
    for the *exact* song/line), it takes priority in the verification
    hierarchy and can yield ``reference_matched``.
    """
    issues: list[VerificationIssue] = []

    # (1) Independent re-run: the engine must be deterministic.
    rerun = transliterate(result.original)
    if rerun.devanagari != result.devanagari:
        issues.append(
            VerificationIssue(
                "non_deterministic",
                "re-running the engine produced a different result",
                "error",
            )
        )

    # (2) Every input character must be recognised.
    if result.unsupported_tokens:
        issues.append(
            VerificationIssue(
                "unsupported_tokens",
                "unrecognised input tokens: " + ", ".join(result.unsupported_tokens),
                "error",
            )
        )

    # (3) Ambiguous tokens (diphthong ae/ao, vocalic-ṛ, foreign) → review.
    if result.ambiguous_tokens:
        issues.append(
            VerificationIssue(
                "ambiguous_tokens",
                "ambiguous tokens requiring review: "
                + ", ".join(result.ambiguous_tokens),
                "warning",
            )
        )

    # (4) No lyric lines silently dropped/inserted.
    if result.devanagari is not None:
        if _count_lines(result.original) != _count_lines(result.devanagari):
            issues.append(
                VerificationIssue(
                    "line_count_mismatch",
                    "line count differs between Roman and Devanagari",
                    "error",
                )
            )
        # (5) Devanagari combining marks must be structurally valid.
        if not _valid_devanagari_marks(result.devanagari):
            issues.append(
                VerificationIssue(
                    "invalid_combining_mark",
                    "a Devanagari combining mark appears in an invalid position",
                    "error",
                )
            )
        # (6) Vowel-length preservation: long ū/ī/ā matras/independents must
        #     survive when their tokens were present.
        norm = unicodedata.normalize("NFC", result.original).upper()
        checks = [
            ("Á", {"आ", "\u093e"}, "ā (Á) dropped"),
            ("Ú", {"ऊ", "\u0942"}, "ū (Ú) dropped"),
            ("II", {"ई", "\u0940"}, "ī (ii) dropped"),
        ]
        for needle, glyphs, msg in checks:
            if needle in norm and not any(g in result.devanagari for g in glyphs):
                issues.append(VerificationIssue("vowel_length_lost", msg, "error"))

    # (7) Optional authoritative reference comparison (top of hierarchy).
    if reference_devanagari is not None and result.devanagari is not None:
        if _normalize_ref(reference_devanagari) == _normalize_ref(result.devanagari):
            return VerificationReport(
                status=VerificationStatus.REFERENCE_MATCHED,
                issues=issues,
                reference_source="authoritative_devanagari",
            )
        issues.append(
            VerificationIssue(
                "reference_mismatch",
                "generated output differs from the authoritative Devanagari",
                "warning",
            )
        )

    # Decide final status.
    has_error = any(i.severity == "error" for i in issues)
    has_warning = any(i.severity == "warning" for i in issues)
    if result.unsupported_tokens:
        status = VerificationStatus.UNSUPPORTED_INPUT
    elif has_error or has_warning or result.devanagari is None:
        status = VerificationStatus.NEEDS_REVIEW
    else:
        status = VerificationStatus.RULES_PASSED

    return VerificationReport(status=status, issues=issues)


def _normalize_ref(text: str) -> str:
    return unicodedata.normalize("NFC", text).strip()
