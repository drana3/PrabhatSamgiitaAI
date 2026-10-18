import pytest

from app.models.song import Song
from app.services.meaning_translation import (
    audit_meaning_translation,
    build_localization_prompt,
    build_meaning_review_prompt,
    build_meaning_translation_prompt,
    pick_meaning_source,
    refine_meaning_translation,
)


def test_pick_meaning_source_prefers_hindi_for_bengali() -> None:
    song = Song(
        id=1,
        number=42,
        title="Test",
        english_meaning="English meaning",
        hindi_meaning="हिन्दी अर्थ",
    )
    text, code = pick_meaning_source(song, "bn")
    assert text == "हिन्दी अर्थ"
    assert code == "hi"


def test_pick_meaning_source_uses_english_when_no_hindi() -> None:
    song = Song(
        id=1,
        number=42,
        title="Test",
        english_meaning="English meaning",
    )
    text, code = pick_meaning_source(song, "bn")
    assert text == "English meaning"
    assert code == "en"


def test_pick_meaning_source_uses_english_lyrics_when_meaning_column_is_empty() -> None:
    song = Song(
        id=1,
        number=99,
        title="Come with me",
        language="English",
        lyrics_original="Come with me to the land of light.\nLeave the shadows behind.",
        first_line="Come with me to the land of light.",
        english_meaning=None,
        hindi_meaning=None,
    )
    text, code = pick_meaning_source(song, "hi")
    assert "Come with me to the land of light." in text
    assert code == "en"


def test_pick_meaning_source_does_not_use_non_english_lyrics_as_meaning() -> None:
    song = Song(
        id=1,
        number=1,
        title="Bandhu",
        language="Bengali",
        lyrics_original="বন্ধু হে নিয়ে চলো",
        english_meaning=None,
        hindi_meaning=None,
    )
    text, code = pick_meaning_source(song, "hi")
    assert text == ""
    assert code == ""


def test_build_meaning_translation_prompt_preserves_line_break_rules() -> None:
    song = Song(
        id=1,
        number=1,
        title="Bandhu He Niye Calo",
        first_line="Bandhu He Niye Calo",
        english_meaning="O dearest Friend,\nlead me on.",
        canonical_source_url="https://prabhatasamgiita.net/lyrics/ps_1.htm",
    )
    prompt = build_meaning_translation_prompt(song, "hi")
    assert "line breaks" in prompt.casefold()
    assert "PRIMARY source" in prompt
    assert "lead me on." in prompt
    assert "prabhatasamgiita.net" in prompt


def test_build_localization_prompt_uses_primary_source() -> None:
    song = Song(
        id=1,
        number=1,
        title="Bandhu He Niye Calo",
        first_line="Bandhu He Niye Calo",
        english_meaning="O dearest Friend,\nlead me on.",
        hindi_meaning="हे प्रिय सखा",
    )
    prompt = build_localization_prompt(song, "Bengali")
    assert "PRIMARY meaning source (hi)" in prompt
    assert "हे प्रिय सखा" in prompt
    assert "localized_meaning" in prompt


def test_audit_meaning_translation_flags_meta_commentary() -> None:
    audit = audit_meaning_translation(
        "O dearest Friend,\nlead me on.",
        "Here is the translation: प्रिय मित्र।",
        "hi",
    )
    assert audit.passed is False
    assert any("meta-commentary" in issue.casefold() for issue in audit.issues)


def test_build_meaning_review_prompt_includes_draft_and_source() -> None:
    song = Song(
        id=1,
        number=1,
        title="Bandhu He Niye Calo",
        english_meaning="O dearest Friend,\nlead me on.",
    )
    audit = audit_meaning_translation(
        song.english_meaning or "",
        "प्रिय मित्र।",
        "hi",
    )
    prompt = build_meaning_review_prompt(
        song,
        "hi",
        source_text=song.english_meaning or "",
        source_code="en",
        draft_text="प्रिय मित्र।",
        audit=audit,
    )
    assert "DRAFT" in prompt
    assert "PRIMARY source" in prompt
    assert "lead me on." in prompt


@pytest.mark.asyncio
async def test_refine_meaning_translation_prefers_revised_when_audit_improves() -> None:
    song = Song(
        id=1,
        number=1,
        title="Test",
        english_meaning="This song speaks of devotion.",
    )

    class FakeProvider:
        async def complete(self, prompt: str) -> str:
            assert "DRAFT" in prompt
            return "यह गीत भक्ति के विषय में है"

    refined = await refine_meaning_translation(
        FakeProvider(),
        song=song,
        target_language="hi",
        source_text="This song speaks of devotion.",
        source_code="en",
        draft_text="यह गीत भक्ति के बारे में है",
    )
    assert refined == "यह गीत भक्ति के विषय में है"
