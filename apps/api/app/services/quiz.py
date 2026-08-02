from __future__ import annotations

import random
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime
from functools import lru_cache
from typing import Any, Literal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import QuizAttempt, QuizCertification, UserAccount
from app.services.seed_data import load_rows

QuizLevel = Literal["starter", "intermediate", "experienced"]

QUIZ_LEVELS: tuple[QuizLevel, ...] = ("starter", "intermediate", "experienced")
QUESTIONS_PER_QUIZ = 10
PASS_PERCENT = 70
PASS_SCORE = max(1, round(QUESTIONS_PER_QUIZ * PASS_PERCENT / 100))

LEVEL_LABELS = {
    "starter": "Starter",
    "intermediate": "Intermediate",
    "experienced": "Experienced",
}


@dataclass(frozen=True)
class QuizOption:
    id: str
    text: str


@dataclass(frozen=True)
class QuizQuestion:
    id: str
    level: QuizLevel
    prompt: str
    options: tuple[QuizOption, ...]
    correct_option_id: str
    explanation: str

    @classmethod
    def from_row(cls, row: dict[str, Any]) -> QuizQuestion:
        return cls(
            id=str(row["id"]),
            level=str(row["level"]),  # type: ignore[arg-type]
            prompt=str(row["prompt"]),
            options=tuple(
                QuizOption(id=str(option["id"]), text=str(option["text"]))
                for option in row["options"]
            ),
            correct_option_id=str(row["correct_option_id"]),
            explanation=str(row.get("explanation", "")),
        )

    def for_client(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "prompt": self.prompt,
            "options": [{"id": option.id, "text": option.text} for option in self.options],
        }


@lru_cache(maxsize=1)
def load_questions() -> dict[str, QuizQuestion]:
    return {
        row["id"]: QuizQuestion.from_row(row)
        for row in load_rows("quiz_questions.json")
    }


def questions_for_level(level: QuizLevel) -> list[QuizQuestion]:
    return [question for question in load_questions().values() if question.level == level]


def pick_questions(level: QuizLevel, count: int = QUESTIONS_PER_QUIZ) -> list[QuizQuestion]:
    pool = questions_for_level(level)
    if len(pool) < count:
        raise ValueError(f"Not enough quiz questions for level {level}")
    return random.sample(pool, count)


def grade_attempt(
    question_ids: list[str],
    answers: list[dict[str, str]],
) -> tuple[int, list[dict[str, Any]]]:
    catalog = load_questions()
    answer_map = {item["question_id"]: item["selected_option_id"] for item in answers}
    review: list[dict[str, Any]] = []
    score = 0

    for question_id in question_ids:
        question = catalog[question_id]
        selected = answer_map.get(question_id)
        is_correct = selected == question.correct_option_id
        if is_correct:
            score += 1
        review.append(
            {
                "question_id": question.id,
                "prompt": question.prompt,
                "options": question.for_client()["options"],
                "selected_option_id": selected,
                "correct_option_id": question.correct_option_id,
                "is_correct": is_correct,
                "explanation": question.explanation,
            }
        )
    return score, review


def passed_score(score: int, total: int = QUESTIONS_PER_QUIZ) -> bool:
    threshold = max(1, round(total * PASS_PERCENT / 100))
    return score >= threshold


def make_certificate_code(level: QuizLevel) -> str:
    prefix = level[:3].upper()
    suffix = secrets.token_hex(3).upper()
    return f"PSAI-{prefix}-{suffix}"


async def quiz_status(session: AsyncSession, member: UserAccount) -> dict[str, Any]:
    certifications = list(
        (
            await session.execute(
                select(QuizCertification)
                .where(QuizCertification.user_id == member.id)
                .order_by(QuizCertification.earned_at.asc())
            )
        ).scalars()
    )
    return {
        "levels": [
            {
                "level": level,
                "label": LEVEL_LABELS[level],
                "question_pool_size": len(questions_for_level(level)),
            }
            for level in QUIZ_LEVELS
        ],
        "questions_per_quiz": QUESTIONS_PER_QUIZ,
        "pass_percent": PASS_PERCENT,
        "pass_score": PASS_SCORE,
        "certifications": [
            {
                "level": cert.level,
                "label": LEVEL_LABELS[cert.level],
                "certificate_code": cert.certificate_code,
                "earned_at": cert.earned_at.isoformat(),
            }
            for cert in certifications
        ],
    }


async def start_quiz(
    session: AsyncSession, member: UserAccount, level: QuizLevel
) -> dict[str, Any]:
    selected = pick_questions(level)
    attempt = QuizAttempt(
        user_id=member.id,
        level=level,
        question_ids=[question.id for question in selected],
        status="in_progress",
    )
    session.add(attempt)
    await session.commit()
    await session.refresh(attempt)
    return {
        "attempt_id": str(attempt.id),
        "level": level,
        "level_label": LEVEL_LABELS[level],
        "questions_per_quiz": QUESTIONS_PER_QUIZ,
        "pass_score": PASS_SCORE,
        "questions": [question.for_client() for question in selected],
    }


async def submit_quiz(
    session: AsyncSession,
    member: UserAccount,
    attempt_id: UUID,
    answers: list[dict[str, str]],
) -> dict[str, Any]:
    attempt = await session.scalar(
        select(QuizAttempt).where(
            QuizAttempt.id == attempt_id,
            QuizAttempt.user_id == member.id,
        )
    )
    if attempt is None:
        raise LookupError("Quiz attempt not found")
    if attempt.status != "in_progress":
        raise ValueError("This quiz attempt was already submitted")

    if len(answers) != len(attempt.question_ids):
        raise ValueError("Please answer all quiz questions before submitting")

    score, review = grade_attempt(list(attempt.question_ids), answers)
    did_pass = passed_score(score)
    completed_at = datetime.now(UTC)

    attempt.answers = answers
    attempt.score = score
    attempt.passed = did_pass
    attempt.status = "completed"
    attempt.completed_at = completed_at

    certification: dict[str, Any] | None = None
    newly_earned = False
    if did_pass:
        existing = await session.scalar(
            select(QuizCertification).where(
                QuizCertification.user_id == member.id,
                QuizCertification.level == attempt.level,
            )
        )
        if existing is None:
            cert = QuizCertification(
                user_id=member.id,
                level=attempt.level,
                attempt_id=attempt.id,
                certificate_code=make_certificate_code(attempt.level),  # type: ignore[arg-type]
                earned_at=completed_at,
            )
            session.add(cert)
            newly_earned = True
            certification = {
                "level": cert.level,
                "label": LEVEL_LABELS[cert.level],
                "certificate_code": cert.certificate_code,
                "earned_at": cert.earned_at.isoformat(),
            }
        else:
            certification = {
                "level": existing.level,
                "label": LEVEL_LABELS[existing.level],
                "certificate_code": existing.certificate_code,
                "earned_at": existing.earned_at.isoformat(),
            }

    await session.commit()

    return {
        "attempt_id": str(attempt.id),
        "level": attempt.level,
        "level_label": LEVEL_LABELS[attempt.level],
        "score": score,
        "total": len(attempt.question_ids),
        "pass_score": PASS_SCORE,
        "passed": did_pass,
        "review": review,
        "certification": certification,
        "newly_earned": newly_earned,
    }
