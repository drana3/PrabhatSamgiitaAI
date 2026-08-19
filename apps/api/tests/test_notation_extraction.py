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
