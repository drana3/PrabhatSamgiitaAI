from app.models import UserFeedback
from app.services.feedback_live import live_display_name


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
