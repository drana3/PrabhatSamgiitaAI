"""A trusted channel's title number alone must not verify a video for a song."""

from __future__ import annotations

import pytest
from scripts.sync_youtube import (
    CHANNELS,
    explicit_song_number,
    media_row,
    programme_word,
    review_row,
    title_agreement,
    verification_problems,
)

SONGS = {
    830: {
        "number": 830,
        "title": "TUMI JADI JAGATJORA",
        "first_line": "Tumi jadi jagatjora",
        "lyrics_original": "Tumi jadi jagatjora\nAmi tomar",
    },
    1: {"number": 1, "title": "BANDHU HE NIYE CALO", "first_line": "BANDHU HE NIYE CALO"},
    25: {"number": 25, "title": "AMI TOMAY BHALOBASI", "first_line": "Ami tomay bhalobasi"},
    2315: {
        "number": 2315,
        "title": "TOMÁR, TOMÁR, TOMÁR",
        "first_line": "TOMÁR, TOMÁR, TOMÁR",
    },
}
CHANNEL = CHANNELS[0]


def video(title: str, vid: str = "abcdefghijk", **extra: str) -> dict[str, str]:
    return {"video_id": vid, "title": title, **extra}


# --- the number -------------------------------------------------------------------------------


@pytest.mark.parametrize(
    "title",
    [
        "Prabhat Samgiita Divas 2025",
        "Prabhat Samgiita celebration 2026 highlights",
        "Prabhat Samgiita 2025",
        "Prabhat Samgiita 14 May 2025",
        "Prabhat Samgiita 25 mins",
        "Prabhat Samgiita Part 25",
        "Prabhat Samgiita 3rd June",
    ],
)
def test_year_date_length_and_part_numbers_are_not_song_numbers(title: str) -> None:
    assert explicit_song_number(title) is None


@pytest.mark.parametrize(
    ("title", "number"),
    [
        ("Tumi Jadi Jagatjora | Prabhat Samgiita #830", 830),
        ("Prabhat Samgiita No. 2025", 2025),
        ("Prabhat Samgiita Song #1900", 1900),
        ("Bandhu He Niye Calo - Prabhat Sangeet 1", 1),
    ],
)
def test_marked_numbers_still_count(title: str, number: int) -> None:
    assert explicit_song_number(title) == number


def test_number_above_the_catalog_is_not_a_song() -> None:
    assert "number_out_of_range" in verification_problems("x #5019", 5019, SONGS[1])
    assert "number_out_of_range" in verification_problems("x #0", 0, SONGS[1])


# --- programmes ----------------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("title", "word"),
    [
        ("Tumi Jadi Jagatjora | Prabhat Samgiita #830 | Dance performance", "dance"),
        ("Prabhat Samgiita #830 compilation", "compilation"),
        ("Prabhat Samgiita #830 live in Kolkata", "live"),
        ("Siddha Mahamantra Kiirtan | Prabhat Samgiita #25", "mahamantra"),
        ("Interview about Prabhat Samgiita #830", "interview"),
    ],
)
def test_programme_titles_are_detected(title: str, word: str) -> None:
    assert programme_word(title) == word


def test_a_programme_word_inside_the_song_title_does_not_count() -> None:
    song = {"title": "Kiirtan Gaiba Ami", "first_line": ""}
    assert programme_word("Kiirtan Gaiba Ami | Prabhat Samgiita #7", song) is None


def test_plain_title_has_no_programme_word() -> None:
    assert programme_word("Tumi Jadi Jagatjora | Prabhat Samgiita #830 | Acarya") is None


# --- fuzzy title ------------------------------------------------------------------------------


def test_title_agreement_ignores_accents_spelling_and_credits() -> None:
    credited = "Tumi Jadi Jagatjora | Prabhat Samgiita #830 | Singer: X"
    assert title_agreement(credited, SONGS[830]) >= 0.9
    assert title_agreement("TUMI JADI JAGATJORA", SONGS[830]) == 1.0
    assert title_agreement("Tumi jadi jagatjora (Prabhat Sangeet 830)", SONGS[830]) >= 0.9
    assert title_agreement("Tomar Tomar Tomar", SONGS[2315]) >= 0.9


def test_title_agreement_is_low_for_another_song() -> None:
    assert title_agreement("Ami Tomay Bhalobasi | Prabhat Samgiita #830", SONGS[830]) < 0.75
    assert title_agreement("Prabhat Samgiita #830", SONGS[830]) == 0.0


def test_first_line_can_carry_the_match() -> None:
    song = {"title": "SOMETHING ELSE", "first_line": "Tumi jadi jagatjora"}
    assert title_agreement("Tumi jadi jagatjora | Prabhat Samgiita", song) >= 0.9


# --- media_row -----------------------------------------------------------------------------------


def test_marked_number_with_matching_title_is_verified() -> None:
    row = media_row(video("Tumi Jadi Jagatjora | Prabhat Samgiita #830"), SONGS, CHANNEL)
    assert row is not None
    assert row["verification_status"] == "verified"
    assert "needs_review_reasons" not in row["metadata_json"]


def test_number_alone_without_the_song_name_is_needs_review() -> None:
    row = media_row(video("Prabhat Samgiita #830 | Acarya Someone"), SONGS, CHANNEL)
    assert row is not None
    assert row["verification_status"] == "needs_review"
    assert row["metadata_json"]["needs_review_reasons"] == ["title_mismatch"]


def test_number_of_another_song_title_is_needs_review() -> None:
    row = media_row(video("Ami Tomay Bhalobasi | Prabhat Samgiita #830"), SONGS, CHANNEL)
    assert row is not None
    assert row["verification_status"] == "needs_review"


def test_dance_programme_is_needs_review_unless_flagged() -> None:
    title = "Tumi Jadi Jagatjora | Prabhat Samgiita #830 | Dance"
    row = media_row(video(title), SONGS, CHANNEL)
    assert row is not None
    assert row["verification_status"] == "needs_review"
    reasons = row["metadata_json"]["needs_review_reasons"]
    assert any(r.startswith("programme_title") for r in reasons)
    flagged = media_row(video(title, programme_ok="1"), SONGS, CHANNEL)
    assert flagged is not None
    assert flagged["verification_status"] == "verified"
    channel_flag = media_row(video(title), SONGS, {**CHANNEL, "allow_programme": True})
    assert channel_flag is not None
    assert channel_flag["verification_status"] == "verified"


def test_year_in_the_title_is_never_linked() -> None:
    assert media_row(video("Prabhat Samgiita Divas 2025"), {2025: SONGS[830]}, CHANNEL) is None


def test_siddha_mahamantra_on_song_25_is_needs_review() -> None:
    row = media_row(video("Siddha Mahamantra | Prabhat Samgiita #25"), SONGS, CHANNEL)
    assert row is not None
    assert row["verification_status"] == "needs_review"


def test_review_row_names_the_failed_rule() -> None:
    row = review_row(video("Prabhat Samgiita #830 dance"), SONGS, CHANNEL)
    assert row is not None
    assert row["review_reason"].startswith(("programme_title", "title_mismatch"))
