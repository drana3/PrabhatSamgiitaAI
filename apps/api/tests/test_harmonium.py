import pytest

from app.schemas.notation import HarmoniumNotation
from app.services.harmonium import normalize_tonic, transpose_notation

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
