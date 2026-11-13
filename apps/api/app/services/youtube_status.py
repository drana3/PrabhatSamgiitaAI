"""Is a YouTube broadcast live right now: YouTube Data API v3 `videos.list` (docs/broadcasts.md).

Only for a broadcast whose link is a YouTube video. The key comes from the environment alone
(`Settings.youtube_api_key`); without it, or with `YOUTUBE_STATUS_ENABLED=false`, nothing here runs
and a broadcast stays "on" by the organizer's clock.

What protects the quota (10,000 units a day are free, a `videos.list` call costs 1 whatever the
number of ids):

* one call asks for up to 50 videos at once (`BATCH`); a list is never one call per viewer or
  per broadcast
* the answer is kept on the broadcast row (`yt_checked_at`) and reused for
  `youtube_status_ttl_seconds`, for every viewer
* a ceiling of `youtube_daily_request_limit` calls per UTC day in this process
* after a refusal (quota used up, a bad key) or a network failure the API is left alone for a while

What is kept: the state (live / upcoming / none) and the two times; nothing else of the answer.
The key travels in the `X-Goog-Api-Key` header, never in the address, so it cannot reach a log line
that prints an address; an error is logged as its class and the HTTP status only, never the text,
the address or the key. A video the API does not return (private, deleted) is "unknown" and the
clock rules.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

import httpx

from app.config import Settings

logger = logging.getLogger(__name__)

API_URL = "https://www.googleapis.com/youtube/v3/videos"
FIELDS = (
    "items(id,snippet/liveBroadcastContent,liveStreamingDetails(actualStartTime,actualEndTime))"
)
BATCH = 50
TIMEOUT_SECONDS = 6.0
AFTER_FAILURE = timedelta(minutes=1)
AFTER_REFUSAL = timedelta(minutes=10)
# A test replaces it with `httpx.MockTransport`; the real internet is never touched by the tests.
transport: httpx.AsyncBaseTransport | None = None


@dataclass(frozen=True)
class LiveFacts:
    """What the API said about one video. `state` is None when it is not a live stream, or not
    known (private, deleted)."""

    state: str | None
    started: datetime | None
    ended: datetime | None


UNKNOWN = LiveFacts(None, None, None)


def is_on(settings: Settings) -> bool:
    return bool(settings.youtube_api_key) and settings.youtube_status_enabled


class _Gate:
    """The daily ceiling and the pause after a failure, for this process."""

    def __init__(self) -> None:
        self.reset()

    def reset(self) -> None:
        self.day: str = ""
        self.used = 0
        self.blocked_until: datetime | None = None

    def take(self, limit: int, now: datetime) -> bool:
        today = now.astimezone(UTC).strftime("%Y-%m-%d")
        if today != self.day:
            self.day, self.used = today, 0
        if self.blocked_until and now < self.blocked_until:
            return False
        if self.used >= limit:
            return False
        self.used += 1
        return True

    def pause(self, now: datetime, how_long: timedelta) -> None:
        self.blocked_until = now + how_long

    def pause_until_midnight(self, now: datetime) -> None:
        tomorrow = (now.astimezone(UTC) + timedelta(days=1)).replace(
            hour=0, minute=5, second=0, microsecond=0
        )
        self.blocked_until = tomorrow


gate = _Gate()


def _moment(value: object) -> datetime | None:
    if not isinstance(value, str) or len(value) > 40:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)


def read_items(body: object, asked: list[str], *, now: datetime) -> dict[str, LiveFacts]:
    """One entry per asked id. An id the answer does not hold is UNKNOWN (private or deleted)."""
    found: dict[str, LiveFacts] = {}
    items = body.get("items") if isinstance(body, dict) else None
    for item in items if isinstance(items, list) else []:
        if not isinstance(item, dict) or item.get("id") not in asked:
            continue
        snippet = item.get("snippet")
        kind = snippet.get("liveBroadcastContent") if isinstance(snippet, dict) else None
        details = item.get("liveStreamingDetails")
        if not isinstance(details, dict):
            found[item["id"]] = UNKNOWN  # an ordinary video: nothing to say about "live"
            continue
        started = _moment(details.get("actualStartTime"))
        ended = _moment(details.get("actualEndTime"))
        if ended is not None and (ended > now + timedelta(minutes=2)):
            ended = None
        if ended is not None and started is not None and ended < started:
            ended = None
        if kind in ("live", "upcoming"):
            found[item["id"]] = LiveFacts(kind, started, None)
        elif kind == "none" and ended is not None:
            found[item["id"]] = LiveFacts("none", started, ended)
        else:
            found[item["id"]] = UNKNOWN
    return {video_id: found.get(video_id, UNKNOWN) for video_id in asked}


async def look(
    video_ids: list[str],
    settings: Settings,
    *,
    now: datetime,
    client: httpx.AsyncClient | None = None,
) -> dict[str, LiveFacts]:
    """What the API says about these videos, in calls of up to BATCH ids. The videos that could
    not be asked (no key, ceiling reached, failure) are simply missing from the answer."""
    key = settings.youtube_api_key
    answer: dict[str, LiveFacts] = {}
    if not key or not settings.youtube_status_enabled:
        return answer
    ids = list(dict.fromkeys(video_ids))
    own = client is None
    http = client or httpx.AsyncClient(
        timeout=TIMEOUT_SECONDS, transport=transport, follow_redirects=False
    )
    try:
        for start in range(0, len(ids), BATCH):
            chunk = ids[start : start + BATCH]
            if not gate.take(settings.youtube_daily_request_limit, now):
                break
            try:
                response = await http.get(
                    API_URL,
                    params={
                        "part": "snippet,liveStreamingDetails",
                        "id": ",".join(chunk),
                        "fields": FIELDS,
                    },
                    headers={"X-Goog-Api-Key": key, "Accept": "application/json"},
                )
            except (TimeoutError, httpx.HTTPError) as exc:
                logger.warning("YouTube status look failed: %s", type(exc).__name__)
                gate.pause(now, AFTER_FAILURE)
                break
            if response.status_code != 200:
                logger.warning("YouTube status look refused: HTTP %s", response.status_code)
                if response.status_code in (403, 429):
                    if _quota_used_up(response):
                        gate.pause_until_midnight(now)
                    else:
                        gate.pause(now, AFTER_REFUSAL)
                else:
                    gate.pause(now, AFTER_FAILURE)
                break
            try:
                body = response.json()
            except ValueError:
                gate.pause(now, AFTER_FAILURE)
                break
            answer.update(read_items(body, chunk, now=now))
    finally:
        if own:
            await http.aclose()
    return answer


def _quota_used_up(response: httpx.Response) -> bool:
    try:
        errors = response.json()["error"]["errors"]
        return any(
            isinstance(e, dict) and e.get("reason") in ("quotaExceeded", "dailyLimitExceeded")
            for e in errors
        )
    except (ValueError, KeyError, TypeError):
        return False
