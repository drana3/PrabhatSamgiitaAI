from app.services.catalog_lyrics import (
    infer_stanza_blank_lines,
    is_corrupt_lyric_padding_line,
    prepare_catalog_lyrics_fields,
    sanitize_catalog_lyrics_text,
)


def test_corrupt_padding_line() -> None:
    assert is_corrupt_lyric_padding_line("ÁÁÁÁÁÁÁÁÁÁ")
    assert not is_corrupt_lyric_padding_line("ESE CHILE TUMI")


def test_strips_sanskrit_label_ps1565() -> None:
    cleaned = sanitize_catalog_lyrics_text(
        "SAḾSKRTA\nVAJRA KAT́HORA",
        language="Roman",
        language_labels=["Sanskrit"],
    )
    assert cleaned.startswith("VAJRA")
    assert "SAM" not in cleaned


def test_prepare_ps4404_heading() -> None:
    row = prepare_catalog_lyrics_fields(
        {
            "title": "ÁÁÁÁÁÁÁÁÁÁ",
            "first_line": "ÁÁÁÁÁÁÁÁÁÁ",
            "language": "Roman",
            "lyrics_original": (
                "ÁÁÁÁÁÁÁÁÁÁ\n"
                "ESE CHILE TUMI ÁMÁR JIIVANE\n"
                "KATA JANAMER PUŃYA PHALE"
            ),
            "metadata_json": {},
        }
    )
    assert row["title"] == "ESE CHILE TUMI ÁMÁR JIIVANE"
    assert row["lyrics_original"].startswith("ESE CHILE")


def test_infer_stanza_blank_before_refrain() -> None:
    lines = ["REFRAIN", "LINE TWO", "REFRAIN", "LINE FOUR"]
    assert infer_stanza_blank_lines(lines) == ["REFRAIN", "LINE TWO", "", "REFRAIN", "LINE FOUR"]


def test_infer_stanza_preserves_official_blanks() -> None:
    lines = ["REFRAIN", "STANZA", "", "REFRAIN", "END"]
    assert infer_stanza_blank_lines(lines) == lines


def test_infer_stanza_repeating_couplet() -> None:
    lines = [
        "OPENING",
        "NUTAN CHANDE",
        "AJ NUTAN CHANDE",
        "MIDDLE",
        "NUTAN CHANDE",
        "AJ NUTAN CHANDE",
    ]
    with_gaps = infer_stanza_blank_lines(lines)
    assert any(not line.strip() for line in with_gaps)