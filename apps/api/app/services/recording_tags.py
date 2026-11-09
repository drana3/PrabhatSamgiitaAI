"""Multi-select tags of a recording (styles and moods): listed ids plus the person's own words.

Dada, 9 Nov 2026: the step "How it sounds" asks for a Mood and a Style, each as SEVERAL choices from
a short list, and "add your own" when the person did not find theirs. Both fields have the same
shape, so the rules live here once:

* the listed ids (`styles` / `moods`), kept in the order the person chose, without repeats;
* the person's own words (`styles_other` / `moods_other`), cleaned like an instrument name (one
  line, 2 to 40 characters); a word that IS a listed value becomes that id, the rest go to the
  team's suggestion queue (services/value_suggestions.py);
* at most `MAX_TAGS` in all and `MAX_OWN` own words per field, so a form cannot grow without end.

Old rows keep their single value (`recordings.style`, `style_other`): `effective_tags` reads either
shape, so nothing is migrated and nothing is lost.
"""

from __future__ import annotations

from collections.abc import Iterable, Sequence

# The mood ids of the upload form (Dada, 9 Nov 2026) and the older ones that stay readable. They
# live here, in a module with no imports, so the suggestion queue and the mood service can both
# use them.
UPLOAD_MOODS: tuple[str, ...] = ("joyful", "meditative", "longing", "energetic", "mix")
LEGACY_MOODS: tuple[str, ...] = ("calm", "ecstatic", "devotion", "sad")
MOOD_MESSAGE = "Choose a mood from the list."

# All the tags of one field, listed and own together.
MAX_TAGS = 5
# Own words per field and recording (each one is a new word for the team to look at).
MAX_OWN = 2
OTHER = "other"


def normalize_listed(
    values: Iterable[object] | None, allowed: Sequence[str], message: str
) -> list[str]:
    """The listed ids in order, lower-case, without repeats. Anything else is a ValueError."""
    out: list[str] = []
    for value in values or ():
        if not isinstance(value, str):
            raise ValueError(message)
        word = value.strip().lower()
        if not word or word == OTHER:
            continue  # "other" is not an id here: the own words are their own list
        if word not in allowed:
            raise ValueError(message)
        if word not in out:
            out.append(word)
    return out


def clean_own_words(values: Iterable[object] | None, message: str) -> list[str]:
    """The own words as typed, one line each, without repeats (case does not matter)."""
    out: list[str] = []
    seen: set[str] = set()
    for value in values or ():
        if not isinstance(value, str):
            raise ValueError(message)
        word = " ".join("".join(ch for ch in value if ch.isprintable() or ch.isspace()).split())
        if not word:
            continue
        if word.casefold() not in seen:
            seen.add(word.casefold())
            out.append(word)
    return out


def check_counts(listed: Sequence[str], own: Sequence[str], what: str) -> None:
    """ValueError when the person chose too many."""
    if len(own) > MAX_OWN:
        raise ValueError(f"Add at most {MAX_OWN} of your own {what}.")
    if len(listed) + len(own) > MAX_TAGS:
        raise ValueError(f"Choose at most {MAX_TAGS} {what}.")


def effective_tags(
    listed: Sequence[str] | None,
    own: Sequence[str] | None,
    single: str | None = None,
    single_other: str | None = None,
) -> tuple[list[str], list[str]]:
    """(ids, own words) of a stored row. A row from before the lists has one `style` (or "other"
    with its word): it reads as a list of one."""
    if listed is not None or own is not None:
        return list(listed or []), list(own or [])
    if not single:
        return [], []
    if single == OTHER:
        return [], [single_other] if single_other else []
    return [single], []


def legacy_single(listed: Sequence[str], own: Sequence[str]) -> tuple[str | None, str | None]:
    """The old single value as an older phone reads it: the first listed id, else "other" with
    the first own word, else nothing."""
    if listed:
        return listed[0], None
    if own:
        return OTHER, own[0]
    return None, None
