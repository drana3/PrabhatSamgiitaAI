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

The same look also brings a picture for the tile (docs/kiirtan-video.md, "Previews"). YouTube's and
the
Internet Archive's pictures stand at addresses built from the video's id, so nothing is asked for
them; Vimeo
names its picture only in the oEmbed answer, so that answer is read once and the address (checked:
https, no user
name, Vimeo's own image host) is kept on the link.

Who runs it: a link that was just added (in the background, after the answer), the links of a page
that is being read when their last look is old (in the background), a `broken` report on a link,
and the team's "check now" endpoint (`POST /video-links/review/recheck`). No job of its own, so
nothing runs on a server that nobody uses."""

from __future__ import annotations

import asyncio
import json
import logging
import re
from collections import OrderedDict
from dataclasses import dataclass
from datetime import timedelta
from time import monotonic
from typing import Literal
from urllib.parse import quote, urlsplit

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.recording_extras import VideoLink
from app.services.extras_common import one_line
from app.services.recordings import now_utc

logger = logging.getLogger(__name__)

Probe = Literal["ok", "no_embed", "gone", "unknown"]

# A link that was fine is looked at again after a week; one that is in doubt after a day; a Vimeo
# link
# whose picture is still missing after a few hours (its oEmbed answer came without one, or never
# came).
STALE_GOOD = timedelta(days=7)
STALE_DOUBT = timedelta(days=1)
STALE_NO_PICTURE = timedelta(hours=6)
GONE_TWICE = 2
TIMEOUT_SECONDS = 6.0
# At most this many links are probed in one pass, a few at a time.
BATCH = 25
PARALLEL = 4

# The most of an oEmbed or metadata answer that is read (a Vimeo answer carries the description).
MAX_BODY = 131_072

# Where each site keeps the pictures of its videos. A picture address that is not on exactly this
# host is never kept
# or shown (an address inside an answer is the site's text, not ours).
THUMB_HOSTS = {"youtube": "i.ytimg.com", "vimeo": "i.vimeocdn.com"}
_YOUTUBE_ID = re.compile(r"[A-Za-z0-9_-]{11}")
_ARCHIVE_ID = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]{2,99}")
_PICTURE_PATH = re.compile(r"/[A-Za-z0-9_./-]{1,200}\.(?:jpg|jpeg|png|webp)")

# Tests (and nothing else) set this to a `httpx.MockTransport`, so no test reaches the internet.
transport: httpx.AsyncBaseTransport | None = None


def probe_target(provider: str, external_id: str, url: str) -> str | None:
    """The one address to ask about a video, or None for a site the check does not know. Built from
    the stored provider, id and rebuilt address; none of it is the text a person typed."""
    if provider == "youtube":
        watch = f"https://www.youtube.com/watch?v={external_id}"
        return f"https://www.youtube.com/oembed?format=json&url={quote(watch, safe='')}"
    if provider == "vimeo":
        return f"https://vimeo.com/api/oembed.json?width=640&url={quote(url, safe='')}"
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


@dataclass(frozen=True)
class Meta:
    """What one look found: the verdict, the video's own title, and the address of its picture."""

    result: Probe
    title: str | None = None
    thumbnail: str | None = None


NOTHING = Meta("unknown")


def thumbnail_by_id(provider: str, external_id: str) -> str | None:
    """The picture of a video at an address built from its id alone (no request is made for it).

    YouTube: `mqdefault.jpg` is 320x180 (16:9, no black bars) and exists for every public video;
    `maxresdefault` is
    missing for many and is never used. The Internet Archive: its `services/img/<id>` picture.
    Vimeo has no
    address by id: it comes from the oEmbed answer (`Meta.thumbnail`, kept on the link)."""
    if provider == "youtube" and _YOUTUBE_ID.fullmatch(external_id or ""):
        return f"https://{THUMB_HOSTS['youtube']}/vi/{external_id}/mqdefault.jpg"
    if provider == "archive" and _ARCHIVE_ID.fullmatch(external_id or ""):
        return f"https://archive.org/services/img/{quote(external_id, safe='')}"
    return None


def safe_thumbnail(provider: str, value: object) -> str | None:
    """A picture address out of a site's answer, or None: https only, no user name or password, no
    odd port,
    the host exactly the provider's image host, a picture path. The query and the fragment are
    dropped."""
    host = THUMB_HOSTS.get(provider)
    if host is None or not isinstance(value, str) or not value or len(value) > 300:
        return None
    try:
        parts = urlsplit(value)
        port = parts.port
    except ValueError:
        return None
    if parts.scheme != "https" or parts.username or parts.password or port not in (None, 443):
        return None
    if (parts.hostname or "").lower().rstrip(".") != host or not _PICTURE_PATH.fullmatch(
        parts.path
    ):
        return None
    return f"https://{host}{quote(parts.path, safe='/')}"


def thumbnail_for(video: VideoLink) -> str | None:
    """The picture to hand out for a stored link: by id for YouTube and the Archive, the kept one
    for Vimeo."""
    if video.status != "published" or not video.external_id:
        return None
    by_id = thumbnail_by_id(video.provider, video.external_id)
    return by_id or safe_thumbnail(video.provider, video.thumbnail_url)


def _read_meta(provider: str, body: bytes) -> tuple[str | None, str | None]:
    """(title, picture address) from an answer that said the video exists; each may be None."""
    try:
        data = json.loads(body)
    except ValueError:
        return None, None
    if not isinstance(data, dict):
        return None, None
    if provider == "archive":
        meta = data.get("metadata")
        raw = meta.get("title") if isinstance(meta, dict) else None
        raw = raw[0] if isinstance(raw, list) and raw else raw
        return (one_line(raw, 200) or None) if isinstance(raw, str) else None, None
    raw = data.get("title")
    title = (one_line(raw, 200) or None) if isinstance(raw, str) else None
    return title, safe_thumbnail(provider, data.get("thumbnail_url"))


async def look(
    provider: str, external_id: str, url: str, *, client: httpx.AsyncClient | None = None
) -> Meta:
    """One request to the site's own answer for this video: is it alive, its title, its picture."""
    target = probe_target(provider, external_id, url)
    if target is None:
        return NOTHING
    own = client is None
    http = client or httpx.AsyncClient(
        timeout=TIMEOUT_SECONDS, transport=transport, follow_redirects=False
    )
    try:
        async with http.stream("GET", target, headers={"Accept": "application/json"}) as response:
            chunks: list[bytes] = []
            size = 0
            async for chunk in response.aiter_bytes():
                chunks.append(chunk)
                size += len(chunk)
                if size >= MAX_BODY:
                    break
            body = b"".join(chunks)[:MAX_BODY]
            result = read_answer(provider, response.status_code, body)
        if result != "ok":
            return Meta(result)
        title, thumbnail = _read_meta(provider, body)
        return Meta(result, title, thumbnail)
    except (TimeoutError, httpx.HTTPError):
        return NOTHING
    finally:
        if own:
            await http.aclose()


async def probe(
    provider: str, external_id: str, url: str, *, client: httpx.AsyncClient | None = None
) -> Probe:
    return (await look(provider, external_id, url, client=client)).result


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


def apply_meta(video: VideoLink, meta: Meta) -> None:
    """Record a look and, for Vimeo, the picture it found (an older picture stays when a look finds
    none)."""
    apply(video, meta.result)
    if meta.result == "ok" and video.provider == "vimeo" and meta.thumbnail:
        video.thumbnail_url = meta.thumbnail


def needs_picture(video: VideoLink) -> bool:
    """A link whose picture cannot be built from its id and has not been kept yet."""
    return video.provider == "vimeo" and not video.thumbnail_url


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
    if needs_picture(video):
        wait = min(wait, STALE_NO_PICTURE)
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

        async def one(video: VideoLink) -> tuple[VideoLink, Meta]:
            async with gate:
                return video, await look(
                    video.provider, video.external_id, video.url, client=client
                )

        results = await asyncio.gather(*(one(v) for v in videos))
    for video, meta in results:
        apply_meta(video, meta)
        counts[meta.result] += 1
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


# --------------------------------------------------------------------------- preview before adding

PREVIEW_TTL = 600.0
PREVIEW_TTL_UNSURE = 45.0
PREVIEW_CACHE_MAX = 500


@dataclass(frozen=True)
class Preview:
    """What the form shows under a typed link: the title and the picture, and whether the site may
    show it."""

    link_status: Literal["unknown", "ok", "no_embed", "unavailable"]
    title: str | None
    thumbnail_url: str | None


_preview_cache: OrderedDict[tuple[str, str], tuple[float, Preview]] = OrderedDict()


def clear_preview_cache() -> None:
    _preview_cache.clear()


async def preview(provider: str, external_id: str, url: str) -> Preview:
    """The look at a link that is not stored yet (the upload form, "Add a video").

    The address that is asked is built from the checked id (`probe_target`), never from the typed
    text. A good
    answer is remembered for ten minutes and a doubtful one (timeout, 5xx, rate limit) for 45
    seconds, so a person
    editing a link, or ten people pasting the same one, cost the site one request. At most 500
    answers are kept."""
    key = (provider, external_id)
    now = monotonic()
    hit = _preview_cache.get(key)
    if hit is not None and hit[0] > now:
        _preview_cache.move_to_end(key)
        return hit[1]
    meta = await look(provider, external_id, url)
    by_id = thumbnail_by_id(provider, external_id)
    if meta.result == "gone":
        found = Preview("unavailable", None, None)
    elif meta.result == "unknown":
        # the site did not answer: the picture by id may still load, and the person is not told the
        # link is bad
        found = Preview("unknown", None, by_id)
    else:
        found = Preview(
            "ok" if meta.result == "ok" else "no_embed", meta.title, by_id or meta.thumbnail
        )
    _preview_cache[key] = (
        now + (PREVIEW_TTL_UNSURE if meta.result == "unknown" else PREVIEW_TTL),
        found,
    )
    _preview_cache.move_to_end(key)
    while len(_preview_cache) > PREVIEW_CACHE_MAX:
        _preview_cache.popitem(last=False)
    return found
