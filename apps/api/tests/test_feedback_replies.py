from __future__ import annotations

from types import SimpleNamespace
from uuid import uuid4

from app.services.feedback_replies import contact_is_email, song_matches_feedback


def test_contact_is_email() -> None:
    assert contact_is_email("member@example.com") is True
    assert contact_is_email("  member@example.com ") is True
    assert contact_is_email("not-an-email") is False
    assert contact_is_email(None) is False
    assert contact_is_email("") is False


def test_song_matches_feedback_path_and_comment() -> None:
    by_path = SimpleNamespace(page_path="/songs/25", comment="please fix")
    assert song_matches_feedback(by_path, 25) is True
    assert song_matches_feedback(by_path, 26) is False

    by_comment = SimpleNamespace(
        page_path="/mobile/feedback",
        comment="Devanagari report for song #40\nline looks wrong",
    )
    assert song_matches_feedback(by_comment, 40) is True
    assert song_matches_feedback(by_comment, 4) is False


def test_reply_to_dict_shape() -> None:
    from app.services.feedback_replies import reply_to_dict

    reply = SimpleNamespace(
        id=uuid4(),
        body="Thanks for reporting",
        author_label="admin@example.com",
        kind="admin",
        email_delivered=True,
        created_at=None,
    )
    payload = reply_to_dict(reply)
    assert payload["body"] == "Thanks for reporting"
    assert payload["email_delivered"] is True
    assert payload["created_at"] == ""
