"""sync_prabhata peels English theme labels out of the lyric block."""

import sys
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
from typing import Any

SCRIPT = Path(__file__).resolve().parents[3] / "scripts" / "sync_prabhata.py"
SPEC = spec_from_file_location("sync_prabhata_theme", SCRIPT)
assert SPEC and SPEC.loader
MODULE: Any = module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


def test_split_song_sections_extracts_theme_after_lyrics() -> None:
    paragraphs = [
        [
            "ELO, ANEK JUGER SEI AJÁNÁ PATHIK",
            "CETANÁR MADHURA TÁNE",
            "SONG OF FULFILMENT",
            "The ancient unknown traveler has come.",
        ]
    ]
    lyrics, meaning, _idea, theme = MODULE.split_song_sections(paragraphs)
    assert theme == "Song of Fulfilment"
    assert all(not MODULE.is_english_theme_line(line) for line in lyrics)
    assert meaning[0].startswith("The ancient")


def test_split_song_sections_extracts_central_idea() -> None:
    paragraphs = [
        [
            "MÁYÁ MUKURE KE KI BHÁVE KI KARE",
            "SABAI JÁNO O GO DEVATÁ",
            "By Your magic mirror,",
            "whatever we think,",
            "Central idea: Paramapuruśa has a magical mirror.",
            "He knows the entire evolution of this universe.",
        ]
    ]
    lyrics, meaning, idea, theme = MODULE.split_song_sections(paragraphs)
    assert theme is None
    assert "MÁYÁ MUKURE" in lyrics[0]
    assert meaning[0].startswith("By Your magic mirror")
    assert "Central idea" not in "\n".join(meaning)
    assert idea[0].startswith("Paramapuruśa has a magical mirror")
    assert "entire evolution" in "\n".join(idea)


def test_split_song_sections_extracts_purport_label() -> None:
    paragraphs = [
        [
            "BANDHU HE NIYE CALO",
            "ÁNDHÁRER VYATHÁ",
            "O Lord, take me with You.",
            "Purport: Paramapurus'a is the real friend.",
        ]
    ]
    _lyrics, meaning, idea, _theme = MODULE.split_song_sections(paragraphs)
    assert meaning == ["O Lord, take me with You."]
    assert idea == ["Paramapurus'a is the real friend."]
