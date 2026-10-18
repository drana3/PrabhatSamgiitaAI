import json

import pytest

from app.services.ai import MockProvider, extract_responses_text


@pytest.mark.asyncio
async def test_mock_provider_returns_hindi_localization_json() -> None:
    provider = MockProvider()
    prompt = "\n".join(
        [
            "Return only valid JSON with these keys:",
            "Title: BANDHU HE NIYE CALO",
            "English meaning: O dearest Friend, lead me on.",
            "Localize this Prabhat Samgiita song into Hindi (hi).",
        ]
    )
    payload = json.loads(await provider.complete(prompt))
    assert "ह" in str(payload["localized_meaning"])


@pytest.mark.asyncio
async def test_mock_provider_reviewer_returns_hindi_for_hi_targets() -> None:
    provider = MockProvider()
    revised = await provider.complete(
        "PRIMARY source (en):\nO dearest Friend, lead me on.\n"
        "DRAFT (hi):\nO dearest Friend, lead me on.\n"
        "Automated review notes:\n"
        "Translate into Hindi (hi)."
    )
    assert "ह" in revised


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
