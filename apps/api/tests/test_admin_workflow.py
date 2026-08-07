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
