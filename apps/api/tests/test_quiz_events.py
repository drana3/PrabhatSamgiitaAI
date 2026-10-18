from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest

from app.models import QuizEvent, QuizEventQuestion, QuizEventSubmission, UserAccount
from app.services.quiz_events import (
    QUESTIONS_PER_EVENT,
    _grade_event_submission,
    _validate_questions,
    create_quiz_event,
    deep_link_for_slug,
    event_metadata_for_member,
    make_event_slug,
    recent_quiz_winners,
    start_event_quiz,
    submit_event_quiz,
    verify_quiz_event,
)


def _sample_questions() -> list[dict[str, object]]:
    rows = []
    for index in range(QUESTIONS_PER_EVENT):
        rows.append(
            {
                "prompt": f"What is the answer to question {index + 1}?",
                "options": [
                    {"id": "a", "text": "Option A"},
                    {"id": "b", "text": "Option B"},
                    {"id": "c", "text": "Option C"},
                    {"id": "d", "text": "Option D"},
                ],
                "correct_option_id": "a",
                "explanation": "Because A is correct.",
            }
        )
    return rows


def _admin() -> UserAccount:
    return UserAccount(
        id=uuid4(),
        external_subject="google:admin",
        identity_provider="google",
        email="admin@example.com",
        display_name="Admin",
        last_seen_at=datetime.now(UTC),
        is_admin=True,
    )


def _member() -> UserAccount:
    return UserAccount(
        id=uuid4(),
        external_subject="google:member",
        identity_provider="google",
        email="member@example.com",
        display_name="Member",
        last_seen_at=datetime.now(UTC),
        is_admin=False,
    )


class _QuizEventSession:
    def __init__(self) -> None:
        self.events: list[QuizEvent] = []
        self.questions: list[QuizEventQuestion] = []
        self.submissions: list[QuizEventSubmission] = []
        self.committed = 0

    def add(self, obj: object) -> None:
        if isinstance(obj, QuizEvent):
            if getattr(obj, "id", None) is None:
                obj.id = uuid4()
            if getattr(obj, "created_at", None) is None:
                obj.created_at = datetime.now(UTC)
            self.events.append(obj)
        elif isinstance(obj, QuizEventQuestion):
            if getattr(obj, "id", None) is None:
                obj.id = uuid4()
            self.questions.append(obj)
        elif isinstance(obj, QuizEventSubmission):
            if getattr(obj, "id", None) is None:
                obj.id = uuid4()
            self.submissions.append(obj)

    async def flush(self) -> None:
        return None

    async def commit(self) -> None:
        self.committed += 1

    async def refresh(self, obj: object) -> None:
        return None

    async def get(self, model, pk):
        if model is QuizEvent:
            return next((event for event in self.events if event.id == pk), None)
        return None

    async def scalar(self, statement):
        sql = str(statement).casefold()
        if "from quiz_events" in sql:
            if len(self.events) == 1:
                return self.events[0]
            for event in self.events:
                if event.slug and event.slug in sql:
                    return event
        if "from quiz_event_submissions" in sql:
            if len(self.submissions) == 1 and "event_id" in sql and "user_id" in sql:
                return self.submissions[0]
            event_id = self._extract_uuid(sql, "event_id")
            user_id = self._extract_uuid(sql, "user_id")
            return next(
                (
                    submission
                    for submission in self.submissions
                    if submission.event_id == event_id and submission.user_id == user_id
                ),
                None,
            )
        return None

    async def execute(self, statement):
        sql = str(statement).casefold()
        if "from quiz_event_questions" in sql:
            if len(self.events) == 1:
                event_id = self.events[0].id
            else:
                event_id = self._extract_uuid(sql, "event_id")
            rows = [question for question in self.questions if question.event_id == event_id]
            rows.sort(key=lambda question: question.position)
            return _Result(rows)
        if "from quiz_events" in sql:
            rows = list(self.events)
            if "status" in sql:
                rows = [event for event in rows if event.status == "verified"]
            rows.sort(key=lambda event: event.deadline, reverse=True)
            return _Result(rows)
        if "from quiz_event_submissions" in sql and "join user_accounts" in sql:
            if len(self.submissions) == 1 and len(self.events) == 1:
                return _JoinResult([(self.submissions[0], _member())])
            event_id = self._extract_uuid(sql, "event_id")
            rows = [
                (submission, _member())
                for submission in self.submissions
                if submission.event_id == event_id
            ]
            rows.sort(
                key=lambda row: (
                    -(row[0].score or 0),
                    row[0].submitted_at or datetime.min.replace(tzinfo=UTC),
                )
            )
            return _JoinResult(rows)
        return _Result([])

    def _extract_eq(self, sql: str, field: str) -> str:
        marker = f"{field} = "
        start = sql.index(marker) + len(marker)
        end = sql.find(" ", start)
        return sql[start:end].strip("'\"")

    def _extract_uuid(self, sql: str, field: str) -> object:
        marker = f"{field} = "
        start = sql.index(marker) + len(marker)
        end = sql.find(" ", start)
        value = sql[start:end].strip("'\"")
        try:
            from uuid import UUID

            return UUID(value)
        except ValueError:
            return value


