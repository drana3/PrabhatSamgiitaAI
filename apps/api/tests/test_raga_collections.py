from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.services.direct_answers import try_direct_answer
from app.services.raga_collections import (
    load_raga_collections,
    parse_song_numbers,
    save_raga_collections,
)
from app.services.search import infer_canonical_collection


def test_seed_raga_manifest_has_expected_entries() -> None:
    rows = load_raga_collections()
    assert len(rows) == 30
    pada = next(row for row in rows if row["label"] == "Pada Kiirtan")
    assert pada["count"] == 13
    assert pada["song_numbers"][0] == 138
    assert pada["song_numbers"][-1] == 150


@pytest.mark.parametrize(
    ("label", "expected_number"),
    [
        ("Yaman", 1565),
        ("Thumri", 3481),
        ("Pure Classical", 828),
    ],
)
def test_raga_collections_resolve_in_catalog_search(label: str, expected_number: int) -> None:
    match = infer_canonical_collection(f"Search Prabhat Samgiita for {label}")
    assert match is not None
    assert match.label == label
    assert expected_number in match.song_numbers


def test_raga_direct_answer_points_to_collections() -> None:
    answer = try_direct_answer("Which ragas are available?")
    assert answer is not None
    assert "Ragas & melodic traditions" in answer.text or "raga" in answer.text.lower()


def test_parse_song_numbers_expands_ranges() -> None:
    valid, out_of_range, unknown = parse_song_numbers([138, 139, 150, 151, 99999])
    assert 150 in valid
    assert 99999 in out_of_range
    assert 151 in unknown or 151 in valid  # depends on catalog presence


def test_save_raga_collections_writes_json(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    target = tmp_path / "raga_collections.json"
    monkeypatch.setattr("app.services.raga_collections.RAGA_COLLECTIONS_PATH", target)
    load_raga_collections.cache_clear()
    rows = save_raga_collections(
        [
            {
                "label": "Test Raga",
                "value": "Test Raga",
                "song_numbers": [1],
                "description": "note",
            }
        ]
    )
    assert rows[0]["count"] == 1
    assert target.exists()
    saved = json.loads(target.read_text(encoding="utf-8"))
    assert saved[0]["label"] == "Test Raga"