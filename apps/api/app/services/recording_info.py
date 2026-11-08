"""How a recording was made, and how it sounds: the type of recording, the tempo, solo or group.

These are the fields the team already sorts the library by on anandamarga.org/music (the
"Sorting the music" page; its words are in `apps/web/src/lib/razbor/vocab.ts` of the website
repository: tempo slow/medium/fast, performance solo or group/choir, recording studio / phone or
voice recorder / live recording / AI-generated). The phone keeps the same ids in
`apps/mobile/lib/kirtan/recordingInfo.ts`; `tests/test_recording_info.py` and
`__tests__/recordingInfo.test.ts` pin the two sides. The database stores the ids only, so another
value later is a new id in the list on both sides and no migration.
See docs/kiirtan-recording-info.md.

* `recording_type` (how it was recorded): `studio`, `live` (at a programme or a concert), `home`
  (at home, on a phone or a voice recorder) or `ai` (made by an AI tool). REQUIRED for a Kiirtan,
  optional for dance music, a Bhajan and a spiritual song. An AI recording is never hidden: the
  value is stored, sent with the recording and shown to the listener. It is not accepted for a
  Bhajan (a song to God, which the team does not take from an AI tool).
* `tempo`: `slow`, `medium`, `fast`. Optional, Kiirtan and dance music.
* `performance`: `solo` or `group` (a group or a choir). Optional, Kiirtan and Bhajan.

A kind that does not carry a field drops it silently, the way a style does.
"""

from __future__ import annotations

import unicodedata

STUDIO = "studio"
LIVE = "live"
HOME = "home"
AI = "ai"
RECORDING_TYPES: tuple[str, ...] = (STUDIO, LIVE, HOME, AI)
TEMPOS: tuple[str, ...] = ("slow", "medium", "fast")
PERFORMANCES: tuple[str, ...] = ("solo", "group")

# Which categories carry which field. Names are the API's category ids (models/recordings.py).
KINDS_WITH_RECORDING_TYPE: tuple[str, ...] = ("kiirtan", "dance_song", "bhajan", "spiritual_song")
KINDS_NEEDING_RECORDING_TYPE: tuple[str, ...] = ("kiirtan",)
KINDS_WITH_AI: tuple[str, ...] = ("kiirtan", "dance_song", "spiritual_song")
KINDS_WITH_TEMPO: tuple[str, ...] = ("kiirtan", "dance_song")
KINDS_WITH_PERFORMANCE: tuple[str, ...] = ("kiirtan", "bhajan")


def _one_of(value: str | None, allowed: tuple[str, ...], message: str) -> str | None:
    if value is None:
        return None
    word = value.strip().lower()
    if not word:
        return None
    if word in allowed:
        return word
    raise ValueError(message)


def normalize_recording_type(value: str | None) -> str | None:
    """A known id or None. Anything else is refused by the schema."""
    return _one_of(value, RECORDING_TYPES, "Choose how this was recorded from the list.")


def normalize_tempo(value: str | None) -> str | None:
    return _one_of(value, TEMPOS, "Choose a tempo from the list.")


def normalize_performance(value: str | None) -> str | None:
    return _one_of(value, PERFORMANCES, "Choose solo or group from the list.")


def info_problem(kind: str, recording_type: str | None) -> str | None:
    """What is missing or wrong for the category, as one sentence; None when fine."""
    if kind in KINDS_NEEDING_RECORDING_TYPE and not recording_type:
        return "Say how this Kiirtan was recorded."
    if recording_type == AI and kind in KINDS_WITH_RECORDING_TYPE and kind not in KINDS_WITH_AI:
        return "A recording made by AI is not accepted in this category."
    return None


def clean_info(
    kind: str,
    recording_type: str | None,
    tempo: str | None,
    performance: str | None,
) -> tuple[str | None, str | None, str | None]:
    """The three fields as this kind keeps them; the ones it does not carry are None."""
    return (
        recording_type if kind in KINDS_WITH_RECORDING_TYPE else None,
        tempo if kind in KINDS_WITH_TEMPO else None,
        performance if kind in KINDS_WITH_PERFORMANCE else None,
    )


def has_non_latin_letters(text: str | None) -> bool:
    """Is there a letter that is not Latin (Cyrillic, Devanagari, Bengali, Arabic, CJK ...)?

    Latin letters with accents ("Bábá", "Śiva") are Latin and pass; digits, spaces and punctuation
    are not letters. The title of a Kiirtan is written in English only
    (docs/kiirtan-recording-info.md),
    so the search by title works in one alphabet.
    """
    for char in text or "":
        if char.isalpha() and not unicodedata.name(char, "").startswith("LATIN"):
            return True
    return False


TITLE_IN_ENGLISH = "Write the title of a Kiirtan in English, with Latin letters."
