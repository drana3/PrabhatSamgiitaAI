"""The chord cycle of a Kiirtan (docs/kiirtan-cycle.md).

A Kiirtan has no lyric lines to hang chords on: the same few chords go round and round. So a cycle
is a ring of chords (2 to 8, four by default on the phone) with the chord the ring STARTS on, and
optionally how many rounds are played (`times`). A recording can hold more than one TUNE (melody),
up to thirty, each with its own ring and its own key. A tune nobody has chords for yet is not
stored: `tune_count` says how many tunes the recording has, the numbers missing from `tunes` are
"no chords yet", and another member can add them later (as a new sheet that starts from this one).

The first build called a tune a "form" (`{"forms": [...]}`, no numbers, no keys, no count). Those
rows are not migrated: `normalize` reads them as tunes numbered by their place, and a request that
sends `forms` is read the same way (schema `CycleIn`).

A cycle is stored as one more kind of chord sheet (`recording_chord_sheets.cycle`), so the review
queue, the replacement of versions, "Start from this chart", the daily allowance and the notices
are the ones the chord sheets already have; this file holds only what is particular to a cycle:
cleaning, the text written from it (`body`, so a reader that does not know cycles still shows it)
and the public shape.

Not checked, and said so on the screen: that the chords are musically right, and the timing (a cycle
is not synced to the audio).
"""

from __future__ import annotations

import json
from typing import Any

from fastapi import HTTPException

from app.schemas.recording_extras import CycleIn, CycleOut, CycleTuneOut
from app.services.song_comments import link_count, strip_invisible

CYCLE_KINDS = ("kiirtan",)
# 30 tunes of 8 long chord names with a name and notes each come to about 8000 characters.
MAX_BODY = 12000


def clean_name(raw: str | None) -> str | None:
    """A tune's own name ("Slow", "Fast round"): one short line, no web links, English-only
    text rules are applied by the app; here only the shape."""
    name = " ".join(strip_invisible(raw or "").split())
    if not name:
        return None
    if len(name) > 30:
        raise HTTPException(status_code=422, detail="The name of a tune can have 30 characters.")
    if link_count(name) > 0:
        raise HTTPException(status_code=422, detail="Please leave web links out of a chord cycle.")
    return name


def clean_cycle(payload: CycleIn) -> dict[str, Any]:
    """The cycle as it will be stored: names cleaned, chords as sent (already checked as chord
    names by the schema), the start inside the ring, the tunes in the order they are played. Two
    tunes with the same chords are fine: many tunes share a few chords."""
    entries: list[dict[str, Any]] = []
    for index, tune in enumerate(payload.tunes, start=1):
        entries.append(
            {
                "number": tune.number if tune.number is not None else index,
                "name": clean_name(tune.name),
                "key": tune.key,
                "chords": list(tune.chords),
                "start": tune.start,
                "times": tune.times,
            }
        )
    entries.sort(key=lambda entry: entry["number"])
    total = (
        payload.tune_count
        if payload.tune_count is not None
        else max(len(entries), entries[-1]["number"])
    )
    return {"tune_count": total, "tunes": entries}


def normalize(cycle: dict[str, Any]) -> dict[str, Any]:
    """A stored cycle in the current shape. Rows of the first build (`forms`, no numbers or keys)
    become tunes numbered by their place; nothing is written back."""
    if "tunes" in cycle:
        tunes = cycle["tunes"]
        total = int(cycle.get("tune_count") or len(tunes))
        return {"tune_count": total, "tunes": tunes}
    forms = cycle.get("forms") or []
    tunes = [
        {
            "number": index,
            "name": form.get("name"),
            "key": None,
            "chords": list(form["chords"]),
            "start": form["start"],
            "times": form.get("times"),
        }
        for index, form in enumerate(forms, start=1)
    ]
    return {"tune_count": len(tunes), "tunes": tunes}


def all_chords(cycle: dict[str, Any]) -> list[str]:
    return [chord for tune in normalize(cycle)["tunes"] for chord in tune["chords"]]


def first_key(cycle: dict[str, Any]) -> str | None:
    """The key of the first tune that has one (the sheet list shows one key per sheet)."""
    for tune in normalize(cycle)["tunes"]:
        if tune.get("key"):
            return str(tune["key"])
    return None


def cycle_body(cycle: dict[str, Any]) -> str:
    """The cycle written as plain text, one line per tune: `Tune 1 (Slow): Em - C - G - D (key G,
    starts on Em, x4)`; a tune without chords says so. English on purpose: it is content, and it is
    what a reader without cycles shows."""
    shaped = normalize(cycle)
    by_number = {tune["number"]: tune for tune in shaped["tunes"]}
    out: list[str] = []
    for number in range(1, shaped["tune_count"] + 1):
        tune = by_number.get(number)
        if tune is None:
            out.append(f"Tune {number}: no chords yet")
            continue
        label = f"Tune {number}" + (f" ({tune['name']})" if tune.get("name") else "")
        notes = []
        if tune.get("key"):
            notes.append(f"key {tune['key']}")
        notes.append(f"starts on {tune['chords'][tune['start']]}")
        if tune.get("times"):
            notes.append(f"x{tune['times']}")
        out.append(f"{label}: {' - '.join(tune['chords'])} ({', '.join(notes)})")
    text = "\n".join(out)
    if len(text) > MAX_BODY:
        raise HTTPException(status_code=422, detail="This chord cycle is too long.")
    return text


def fingerprint(cycle: dict[str, Any]) -> str:
    return json.dumps(normalize(cycle), sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def cycle_out(cycle: dict[str, Any] | None) -> CycleOut | None:
    if not cycle:
        return None
    shaped = normalize(cycle)
    return CycleOut(
        tune_count=shaped["tune_count"],
        tunes=[
            CycleTuneOut(
                number=int(tune["number"]),
                name=tune.get("name"),
                key=tune.get("key"),
                chords=[str(c) for c in tune["chords"]],
                start=int(tune["start"]),
                times=tune.get("times"),
            )
            for tune in shaped["tunes"]
        ],
    )
