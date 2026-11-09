"""The styles of a recording: a short pick list (several can be chosen) and the own words.

How it is made. Dada, 9 Nov 2026: Indian style, Electronic, Acoustic guitar, African, Western, and
"add your own"; the person may choose several. The old list (Bengali, Hindi, Brajabuli,
Dhrupad-flavoured, Folk) is gone from the form. Rows that carry an old id stay readable:
`LEGACY_STYLES` is only read, never offered or accepted again.

A Kiirtan must name at least one style (listed or its own word); the other kinds (not Baba's
Audio Discourses, which are speech) may. The phone keeps the same list in
`apps/mobile/lib/kirtan/styles.ts` (with the labels in three languages);
`tests/test_kiirtan_style_and_menu_pins.py` and `__tests__/kirtanStyles.test.ts` each pin their
side. To add a style: add its id here and there and a `style.<id>` label in the three locale
dictionaries. The database stores the ids only, so no migration is needed.

Stored shape: `recordings.styles` (list of ids), `recordings.styles_other` (list of own words),
and the old single `style` / `style_other`, which now mirror the first of them so an older phone
and the search shelves keep working (`services/recording_tags.legacy_single`).
"""

from __future__ import annotations

from app.services.recording_languages import clean_language_other
from app.services.recording_tags import clean_own_words, normalize_listed

OTHER = "other"
# Dada's list (9 Nov 2026). The ids are short and stable; the labels live in the phone.
STYLES: tuple[str, ...] = ("indian", "electronic", "acoustic_guitar", "african", "western")
# The first list (8 Nov 2026), kept so that rows already stored read as they were.
LEGACY_STYLES: tuple[str, ...] = ("bengali", "hindi", "brajabuli", "dhrupad", "folk")
# Styles are asked of every category that is sung or played (not Baba's spoken discourses).
KINDS_WITHOUT_STYLE: tuple[str, ...] = ("baba_audio",)
KINDS_NEEDING_STYLE: tuple[str, ...] = ("kiirtan",)
STYLE_MESSAGE = "Choose a style from the list."


def keeps_style(kind: str) -> bool:
    return kind not in KINDS_WITHOUT_STYLE


def normalize_style(value: str | None) -> str | None:
    """One id of the old single field: a known id, "other", or None. Anything else is refused."""
    if value is None:
        return None
    word = value.strip().lower()
    if not word:
        return None
    if word in STYLES or word == OTHER:
        return word
    raise ValueError(STYLE_MESSAGE)


def normalize_styles(values: object) -> list[str]:
    """The listed ids of a list: known ids only, in order, without repeats."""
    if values is None:
        return []
    if not isinstance(values, list | tuple):
        raise ValueError(STYLE_MESSAGE)
    return normalize_listed(values, STYLES, STYLE_MESSAGE)


def clean_styles_other(values: object) -> list[str]:
    """The person's own style words, one line each, without repeats."""
    if values is None:
        return []
    if not isinstance(values, list | tuple):
        raise ValueError(STYLE_MESSAGE)
    return clean_own_words(values, STYLE_MESSAGE)


def clean_style_other(value: str | None) -> str | None:
    """The free-text name of the old single field: cleaned like a language name, 80 characters."""
    return clean_language_other(value)
