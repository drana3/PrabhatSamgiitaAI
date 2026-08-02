from app.models.song import Song
from app.services.chat_language import (
    conversation_language_from_user_messages,
    detect_response_language,
    explicit_response_language,
    is_language_rephrase,
)
from app.services.query_guard import assess_query
from app.services.structured_answers import requests_song_explanation, try_structured_answer


def test_explicit_hindi_from_in_hindi_request() -> None:
    assert explicit_response_language("explain this song in hindi") == "hi"
    assert detect_response_language("explain this song in hindi") == "hi"


def test_explicit_english_overrides_romanized_hindi_terms() -> None:
    assert detect_response_language("is gaane ka arth batao in english") == "en"


def test_devanagari_query_is_hindi() -> None:
    assert detect_response_language("इस गीत का अर्थ समझाइए") == "hi"


def test_english_companion_phrases_stay_english() -> None:
    assert detect_response_language("tell me about this song") == "en"
    assert detect_response_language("what does this mean") == "en"


def test_numeric_input_does_not_stick_to_hindi_history() -> None:
    history = [("user", "explain this song in hindi"), ("assistant", "हिंदी में उत्तर")]

    assert detect_response_language("222", history) == "en"
    assert detect_response_language("what does 222 mean?", history) == "en"


def test_ambiguous_follow_up_can_inherit_hindi() -> None:
    history = [("user", "is gaane ka arth batao")]

    assert detect_response_language("ok", history) == "hi"
    assert detect_response_language("in hindi", history) == "hi"


def test_language_rephrase_requires_history_for_structured_explain() -> None:
    assert requests_song_explanation("in hindi") is False
    assert requests_song_explanation("in hindi", [("user", "What is this song about?")]) is True


def test_query_guard_accepts_companion_phrases() -> None:
    for query in (
        "explain in hindi",
        "what does this mean",
        "is gaane ka arth batao",
        "explain the spiritual imagery",
        "in hindi",
    ):
        assert assess_query(query).allowed is True


def test_hindi_explanation_skips_structured_answer_without_hindi_meaning() -> None:
    song = Song(
        number=16,
        title="ÁJI, SAJALA PAVANE SAGHANA SVAPANE",
        english_meaning="Deep in dream, the Unknown Traveler came.",
        theme="Mysticism",
    )

    assert try_structured_answer("explain this song in hindi", song) is None


def test_hindi_explanation_uses_canonical_hindi_meaning_when_available() -> None:
    song = Song(
        number=16,
        title="ÁJI, SAJALA PAVANE SAGHANA SVAPANE",
        english_meaning="Deep in dream, the Unknown Traveler came.",
        hindi_meaning="गहरी स्वप्न में, अज्ञात पथिक आया।",
        theme="Mysticism",
    )

    answer = try_structured_answer("explain this song in hindi", song)

    assert answer is not None
    assert "गहरी स्वप्न" in answer
    assert "Deep in dream" not in answer


def test_is_language_rephrase() -> None:
    assert is_language_rephrase("in hindi")
    assert is_language_rephrase("hindi mein batao")
    assert is_language_rephrase("translate to hindi")
    assert is_language_rephrase("explain this song") is False


def test_conversation_language_follows_latest_clear_message() -> None:
    messages = ["explain this song in hindi", "222"]
    assert conversation_language_from_user_messages(messages) == "en"
    messages = ["explain this song in hindi", "ok"]
    assert conversation_language_from_user_messages(messages) == "hi"
