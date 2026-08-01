import pytest

from app.models import Notation, Song
from app.schemas.notation import HarmoniumNotation
from app.services.harmonium import load_song_notation, normalize_tonic, transpose_notation

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
