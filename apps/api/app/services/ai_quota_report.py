"""What the app is told about the daily AI question allowance.

The limit itself lives in `ai_quota.py`. This module only turns a `DailyQuotaStatus` into the
`X-RateLimit-*` response headers (and the JSON of `GET /ai/quota`), so the phone can show
"N questions left today" from the server's own count instead of keeping a tally of its own.

Honest by construction: when the status carries no numbers (for example a fake in a test, or a
failure while reading it) there is no report and no header is sent, and the app then shows nothing.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

LIMIT_HEADER = "X-RateLimit-Limit"
REMAINING_HEADER = "X-RateLimit-Remaining"
RESET_HEADER = "X-RateLimit-Reset"
EXPOSED_HEADERS = (LIMIT_HEADER, REMAINING_HEADER, RESET_HEADER)
"""Listed in the CORS `expose_headers` so a browser build of the app can read them too."""


@dataclass(frozen=True, slots=True)
class QuotaReport:
    limit: int
    remaining: int
    reset_seconds: int
    is_member: bool

    @property
    def used(self) -> int:
        return max(self.limit - self.remaining, 0)


def seconds_until_reset(now: datetime | None = None) -> int:
    """Whole seconds until the next UTC midnight, when the daily count starts again (at least 1)."""
    moment = now or datetime.now(UTC)
    tomorrow = (moment + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    return max(int((tomorrow - moment).total_seconds()), 1)


def report_from_status(
    status: Any,
    *,
    charged: int = 0,
    now: datetime | None = None,
) -> QuotaReport | None:
    """The allowance after `charged` more questions were counted, or None when it is not known."""
    limit = getattr(status, "limit", None)
    used = getattr(status, "used", None)
    if (
        not isinstance(limit, int)
        or not isinstance(used, int)
        or isinstance(limit, bool)
        or isinstance(used, bool)
        or limit < 1
        or used < 0
    ):
        return None
    remaining = max(limit - used - max(charged, 0), 0)
    return QuotaReport(
        limit=limit,
        remaining=remaining,
        reset_seconds=seconds_until_reset(now),
        is_member=bool(getattr(status, "is_member", False)),
    )


def quota_headers(report: QuotaReport | None) -> dict[str, str]:
    if report is None:
        return {}
    return {
        LIMIT_HEADER: str(report.limit),
        REMAINING_HEADER: str(report.remaining),
        RESET_HEADER: str(report.reset_seconds),
    }
