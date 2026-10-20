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


def test_format_central_idea_prose_makes_two_paragraphs() -> None:
    from app.services.meaning_translation import format_central_idea_prose

    formatted = format_central_idea_prose(
        "Central idea: The heart longs for light. Darkness feels heavy. "
        "Walk toward the fountain of love with trust."
    )
    assert "\n\n" in formatted
    assert "Central idea:" not in formatted
    assert "heart longs" in formatted


def test_usable_explanation_rejects_meaning_mirror() -> None:
    from app.services.localization import LocalizationService

    hindi = (
        "जीवन के अंतिम पड़ाव पर, सीपियाँ इकट्ठी करते हुए, मेरा जीवन बीतता जा रहा है। "
        "कितने लोग आए और चले गए, बिना मेरी ओर देखे?"
    )
    song = Song(
        number=99,
        title="Test",
        english_meaning="At the far end of my life, collecting shells.",
        hindi_meaning=hindi,
        metadata_json={},
    )
    service = LocalizationService()
    assert (
        service._usable_localized_explanation(
            song,
            hindi,
            None,
            language="hi",
            localized_meaning=hindi,
        )
        is None
    )
    short = (
        "जीवन के अंत में साधिका सीपियाँ बटोरती हुई प्रभु की राह जोहती है।\n\n"
        "उन्होंने कहा था वे आकर उसे सागर पार ले जाएँगे।"
    )
    assert (
        service._usable_localized_explanation(
            song,
            short,
            None,
            language="hi",
            localized_meaning=hindi,
        )
        == short
    )


def test_usable_explanation_allows_expanding_language_central_idea() -> None:
    """Romance/Indic Central ideas can exceed English char length without being mirrors."""
    english = (
        "The lyres of all minds play to the same tune today. There is fragrance "
        "in all hearts. You came onto this earth with Your exquisite appearance "
        "and gave the same feeling to all. Do not tear my garland of flowers, "
        "my entire wealth of compassion. Come close to me, come closer, still "
        "closer, take all that I have."
    )
    galician_meaning = (
        "As liras de todas as mentes tocan a mesma melodía hoxe. Hai fragancia "
        "en todos os corazóns. Viñeches a esta terra co teu exquisito aspecto "
        "e décheslle o mesmo sentimento a todos. Non rompas a miña guirlanda "
        "de flores, toda a miña riqueza de compaixón. Achegácheste a min."
    )
    # Longer than 75% of English (old gate) but under 1.65× Galician meaning.
    galician_idea = (
        "Hoxe todas as mentes vibran nunha soa melodía e hai un sutil aroma "
        "de ternura en cada corazón; sentín a túa chegada, tan fermosa, e esa "
        "presenza chea de luz instaurou a mesma ledicia en todos nós. "
        "Ofrezoche o meu colar de flores, todo o meu afecto e compaixón.\n\n"
        "Achega‑te máis, cada paso teu preto axústame o corazón; toma canto teño."
    )
    song = Song(
        number=4,
        title="Test",
        english_meaning=english,
        metadata_json={},
    )
    service = LocalizationService()
    assert len(galician_idea) >= int(len(english) * 0.75)
    assert len(galician_idea) < int(len(galician_meaning) * 1.65)
    assert (
        service._usable_localized_explanation(
            song,
            galician_idea,
            None,
            language="gl",
            localized_meaning=galician_meaning,
        )
        == galician_idea
    )


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
