"""The pure rules of finding a performer's recordings: spellings, scripts, group credits."""

from __future__ import annotations

import os

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://test:test@localhost/test")

import pytest

from app.services import author_claim_rules as rules


@pytest.mark.parametrize(
    ("a", "b"),
    [
        ("Priya Devi", "priya  DEVI"),
        ("Priya Devi", "Priya Devii"),
        ("Dhiiraj", "Dhiraj"),
        ("Shri Kamal", "Sri Kamal"),
        ("Madhu Vrata", "Madhuvrata"),
        ("Dewi", "Devi"),
        ("प्रिया देवी", "Priya Devi"),
        ("Priyа Devi", "Priya Devi"),  # a Cyrillic letter that looks Latin
    ],
)
def test_these_are_the_same_name(a: str, b: str) -> None:
    assert rules.same_name(a, b)


@pytest.mark.parametrize(
    ("a", "b"),
    [("Priya Devi", "Devi Priya"), ("Priya Devi", "Priya Dev"), ("প্রিয়া দেবী", "Priya Devi")],
)
def test_these_are_alike_but_not_the_same(a: str, b: str) -> None:
    assert not rules.same_name(a, b)
    assert rules.alike_name(a, b)


def test_different_people_are_neither() -> None:
    assert not rules.same_name("Priya Devi", "Ravi Das")
    assert not rules.alike_name("Priya Devi", "Ravi Das")
    assert not rules.alike_name("Priya Devi", "Priyanka Devi")


def test_a_credit_is_split_into_names_and_a_group_is_seen() -> None:
    assert rules.split_credit("Priya Devi & friends, Ravi and Anna") == [
        "Priya Devi",
        "friends",
        "Ravi",
        "Anna",
    ]
    assert rules.split_credit("Anna feat. Ravi") == ["Anna", "Ravi"]
    assert rules.split_credit("") == []
    assert not rules.is_group_credit("Priya Devi")
    assert rules.is_group_credit("Priya Devi with Ravi")
    assert rules.is_group_credit("Dharmacakra Kiirtan")


def test_the_level_of_a_credit_and_the_part_that_matched() -> None:
    assert rules.level_of("Priya Devi & friends", ["Priya Devi"]) == ("same", "Priya Devi")
    assert rules.level_of("Priya Dev", ["Priya Devi"]) == ("alike", "Priya Dev")
    assert rules.level_of("Somebody", ["Priya Devi"]) == (None, None)
    assert rules.level_of("", ["Priya Devi"]) == (None, None)


def test_a_name_inside_a_title_is_found_only_as_whole_words() -> None:
    assert rules.title_has("Night kiirtan with Priya Devi in Warsaw", ["Priya Devi"])
    assert not rules.title_has("Night kiirtan, Priyanka Devi", ["Priya Devi"])
    assert not rules.title_has("", ["Priya Devi"])


def test_devanagari_and_bengali_are_written_in_latin() -> None:
    assert rules.transliterate("प्रिया") == "priyaa"
    assert rules.transliterate("देवी") == "devii"
    assert rules.transliterate("Priya") == "Priya"
