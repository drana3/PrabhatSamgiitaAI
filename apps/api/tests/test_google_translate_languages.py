from app.services.google_translate_languages import google_target_code
from app.services.song_meanings import language_display_name, normalize_language_code


def test_google_target_code_covers_full_catalog_and_aliases() -> None:
    assert google_target_code("es") == "es"
    assert google_target_code("mai") == "mai"
    assert google_target_code("zh") == "zh-CN"
    assert google_target_code("zh-CN") == "zh-CN"
    assert google_target_code("zh-tw") == "zh-TW"
    assert google_target_code("he") == "he"
    assert google_target_code("iw") == "he"
    assert google_target_code("mni-Mtei") == "mni-Mtei"
    assert google_target_code("mag") is None  # LLM-only Magahi


def test_normalize_preserves_google_canonical_codes() -> None:
    assert normalize_language_code("Chinese (Simplified)") == "zh-CN"
    assert normalize_language_code("zh-cn") == "zh-CN"
    assert normalize_language_code("Meiteilon (Manipuri)") == "mni-Mtei"
    assert language_display_name("zh-CN") == "Chinese (Simplified)"
