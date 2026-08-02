from app.services.feedback_triage import feedback_acknowledgement, feedback_is_priority


def test_priority_feedback_flags_ai_and_low_ratings() -> None:
    assert feedback_is_priority("ai", 5) is True
    assert feedback_is_priority("experience", 2) is True
    assert feedback_is_priority("search", 4) is False


def test_acknowledgement_includes_reference() -> None:
    message = feedback_acknowledgement("12345678-abcd", priority=True)
    assert "12345678" in message
    assert "prioritise" in message.lower()
