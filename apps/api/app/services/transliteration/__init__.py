"""Deterministic Roman Saṃskṛta → Devanagari transliteration engine.

This package implements the Prabhát Saṃgiita Roman-Saṃskṛta transliteration
scheme devised by P.R. Sarkar (see
https://www.prabhatasamgiita.net/romansamskrta.html) and the exact
character conventions used by the local song catalogue
(``data/generated/songs.json``).

The engine is split into three independent concerns:

* :mod:`app.services.transliteration.mapping` — the versioned, machine
  readable mapping specification (the source of truth for every token).
* :mod:`app.services.transliteration.engine` — the longest-match tokenizer
  and the context-sensitive Devanagari orthography builder.
* :mod:`app.services.transliteration.verification` — an *independent*
  verifier that re-checks an engine result without trusting it.

Accuracy and transparency are prioritised over coverage: ambiguous input is
flagged (``needs_review``) rather than silently guessed.
"""

from app.services.transliteration.engine import (
    ENGINE_VERSION,
    TransliterationResult,
    transliterate,
)
from app.services.transliteration.language_agents import (
    CORE_REVIEW_LANGUAGES,
    HINDI_FAMILY_LANGUAGES,
    CrossValidationResult,
    ReviewLanguage,
    cross_validate,
    review_deterministic,
)
from app.services.transliteration.mapping import RULESET_VERSION
from app.services.transliteration.verification import (
    VerificationReport,
    verify,
)

__all__ = [
    "ENGINE_VERSION",
    "RULESET_VERSION",
    "CORE_REVIEW_LANGUAGES",
    "CrossValidationResult",
    "HINDI_FAMILY_LANGUAGES",
    "ReviewLanguage",
    "TransliterationResult",
    "VerificationReport",
    "cross_validate",
    "review_deterministic",
    "transliterate",
    "verify",
]
