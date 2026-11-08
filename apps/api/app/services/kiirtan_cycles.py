"""The chord cycle of a Kiirtan (docs/kiirtan-cycle.md).

A Kiirtan has no lyric lines to hang chords on: the same few chords go round and round. So a cycle
is a ring of chords (2 to 8, four by default on the phone) with the chord the ring STARTS on, and
optionally how many rounds are played (`times`). A recording can be played in more than one way (a
slow round, then a fast one): each way is a "form", up to eight, each with its own ring.

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

from app.schemas.recording_extras import CycleFormOut, CycleIn, CycleOut
from app.services.song_comments import link_count, strip_invisible

CYCLE_KINDS = ("kiirtan",)
MAX_BODY = 2000


def clean_name(raw: str | None) -> str | None:
    """A form's own name ("Slow", "Fast round"): one short line, no web links, English-only
    text rules are applied by the app; here only the shape."""
    name = " ".join(strip_invisible(raw or "").split())
    if not name:
        return None
    if len(name) > 30:
        raise HTTPException(status_code=422, detail="The name of a form can have 30 characters.")
    if link_count(name) > 0:
        raise HTTPException(status_code=422, detail="Please leave web links out of a chord cycle.")
    return name


def clean_cycle(payload: CycleIn) -> dict[str, Any]:
    """The cycle as it will be stored: names cleaned, chords as sent (already checked as chord
    names by the schema), the start inside the ring. Two forms with the same chords, start and
    times are one form too many."""
    forms: list[dict[str, Any]] = []
    seen: set[str] = set()
    for form in payload.forms:
        entry = {
            "name": clean_name(form.name),
            "chords": list(form.chords),
            "start": form.start,
            "times": form.times,
        }
        key = json.dumps([entry["chords"], entry["start"], entry["times"]])
        if key in seen:
            raise HTTPException(
                status_code=422,
                detail="Two forms of the cycle are exactly the same. Remove one of them.",
            )
        seen.add(key)
        forms.append(entry)
    return {"forms": forms}


def all_chords(cycle: dict[str, Any]) -> list[str]:
    return [chord for form in cycle["forms"] for chord in form["chords"]]


def cycle_body(cycle: dict[str, Any]) -> str:
    """The cycle written as plain text, one line per form: `Form 1 (Slow): Em - C - G - D (starts on
    Em, x4)`. English on purpose: it is content, and it is what a reader without cycles shows."""
    out: list[str] = []
    for index, form in enumerate(cycle["forms"], start=1):
        label = f"Form {index}" + (f" ({form['name']})" if form.get("name") else "")
        notes = [f"starts on {form['chords'][form['start']]}"]
        if form.get("times"):
            notes.append(f"x{form['times']}")
        out.append(f"{label}: {' - '.join(form['chords'])} ({', '.join(notes)})")
    text = "\n".join(out)
    if len(text) > MAX_BODY:
        raise HTTPException(status_code=422, detail="This chord cycle is too long.")
    return text


def fingerprint(cycle: dict[str, Any]) -> str:
    return json.dumps(cycle, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def cycle_out(cycle: dict[str, Any] | None) -> CycleOut | None:
    if not cycle:
        return None
    return CycleOut(
        forms=[
            CycleFormOut(
                name=form.get("name"),
                chords=[str(c) for c in form["chords"]],
                start=int(form["start"]),
                times=form.get("times"),
            )
            for form in cycle.get("forms", [])
        ]
    )
