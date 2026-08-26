from unittest.mock import AsyncMock, patch

import pytest

from app.models.song import Song
from app.services.localization import LocalizationService
from app.services.song_meanings import (
    collect_stored_meanings,
    normalize_language_code,
    stored_meaning_for_language,
)


def test_normalize_language_code_accepts_labels_and_codes() -> None:
    assert normalize_language_code("hi") == "hi"
    assert normalize_language_code("Hindi") == "hi"
    assert normalize_language_code("Bengali") == "bn"


def test_collect_stored_meanings_merges_columns_and_metadata() -> None:
    song = Song(
        id=1,
        number=42,
        title="Test",
        english_meaning="English meaning",
        hindi_meaning="हिन्दी अर्थ",
        metadata_json={"localized_meanings": {"bn": "বাংলা অর্থ"}},
    )
    assert collect_stored_meanings(song) == {
        "en": "English meaning",
        "hi": "हिन्दी अर्थ",
        "bn": "বাংলা অর্থ",
    }


def test_stored_meaning_for_language_prefers_db_over_ai() -> None:
    song = Song(
        id=1,
        number=42,
        title="Test",
        english_meaning="English meaning",
        metadata_json={"localized_meanings": {"ta": "தமிழ் அர்த்தம்"}},
    )
    assert stored_meaning_for_language(song, "Tamil") == "தமிழ் அர்த்தம்"


@pytest.mark.asyncio
async def test_localize_returns_db_meaning_without_ai() -> None:
    song = Song(
        id=1,
        number=42,
        title="Test song",
        first_line="First line",
        english_meaning="English meaning",
        metadata_json={"localized_meanings": {"bn": "বাংলা অর্থ"}},
    )
    provider = AsyncMock()
    with patch("app.services.localization.select_provider", return_value=provider):
        result = await LocalizationService().localize(song, "Bengali")
    assert result.localized_meaning == "বাংলা অর্থ"
    assert result.localized_title == "Test song"
    provider.complete.assert_not_called()


@pytest.mark.asyncio
async def test_localize_retries_when_json_path_returns_english_for_tamil() -> None:
    song = Song(
        id=1,
        number=42,
        title="Test song",
        first_line="First line",
        english_meaning="Piercing the veil of darkness.",
    )
    provider = AsyncMock()
    provider.complete = AsyncMock(
        side_effect=[
            '{"localized_title":"Test","localized_first_line":"First",'
            '"localized_meaning":"Piercing the veil of darkness.",'
            '"localized_explanation":null}',
            "இருளின் திரையைத் துளைத்து.",
            "இருளின் திரையைத் துளைத்து.",
        ]
    )
    with patch("app.services.localization.select_provider", return_value=provider):
        result = await LocalizationService().localize(song, "Tamil")
    assert result.localized_meaning == "இருளின் திரையைத் துளைத்து."
    assert provider.complete.await_count >= 2
