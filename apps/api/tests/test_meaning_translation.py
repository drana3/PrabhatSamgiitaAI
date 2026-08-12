from app.models.song import Song
from app.services.meaning_translation import (
    build_localization_prompt,
    build_meaning_translation_prompt,
    pick_meaning_source,
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
