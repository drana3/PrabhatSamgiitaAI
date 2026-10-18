from app.models import UserFeedback
from app.services.feedback_live import MIN_LIVE_QUOTE_LENGTH, live_display_name


def test_min_live_quote_length_is_usable_for_short_feedback() -> None:
    assert MIN_LIVE_QUOTE_LENGTH == 8


def test_live_display_name_from_email() -> None:
    feedback = UserFeedback(
        category="experience",
        rating=5,
        comment="This companion helped my morning practice deeply.",
        contact="devoted.seeker@example.com",
    )
    assert live_display_name(feedback) == "Devoted Seeker"


def test_live_display_name_fallback() -> None:
    feedback = UserFeedback(
        category="experience",
        rating=5,
        comment="This companion helped my morning practice deeply.",
        contact=None,
    )
    assert live_display_name(feedback) == "Community member"
