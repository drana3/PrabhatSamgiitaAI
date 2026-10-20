"""English theme labels must not stay inside singing lyrics."""

from app.services.lyrics_theme import (
    drop_last_nonempty_line,
    extract_trailing_english_theme,
    format_theme_label,
    is_english_theme_line,
)


def test_song_of_line_is_theme() -> None:
    assert is_english_theme_line("SONG OF FULFILMENT")
    assert is_english_theme_line("Song of Liberation")
    assert not is_english_theme_line("BANDHU HE NIYE CALO")
    assert not is_english_theme_line("CETANÁR MADHURA TÁNE")


def test_extract_trailing_theme_from_lyrics() -> None:
    roman = "ELO, ANEK JUGER SEI AJÁNÁ PATHIK\nCETANÁR MADHURA TÁNE\nSONG OF FULFILLMENT\n"
    cleaned, theme = extract_trailing_english_theme(roman)
    assert theme == "Song of Fulfillment"
    assert "SONG OF" not in cleaned
    assert cleaned.endswith("TÁNE\n") or cleaned.rstrip().endswith("TÁNE")


def test_format_theme_label() -> None:
    assert format_theme_label("SONG OF FULFILMENT") == "Song of Fulfilment"


def test_drop_last_nonempty_devanagari_line() -> None:
    dev = "एलो\nचेतनार्\nसोन्ग् ओफ़् फ़ुल्फ़िल्ल्मेन्त्\n"
    assert drop_last_nonempty_line(dev).rstrip() == "एलो\nचेतनार्"
