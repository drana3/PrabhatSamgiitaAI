from app.models import Song
from app.services.direct_answers import try_direct_answer


def test_catalog_questions_are_answered_without_rag() -> None:
    answer = try_direct_answer("How many songs are in Prabhat Samgiita?")

    assert answer is not None
    assert "5,018" in answer.text


def test_language_question_uses_catalog_aggregate() -> None:
    answer = try_direct_answer("Which languages are available?")

    assert answer is not None
    assert "Maithili" in answer.text
    assert "Urdu" in answer.text


def test_raga_question_does_not_invent_missing_metadata() -> None:
    answer = try_direct_answer("Which ragas are available?")

    assert answer is not None
    assert "not yet consistently structured" in answer.text


def test_interpretive_question_continues_to_rag() -> None:
    song = Song(number=1, title="Bandhu He Niye Calo")

    assert try_direct_answer("How does longing become surrender in this song?", song) is None
