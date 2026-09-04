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


def test_prefers_devanagari_for_explicit_hindi_and_romanized_for_chat() -> None:
    from app.services.chat_language import prefers_devanagari_hindi

    assert prefers_devanagari_hindi("explain this song in hindi") is True
    assert prefers_devanagari_hindi("इस गीत का अर्थ समझाइए") is True
    assert prefers_devanagari_hindi("is gaane ka arth batao") is False


def test_explicit_english_overrides_romanized_hindi_terms() -> None:
    assert detect_response_language("is gaane ka arth batao in english") == "en"


def test_devanagari_query_is_hindi() -> None:
    assert detect_response_language("इस गीत का अर्थ समझाइए") == "hi"


def test_english_companion_phrases_stay_english() -> None:
    assert detect_response_language("tell me about this song") == "en"
    assert detect_response_language("what does this mean") == "en"


def test_numeric_input_inherits_hindi_conversation() -> None:
    history = [("user", "explain this song in hindi"), ("assistant", "हिंदी में उत्तर")]

    assert detect_response_language("222", history) == "hi"
    assert detect_response_language("what does 222 mean?", history) == "hi"


def test_ambiguous_follow_up_can_inherit_hindi() -> None:
    history = [("user", "is gaane ka arth batao")]

    assert detect_response_language("ok", history) == "hi"
    assert detect_response_language("in hindi", history) == "hi"


def test_english_follow_up_keeps_hindi_until_explicit_switch() -> None:
    """Stay in Hindi once the conversation moved there; only explicit requests switch back."""
    history = [
        ("user", "What is this song about?"),
        ("assistant", "This song is about devotion at dawn."),
        ("user", "is gaane ka arth batao"),
        ("assistant", "Yeh gaana prem aur bhakti ke bare mein hai."),
    ]

    assert detect_response_language("What emotion drives this PS?", history) == "hi"
    assert detect_response_language("in english", history) == "en"
    assert detect_response_language("Tell me more about the imagery", history) == "hi"


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


def test_hindi_explanation_prefers_llm_over_stiff_structured_paste() -> None:
    """Natural Hindi prose should come from the grounded LLM, not a catalog dump."""
    song = Song(
        number=16,
        title="ÁJI, SAJALA PAVANE SAGHANA SVAPANE",
        english_meaning="Deep in dream, the Unknown Traveler came.",
        hindi_meaning="गहरी स्वप्न में, अज्ञात पथिक आया।",
        theme="Mysticism",
    )

    assert try_structured_answer("explain this song in hindi", song) is None
    assert try_structured_answer("is gaane ka arth batao", song) is None


def test_magahi_explanation_skips_structured_answer_and_uses_llm_path() -> None:
    song = Song(
        number=3,
        title="ÁNDHÁRA SHEŚE ÁLORA DESHE",
        english_meaning="Calling all, I will sing the glories of this crimson dawn.",
        theme="Neo-Humanism",
    )

    assert explicit_response_language("explain its meaning in magahi") == "other"
    assert try_structured_answer("explain its meaning in magahi", song) is None


def test_is_language_rephrase() -> None:
    assert is_language_rephrase("in hindi")
    assert is_language_rephrase("hindi mein batao")
    assert is_language_rephrase("translate to hindi")
    assert is_language_rephrase("explain this song") is False


def test_conversation_language_stays_consistent() -> None:
    messages = ["explain this song in hindi", "222"]
    assert conversation_language_from_user_messages(messages) == "hi"
    messages = ["explain this song in hindi", "ok"]
    assert conversation_language_from_user_messages(messages) == "hi"


def test_conversation_language_uses_member_preferred_language_before_first_turn() -> None:
    assert conversation_language_from_user_messages([], preferred_language="hindi") == "hi"
    assert conversation_language_from_user_messages([], preferred_language="english") == "en"


def test_language_switch_acknowledgment_for_hindi_only_request() -> None:
    from app.services.conversation import try_language_switch_acknowledgment

    ack = try_language_switch_acknowledgment("in hindi", [])
    assert ack
    assert "हिंदी" in ack


def test_language_switch_acknowledgment_when_already_in_hindi() -> None:
    from app.services.conversation import try_language_switch_acknowledgment

    history = [("user", "explain this song in hindi")]
    ack = try_language_switch_acknowledgment("in hindi", history)
    assert ack
    assert "पहले से" in ack
