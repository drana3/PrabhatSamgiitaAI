"""The local recheck pass only downgrades, never upgrades, deletes or relinks."""

from __future__ import annotations

import copy
from typing import Any

from scripts.recheck_youtube_local import (
    check_row,
    downgrade,
    downgraded_entries,
    queue_verdicts,
)

SONGS: dict[int, dict[str, Any]] = {
    830: {"number": 830, "title": "TUMI JADI JAGATJORA", "first_line": "Tumi jadi jagatjora"},
    25: {"number": 25, "title": "AMI TOMAY BHALOBASI", "first_line": "Ami tomay bhalobasi"},
}
CHANNEL_ID = "UCzJy4vdGKx6gzP782-5buOQ"


def row(song: int, title: str, status: str = "verified", vid: str = "v") -> dict[str, Any]:
    return {
        "song_number": song,
        "title": title,
        "verification_status": status,
        "metadata_json": {"external_id": vid, "channel_id": CHANNEL_ID},
    }


def test_good_row_is_left_alone() -> None:
    rows = [row(830, "Tumi Jadi Jagatjora | Prabhat Samgiita #830")]
    before = copy.deepcopy(rows)
    assert downgrade(rows, SONGS) == []
    assert rows == before


def test_dance_and_wrong_title_rows_are_downgraded_with_reasons() -> None:
    rows = [
        row(830, "Tumi Jadi Jagatjora | Prabhat Samgiita #830 | Dance", vid="a"),
        row(830, "Prabhat Samgiita #830 | Someone else", vid="b"),
        row(830, "Tumi Jadi Jagatjora | Prabhat Samgiita #830", vid="c"),
    ]
    changed = downgrade(rows, SONGS)
    assert [c["external_id"] for c in changed] == ["a", "b"]
    assert [r["verification_status"] for r in rows] == ["needs_review", "needs_review", "verified"]
    assert rows[0]["metadata_json"]["needs_review_reasons"] == ["programme_title:dance"]
    assert rows[0]["metadata_json"]["previous_verification_status"] == "verified"


def test_already_unverified_rows_are_not_touched() -> None:
    rows = [row(830, "Prabhat Samgiita #830 dance", status="rejected")]
    assert downgrade(rows, SONGS) == []
    assert rows[0]["verification_status"] == "rejected"


def test_rerun_is_idempotent() -> None:
    rows = [row(830, "Prabhat Samgiita #830 | Someone else")]
    downgrade(rows, SONGS)
    snapshot = copy.deepcopy(rows)
    assert downgrade(rows, SONGS) == []
    assert rows == snapshot
    assert [e["external_id"] for e in downgraded_entries(rows)] == ["v"]


def test_title_without_its_number_is_flagged() -> None:
    assert "number_not_in_title" in check_row(row(830, "Tumi Jadi Jagatjora"), SONGS)


def test_queue_verdicts_do_not_change_the_queue() -> None:
    queue = [
        {"external_id": "q1", "title": "Prabhat Samgiita Divas 2025", "channel_name": "x"},
        {
            "external_id": "q2",
            "title": "Tumi Jadi Jagatjora | Prabhat Samgiita #830",
            "channel_name": "x",
            "channel_id": CHANNEL_ID,
        },
    ]
    before = copy.deepcopy(queue)
    verdicts = queue_verdicts(queue, SONGS, {"q2": 830})
    assert queue == before
    assert verdicts[0]["verdict"] == "no usable song number"
    assert verdicts[1]["verdict"] == "would verify"
    assert verdicts[1]["already_linked_to"] == 830
