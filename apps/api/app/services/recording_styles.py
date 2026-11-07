"""The style (origin) of a Kiirtan: a short pick list, plus "other".

A Kiirtan is always Baba Nam Kevalam, so it has no sung language; what tells one Kiirtan from
another is how it is sung. The uploader may name that (never required). The phone keeps the same
list in `apps/mobile/lib/kirtan/styles.ts` (with the labels in three languages);
`tests/test_kiirtan_style_and_menu_pins.py` and `__tests__/kirtanStyles.test.ts` each pin their
side. To add a style: add its id here and there and a `style.<id>` label in the three locale
dictionaries. The database stores the id only, so no migration is needed.

Only the Kiirtan category carries a style. The search menu shows each style that has enough
Kiirtans as a shelf.
"""

from __future__ import annotations

from app.services.recording_languages import clean_language_other

OTHER = "other"
# Dada's list: three languages of the text and two ways of singing.
STYLES: tuple[str, ...] = ("bengali", "hindi", "brajabuli", "dhrupad", "folk")


def normalize_style(value: str | None) -> str | None:
    """A known id, "other", or None. Anything else is refused by the schema."""
    if value is None:
        return None
    word = value.strip().lower()
    if not word:
        return None
    if word in STYLES or word == OTHER:
        return word
    raise ValueError("Choose a style from the list.")


def clean_style_other(value: str | None) -> str | None:
    """The free-text name for "other": cleaned like a language name, cut to 80 characters."""
    return clean_language_other(value)
