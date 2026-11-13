"""The practice a Kiirtan is for: today only "avarta" (Avarta Kiirtan).

Avarta Kiirtan is a special style of kiirtan done by facing six different directions in turn
(the hint text on the phone follows the Kiirtan section of the Ananda Marga booklet "Path of
Bliss"; see docs/kiirtan-practice.md for the sources). It is a sub-category INSIDE Kiirtan, so it
is a flag on a Kiirtan recording and not a new kind: `recordings.practice` is "avarta" or null,
and only a Kiirtan may carry it. The database stores the id only, so another practice later needs
no migration. The phone keeps the same id in `apps/mobile/lib/kirtan/practice.ts`; the two sides
are pinned by tests.

Who may change it afterwards: the uploader or the team (`PATCH /recordings/{id}/practice`). A
member who thinks a Kiirtan is an Avarta Kiirtan reports it with the reason "wrong_info"; the
team looks and sets the flag. There is no separate suggestion endpoint.
"""

from __future__ import annotations

AVARTA = "avarta"
PRACTICES: tuple[str, ...] = (AVARTA,)


def normalize_practice(value: str | None) -> str | None:
    """A known id or None. Anything else is refused by the schema."""
    if value is None:
        return None
    word = value.strip().lower()
    if not word:
        return None
    if word in PRACTICES:
        return word
    raise ValueError("Choose a practice from the list.")
