from app.services.quiz import (
    PASS_SCORE,
    QUESTIONS_PER_QUIZ,
    grade_attempt,
    load_questions,
    passed_score,
    pick_questions,
    questions_for_level,
)


def test_question_pool_has_twelve_per_level() -> None:
    for level in ("starter", "intermediate", "experienced"):
        assert len(questions_for_level(level)) >= 12


def test_pick_questions_returns_ten_unique() -> None:
    selected = pick_questions("starter")
    assert len(selected) == QUESTIONS_PER_QUIZ
    assert len({question.id for question in selected}) == QUESTIONS_PER_QUIZ


def test_pass_score_is_seventy_percent() -> None:
    assert PASS_SCORE == 7
    assert passed_score(7) is True
    assert passed_score(6) is False


def test_grade_attempt_builds_review() -> None:
    selected = pick_questions("starter")
    question_ids = [question.id for question in selected]
    answers = [
        {
            "question_id": question.id,
            "selected_option_id": question.correct_option_id,
        }
        for question in selected
    ]
    score, review = grade_attempt(question_ids, answers)
    assert score == QUESTIONS_PER_QUIZ
    assert len(review) == QUESTIONS_PER_QUIZ
    assert all(item["is_correct"] for item in review)


def test_grade_attempt_marks_wrong_selection() -> None:
    question = questions_for_level("starter")[0]
    wrong = next(option.id for option in question.options if option.id != question.correct_option_id)
    score, review = grade_attempt(
        [question.id],
        [{"question_id": question.id, "selected_option_id": wrong}],
    )
    assert score == 0
    assert review[0]["is_correct"] is False
    assert review[0]["correct_option_id"] == question.correct_option_id


def test_load_questions_indexed_by_id() -> None:
    catalog = load_questions()
    assert "starter-001" in catalog
