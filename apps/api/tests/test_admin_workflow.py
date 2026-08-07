import pytest

from app.services.ingestion_language import validate_meaning_language


def test_validate_meaning_language_accepts_english() -> None:
    ok, message = validate_meaning_language("en", "This song speaks of devotion.")
    assert ok is True
    assert message == ""


def test_validate_meaning_language_rejects_hindi_in_english_slot() -> None:
    ok, message = validate_meaning_language("en", "यह गीत भक्ति के बारे में है")
    assert ok is False
    assert "English" in message


def test_validate_meaning_language_accepts_devanagari_for_hindi() -> None:
    ok, message = validate_meaning_language("hi", "यह गीत भक्ति के बारे में है")
    assert ok is True


@pytest.mark.asyncio
async def test_translate_meaning_from_english_uses_db_english() -> None:
    from unittest.mock import AsyncMock, patch

    from app.models import Song
    from app.services.admin_workflow import translate_meaning_from_english

    song = Song(
        id=1,
        number=42,
        title="Test song",
        english_meaning="This song speaks of devotion.",
    )
    session = AsyncMock()
    session.scalar = AsyncMock(return_value=song)

    class FakeProvider:
        async def complete(self, prompt: str) -> str:
            assert "This song speaks of devotion." in prompt
            assert "Hindi" in prompt
            return "यह गीत भक्ति के बारे में है"

    with patch(
        "app.services.admin_workflow.select_provider",
        return_value=FakeProvider(),
    ):
        result = await translate_meaning_from_english(session, 42, "hi")

    assert result.draft_text == "यह गीत भक्ति के बारे में है"
    assert result.source_language == "en"
    assert result.target_language == "hi"
    assert result.language_check_ok is True


@pytest.mark.asyncio
async def test_translate_meaning_from_english_requires_english_source() -> None:
    from unittest.mock import AsyncMock

    from fastapi import HTTPException

    from app.models import Song
    from app.services.admin_workflow import translate_meaning_from_english

    song = Song(id=1, number=42, title="Test song", english_meaning=None)
    session = AsyncMock()
    session.scalar = AsyncMock(return_value=song)

    with pytest.raises(HTTPException) as exc:
        await translate_meaning_from_english(session, 42, "hi")
    assert exc.value.status_code == 400
    assert "English" in str(exc.value.detail)


@pytest.mark.asyncio
async def test_translate_meaning_from_english_accepts_override() -> None:
    from unittest.mock import AsyncMock, patch

    from app.models import Song
    from app.services.admin_workflow import translate_meaning_from_english

    song = Song(id=1, number=42, title="Test song", english_meaning="Stored meaning")
    session = AsyncMock()
    session.scalar = AsyncMock(return_value=song)

    class FakeProvider:
        async def complete(self, prompt: str) -> str:
            assert "Override meaning" in prompt
            assert "Stored meaning" not in prompt
            return "अनुवाद"

    with patch(
        "app.services.admin_workflow.select_provider",
        return_value=FakeProvider(),
    ):
        result = await translate_meaning_from_english(
            session,
            42,
            "hi",
            english_text="Override meaning",
        )

    assert result.draft_text == "अनुवाद"
