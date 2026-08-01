from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
from typing import Any

SCRIPT = Path(__file__).resolve().parents[3] / "scripts" / "extract_harmonium_notation.py"
SPEC = spec_from_file_location("extract_harmonium_notation", SCRIPT)
assert SPEC and SPEC.loader
MODULE: Any = module_from_spec(SPEC)
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
    assert confidence < 0.7


def test_plain_lyrics_do_not_create_notation() -> None:
    notation, confidence = MODULE.build_notation(
        {"first_line": "Bandhu he niye calo"},
        "বন্ধু হে নিয়ে চলো\nআলোর ওই ঝর্ণাধারার পানে",
    )

    assert notation is None
    assert confidence == 0.0
