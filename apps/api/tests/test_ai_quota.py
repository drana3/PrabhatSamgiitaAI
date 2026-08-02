from app.config import Settings
from app.services.ai_quota import (
    check_daily_ai_quota,
    record_daily_ai_question,
    reset_daily_ai_quota_for_tests,
)


def test_guest_daily_quota_allows_fifteen_questions() -> None:
    reset_daily_ai_quota_for_tests()
    settings = Settings(ai_daily_guest_limit=15, ai_daily_member_limit=50)

    for _ in range(15):
        status = check_daily_ai_quota(is_member=False, identity="203.0.113.10", settings=settings)
        assert status.allowed is True
        record_daily_ai_question(is_member=False, identity="203.0.113.10")

    status = check_daily_ai_quota(is_member=False, identity="203.0.113.10", settings=settings)
    assert status.allowed is False
    assert status.remaining == 0
    assert "guest limit" in status.guidance.casefold()
    assert "sign in" in status.guidance.casefold()


def test_member_daily_quota_allows_more_than_guests() -> None:
    reset_daily_ai_quota_for_tests()
    settings = Settings(ai_daily_guest_limit=15, ai_daily_member_limit=50)

    for _ in range(50):
        status = check_daily_ai_quota(is_member=True, identity="aad:user-1", settings=settings)
        assert status.allowed is True
        record_daily_ai_question(is_member=True, identity="aad:user-1")

    status = check_daily_ai_quota(is_member=True, identity="aad:user-1", settings=settings)
    assert status.allowed is False
    assert "signed-in limit" in status.guidance.casefold()
