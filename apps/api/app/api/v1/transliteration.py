"""Roman Saṃskṛta → Devanagari transliteration endpoints.

Both the individual and batch endpoints share the exact same deterministic
engine. Language agents and optional AI review sit *on top of* that engine and
never replace or auto-apply changes. The batch endpoint stays LLM-free by
default.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.schemas.transliteration import (
    AgentReviewModel,
    AIReviewModel,
    BatchItemResponse,
    BatchRequest,
    BatchResponse,
    BatchSummary,
    CrossValidationModel,
    TransliterationRequest,
    TransliterationResponse,
    VerificationModel,
)
from app.services.transliteration import (
    ENGINE_VERSION,
    RULESET_VERSION,
    transliterate,
    verify,
)
from app.services.transliteration.ai_review import ai_review
from app.services.transliteration.language_agents import (
    ReviewLanguage,
    cross_validate,
    cross_validate_async,
    review_deterministic,
    review_with_optional_llm,
)
from app.services.transliteration.verification import VerificationStatus

router = APIRouter(prefix="/transliteration", tags=["transliteration"])

_VALID_AGENTS = {lang.value for lang in ReviewLanguage}


def _run(text: str, do_verify: bool) -> TransliterationResponse:
    result = transliterate(text)
    verification: VerificationModel | None = None
    status = "rules_passed" if not result.unsupported_tokens else "unsupported_input"
    if result.ambiguous_tokens and status == "rules_passed":
        status = "needs_review"
    if result.devanagari is None:
        status = "needs_review"

    if do_verify:
        report = verify(result)
        verification = VerificationModel(**report.as_dict())
        status = report.status.value
        if report.status is VerificationStatus.RULES_PASSED and result.devanagari is None:
            status = VerificationStatus.NEEDS_REVIEW.value

    return TransliterationResponse(
        original_roman=result.original,
        devanagari=result.devanagari,
        status=status,
        ruleset_version=RULESET_VERSION,
        engine_version=ENGINE_VERSION,
        warnings=result.warnings,
        unsupported_tokens=result.unsupported_tokens,
        ambiguous_tokens=result.ambiguous_tokens,
        verification=verification,
    )


def _normalize_agents(agents: list[str] | None) -> list[str]:
    if not agents:
        return []
    normalized = [a.strip().lower() for a in agents if a and a.strip()]
    bad = [a for a in normalized if a not in _VALID_AGENTS]
    if bad:
        raise HTTPException(
            status_code=422,
            detail=f"Unknown language agents {bad}; choose from {sorted(_VALID_AGENTS)}",
        )
    return normalized


@router.post("/roman-to-devanagari", response_model=TransliterationResponse)
async def roman_to_devanagari(payload: TransliterationRequest) -> TransliterationResponse:
    response = _run(payload.text, payload.verify)

    # Optional generic AI review (legacy / single-hint path).
    if payload.ai_review:
        review = await ai_review(
            response.original_roman,
            response.devanagari,
            language_hint=payload.language_hint,
        )
        response.ai_review = AIReviewModel(**review.as_dict())
        if review.suggestions and response.status == "rules_passed":
            response.status = "needs_review"

    # Language agents + optional cross-validation — always on top of rules.
    agents = _normalize_agents(payload.language_agents)
    if payload.cross_validate and not agents:
        agents = sorted(_VALID_AGENTS)

    if agents:
        if payload.cross_validate or len(agents) > 1:
            if payload.language_agents_use_llm:
                xv = await cross_validate_async(
                    response.original_roman,
                    response.devanagari,
                    agents,
                    use_llm=True,
                )
            else:
                xv = cross_validate(
                    response.original_roman, response.devanagari, agents
                )
            response.cross_validation = CrossValidationModel(**xv.as_dict())
            response.language_reviews = [
                AgentReviewModel(**a.as_dict()) for a in xv.agents
            ]
            if any(a.suggestions for a in xv.agents) and response.status == "rules_passed":
                response.status = "needs_review"
        else:
            # Single agent
            lang = agents[0]
            if payload.language_agents_use_llm:
                agent_review = await review_with_optional_llm(
                    lang,
                    response.original_roman,
                    response.devanagari,
                    use_llm=True,
                )
            else:
                agent_review = review_deterministic(
                    lang, response.original_roman, response.devanagari
                )
            response.language_reviews = [AgentReviewModel(**agent_review.as_dict())]
            if agent_review.suggestions and response.status == "rules_passed":
                response.status = "needs_review"

    return response


@router.post("/roman-to-devanagari/batch", response_model=BatchResponse)
def roman_to_devanagari_batch(payload: BatchRequest) -> BatchResponse:
    items: list[BatchItemResponse] = []
    succeeded = failed = needs_review = unsupported = rules_passed = 0

    for item in payload.items:
        try:
            result = _run(item.text, payload.verify)
            items.append(BatchItemResponse(id=item.id, ok=True, result=result))
            succeeded += 1
            if result.status == "needs_review":
                needs_review += 1
            elif result.status == "unsupported_input":
                unsupported += 1
            elif result.status == "rules_passed":
                rules_passed += 1
        except Exception as exc:  # isolate individual failures
            items.append(BatchItemResponse(id=item.id, ok=False, error=str(exc)))
            failed += 1

    return BatchResponse(
        ruleset_version=RULESET_VERSION,
        engine_version=ENGINE_VERSION,
        summary=BatchSummary(
            total=len(payload.items),
            succeeded=succeeded,
            failed=failed,
            needs_review=needs_review,
            unsupported=unsupported,
            rules_passed=rules_passed,
        ),
        items=items,
    )
