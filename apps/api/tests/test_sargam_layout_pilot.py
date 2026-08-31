import json
import sys
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SCRIPTS = ROOT / "scripts"


def load_module(name: str, path: Path):
    spec = spec_from_file_location(name, path)
    assert spec and spec.loader
    module = module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


extract = load_module("extract_harmonium_notation", SCRIPTS / "extract_harmonium_notation.py")
pilot = load_module("pilot_sargam_extract", SCRIPTS / "pilot_sargam_extract.py")


def test_song2_gold_fixture_has_twelve_lines() -> None:
    gold = json.loads((ROOT / "data/fixtures/song2_gold_sargam.json").read_text(encoding="utf-8"))
    assert gold["song_number"] == 2
    assert len(gold["lines"]) == 12
    assert gold["pages"] == [10, 11]


def test_match_pipeline_lines_pairs_refrain() -> None:
    gold_lines = [
        {"lyric": "Alor jharnadhara", "sargam": "Sa á Re á | Ni á Sa á | á á á á"},
        {"lyric": "dhara", "sargam": "Ni á Sa á | á á á á"},
    ]
    candidates = [
        ("dhara", "Ni á Sa á | á á á á"),
        ("Alor jharnadhara", "Sa á Re á | Ni á Sa á | á á á á"),
    ]
    matched = pilot.match_pipeline_lines(extract, gold_lines, candidates)
    assert matched[0][1].startswith("Ni á Sa")
    assert matched[1][1].startswith("Sa á Re")


def test_play_beats_use_holds_not_dashes_and_keep_taar() -> None:
    roman = load_module("prabhat_sargam_roman", SCRIPTS / "prabhat_sargam_roman.py")
    line = "Sa' ga' a' sa' | ga' ma' ga' ra'"
    beats = roman.play_beats_from_roman(line)
    sargam = roman.sargam_display_from_roman(line)
    assert "---" not in sargam
    assert "á" in sargam
    assert any(item["sargam"].endswith("'") for item in beats)
    assert roman.matra_total(beats) == 8


def test_extract_validate_rejects_dash_holds(tmp_path) -> None:
    roman = load_module("prabhat_sargam_roman", SCRIPTS / "prabhat_sargam_roman.py")
    payload = {
        "lines": [
            {
                "line_number": 1,
                "roman": "Pa --- Pa",
                "sargam": "Pa --- Pa",
                "play_beats": [{"sargam": "P", "beats": 1}],
            }
        ]
    }
    problems = []
    for line in payload["lines"]:
        if "---" in str(line.get("sargam") or ""):
            problems.append("dash hold")
    assert problems
    assert roman.play_beats_from_roman("Pa a' Pa")
    assert "---" not in roman.sargam_display_from_roman("Pa a' Pa")


def test_beats_signature_matches_gold_opening_line() -> None:
    gold = json.loads((ROOT / "data/fixtures/song2_gold_sargam.json").read_text(encoding="utf-8"))
    opening = gold["lines"][0]["sargam"]
    beats = pilot.beats_signature(extract, opening)
    assert beats == [
        ("S", 1),
        ("R", 1),
        ("G", 2),
        ("G", 1),
        ("D", 1),
        ("P", 2),
        ("R", 2),
        ("G", 2),
        ("S", 2),
        ("R", 2),
    ]
