"""Does a new recording match one that is already in the library? Three layers, one answer.

The layers (docs/duplicate-check.md):

* `title`: the same title once case, accents, spaces and punctuation are gone, or a very close one
  (a typo, a missing word); numbers must agree, so "Kiirtan 1" and "Kiirtan 2" are different.
* `duration`: the lengths differ by at most 2 seconds or 1 percent, whichever is more.
* `sound`: the audio fingerprint (Chromaprint, `fpcalc`) is close, see recording_fingerprint.py.
  Without `fpcalc` on the server this layer does not exist and is never claimed.

The same file (SHA-256) is not a layer but a hard stop of its own, handled before these.

A recording is OFFERED as a match when its sound is close (the strongest signal, kept from the
first version of the check) or when its title AND its duration both match. One layer alone never
offers anything for title or duration: many different kiirtans are called "Baba Nam Kevalam" and
many last five minutes. The offer is a question for the uploader, never a refusal.
"""

from __future__ import annotations

import re
from difflib import SequenceMatcher

TITLE = "title"
DURATION = "duration"
SOUND = "sound"
LAYERS: tuple[str, ...] = (TITLE, DURATION, SOUND)

TITLE_RATIO = 0.88
DURATION_SLACK_SEC = 2
DURATION_SLACK_SHARE = 0.01


def _digits(key: str) -> str:
    return "".join(re.findall(r"\d+", key))


def titles_close(key_a: str, key_b: str) -> bool:
    """Two `title_key` values: equal, or almost equal with the same numbers. Empty never matches."""
    if not key_a or not key_b:
        return False
    if key_a == key_b:
        return True
    if _digits(key_a) != _digits(key_b):
        return False
    if min(len(key_a), len(key_b)) < 6:
        return False  # too short to call a near match
    return SequenceMatcher(None, key_a, key_b).ratio() >= TITLE_RATIO


def duration_window(seconds: int) -> tuple[int, int]:
    """The shortest and the longest length that counts as the same length as `seconds`."""
    slack = max(DURATION_SLACK_SEC, round(seconds * DURATION_SLACK_SHARE))
    return seconds - slack, seconds + slack


def durations_close(a: int | None, b: int | None) -> bool:
    if not a or not b:
        return False
    low, high = duration_window(a)
    return low <= b <= high


def is_offered(layers: set[str]) -> bool:
    """Sound alone, or title and duration together."""
    return SOUND in layers or {TITLE, DURATION} <= layers
