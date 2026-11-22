"""Stanza extraction from official HTML (scripts/sync_prabhata.py)."""
from __future__ import annotations

import sys
from pathlib import Path

_SCRIPTS = Path(__file__).resolve().parents[3] / "scripts"
sys.path.insert(0, str(_SCRIPTS))

import sync_prabhata as sp  # noqa: E402


def test_html_to_lines_preserves_br_stanza_blanks() -> None:
    fragment = "LINE ONE<br><br><br>LINE TWO<br>LINE THREE"
    lines = sp.html_to_lines(fragment)
    assert lines == ["LINE ONE", "", "", "LINE TWO", "LINE THREE"]


def test_split_song_sections_keeps_blanks_in_lyrics() -> None:
    paragraphs = [
        [
            "MAYA MUKURE KE KI BHAVE",
            "",
            "",
            "SABAI JANO",
        ],
        ["By Your magic mirror, the meaning is hidden."],
    ]
    lyrics, english, _idea, _theme = sp.split_song_sections(paragraphs)
    assert lyrics[0].startswith("MAYA")
    assert lyrics[1] == ""
    assert lyrics[2] == ""
    assert len(english) > 0