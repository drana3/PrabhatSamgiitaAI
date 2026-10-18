"""
Tester feedback matrix — maps FB items to automated checks.

Each test name references the feedback ID from the tester matrix.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.models.song import Song
from app.schemas.member import MemberPreferencesWrite
from app.schemas.notation import HarmoniumNotation
from app.services.harmonium import is_hold_note, transpose_notation
from app.services.localization import LocalizationService
from app.services.structured_answers import try_structured_answer


def test_fb02_language_label_normalizes_to_codes() -> None:
    from app.services.song_meanings import normalize_language_code

    assert normalize_language_code("Hindi") == "hi"
    assert normalize_language_code("english") == "en"
    assert normalize_language_code("bn") == "bn"


def test_fb02_localization_rejects_english_echo_for_hindi() -> None:
    """Localized Hindi must not echo the English meaning verbatim."""
    service = LocalizationService()
    song = Song(
        number=100,
        title="Test Song",
        english_meaning="You bathe in the ocean of formless beauty.",
    )
    assert service._usable_localized_meaning(
        song,
        "hi",
        "You bathe in the ocean of formless beauty.",
    ) is None
    assert service._usable_localized_meaning(
        song,
        "hi",
        "आप निराकार सौंदर्य के सागर में स्नान करते हैं।",
    ) is not None


def test_fb01_member_preferences_accepts_display_name() -> None:
    payload = MemberPreferencesWrite(display_name="Anand Das")
    assert payload.display_name == "Anand Das"


def test_fb05_transpose_keeps_sargam_tokens() -> None:
    notation = HarmoniumNotation.model_validate(
        {
            "version": 1,
            "source_scale": "C",
            "lines": [
                {
                    "line_number": 1,
                    "lyrics": "line",
                    "measures": [
                        {
                            "beats": [
                                {
                                    "beat": 1,
                                    "notes": [
                                        {
                                            "sargam": "P",
                                            "western": "G4",
                                            "duration": 1,
                                            "octave": "middle",
                                        },
                                        {
                                            "sargam": "m",
                                            "western": "F4",
                                            "duration": 1,
                                            "octave": "middle",
                                        },
                                    ],
                                }
                            ],
                        }
                    ],
                }
            ],
        }
    )
    transposed = transpose_notation(notation, "D")
    notes = transposed.lines[0].measures[0].beats[0].notes
    assert [n.sargam for n in notes] == ["P", "m"]
    assert [n.western for n in notes] == ["A4", "G4"]


def test_harmonium_play_hold_cells_stay_silent() -> None:
    hold = HarmoniumNotation.model_validate(
        {
            "version": 1,
            "source_scale": "C",
            "lines": [
                {
                    "line_number": 1,
                    "lyrics": "line",
                    "measures": [
                        {
                            "beats": [
                                {
                                    "beat": 1,
                                    "notes": [
                                        {
                                            "sargam": "-",
                                            "western": None,
                                            "duration": 1,
                                            "octave": "middle",
                                        }
                                    ],
                                }
                            ],
                        }
                    ],
                }
            ],
        }
    ).lines[0].measures[0].beats[0].notes[0]
    assert is_hold_note(hold)
    transposed = transpose_notation(
        HarmoniumNotation.model_validate(
            {
                "version": 1,
                "source_scale": "C",
                "lines": [
                    {
                        "line_number": 1,
                        "lyrics": "line",
                        "measures": [
                            {
                                "beats": [
                                    {
                                        "beat": 1,
                                        "notes": [
                                            {
                                                "sargam": "-",
                                                "western": None,
                                                "duration": 1,
                                                "octave": "middle",
                                            }
                                        ],
                                    }
                                ],
                            }
                        ],
                    }
                ],
            }
        ),
        "G",
    )
    assert transposed.lines[0].measures[0].beats[0].notes[0].western is None


def test_expert_4961_curated_notation_loads_for_playback() -> None:
    path = (
        Path(__file__).resolve().parents[3]
        / "data"
        / "curated"
        / "expert_notation"
        / "4961.json"
    )
    payload = json.loads(path.read_text(encoding="utf-8"))
    notation = HarmoniumNotation.model_validate(payload["notation_text"])
    assert notation.tala is not None
    assert notation.tala.beats == 8
    assert notation.tempo_bpm == 72
    assert len(notation.lines) == 3
    pitched = sum(
        1
        for line in notation.lines
        for measure in line.measures
        for beat in measure.beats
        for note in beat.notes
        if note.western and not is_hold_note(note)
    )
    assert pitched >= 20


def test_formatting_structured_answers_use_light_markdown() -> None:
    song = Song(
        number=452,
        title="ARÚP SÁGARE SNÁNA KARIYÁCHO",
        english_meaning="You bathe in the ocean of formless beauty.",
        theme="Devotion",
    )
    answer = try_structured_answer("What is this song about?", song)
    assert answer is not None
    assert "**Song 452**" in answer
    assert "**Theme:** Devotion" in answer


@pytest.mark.parametrize(
    "query",
    [
        "explain this song in hindi",
        "is gaane ka arth batao",
        "What is this song about?",
    ],
)
def test_fb03_companion_queries_allowed(query: str) -> None:
    from app.services.query_guard import assess_query

    assert assess_query(query).allowed is True
