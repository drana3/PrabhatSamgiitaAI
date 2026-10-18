import sys
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
from typing import Any

from app.services.seed_data import _merge_notation_practice

INGEST = Path(__file__).resolve().parents[3] / "scripts" / "ingest_sarkarverse_sargam.py"
SPEC = spec_from_file_location("ingest_sarkarverse_sargam", INGEST)
assert SPEC and SPEC.loader
MODULE: Any = module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


def test_divyadyuti_filename_maps_to_song_number() -> None:
    row = MODULE.classify("Divyadyuti", "Divyadyuti/2094sl.pdf")
    assert row["kind"] == "divyadyuti"
    assert row["parse"] == "digital_text"
    assert row["song_number"] == 2094
    assert row["source_url"].endswith("2094sl.pdf")


def test_roman_and_bengali_files_are_classified() -> None:
    roman = MODULE.classify("0001-1000", "0001-1000/RS_0026-0050.pdf")
    assert roman["script"] == "roman"
    assert roman["family"] == "rs_roman"
    assert roman["extract_role"] == "extract"
    bengali = MODULE.classify(
        "4001-5018",
        "4001-5018/Prabhata_Samgiita_Svaralipi_Volume_09_Part_01_Song_4001_to_4025.pdf",
    )
    assert bengali["script"] == "bengali"
    assert bengali["family"] == "svaralipi"
    assert bengali["song_start"] == 4001
    assert bengali["song_end"] == 4025
    assert bengali["extract_role"] == "skip_not_roman"
    typo = MODULE.classify(
        "4001-5018",
        "4001-5018/Prabhata_Samgiita_Svaralipi_Volume_09_Part_05_Song_4101_tp_4125.pdf",
    )
    assert typo["song_start"] == 4101
    assert typo["song_end"] == 4125
    dump = MODULE.classify("0001-1000", "0001-1000/0001-1000.pdf")
    assert dump["extract_role"] == "skip_duplicate"
    assert dump["kind"] == "range_dump"


def test_plan_picks_one_primary_per_song_without_dump_duplicates() -> None:
    files = [
        MODULE.classify("0001-1000", "0001-1000/0001-1000.pdf"),
        MODULE.classify("0001-1000", "0001-1000/RS_0026-0050.pdf"),
        MODULE.classify("FromPSnet", "FromPSnet/0001-1000.pdf"),
        MODULE.classify("Divyadyuti", "Divyadyuti/0027sl.pdf"),
        MODULE.classify("Divyadyuti", "Divyadyuti/2094sl.pdf"),
        MODULE.classify(
            "4001-5018",
            "4001-5018/Prabhata_Samgiita_Svaralipi_Volume_09_Part_01_Song_4001_to_4025.pdf",
        ),
    ]
    plan = MODULE.build_plan({"files": files})
    assert plan["songs"]["27"]["script"] == "roman"
    assert plan["songs"]["27"]["primary_file"] == "RS_0026-0050.pdf"
    assert "2094" not in plan["songs"]
    assert "4001" not in plan["songs"]
    primaries = [row["primary_file"] for row in plan["songs"].values()]
    assert "0001-1000.pdf" not in primaries
    assert len(plan["songs"]) == len(set(plan["songs"]))


def test_roman_sargam_rows_parse_into_learner_notes() -> None:
    raw = """
    ( 27 )
    Ta'l : Da'dra'
    II Ga' pa' pa' pa' | pa' pa' pa' pa' I pa' dha' pa' ma'
    Da' o sa' r'a o go Pra bhu
    I Ra' a' ra' ra' | ra' ra' ga' ma' I ra' ga' pa' ma'
    """
    chunks = MODULE.split_booklet_by_song(raw, 26, 50)
    assert 27 in chunks
    song = {"number": 27, "transliteration": "Dao sara ogo Prabhu\nNidra yakhan"}
    notation, confidence = MODULE.build_notation(song, chunks[27])
    assert notation is not None
    assert notation["tala"]["name"] == "Dadra"
    notes = [
        beat["notes"][0]["sargam"]
        for measure in notation["lines"][0]["measures"]
        for beat in measure["beats"]
    ]
    assert notes[:4] == ["G", "P", "P", "P"]
    assert "D" in notes
    assert confidence > 0


def test_roman_booklet_parser_reads_sarkarverse_rs_holds() -> None:
    extract = MODULE.extract
    beats = extract.parse_roman_booklet_beats(
        "II Sa ra ga a I ga dha pa a I ra a ga a I sa a ra a I"
    )
    assert sum(item["beats"] for item in beats) == 16
    assert beats[0]["sargam"] == "S"
    assert beats[2]["beats"] == 2


