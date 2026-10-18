import pytest

from app.models import Notation, Song
from app.schemas.notation import HarmoniumNotation
from app.services.harmonium import (
    is_hold_note,
    load_song_notation,
    normalize_tonic,
    transpose_notation,
)

ROOTS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]


def sample_notation() -> HarmoniumNotation:
    return HarmoniumNotation.model_validate(
        {
            "version": 1,
            "source_scale": "C",
            "tempo_bpm": 72,
            "lines": [
                {
                    "line_number": 1,
                    "lyrics": "Verified sample line",
                    "measures": [
                        {
                            "beats": [
                                {
                                    "beat": 1,
                                    "notes": [
                                        {
                                            "sargam": "S",
                                            "western": "C4",
                                            "duration": 1.5,
                                            "octave": "middle",
                                            "syllable": "Ver",
                                        }
                                    ],
                                }
                            ]
                        }
                    ],
                }
            ],
        }
    )


def test_transposition_preserves_sargam_tokens() -> None:
    """FB-05: sargam is relative to tonic — transpose must not rewrite swaras from western."""
    source = HarmoniumNotation.model_validate(
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
                            ]
                        }
                    ],
                }
            ],
        }
    )
    transposed = transpose_notation(source, "D")
    notes = transposed.lines[0].measures[0].beats[0].notes
    assert [note.sargam for note in notes] == ["P", "m"]
    assert [note.western for note in notes] == ["A4", "G4"]


def test_hold_notes_keep_no_western_pitch_on_transpose() -> None:
    """Harmonium play must not sound holds; '-' cells stay unpitched after transpose."""
    source = HarmoniumNotation.model_validate(
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
                                        }
                                    ],
                                },
                                {
                                    "beat": 2,
                                    "notes": [
                                        {
                                            "sargam": "-",
                                            "western": None,
                                            "duration": 1,
                                            "octave": "middle",
                                            "syllable": "S",
                                        }
                                    ],
                                },
                                {
                                    "beat": 3,
                                    "notes": [
                                        {
                                            "sargam": "S",
                                            "western": "C4",
                                            "duration": 1,
                                            "octave": "middle",
                                        }
                                    ],
                                },
                            ]
                        }
                    ],
                }
            ],
        }
    )
    assert is_hold_note(source.lines[0].measures[0].beats[1].notes[0])
    assert not is_hold_note(source.lines[0].measures[0].beats[2].notes[0])
    transposed = transpose_notation(source, "D")
    notes = transposed.lines[0].measures[0].beats
    assert notes[0].notes[0].western == "A4"
    assert notes[1].notes[0].western is None
    assert notes[2].notes[0].western == "D4"
    assert notes[2].notes[0].sargam == "S"


@pytest.mark.parametrize(("target", "expected"), list(zip(ROOTS, ROOTS, strict=True)))
def test_transposition_supports_all_chromatic_roots(target: str, expected: str) -> None:
    transposed = transpose_notation(sample_notation(), target)
    note = transposed.lines[0].measures[0].beats[0].notes[0]

    assert note.western == f"{expected}4"
    assert note.duration == 1.5
    assert note.syllable == "Ver"
    assert transposed.source_scale == target


def test_transposition_rejects_invalid_tonic() -> None:
    with pytest.raises(ValueError, match="Unsupported tonic"):
        normalize_tonic("H")


class OrmResult:
    def __init__(self, notation: Notation) -> None:
        self.notation = notation

    def scalar_one_or_none(self) -> Notation:
        return self.notation


class OrmSession:
    def __init__(self, notation: Notation) -> None:
        self.notation = notation

    async def execute(self, statement: object) -> OrmResult:
        return OrmResult(self.notation)


@pytest.mark.asyncio
async def test_database_orm_notation_is_loaded() -> None:
    notation = Notation(
        id=1,
        song_number=1,
        notation_text=sample_notation().model_dump_json(),
        scale="C",
        verification_status="practice_draft",
    )

    loaded = await load_song_notation(
        OrmSession(notation),  # type: ignore[arg-type]
        Song(number=1, title="Bandhu He Niye Calo"),
    )

    assert loaded is not None
    assert loaded.lines[0].lyrics == "Verified sample line"