class _Result:
    def __init__(self, rows: list[object]) -> None:
        self._rows = rows

    def scalars(self):
        return self

    def all(self):
        return self._rows

    def __iter__(self):
        return iter(self._rows)


class _JoinResult:
    def __init__(self, rows: list[tuple[object, object]]) -> None:
        self._rows = rows

    def all(self):
        return self._rows


def test_make_event_slug_is_short_and_lowercase() -> None:
    slug = make_event_slug()
    assert slug == slug.lower()
    assert 6 <= len(slug) <= 12


def test_deep_link_uses_prabhatai_scheme() -> None:
    assert deep_link_for_slug("abc123") == "prabhatai://quiz/event/abc123"


def test_validate_questions_requires_ten_mcq_items() -> None:
    with pytest.raises(ValueError, match="Exactly 10"):
        _validate_questions(_sample_questions()[:3])
    validated = _validate_questions(_sample_questions())
    assert len(validated) == QUESTIONS_PER_EVENT
    assert validated[0]["correct_option_id"] == "a"


def test_grade_event_submission_scores_correct_answers() -> None:
    questions = [
        QuizEventQuestion(
            id=uuid4(),
            event_id=uuid4(),
            position=0,
            prompt="One",
            options=[{"id": "a", "text": "A"}, {"id": "b", "text": "B"}],
            correct_option_id="a",
        ),
        QuizEventQuestion(
            id=uuid4(),
            event_id=uuid4(),
            position=1,
            prompt="Two",
            options=[{"id": "a", "text": "A"}, {"id": "b", "text": "B"}],
            correct_option_id="b",
        ),
    ]
    score, review = _grade_event_submission(
        questions,
        [
            {"question_id": str(questions[0].id), "selected_option_id": "a"},
            {"question_id": str(questions[1].id), "selected_option_id": "b"},
        ],
    )
    assert score == 2
    assert all(item["is_correct"] for item in review)


@pytest.mark.asyncio
async def test_create_and_start_event_quiz_flow() -> None:
    session = _QuizEventSession()
    admin = _admin()
    member = _member()
    deadline = datetime.now(UTC) + timedelta(hours=2)
    event = await create_quiz_event(
        session,
        admin,
        title="Live Quiz",
        description="Test event",
        deadline=deadline,
        tags=["devotion"],
        questions=_sample_questions(),
        publish=True,
    )
    assert event.status == "published"
    assert event.slug

    metadata = await event_metadata_for_member(session, member, event.slug)
    assert metadata["is_open"] is True
    assert metadata["has_submission"] is False

    started = await start_event_quiz(session, member, event.slug)
    assert len(started["questions"]) == QUESTIONS_PER_EVENT

    answers = [
        {"question_id": question["id"], "selected_option_id": "a"}
        for question in started["questions"]
    ]
    submitted = await submit_event_quiz(session, member, event.slug, answers)
    assert submitted["score"] == QUESTIONS_PER_EVENT
    assert submitted["pending_verification"] is True


@pytest.mark.asyncio
async def test_verify_event_enables_winners_payload() -> None:
    session = _QuizEventSession()
    admin = _admin()
    member = _member()
    deadline = datetime.now(UTC) + timedelta(hours=1)
    event = await create_quiz_event(
        session,
        admin,
        title="Closed Quiz",
        description=None,
        deadline=deadline,
        tags=[],
        questions=_sample_questions(),
        publish=True,
    )
    started = await start_event_quiz(session, member, event.slug)
    event.deadline = datetime.now(UTC) - timedelta(minutes=5)
    answers = [
        {"question_id": question["id"], "selected_option_id": "a"}
        for question in started["questions"]
    ]
    await submit_event_quiz(session, member, event.slug, answers)
    await verify_quiz_event(session, event.id)
    winners = await recent_quiz_winners(session)
    assert len(winners) == 1
    assert winners[0]["winners"][0]["display_name"] == "Member"
