"""Request/response schemas for the transliteration API."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

# Request-size guards (independent from the global MAX_REQUEST_BYTES middleware).
MAX_TEXT_CHARS = 20_000
MAX_BATCH_ITEMS = 500
MAX_BATCH_TEXT_CHARS = 20_000


class VerificationIssueModel(BaseModel):
    code: str
    message: str
    severity: str


class VerificationModel(BaseModel):
    status: str
    confidence: None = Field(
        default=None,
        description="Always null: no calibrated confidence metric exists yet.",
    )
    reference_source: str | None = None
    issues: list[VerificationIssueModel] = Field(default_factory=list)


class TransliterationRequest(BaseModel):
    text: str = Field(..., min_length=0, max_length=MAX_TEXT_CHARS)
    verify: bool = True
    ai_review: bool = False
    language_hint: str | None = Field(default=None, max_length=32)
    # Language agents sit on top of the rule engine (never replace it).
    language_agents: list[str] | None = Field(
        default=None,
        description="Subset of: hindi, bengali, samskrta, urdu. Empty/null = skip.",
    )
    cross_validate: bool = Field(
        default=False,
        description="If true, run language agents and report agreements/conflicts.",
    )
    language_agents_use_llm: bool = Field(
        default=False,
        description="Opt-in LLM enrichment per language agent (still pending_review).",
    )


class AISuggestionModel(BaseModel):
    scope: str
    target: str
    problem: str
    suggested_devanagari: str
    reason: str
    evidence: str
    model_self_reported_confidence: str | None = None
    status: str
    roman_preserved: bool
    is_devanagari: bool


class AIReviewModel(BaseModel):
    available: bool
    assessment: str
    overall_comment: str = ""
    provider: str = ""
    caveat: str = ""
    suggestions: list[AISuggestionModel] = Field(default_factory=list)


class AgentSuggestionModel(BaseModel):
    agent: str
    scope: str
    target_roman: str
    engine_devanagari: str
    suggested_devanagari: str
    problem: str
    reason: str
    evidence: str
    rule_basis: str
    status: str
    source: str
    model_self_reported_confidence: str | None = None


class AgentReviewModel(BaseModel):
    language: str
    available: bool
    assessment: str
    overall_comment: str = ""
    ruleset_version: str
    method: str
    suggestions: list[AgentSuggestionModel] = Field(default_factory=list)


class CrossValidationModel(BaseModel):
    engine_devanagari: str | None
    ruleset_version: str
    consensus: str
    caveat: str
    agreements: list[dict[str, Any]] = Field(default_factory=list)
    disagreements: list[dict[str, Any]] = Field(default_factory=list)
    agents: list[AgentReviewModel] = Field(default_factory=list)


class TransliterationResponse(BaseModel):
    original_roman: str
    devanagari: str | None
    status: str
    method: str = "rule_based"
    ruleset_version: str
    engine_version: str
    warnings: list[str] = Field(default_factory=list)
    unsupported_tokens: list[str] = Field(default_factory=list)
    ambiguous_tokens: list[str] = Field(default_factory=list)
    verification: VerificationModel | None = None
    ai_review: AIReviewModel | None = None
    language_reviews: list[AgentReviewModel] | None = None
    cross_validation: CrossValidationModel | None = None


class BatchItemRequest(BaseModel):
    id: str = Field(..., min_length=1, max_length=256)
    text: str = Field(..., min_length=0, max_length=MAX_BATCH_TEXT_CHARS)


class BatchRequest(BaseModel):
    items: list[BatchItemRequest] = Field(..., min_length=1, max_length=MAX_BATCH_ITEMS)
    verify: bool = True


class BatchItemResponse(BaseModel):
    id: str
    ok: bool
    result: TransliterationResponse | None = None
    error: str | None = None


class BatchSummary(BaseModel):
    total: int
    succeeded: int
    failed: int
    needs_review: int
    unsupported: int
    rules_passed: int


class BatchResponse(BaseModel):
    ruleset_version: str
    engine_version: str
    summary: BatchSummary
    items: list[BatchItemResponse]