def test_digital_rows_keep_sargam_and_drop_lyrics() -> None:
    raw = """
    এই অনুররাধ প্রভু তব চরণে
    ⅠⅠ সা   গা     গা    গা    |    গা     মা       রা     গা
    এ ই অ নু রোধ প্র ভু
    Ⅰ পা   সা   ধা    পা    |    মা     গা       রা     সা
    """
    filtered = MODULE.filter_digital_sargam_text(raw)
    assert "সা" in filtered and "পা" in filtered
    assert "অনুররাধ" not in filtered
    song = {"number": 2094, "transliteration": "Ei anuradha prabhu\nManere amar"}
    notation, confidence = MODULE.build_notation(song, filtered)
    assert notation is not None
    assert notation["lines"]
    assert notation["lines"][0]["measures"][0]["beats"][0]["notes"][0]["sargam"] in {"S", "P"}
    assert confidence > 0


def test_practice_drafts_outside_andromeda_are_appended_for_the_db() -> None:
    sources = [
        {
            "song_number": 1,
            "source_url": "https://example.test/1.pdf",
            "notation_text": None,
            "verification_status": "verified",
            "metadata_json": {},
        }
    ]
    drafts = [
        {
            "song_number": 2094,
            "source_url": "https://sarkarverse.org/SARGAM/Divyadyuti/2094sl.pdf",
            "notation_text": '{"version":1,"lines":[]}',
            "scale": "C",
            "verification_status": "practice_draft",
            "metadata_json": {
                "source_kind": "sarkarverse_divyadyuti",
                "requires_human_review": True,
            },
        },
        {
            "song_number": 27,
            "source_url": "https://sarkarverse.org/SARGAM/0001-1000/RS_0026-0050.pdf",
            "notation_text": (
                '{"version":1,"lines":[{"line_number":1,"lyrics":"Dao","measures":[]}]}'
            ),
            "scale": "C",
            "verification_status": "practice_draft",
            "metadata_json": {
                "source_kind": "sarkarverse_roman_ocr",
                "extraction_method": "sarkarverse_roman_tesseract",
            },
        },
    ]
    merged = _merge_notation_practice(sources, drafts)
    numbers = {row["song_number"] for row in merged}
    assert 2094 not in numbers
    assert 1 in numbers and 27 in numbers
    song1 = next(row for row in merged if row["song_number"] == 1)
    assert not song1.get("notation_text")
    extra = next(row for row in merged if row["song_number"] == 27)
    assert extra["notation_text"].startswith("{")
    assert "prabhatasamgiita.net" in extra["source_url"]
    assert "sarkarverse.org" not in extra["source_url"]
    assert extra["source_url"].endswith("andromeda.php")


def test_expert_curated_4961_overrides_practice_draft() -> None:
    import json

    from app.schemas.notation import HarmoniumNotation
    from app.services.seed_data import load_rows

    load_rows.cache_clear()
    rows = load_rows("notations.json")
    row = next(item for item in rows if item.get("song_number") == 4961)
    assert row["verification_status"] == "expert_verified"
    assert (row.get("metadata_json") or {}).get("expert_overrides_practice") is True
    payload = row["notation_text"]
    if isinstance(payload, str):
        payload = json.loads(payload)
    notation = HarmoniumNotation.model_validate(payload)
    assert notation.tala is not None
    assert notation.tala.beats == 8
    assert len(notation.lines) == 3
    first = notation.lines[0].measures[0].beats[0].notes[0]
    assert first.sargam == "P"
    assert first.western == "G4"
    hold = notation.lines[0].measures[0].beats[1].notes[0]
    assert hold.sargam == "-"
    assert hold.western is None


def test_learner_notation_url_never_returns_sarkarverse() -> None:
    assert "sarkarverse.org" not in MODULE.learner_notation_url(
        "https://sarkarverse.org/SARGAM/Divyadyuti/2094sl.pdf"
    )
    assert MODULE.learner_notation_url(
        "https://prabhatasamgiita.net/notations/1.pdf"
    ).endswith("1.pdf")


def test_extract_is_required_until_stamp_matches() -> None:
    index = {
        "divyadyuti_count": 1,
        "files": [
                {
                    "kind": "divyadyuti",
                    "folder": "Divyadyuti",
                    "filename": "2094sl.pdf",
                    "song_number": 2094,
                    "source_url": "https://sarkarverse.org/SARGAM/Divyadyuti/2094sl.pdf",
                },
                {
                    "kind": "booklet_scan",
                    "parse": "roman_ocr",
                    "folder": "0001-1000",
                    "filename": "RS_0026-0050.pdf",
                    "song_start": 26,
                    "song_end": 50,
                    "source_url": "https://sarkarverse.org/SARGAM/0001-1000/RS_0026-0050.pdf",
                },
        ],
    }
    booklet = "https://sarkarverse.org/SARGAM/0001-1000/RS_0026-0050.pdf"
    assert MODULE.extract_is_required(index, None) is True
    stamp = {
        "fingerprint": MODULE.source_fingerprint(index),
        "extracted_count": 1,
        "processed_booklets": [booklet],
    }
    assert MODULE.extract_is_required(index, stamp) is False
    pending = {"fingerprint": MODULE.source_fingerprint(index), "processed_booklets": []}
    assert MODULE.extract_is_required(index, pending) is True
    stale = {"fingerprint": "old", "extracted_count": 1, "processed_booklets": [booklet]}
    assert MODULE.extract_is_required(index, stale) is True
