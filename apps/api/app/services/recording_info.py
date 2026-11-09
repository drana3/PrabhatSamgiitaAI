"""How a recording was made, and how it sounds: the type of recording, the tempo, solo or group.

These are the fields the team already sorts the library by on anandamarga.org/music (the
"Sorting the music" page; its words are in `apps/web/src/lib/razbor/vocab.ts` of the website
repository). The phone keeps the same ids in `apps/mobile/lib/kirtan/recordingInfo.ts`;
`tests/test_recording_info.py` and `__tests__/recordingInfo.test.ts` pin the two sides. The
database stores the ids only, so another value later is a new id in the list on both sides and no
migration. See docs/kiirtan-recording-info.md.

* `recording_type` (how it was recorded): EXACTLY three, `studio` (Studio recording), `live` (Live
  recording, a concert or a programme) and `ai` (AI-generated). Dada, 9 Nov 2026: three everywhere.
  REQUIRED for a Kiirtan, optional for the other kinds that carry it. The old `home` ("at home, on
  a phone") is gone: a stored row was turned into `studio` by migration 0064, and an older phone
  that still sends `home` is read as `studio`. An AI recording is never hidden: the value is
  stored, sent with the recording and shown to the listener. Every kind that carries the field
  accepts `ai`, a Bhajan too (Dada, 8 Nov 2026).
* `tempo`: Dance music ONLY (Dada, 9 Nov 2026): `slow`, `medium`, `fast` or `mix`. Optional. Every
  other kind drops it, and a Kiirtan row stored with one no longer shows it.
* `performance`: `solo` or `group` (a group or a choir). REQUIRED for a Kiirtan, optional for a
  Bhajan and Other mantras.
* `by_author` ("I composed this melody or song myself"): every kind except Prabhat Samgiita (it has
  one author), Baba's Audio Discourses and Other mantras (a mantra is not composed by the
  uploader). A kind that does not carry it drops it silently.

A kind that does not carry a field drops it silently, the way a style does.
"""

from __future__ import annotations

import unicodedata

STUDIO = "studio"
LIVE = "live"
AI = "ai"
RECORDING_TYPES: tuple[str, ...] = (STUDIO, LIVE, AI)
# Ids that an older phone, an old import file or an old row may still carry, and what they mean now.
LEGACY_RECORDING_TYPES: dict[str, str] = {"home": STUDIO}
TEMPOS: tuple[str, ...] = ("slow", "medium", "fast", "mix")
PERFORMANCES: tuple[str, ...] = ("solo", "group")

# Which categories carry which field. Names are the API's category ids (models/recordings.py).
KINDS_WITH_RECORDING_TYPE: tuple[str, ...] = (
    "kiirtan",
    "dance_song",
    "bhajan",
    "spiritual_song",
    "prabhat_samgiita",
    "other_mantra",
)
KINDS_NEEDING_RECORDING_TYPE: tuple[str, ...] = ("kiirtan",)
KINDS_WITH_AI: tuple[str, ...] = KINDS_WITH_RECORDING_TYPE
# Tempo is asked for Dance music and for nothing else.
KINDS_WITH_TEMPO: tuple[str, ...] = ("dance_song",)
KINDS_WITH_PERFORMANCE: tuple[str, ...] = ("kiirtan", "bhajan", "other_mantra")
KINDS_NEEDING_PERFORMANCE: tuple[str, ...] = ("kiirtan",)
# "I composed this melody or song myself": not for Prabhat Samgiita (one author), Baba's talks or
# a mantra.
KINDS_WITHOUT_BY_AUTHOR: tuple[str, ...] = ("prabhat_samgiita", "baba_audio", "other_mantra")


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
    """A known id or None. The removed `home` reads as `studio`; anything else is refused."""
    word = _one_of(
        value,
        (*RECORDING_TYPES, *LEGACY_RECORDING_TYPES),
        "Choose how this was recorded from the list.",
    )
    return LEGACY_RECORDING_TYPES.get(word, word) if word else None


def normalize_tempo(value: str | None) -> str | None:
    return _one_of(value, TEMPOS, "Choose a tempo from the list.")


def normalize_performance(value: str | None) -> str | None:
    return _one_of(value, PERFORMANCES, "Choose solo or group from the list.")


def info_problem(
    kind: str, recording_type: str | None, performance: str | None = None
) -> str | None:
    """What is missing or wrong for the category, as one sentence; None when fine."""
    if kind in KINDS_NEEDING_RECORDING_TYPE and not recording_type:
        return "Say how this Kiirtan was recorded."
    if recording_type == AI and kind in KINDS_WITH_RECORDING_TYPE and kind not in KINDS_WITH_AI:
        return "A recording made by AI is not accepted in this category."
    if kind in KINDS_NEEDING_PERFORMANCE and not performance:
        return "Say whether this Kiirtan is a solo or a group."
    return None


def keeps_by_author(kind: str, by_author: bool) -> bool:
    """The "I composed it myself" tick as this kind keeps it (never for Prabhat Samgiita)."""
    return bool(by_author) and kind not in KINDS_WITHOUT_BY_AUTHOR


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
