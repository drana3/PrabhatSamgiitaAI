from __future__ import annotations

import secrets
from datetime import UTC, datetime
from typing import Any, cast
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import QuizEvent, QuizEventQuestion, QuizEventSubmission, UserAccount

QUESTIONS_PER_EVENT = 10
OPTION_IDS = ("a", "b", "c", "d")


def make_event_slug() -> str:
    return secrets.token_urlsafe(8).replace("-", "").replace("_", "")[:12].lower()


def deep_link_for_slug(slug: str) -> str:
    return f"prabhatai://quiz/event/{slug}"


def _now() -> datetime:
    return datetime.now(UTC)


def _question_for_client(question: QuizEventQuestion) -> dict[str, Any]:
    return {
        "id": str(question.id),
        "position": question.position,
        "prompt": question.prompt,
        "options": question.options,
    }


def _event_summary(event: QuizEvent) -> dict[str, Any]:
    return {
        "id": str(event.id),
        "slug": event.slug,
        "title": event.title,
        "description": event.description,
        "deadline": event.deadline.isoformat(),
        "tags": event.tags or [],
        "status": event.status,
        "deep_link": deep_link_for_slug(event.slug),
        "created_at": event.created_at.isoformat(),
    }


def _validate_questions(questions: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if len(questions) != QUESTIONS_PER_EVENT:
        raise ValueError(f"Exactly {QUESTIONS_PER_EVENT} questions are required")
    validated: list[dict[str, Any]] = []
    for index, row in enumerate(questions):
        prompt = str(row.get("prompt", "")).strip()
        if len(prompt) < 5:
            raise ValueError(f"Question {index + 1} needs a longer prompt")
        options = row.get("options") or []
        if len(options) != 4:
            raise ValueError(f"Question {index + 1} must have exactly 4 options")
        normalized_options: list[dict[str, str]] = []
        option_ids: set[str] = set()
        for opt_index, option in enumerate(options):
            option_id = str(option.get("id") or OPTION_IDS[opt_index])
            text = str(option.get("text", "")).strip()
            if not text:
                raise ValueError(f"Question {index + 1} option {opt_index + 1} needs text")
            normalized_options.append({"id": option_id, "text": text})
            option_ids.add(option_id)
        correct = str(row.get("correct_option_id", "")).strip()
        if correct not in option_ids:
            raise ValueError(f"Question {index + 1} has an invalid correct answer")
        validated.append(
            {
                "position": index,
                "prompt": prompt,
                "options": normalized_options,
                "correct_option_id": correct,
                "explanation": str(row.get("explanation") or "").strip() or None,
            }
        )
    return validated


async def create_quiz_event(
    session: AsyncSession,
    admin: UserAccount,
    *,
    title: str,
    description: str | None,
    deadline: datetime,
    tags: list[str],
    questions: list[dict[str, Any]],
    publish: bool = True,
) -> QuizEvent:
    if deadline <= _now():
        raise ValueError("Deadline must be in the future")
    validated = _validate_questions(questions)
    event = QuizEvent(
        slug=make_event_slug(),
        title=title.strip(),
        description=(description or "").strip() or None,
        deadline=deadline,
        tags=[tag.strip() for tag in tags if tag.strip()],
        status="published" if publish else "draft",
        created_by=admin.id,
    )
    session.add(event)
    await session.flush()
    for row in validated:
        session.add(
            QuizEventQuestion(
                event_id=event.id,
                position=row["position"],
                prompt=row["prompt"],
                options=row["options"],
                correct_option_id=row["correct_option_id"],
                explanation=row["explanation"],
            )
        )
    await session.commit()
    await session.refresh(event)
    return event


async def list_quiz_events(session: AsyncSession) -> list[dict[str, Any]]:
    events = list(
        (
            await session.execute(
                select(QuizEvent).order_by(QuizEvent.created_at.desc()).limit(50)
            )
        ).scalars()
    )
    return [_event_summary(event) for event in events]


async def get_quiz_event_admin(
    session: AsyncSession, event_id: UUID
) -> dict[str, Any] | None:
    event = await session.get(QuizEvent, event_id)
    if event is None:
        return None
    questions = list(
        (
            await session.execute(
                select(QuizEventQuestion)
                .where(QuizEventQuestion.event_id == event_id)
                .order_by(QuizEventQuestion.position.asc())
            )
        ).scalars()
    )
    submissions = list(
        (
            await session.execute(
                select(QuizEventSubmission, UserAccount)
                .join(UserAccount, UserAccount.id == QuizEventSubmission.user_id)
                .where(QuizEventSubmission.event_id == event_id)
                .order_by(
                    QuizEventSubmission.score.desc().nullslast(),
                    QuizEventSubmission.submitted_at.asc().nullslast(),
                )
            )
        ).all()
    )
    questions = sorted(questions, key=lambda q: q.position)
    return {
        **_event_summary(event),
        "questions": [
            {
                "id": str(question.id),
                "position": question.position,
                "prompt": question.prompt,
                "options": question.options,
                "correct_option_id": question.correct_option_id,
                "explanation": question.explanation,
            }
            for question in questions
        ],
        "submissions": [
            {
                "id": str(submission.id),
                "user_id": str(submission.user_id),
                "display_name": member.display_name,
                "score": submission.score,
                "status": submission.status,
                "submitted_at": submission.submitted_at.isoformat()
                if submission.submitted_at
                else None,
            }
            for submission, member in submissions
        ],
    }


async def publish_quiz_event(session: AsyncSession, event_id: UUID) -> QuizEvent:
    event = await session.get(QuizEvent, event_id)
    if event is None:
        raise LookupError("Quiz event not found")
    if event.deadline <= _now():
        raise ValueError("Cannot publish an event whose deadline has passed")
    event.status = "published"
    await session.commit()
    await session.refresh(event)
    return event


async def verify_quiz_event(session: AsyncSession, event_id: UUID) -> QuizEvent:
    event = await session.get(QuizEvent, event_id)
    if event is None:
        raise LookupError("Quiz event not found")
    if event.deadline > _now():
        raise ValueError("Event deadline has not passed yet")
    event.status = "verified"
    await session.commit()
    await session.refresh(event)
    return event


async def get_event_by_slug(session: AsyncSession, slug: str) -> QuizEvent | None:
    return cast(
        QuizEvent | None,
        await session.scalar(select(QuizEvent).where(QuizEvent.slug == slug)),
    )


async def event_metadata_for_member(
    session: AsyncSession, member: UserAccount, slug: str
) -> dict[str, Any]:
    event = await get_event_by_slug(session, slug)
    if event is None or event.status not in {"published", "closed", "verified"}:
        raise LookupError("Quiz event not found")
    now = _now()
    submission = await session.scalar(
        select(QuizEventSubmission).where(
            QuizEventSubmission.event_id == event.id,
            QuizEventSubmission.user_id == member.id,
        )
    )
    return {
        **_event_summary(event),
        "is_open": event.deadline > now and event.status == "published",
        "seconds_remaining": max(0, int((event.deadline - now).total_seconds())),
        "has_submission": submission is not None,
        "submission_status": submission.status if submission else None,
        "score": submission.score if submission and submission.status != "in_progress" else None,
    }


async def start_event_quiz(
    session: AsyncSession, member: UserAccount, slug: str
) -> dict[str, Any]:
    event = await get_event_by_slug(session, slug)
    if event is None or event.status != "published":
        raise LookupError("Quiz event not found")
    if event.deadline <= _now():
        raise ValueError("This quiz event has closed")
    existing = await session.scalar(
        select(QuizEventSubmission).where(
            QuizEventSubmission.event_id == event.id,
            QuizEventSubmission.user_id == member.id,
        )
    )
    if existing is not None:
        if existing.status != "in_progress":
            raise ValueError("You have already submitted this quiz")
        questions = list(
            (
                await session.execute(
                    select(QuizEventQuestion)
                    .where(QuizEventQuestion.event_id == event.id)
                    .order_by(QuizEventQuestion.position.asc())
                )
            ).scalars()
        )
        return {
            "submission_id": str(existing.id),
            "event": _event_summary(event),
            "questions": [_question_for_client(question) for question in questions],
            "seconds_remaining": max(0, int((event.deadline - _now()).total_seconds())),
        }
    submission = QuizEventSubmission(
        event_id=event.id,
        user_id=member.id,
        started_at=_now(),
        status="in_progress",
    )
    session.add(submission)
    questions = list(
        (
            await session.execute(
                select(QuizEventQuestion)
                .where(QuizEventQuestion.event_id == event.id)
                .order_by(QuizEventQuestion.position.asc())
            )
        ).scalars()
    )
    await session.commit()
    await session.refresh(submission)
    return {
        "submission_id": str(submission.id),
        "event": _event_summary(event),
        "questions": [_question_for_client(question) for question in questions],
        "seconds_remaining": max(0, int((event.deadline - _now()).total_seconds())),
    }


def _grade_event_submission(
    questions: list[QuizEventQuestion], answers: list[dict[str, str]]
) -> tuple[int, list[dict[str, Any]]]:
    answer_map = {item["question_id"]: item["selected_option_id"] for item in answers}
    review: list[dict[str, Any]] = []
    score = 0
    for question in questions:
        selected = answer_map.get(str(question.id))
        is_correct = selected == question.correct_option_id
        if is_correct:
            score += 1
        review.append(
            {
                "question_id": str(question.id),
                "prompt": question.prompt,
                "options": question.options,
                "selected_option_id": selected,
                "correct_option_id": question.correct_option_id,
                "is_correct": is_correct,
                "explanation": question.explanation or "",
            }
        )
    return score, review


async def submit_event_quiz(
    session: AsyncSession,
    member: UserAccount,
    slug: str,
    answers: list[dict[str, str]],
) -> dict[str, Any]:
    event = await get_event_by_slug(session, slug)
    if event is None or event.status not in {"published", "closed"}:
        raise LookupError("Quiz event not found")
    if event.deadline <= _now():
        event.status = "closed"
    elif event.status != "published":
        raise ValueError("This quiz event is not accepting submissions")
    submission = await session.scalar(
        select(QuizEventSubmission).where(
            QuizEventSubmission.event_id == event.id,
            QuizEventSubmission.user_id == member.id,
        )
    )
    if submission is None:
        raise ValueError("Start the quiz before submitting")
    if submission.status != "in_progress":
        raise ValueError("You have already submitted this quiz")
    questions = list(
        (
            await session.execute(
                select(QuizEventQuestion)
                .where(QuizEventQuestion.event_id == event.id)
                .order_by(QuizEventQuestion.position.asc())
            )
        ).scalars()
    )
    if len(answers) != len(questions):
        raise ValueError(f"Please answer all {len(questions)} questions")
    score, review = _grade_event_submission(questions, answers)
    now = _now()
    submission.answers = answers
    submission.score = score
    submission.status = "submitted"
    submission.submitted_at = now
    if event.deadline <= now and event.status == "published":
        event.status = "closed"
    await session.commit()
    return {
        "submission_id": str(submission.id),
        "event": _event_summary(event),
        "score": score,
        "total": len(questions),
        "review": review,
        "pending_verification": event.status != "verified",
    }


async def recent_quiz_winners(session: AsyncSession, limit: int = 3) -> list[dict[str, Any]]:
    events = list(
        (
            await session.execute(
                select(QuizEvent)
                .where(QuizEvent.status == "verified")
                .order_by(QuizEvent.deadline.desc())
                .limit(3)
            )
        ).scalars()
    )
    payload: list[dict[str, Any]] = []
    for event in events:
        rows = list(
            (
                await session.execute(
                    select(QuizEventSubmission, UserAccount)
                    .join(UserAccount, UserAccount.id == QuizEventSubmission.user_id)
                    .where(
                        QuizEventSubmission.event_id == event.id,
                        QuizEventSubmission.status.in_(("submitted", "verified")),
                    )
                    .order_by(
                        QuizEventSubmission.score.desc().nullslast(),
                        QuizEventSubmission.submitted_at.asc().nullslast(),
                    )
                    .limit(limit)
                )
            ).all()
        )
        if not rows:
            continue
        payload.append(
            {
                "event": _event_summary(event),
                "winners": [
                    {
                        "rank": index + 1,
                        "display_name": member.display_name,
                        "score": submission.score or 0,
                        "total": QUESTIONS_PER_EVENT,
                        "submitted_at": submission.submitted_at.isoformat()
                        if submission.submitted_at
                        else None,
                    }
                    for index, (submission, member) in enumerate(rows)
                ],
            }
        )
    return payload
