import pytest

from app.services.ai import extract_responses_text


def test_extract_responses_text_from_message_content() -> None:
    payload = {
        "output": [
            {
                "type": "message",
                "content": [
                    {"type": "output_text", "text": "A grounded response."},
                ],
            }
        ]
    }

    assert extract_responses_text(payload) == "A grounded response."


def test_extract_responses_text_rejects_empty_payload() -> None:
    with pytest.raises(ValueError, match="status='incomplete'.*max_output_tokens"):
        extract_responses_text(
            {
                "status": "incomplete",
                "incomplete_details": {"reason": "max_output_tokens"},
                "output": [],
            }
        )
