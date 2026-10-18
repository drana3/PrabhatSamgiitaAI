import sys
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
from typing import Any

SCRIPT = Path(__file__).resolve().parents[3] / "scripts" / "extract_harmonium_notation.py"
SPEC = spec_from_file_location("extract_harmonium_notation", SCRIPT)
assert SPEC and SPEC.loader
MODULE: Any = module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


def test_bengali_ocr_rows_become_learner_notation() -> None:
    song = {
        "number": 1,
        "transliteration": "Bandhu he niye calo\nAlor oi jharana dharar pane",
    }
    ocr = """
    তাল কাহারবা
    পা পা - - মা | গা - - - | সা রা - না
    ব ন্ ধু হে নিয়ে চল
    সা রা রা - | রা গা - গা | মা পা - মা
    আলোর ওই ঝর্ণাধারার পানে
    """

    notation, confidence = MODULE.build_notation(song, ocr)

    assert notation is not None
    assert notation["tala"]["beats"] == 8
    assert notation["lines"][0]["lyrics"] == "Bandhu he niye calo"
    assert notation["lines"][0]["measures"][0]["beats"][0]["notes"][0]["sargam"] == "P"
    assert confidence < 0.85
    assert len(notation["lines"]) >= 2


def test_ocr_rows_without_double_bar_markers_still_count() -> None:
    song = {"lyrics_original": "Line one\nLine two\nLine three"}
    ocr = """
    পা পা - মা গা সা রা না
    সা রা রা - গা মা পা মা
    ধা নি সা - নি ধা পা মা
    """
    notation, confidence = MODULE.build_notation(song, ocr)
    assert notation is not None
    assert len(notation["lines"]) == 3
    assert confidence >= 0.5


def test_plain_lyrics_do_not_create_notation() -> None:
    notation, confidence = MODULE.build_notation(
        {"first_line": "Bandhu he niye calo"},
        "বন্ধু হে নিয়ে চলো\nআলোর ওই ঝর্ণাধারার পানে",
    )

    assert notation is None
    assert confidence == 0.0


def test_extra_ocr_rows_are_capped_to_lyric_line_count() -> None:
    song = {"lyrics_original": "One\nTwo"}
    ocr = """
    পা পা - মা গা সা রা না
    সা রা রা - গা মা পা মা
    ধা নি সা - নি ধা পা মা
    নি ধা পা - মা গা রা সা
    """
    notation, _confidence = MODULE.build_notation(song, ocr)
    assert notation is not None
    assert len(notation["lines"]) == 2
    assert notation["lines"][0]["lyrics"] == "One"
    assert notation["lines"][1]["lyrics"] == "Two"


def test_roman_booklet_holds_keep_kaharva_matras() -> None:
    refrain = "Pa á á ma | Ga á á á | Sa Re á Ni | Sa á á á"
    beats = MODULE.parse_roman_booklet_beats(refrain)
    assert [item["sargam"] for item in beats] == ["P", "m", "G", "S", "R", "N", "S"]
    assert [item["beats"] for item in beats] == [3, 1, 4, 1, 2, 1, 4]
    assert sum(item["beats"] for item in beats) == 16

    row = "Sa ra ga á | ga dha pa á | ra á ga á | sa á ra á"
    second = MODULE.parse_roman_booklet_beats(row)
    assert sum(item["beats"] for item in second) == 16
    assert second[0] == {"sargam": "S", "beats": 1}
    assert second[2] == {"sargam": "G", "beats": 2}

    notation, confidence = MODULE.build_notation(
        {"transliteration": "Bandhu he niye calo"},
        f"Tal : Kaharba\n{refrain}\n",
    )
    assert notation is not None
    first = notation["lines"][0]["measures"][0]["beats"][0]["notes"][0]
    assert first["sargam"] == "P"
    assert first["duration"] == 3.0
    assert confidence > 0


def test_rs_song2_keeps_ni_sa_on_dhara_not_upala() -> None:
    song = {
        "number": 2,
        "transliteration": "E gan amar\nAlor jharnadhara\nUpala pathe dine rate",
        "lyrics_original": "এ গান আমার\nআলোর ঝর্ণাধারা\nউপল-পথে দিনে রাতে",
    }
    ocr = """
    ( 2 )
    MUKTIGIITI
    E gan amar
    Alor jharnadhara
    Upala pathe dine rate
    (Deoghar, 17 September 1982)
    Tal : Kaharba
    Sa ra ga a | ga dha pa a | ra a ga a | sa a ra a
    E e gan amar alor jhar na
    Na a sa a | a a a a | pa ksa ga ma | ga a a a
    Dha a ra a a a a a u pa la pa the e e e
    """
    notation = MODULE.parse_rs_song_page(ocr, song)
    assert notation is not None
    lyrics = [line["lyrics"] for line in notation["lines"]]
    sargam = [line["sargam_text"] for line in notation["lines"]]
    dhara = next(line for line in notation["lines"] if line["sargam_text"].startswith("Ni á Sa á"))
    upala = next(line for line in notation["lines"] if "upala" in line["lyrics"].lower())
    assert "upala" not in dhara["lyrics"].lower()
    assert "dhara" in dhara["lyrics"].lower() or "jharna" in dhara["lyrics"].lower()
    assert "upala" in upala["lyrics"].lower()
    assert lyrics[0].lower().startswith("e gan")
    assert "Sa Re Ga á" in sargam[0]


def test_photo_ocr_punctuation_still_counts_as_bar_markers() -> None:
    song = {"lyrics_original": "Line one\nLine two"}
    # Book-photo OCR often turns | and - into · : …
    ocr = """
    পা পা · · মা : গা · · · : সা রা · না
    সা রা রা · : রা গা · গা : মা পা · মা
    """
    notation, confidence = MODULE.build_notation(song, ocr)
    assert notation is not None
    assert len(notation["lines"]) == 2
    assert confidence >= 0.5


def test_dense_photo_row_without_bars_can_count() -> None:
    assert MODULE.score_notation_line("স র গ ম প ধ ন স র গ ম") > 0
    assert MODULE.score_notation_line("বন্ধু হে নিয়ে চলো আলোর পানে") == 0


def test_near_duplicate_ocr_rows_are_collapsed() -> None:
    song = {"lyrics_original": "One\nTwo"}
    ocr = """
    পা পা - মা গা সা রা না
    পা পা - মা গা সা রা না
    সা রা রা - গা মা পা মা
    """
    notation, _confidence = MODULE.build_notation(song, ocr)
    assert notation is not None
    assert len(notation["lines"]) == 2
