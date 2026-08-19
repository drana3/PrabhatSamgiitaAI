import sys
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
from typing import Any

SCRIPT = Path(__file__).resolve().parents[3] / "scripts" / "sync_prabhata.py"
SPEC = spec_from_file_location("sync_prabhata", SCRIPT)
assert SPEC and SPEC.loader
MODULE: Any = module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


def test_prefer_bengali_display_number_when_filename_prefix_is_wrong() -> None:
    number, title, meta = MODULE.parse_notation_label(
        "__290 - (২৯৬) (প্রভু) তোমার পরশ",
        "__290 - (২৯৬) (প্রভু) তোমার পরশ.pdf",
    )
    assert number == 296
    assert "তোমার পরশ" in title
    assert meta["number_source"] == "bengali_display"
    assert meta["filename_number"] == 290


def test_group_continuation_parts_under_one_song() -> None:
    rows = [
        {
            "song_number": 88,
            "source_url": "https://prabhatasamgiita.net/notations/88-a.pdf",
            "metadata_json": {"title": "Song", "part": 1},
        },
        {
            "song_number": 88,
            "source_url": "https://prabhatasamgiita.net/notations/88-b.pdf",
            "metadata_json": {"title": "Song", "part": 2},
        },
    ]
    grouped = MODULE.group_notation_parts(rows)
    assert len(grouped) == 1
    assert grouped[0]["song_number"] == 88
    assert grouped[0]["metadata_json"]["part_count"] == 2
    assert len(grouped[0]["metadata_json"]["source_urls"]) == 2


def test_malformed_bengali_parenthetical_still_resolves_number() -> None:
    number, title, meta = MODULE.parse_notation_label(
        "__360 - (৩৬২নূতন প্রভাতে অরুণ আলোতে",
        "__360 - (৩৬২নূতন প্রভাতে অরুণ আলোতে.pdf",
    )
    assert number == 362
    assert meta["number_source"] == "bengali_display"
    assert "নূতন" in title or "প্রভাতে" in title


def test_url_encoded_filename_is_decoded_before_parse() -> None:
    number, _title, meta = MODULE.parse_notation_label(
        "",
        "__290%20-%20%28%E0%A7%A8%E0%A7%AF%E0%A7%AC%28%E0%A6%AA%E0%A7%8D%E0%A6%B0%E0%A6%AD%E0%A7%81%29%20%E0%A6%A4%E0%A7%8B%E0%A6%AE%E0%A6%BE%E0%A6%B0%20%E0%A6%AA%E0%A6%B0%E0%A6%B6.pdf",
    )
    assert number == 296
    assert meta["number_source"] == "bengali_display"
