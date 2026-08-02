from __future__ import annotations

from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


class MemberProfile(BaseModel):
    authenticated: bool = True
    id: UUID
    display_name: str
    email: str | None = None
    avatar_url: str | None = None
    identity_provider: str
    preferred_language: str | None = None
    country: str | None = None
    personalization_enabled: bool = True
    is_admin: bool = False
    favorite_song_numbers: list[int] = Field(default_factory=list)


class AdminMemberItem(BaseModel):
    id: UUID
    display_name: str
    email: str | None = None
    is_admin: bool
    is_protected: bool = False


class AdminGrantWrite(BaseModel):
    email: str = Field(min_length=3, max_length=320)


class AnonymousMember(BaseModel):
    authenticated: bool = False


class ChatMemoryTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=8000)


class ChatMemoryWrite(BaseModel):
    song_number: int | None = Field(default=None, ge=1, le=5018)
    turns: list[ChatMemoryTurn] = Field(min_length=1, max_length=4)


class ChatMemoryResponse(BaseModel):
    summary: str = ""
    recent_turns: list[ChatMemoryTurn] = Field(default_factory=list)


class FavoriteWrite(BaseModel):
    song_number: int = Field(ge=1, le=5018)


class MemberPreferencesWrite(BaseModel):
    preferred_language: str | None = Field(default=None, max_length=32)
    country: str | None = Field(default=None, max_length=128)
    personalization_enabled: bool | None = None


QuizLevel = Literal["starter", "intermediate", "experienced"]


class QuizAnswerWrite(BaseModel):
    question_id: str = Field(min_length=3, max_length=64)
    selected_option_id: str = Field(min_length=1, max_length=8)


class QuizStartWrite(BaseModel):
    level: QuizLevel


class QuizSubmitWrite(BaseModel):
    attempt_id: UUID
    answers: list[QuizAnswerWrite] = Field(min_length=10, max_length=10)


class QuizCertificationOut(BaseModel):
    level: QuizLevel
    label: str
    certificate_code: str
    earned_at: str


class QuizStatusResponse(BaseModel):
    levels: list[dict[str, object]]
    questions_per_quiz: int
    pass_percent: int
    pass_score: int
    certifications: list[QuizCertificationOut]


class QuizStartResponse(BaseModel):
    attempt_id: str
    level: QuizLevel
    level_label: str
    questions_per_quiz: int
    pass_score: int
    questions: list[dict[str, object]]


class QuizReviewItem(BaseModel):
    question_id: str
    prompt: str
    options: list[dict[str, str]]
    selected_option_id: str | None = None
    correct_option_id: str
    is_correct: bool
    explanation: str


class QuizSubmitResponse(BaseModel):
    attempt_id: str
    level: QuizLevel
    level_label: str
    score: int
    total: int
    pass_score: int
    passed: bool
    review: list[QuizReviewItem]
    certification: QuizCertificationOut | None = None
    newly_earned: bool = False
