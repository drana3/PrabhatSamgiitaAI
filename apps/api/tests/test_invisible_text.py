"""One shared rule for invisible characters (QA-044): joiners stay inside Indic and Arabic-script
words and emoji, and go everywhere else."""

from __future__ import annotations

import pytest

from app.services import author_rules as rules
from app.services import invisible_text, recording_collections, song_comments

ZWJ = "‍"
ZWNJ = "‌"
KSHA_DEVANAGARI = f"क्{ZWJ}ष"  # क्‍ष
KSHA_BENGALI = f"ক্{ZWJ}ষ"  # ক্‍ষ
PERSIAN = f"می{ZWNJ}خواهم"  # می‌خواهم


@pytest.mark.parametrize("text", [KSHA_DEVANAGARI, KSHA_BENGALI, PERSIAN, f"👨{ZWJ}👩{ZWJ}👧"])
def test_a_joiner_between_two_letters_of_the_script_stays(text: str) -> None:
    assert invisible_text.strip_invisible(text) == text
    assert rules.clean_line(text, 80) == text
    assert song_comments.clean_body(text) == text


@pytest.mark.parametrize(
    ("raw", "clean"),
    [
        (f"Adm{ZWJ}in", "Admin"),
        (f"Adm{ZWNJ}in", "Admin"),
        (f"{ZWJ}क्ष", "क्ष"),  # leading
        (f"क्ष{ZWJ}", "क्ष"),  # trailing
        (f"क्{ZWJ}{ZWJ}ष", "क्ष"),  # doubled
        (f"क्{ZWJ}{ZWNJ}ष", "क्ष"),  # two different joiners
        (f"क {ZWJ}ष", "क ष"),  # next to a space
        (f"क{ZWJ}a", "कa"),  # Indic letter on one side only
        (f"a{ZWNJ}ष", "aष"),
        (f"م{ZWNJ}a", "مa"),  # Arabic letter on one side only
        (f"1{ZWJ}2", "12"),
        (f"👨{ZWJ}a", "👨a"),
        (f"{ZWJ}", ""),
        ("a​b⁠c﻿d­e", "abcde"),  # the other zero-width characters
        ("a‮b⁦c‎d", "abcd"),  # bidi controls
    ],
)
def test_everywhere_else_the_invisible_characters_go(raw: str, clean: str) -> None:
    assert invisible_text.strip_invisible(raw) == clean
    assert rules.clean_line(raw, 80) == clean


def test_a_joiner_next_to_a_digit_or_virama_alone_is_not_enough() -> None:
    # a virama without a letter after it, or a mark with a joiner after the word, is not flanked
    assert invisible_text.strip_invisible(f"क्{ZWJ}") == "क्"
    assert invisible_text.strip_invisible(f"्{ZWJ}1") == "्1"


def test_paragraphs_keep_the_joiner_in_an_indic_word_and_lose_it_elsewhere() -> None:
    text = f"{KSHA_DEVANAGARI} text\n\nAdm{ZWJ}in"
    assert rules.clean_paragraphs(text, 200) == f"{KSHA_DEVANAGARI} text\n\nAdmin"


def test_comments_chords_and_playlists_use_the_same_helper() -> None:
    assert song_comments.strip_invisible is invisible_text.strip_invisible
    assert recording_collections.strip_invisible is invisible_text.strip_invisible
    assert song_comments.clean_body(f"x {KSHA_BENGALI} y{ZWJ}") == f"x {KSHA_BENGALI} y"
    assert recording_collections.clean_set_text(f"{KSHA_DEVANAGARI}{ZWJ}", 80) == KSHA_DEVANAGARI
    assert recording_collections.clean_set_text(f"Mad{ZWJ}hu", 80) == "Madhu"


def test_the_staff_and_look_alike_checks_still_ignore_joiners() -> None:
    for text in (f"Adm{ZWJ}in", f"Adm{ZWNJ}in", f"{ZWJ}Admin", f"Μ{ZWJ}oderator", f"Ma{ZWJ}itreya"):
        assert rules.staff_hit(text), ascii(text)
        assert rules.latin_skeleton(text).isascii()
    assert rules.protected_hit(f"Anand{ZWJ}amurti")
    assert rules.names_alike(f"Madhu{ZWJ}vrata", "Madhuvrata")
    # the Indic half-form itself is an ordinary name
    assert not rules.staff_hit(KSHA_DEVANAGARI)
    assert rules.name_key(KSHA_DEVANAGARI) == rules.name_key("क्ष")
