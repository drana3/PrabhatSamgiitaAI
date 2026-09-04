from __future__ import annotations

import json
import re
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Notation, Song
from app.schemas.notation import (
    HarmoniumNotation,
    NotationBeat,
    NotationLine,
    NotationMeasure,
    NotationNote,
)
from app.services.catalog import CatalogService
from app.services.sargam_capture import is_learner_playable_notation, is_notation_enabled

CHROMATIC_ROOTS = {
    "C": 0,
    "B#": 0,
    "C#": 1,
    "DB": 1,
    "D": 2,
    "D#": 3,
    "EB": 3,
    "E": 4,
    "FB": 4,
    "E#": 5,
    "F": 5,
    "F#": 6,
    "GB": 6,
    "G": 7,
    "G#": 8,
    "AB": 8,
    "A": 9,
    "A#": 10,
    "BB": 10,
    "B": 11,
    "CB": 11,
}

WESTERN_SHARP_NAMES = [
    "C",
    "C#",
    "D",
    "D#",
    "E",
    "F",
    "F#",
    "G",
    "G#",
    "A",
    "A#",
    "B",
]

SARGAM_TO_SEMITONE = {
    "S": 0,
    "r": 1,
    "R": 2,
    "g": 3,
    "G": 4,
    "m": 5,
    "M": 6,
    "P": 7,
    "d": 8,
    "D": 9,
    "n": 10,
    "N": 11,
}

SEMITONE_TO_SARGAM = {value: key for key, value in SARGAM_TO_SEMITONE.items()}

OCTAVE_NUMBERS = {
    "lower": 3,
    "middle": 4,
    "upper": 5,
}


def note_octave_number(octave: str | None) -> int:
    return OCTAVE_NUMBERS.get((octave or "middle").strip().lower(), 4)


@dataclass(slots=True)
class ParsedWesternNote:
    root: str
    octave: int


def normalize_tonic(tonic: str) -> str:
    cleaned = tonic.strip().upper().replace("♯", "#").replace("♭", "B")
    if cleaned not in CHROMATIC_ROOTS:
        raise ValueError(f"Unsupported tonic: {tonic}")
    return cleaned


def parse_western_note(note: str) -> ParsedWesternNote:
    match = re.fullmatch(r"([A-Ga-g])([#bB]?)(-?\d+)", note.strip())
    if not match:
        raise ValueError(f"Invalid western note: {note}")
    root = match.group(1).upper() + match.group(2).replace("b", "B").replace("♭", "B").replace(
        "♯", "#"
    )
    normalized = normalize_tonic(root)
    return ParsedWesternNote(root=normalized, octave=int(match.group(3)))


def note_index(note: str) -> int:
    parsed = parse_western_note(note)
    return parsed.octave * 12 + CHROMATIC_ROOTS[parsed.root]


def western_from_index(index: int) -> str:
    octave, semitone = divmod(index, 12)
    return f"{WESTERN_SHARP_NAMES[semitone]}{octave}"


def transpose_note(note: str, semitone_shift: int) -> str:
    parsed = parse_western_note(note)
    new_index = note_index(f"{parsed.root}{parsed.octave}") + semitone_shift
    return western_from_index(new_index)


def sargam_token_to_semitone(sargam: str) -> int:
    token = sargam.strip()
    if token not in SARGAM_TO_SEMITONE:
        raise ValueError(f"Invalid sargam token: {sargam}")
    return SARGAM_TO_SEMITONE[token]


def sargam_to_western(sargam: str, tonic: str, octave: int) -> str:
    tonic_root = normalize_tonic(tonic)
    semitone = (CHROMATIC_ROOTS[tonic_root] + sargam_token_to_semitone(sargam)) % 12
    octave_adjust = (CHROMATIC_ROOTS[tonic_root] + sargam_token_to_semitone(sargam)) // 12
    return f"{WESTERN_SHARP_NAMES[semitone]}{octave + octave_adjust}"


def western_to_sargam(note: str, tonic: str) -> str:
    tonic_root = normalize_tonic(tonic)
    parsed = parse_western_note(note)
    tonic_index = CHROMATIC_ROOTS[tonic_root] + parsed.octave * 12
    note_idx = CHROMATIC_ROOTS[parsed.root] + parsed.octave * 12
    relative = (note_idx - tonic_index) % 12
    return SEMITONE_TO_SARGAM.get(relative, "S")


def is_hold_note(note: NotationNote) -> bool:
    """Sustain/hold cells use '-' (or S without a western pitch)."""
    token = note.sargam.strip()
    if token in {"-", "–", "—", ".", "।", "ऽ"}:
        return True
    if token in {"S", "s"} and not (note.western and note.western.strip()):
        return True
    return False


def transpose_notation(notation: HarmoniumNotation, target_scale: str) -> HarmoniumNotation:
    source_tonic = normalize_tonic(notation.source_scale)
    target_tonic = normalize_tonic(target_scale)
    semitone_shift = CHROMATIC_ROOTS[target_tonic] - CHROMATIC_ROOTS[source_tonic]

    transposed_lines: list[NotationLine] = []
    for line in notation.lines:
        transposed_measures: list[NotationMeasure] = []
        for measure in line.measures:
            transposed_beats: list[NotationBeat] = []
            for beat in measure.beats:
                notes: list[NotationNote] = []
                for note in beat.notes:
                    if is_hold_note(note):
                        notes.append(note.model_copy(update={"western": None}))
                        continue
                    western = note.western or sargam_to_western(
                        note.sargam,
                        notation.source_scale,
                        note_octave_number(note.octave),
                    )
                    transposed_western = transpose_note(western, semitone_shift)
                    notes.append(
                        note.model_copy(
                            update={
                                "western": transposed_western,
                                # Sargam is tonic-relative; keep the source tokens so a bad
                                # western pitch never rewrites every swara after transpose.
                            }
                        )
                    )
                transposed_beats.append(NotationBeat(beat=beat.beat, notes=notes))
            transposed_measures.append(NotationMeasure(beats=transposed_beats))
        transposed_lines.append(
            NotationLine(
                line_number=line.line_number,
                lyrics=line.lyrics,
                transliteration=line.transliteration,
                measures=transposed_measures,
            )
        )

    return notation.model_copy(update={"source_scale": target_tonic, "lines": transposed_lines})


def notation_from_json(text: str) -> HarmoniumNotation:
    payload = json.loads(text)
    return HarmoniumNotation.model_validate(payload)


async def load_song_notation(session: AsyncSession, song: Song) -> HarmoniumNotation | None:
    row = None
    try:
        result = await session.execute(select(Notation).where(Notation.song_number == song.number))
        row = result.scalar_one_or_none()
    except SQLAlchemyError:
        await session.rollback()
        row = await CatalogService(session).get_notation(song.number)

    if row and is_learner_playable_notation(
        song.number, row.verification_status, row.notation_text, row.metadata_json
    ):
        return notation_from_json(str(row.notation_text))
    if row and not is_notation_enabled(
        row.metadata_json,
        verification_status=row.verification_status,
    ):
        return None

    if song.harmonium_notation:
        raw = song.harmonium_notation.strip()
        if is_learner_playable_notation(song.number, "verified", raw):
            return notation_from_json(raw)
    return None
