from app.services.catalog_lyrics import (
    infer_stanza_blank_lines,
    is_corrupt_lyric_padding_line,
    normalize_official_br_paragraph_gaps,
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


def test_prepare_ps1565_title_without_sanskrit_metadata() -> None:
    row = prepare_catalog_lyrics_fields(
        {
            "title": "SAḾSKRTA",
            "first_line": "SAḾSKRTA",
            "language": "Roman",
            "lyrics_original": "SAḾSKRTA\nVAJRA KAT́HORA",
            "metadata_json": {"category": "K"},
        }
    )
    assert row["title"] == "VAJRA KAT́HORA"
    assert row["lyrics_original"].startswith("VAJRA")


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


def test_second_prepare_keeps_stanza_gaps() -> None:
    base = {
        "title": "ELO",
        "first_line": "ELO",
        "language": "Roman",
        "metadata_json": {},
        "lyrics_original": "OPEN\n\nSTANZA TWO\n",
    }
    first = prepare_catalog_lyrics_fields(base)
    again = prepare_catalog_lyrics_fields({**base, **first})
    assert sum(1 for line in again["lyrics_original"].split("\n") if not line.strip()) >= 1


def test_flat_lyrics_with_trailing_blank_uses_infer_not_normalize() -> None:
    flat = "\n".join(
        [
            "ELO, ANEK JUGER SEI AJANA PATHIK",
            "CETANAR MADHURA TANE",
            "ELO, ANEK JUGER SEI AJANA PATHIK",
            "SAB HARANOR VEDANATE",
            "",
        ]
    )
    cleaned = sanitize_catalog_lyrics_text(flat, language="Roman")
    assert sum(1 for line in cleaned.split("\n") if not line.strip()) >= 1
    assert "CETANAR" in cleaned.split("\n")[1]


def test_normalize_official_br_ps5_style() -> None:
    scraped = [
        "ELO, ANEK JUGER SEI AJANA PATHIK",
        "",
        "",
        "CETANAR MADHURA TANE",
        "",
        "",
        "TAI, JIIVAN AMAR BHARE GELO GANE",
        "",
        "",
        "ELO, ANEK JUGER SEI AJANA PATHIK",
        "",
        "",
        "",
        "",
        "SAB HARANOR VEDANATE",
    ]
    assert normalize_official_br_paragraph_gaps(scraped) == [
        "ELO, ANEK JUGER SEI AJANA PATHIK",
        "CETANAR MADHURA TANE",
        "TAI, JIIVAN AMAR BHARE GELO GANE",
        "ELO, ANEK JUGER SEI AJANA PATHIK",
        "",
        "SAB HARANOR VEDANATE",
    ]


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