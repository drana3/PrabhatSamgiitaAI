"""Is a video link still alive, and may the app show it inside itself? (docs/recording-extras.md)

The member's pasted text is never fetched. The address that is looked at is built HERE from the
provider and the video's own id, which `video_links.parse_video_url` has already checked for shape,
and only three hosts are ever called:

* YouTube: `youtube.com/oembed`. 200 = the video exists and may be shown by other apps; 401 = the
owner does not allow it to be shown outside YouTube; 404 = removed or private.
* Vimeo: `vimeo.com/api/oembed.json`. 200 = ok; 403 = embedding is switched off; 404 = gone.
* Internet Archive: `archive.org/metadata/<id>`. An item that does not exist answers with an empty
  object. Items can always be embedded.

The answer is a SOFT status kept on the link (`link_status`): the app uses it to choose between
"watch here" and "Open", and to say "this link may no longer work". Nothing is hidden or blocked
because of it. A link is called `unavailable` only when it was gone twice in a row (a network
hiccup or a moment of YouTube trouble must not mark good links). Anything the check cannot tell (a
timeout, a 5xx, rate limiting) leaves the status as it was.

Who runs it: a link that was just added (in the background, after the answer), the links of a page
that is being read when their last look is old (in the background), a `broken` report on a link,
and the team's "check now" endpoint (`POST /video-links/review/recheck`). No job of its own, so
nothing runs on a server that nobody uses."""

from __future__ import annotations

import asyncio
import logging
from datetime import timedelta
from typing import Literal
from urllib.parse import quote

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.recording_extras import VideoLink
from app.services.recordings import now_utc

logger = logging.getLogger(__name__)

Probe = Literal["ok", "no_embed", "gone", "unknown"]

# A link that was fine is looked at again after a week; one that is in doubt after a day.
STALE_GOOD = timedelta(days=7)
STALE_DOUBT = timedelta(days=1)
GONE_TWICE = 2
TIMEOUT_SECONDS = 6.0
# At most this many links are probed in one pass, a few at a time.
BATCH = 25
PARALLEL = 4

# Tests (and nothing else) set this to a `httpx.MockTransport`, so no test reaches the internet.
transport: httpx.AsyncBaseTransport | None = None


def probe_target(provider: str, external_id: str, url: str) -> str | None:
    """The one address to ask about a video, or None for a site the check does not know. Built from
    the stored provider, id and rebuilt address; none of it is the text a person typed."""
    if provider == "youtube":
        watch = f"https://www.youtube.com/watch?v={external_id}"
        return f"https://www.youtube.com/oembed?format=json&url={quote(watch, safe='')}"
    if provider == "vimeo":
        return f"https://vimeo.com/api/oembed.json?url={quote(url, safe='')}"
    if provider == "archive":
        return f"https://archive.org/metadata/{quote(external_id, safe='')}"
    return None


def read_answer(provider: str, status_code: int, body: bytes) -> Probe:
    """What the site's answer means."""
    if provider == "archive":
        if status_code == 200:
            # a missing item is an empty object, `{}`
            return "ok" if body.strip() not in (b"", b"{}") else "gone"
        return "gone" if status_code == 404 else "unknown"
    if status_code == 200:
        return "ok"
    if status_code in (401, 403):
        return "no_embed"
    if status_code in (404, 410):
        return "gone"
    return "unknown"


async def probe(
    provider: str, external_id: str, url: str, *, client: httpx.AsyncClient | None = None
) -> Probe:
    target = probe_target(provider, external_id, url)
    if target is None:
        return "unknown"
    own = client is None
    http = client or httpx.AsyncClient(
        timeout=TIMEOUT_SECONDS, transport=transport, follow_redirects=False
    )
    try:
        response = await http.get(target, headers={"Accept": "application/json"})
        return read_answer(provider, response.status_code, response.content[:4096])
    except (TimeoutError, httpx.HTTPError):
        return "unknown"
    finally:
        if own:
            await http.aclose()


def apply(video: VideoLink, result: Probe) -> None:
    """Record what a look found. `unknown` changes nothing but the time of the look."""
    video.checked_at = now_utc()
    if result == "ok":
        video.link_status, video.check_fails = "ok", 0
    elif result == "no_embed":
        video.link_status, video.check_fails = "no_embed", 0
    elif result == "gone":
        video.check_fails = (video.check_fails or 0) + 1
        if video.check_fails >= GONE_TWICE:
            video.link_status = "unavailable"


def is_due(video: VideoLink, *, now=None) -> bool:
    if video.status != "published" or not video.external_id:
        return False
    if video.checked_at is None:
        return True
    moment = now or now_utc()
    checked = video.checked_at
    if checked.tzinfo is None:
        checked = checked.replace(tzinfo=moment.tzinfo)
    wait = STALE_GOOD if video.link_status in ("ok", "no_embed") else STALE_DOUBT
    return moment - checked >= wait


async def check_links(session: AsyncSession, videos: list[VideoLink]) -> dict[str, int]:
    """Probe these links (a few at a time) and store what was found. Returns how many ended up in
    each state."""
    counts = {"ok": 0, "no_embed": 0, "gone": 0, "unknown": 0}
    if not videos:
        return counts
    gate = asyncio.Semaphore(PARALLEL)
    async with httpx.AsyncClient(
        timeout=TIMEOUT_SECONDS, transport=transport, follow_redirects=False
    ) as client:

        async def one(video: VideoLink) -> tuple[VideoLink, Probe]:
            async with gate:
                return video, await probe(
                    video.provider, video.external_id, video.url, client=client
                )

        results = await asyncio.gather(*(one(v) for v in videos))
    for video, result in results:
        apply(video, result)
        counts[result] += 1
    await session.commit()
    return counts


async def check_target_if_due(session: AsyncSession, target_key: str) -> None:
    """The links of one page that are due for a look (the page was just read)."""
    rows = (
        await session.scalars(
            select(VideoLink).where(
                VideoLink.target_key == target_key, VideoLink.status == "published"
            )
        )
    ).all()
    due = [v for v in rows if is_due(v)]
    if due:
        await check_links(session, due[:BATCH])


async def check_one(session: AsyncSession, video_id) -> None:
    """One link, now (just added, or reported as broken)."""
    video = await session.get(VideoLink, video_id)
    if video is not None and video.status == "published" and video.external_id:
        await check_links(session, [video])


async def recheck_due(session: AsyncSession, *, everything: bool = False) -> dict[str, int]:
    """The team's "check now": the links that are due (or all of them with `everything`), the
    oldest look first, at most BATCH of them."""
    query = (
        select(VideoLink)
        .where(VideoLink.status == "published", VideoLink.external_id != "")
        .order_by(VideoLink.checked_at.asc().nullsfirst(), VideoLink.created_at.asc())
    )
    rows = list((await session.scalars(query.limit(BATCH * 4))).all())
    chosen = rows if everything else [v for v in rows if is_due(v)]
    return await check_links(session, chosen[:BATCH])
