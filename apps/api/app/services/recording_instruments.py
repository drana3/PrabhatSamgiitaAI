"""The main (lead) instrument of a recording: a short pick list, plus "other".

One value per recording: the instrument that carries the music (a Kiirtan with a harmonium and a
tabla names the harmonium). The phone keeps the same list in `apps/mobile/lib/kirtan/instruments.ts`
(with the labels in three languages); `tests/test_recording_instruments.py` and
`__tests__/kirtanInstruments.test.ts` each pin their side. To add an instrument: add its code here
and there and an `instrument.<code>` label in the three locale dictionaries. The database stores the
code only, so no migration is needed.

`other` is the escape hatch: the uploader writes the name (`lead_instrument_other`). That word is
shown to its author at once and goes to the team's suggestion queue
(`services/value_suggestions.py`); the team accepts it, merges it into a listed instrument or
rejects it. A word that already IS a listed instrument ("piano", "Pianino" is not) is turned into
the code (`value_suggestions.listed_code`), so the shelf "Kiirtans for piano" does not miss a
recording typed as text.

Feeds the search menu (docs/search-menu.md, "Fields feeding categories"): the phone builds the shelf
"Kiirtans for piano" from `lead_instrument == "piano"`.
"""

from __future__ import annotations

from app.services.recording_languages import OTHER

# Dada's starting list (8 Nov 2026): guitar, harmonium and piano, plus the usual instruments of
# kiirtan and bhajan. `electronic` marks the ones that are not acoustic (the form shows a note).
INSTRUMENTS: tuple[str, ...] = (
    "guitar",
    "harmonium",
    "piano",
    "synthesizer",
    "keyboard",
    "tabla",
    "dholak",
    "khol",
    "kartal",
    "flute",
    "violin",
    "sitar",
    "esraj",
    "bass_guitar",
    "ukulele",
    "voice_only",
)
ELECTRONIC: tuple[str, ...] = ("synthesizer", "keyboard")
# English names, used to turn a typed word into a code ("Bass guitar" is `bass_guitar`).
NAMES: dict[str, tuple[str, ...]] = {
    "guitar": ("guitar", "acoustic guitar"),
    "harmonium": ("harmonium",),
    "piano": ("piano",),
    "synthesizer": ("synthesizer", "synth", "electronic", "synthesizer electronic"),
    "keyboard": ("keyboard", "keys"),
    "tabla": ("tabla",),
    "dholak": ("dholak",),
    "khol": ("khol", "mridanga", "mridangam", "khol mridanga"),
    "kartal": ("kartal", "kartals", "kartala", "hand cymbals", "cymbals"),
    "flute": ("flute", "bansuri"),
    "violin": ("violin",),
    "sitar": ("sitar",),
    "esraj": ("esraj",),
    "bass_guitar": ("bass guitar", "bass"),
    "ukulele": ("ukulele",),
    "voice_only": (
        "voice only",
        "a cappella",
        "acapella",
        "voice only a cappella",
        "no instruments",
    ),
}
# The categories that carry a main instrument (Baba's discourses are speech: no instrument).
KINDS_WITH_INSTRUMENT: tuple[str, ...] = (
    "kiirtan",
    "bhajan",
    "prabhat_samgiita",
    "spiritual_song",
    "dance_song",
)
# Length of a written instrument name (after cleaning): at least 2, at most 40 characters.
OTHER_MIN = 2
OTHER_MAX = 40


def normalize_instrument(value: str | None) -> str | None:
    """A listed code, "other", or None. Anything else is refused by the schema."""
    if value is None:
        return None
    word = value.strip().lower()
    if not word:
        return None
    if word in INSTRUMENTS or word == OTHER:
        return word
    raise ValueError("Choose the main instrument from the list.")


def keeps_instrument(kind: str) -> bool:
    return kind in KINDS_WITH_INSTRUMENT
