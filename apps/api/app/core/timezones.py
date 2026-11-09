"""Time zones that never take the server down (docs/launch-readiness.md, "Server tools").

`zoneinfo` reads the operating system's time zone files (the `tzdata` package of the container). A
server image without them makes `ZoneInfo("Asia/Kolkata")` raise, and every page that says "today in
India" would answer 500. India has had no daylight saving since 1945, so a fixed UTC+05:30 is
exactly right for it; any other zone that cannot be loaded is still an error, because guessing its
offset would be wrong half the year.
"""

from __future__ import annotations

import logging
from datetime import timedelta, timezone, tzinfo
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

logger = logging.getLogger(__name__)

INDIA_NAMES = frozenset({"Asia/Kolkata", "Asia/Calcutta"})
INDIA_FIXED = timezone(timedelta(hours=5, minutes=30), "IST")
_warned = False


def load_zone(name: str) -> tzinfo:
    """The zone for `name`. Fixed IST as a fallback for India only; else raises like ZoneInfo."""
    global _warned
    try:
        return ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError, OSError):
        if name in INDIA_NAMES:
            if not _warned:
                _warned = True
                logger.warning(
                    "time zone data (tzdata) is missing on this server: using a fixed UTC+05:30 "
                    "for India. Install the tzdata package; other zones will be refused."
                )
            return INDIA_FIXED
        raise ZoneInfoNotFoundError(name) from None


def tzdata_available() -> bool:
    """True when the operating system's zone files can be read (checked on a zone with a rule)."""
    try:
        ZoneInfo("Europe/Berlin")
        ZoneInfo("Asia/Kolkata")
    except (ZoneInfoNotFoundError, ValueError, OSError):
        return False
    return True
