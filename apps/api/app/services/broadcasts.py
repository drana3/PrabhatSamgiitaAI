"""Broadcasts: link rules, state, limits and moderation (docs/broadcasts.md).

The pasted address is NEVER fetched. It is read as a URL (`urlsplit`, exact host names, no pattern
matching on the text), classified by its host, and rebuilt. The only requests the server makes are
the YouTube oEmbed look of `video_checks` (a fixed host, an address built from the checked video
id), for a YouTube broadcast. Zoom, Facebook, Instagram and every other site are only ever stored
and opened by the person in their own browser or app: the phone never loads them in a web view.

State (`phase`), worked out when read, never stored:

* upcoming  the start is in the future
* now       the start has come and the broadcast has not ended. A broadcast without a start counts
            as "now" from the moment it was posted. Nobody checks that a Zoom room is really open:
            "now" means "by the clock of the organizer", and the page says so
* ended     the author or the team said so, or ASSUMED_DURATION passed since the start

Archive: ARCHIVE_AFTER after the end a broadcast leaves every public list and its page is closed to
everybody but its author and the team ("My broadcasts" keeps it).
"""

from __future__ import annotations

import asyncio
import ipaddress
import json
import logging
from datetime import UTC, datetime, timedelta
from urllib.parse import quote, urlsplit
from uuid import UUID

import httpx
from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import UserAccount
from app.models.broadcasts import (
    BROADCAST_DESCRIPTION_MAX_LENGTH,
    BROADCAST_ORGANIZER_MAX_LENGTH,
    BROADCAST_TITLE_MAX_LENGTH,
    BROADCAST_URL_MAX_LENGTH,
    Broadcast,
    BroadcastReport,
)
from app.schemas.broadcasts import BroadcastOut
from app.services import video_checks
from app.services.extras_common import AUTHOR_DELETED_BY, one_line, team_removed_by
from app.services.invisible_text import strip_invisible
from app.services.recording_info import has_non_latin_letters
from app.services.recordings import RateLimiter, now_utc
from app.services.song_comments import link_count
from app.services.video_links import (
    YOUTUBE_HOSTS,
    YOUTUBE_NOCOOKIE,
    VideoRefusedError,
    parse_video_url,
)

logger = logging.getLogger(__name__)

ASSUMED_DURATION = timedelta(hours=6)
ARCHIVE_AFTER = timedelta(days=7)
STARTED_AGO_MAX = timedelta(hours=6)
FAR_AHEAD_MAX = timedelta(days=365)
# Reports that hide a broadcast from the public lists until the team has looked at it.
REPORTS_HIDE = 3
DAILY_BROADCASTS = 3
HOURLY_BROADCASTS = 5
HOURLY_BROADCASTS_TEAM = 60
MAX_LIVE_PER_MEMBER = 5

BAD_LINK_CODE = "broadcast_bad_link"
DAILY_LIMIT_CODE = "broadcast_daily_limit"
LIVE_LIMIT_CODE = "broadcast_live_limit"
DUPLICATE_CODE = "broadcast_duplicate"

limiter = RateLimiter()

ZOOM_DOMAINS = ("zoom.us", "zoom.com", "zoomgov.com")
FACEBOOK_HOSTS = frozenset(
    {"facebook.com", "www.facebook.com", "m.facebook.com", "web.facebook.com", "fb.watch"}
)
INSTAGRAM_HOSTS = frozenset({"instagram.com", "www.instagram.com"})
# Names a person's own machine or network answers to: never a public broadcast.
PRIVATE_TLDS = frozenset(
    {"local", "localhost", "internal", "lan", "home", "corp", "intranet", "test", "invalid", "arpa"}
)
YOUTUBE_ALL = YOUTUBE_HOSTS | {YOUTUBE_NOCOOKIE}
YTIMG_HOST = "i.ytimg.com"


def _bad(message: str) -> VideoRefusedError:
    return VideoRefusedError(BAD_LINK_CODE, message)


def refusal(error: VideoRefusedError) -> HTTPException:
    return HTTPException(
        status_code=422, detail=error.message, headers={"X-Error-Code": error.code}
    )


def _under(host: str, domain: str) -> bool:
    return host == domain or host.endswith("." + domain)


def _is_ip(host: str) -> bool:
    try:
        ipaddress.ip_address(host.strip("[]"))
    except ValueError:
        return False
    return True


def _good_host(host: str) -> bool:
    """A public domain name: ASCII letters, digits and hyphens in dot-separated labels, at least
    two labels, not an address, not a name that only exists inside a network."""
    if not host or len(host) > 100 or _is_ip(host):
        return False
    labels = host.split(".")
    if len(labels) < 2 or labels[-1] in PRIVATE_TLDS:
        return False
    for label in labels:
        if not label or len(label) > 63 or label[0] == "-" or label[-1] == "-":
            return False
        if not all(ch.isascii() and (ch.isalnum() or ch == "-") for ch in label):
            return False
    return True


def parse_broadcast_url(raw: str) -> tuple[str, str, str, str]:
    """(provider, external id, stored url, host) of a pasted link, or `VideoRefusedError`.

    https only (a link typed without a scheme is read as https); no user name or password; no
    port but 443; an ASCII domain name, never an IP address or a name of a private network. A
    YouTube link must be ONE video (a live stream has its own watch address) and is rebuilt from
    its id. Any other link is kept as the person gave it, without the fragment (a Zoom link needs
    its `pwd` in the query).
    """
    text = (raw or "").strip()
    if not text or len(text) > BROADCAST_URL_MAX_LENGTH + 200:
        raise _bad("Paste the link of the broadcast.")
    if any(ch.isspace() or ord(ch) < 32 or ord(ch) == 127 or ch == "\\" for ch in text):
        raise _bad("That does not look like one link.")
    if "://" not in text:
        if ":" in text.split("/", 1)[0] and not text.split("/", 1)[0].rsplit(":", 1)[-1].isdigit():
            raise _bad("Only https links are accepted.")
        text = "https://" + text.lstrip("/")
    try:
        parts = urlsplit(text)
        port = parts.port
    except ValueError as exc:
        raise _bad("That does not look like one link.") from exc
    if parts.scheme.lower() != "https":
        raise _bad("Only https links are accepted.")
    if "@" in parts.netloc:
        raise _bad("That does not look like one link.")
    if port not in (None, 443):
        raise _bad("That does not look like one link.")
    host = (parts.hostname or "").lower().rstrip(".")
    if not _good_host(host):
        raise _bad("That does not look like a link to a public website.")

    if host in YOUTUBE_ALL:
        try:
            _, video_id, url = parse_video_url(text)
        except VideoRefusedError as exc:
            raise _bad(
                "For YouTube, paste the link of the live video itself "
                "(youtube.com/live/... or youtube.com/watch?v=...), not a channel."
            ) from exc
        return "youtube", video_id, url, "youtube.com"

    path = parts.path or "/"
    if path == "/" and not parts.query:
        raise _bad("Paste the link of the broadcast, not only the name of the site.")
    url = f"https://{host}{path}" + (f"?{parts.query}" if parts.query else "")
    if len(url) > BROADCAST_URL_MAX_LENGTH:
        raise _bad(f"The link is too long (more than {BROADCAST_URL_MAX_LENGTH} characters).")
    if any(_under(host, domain) for domain in ZOOM_DOMAINS):
        provider = "zoom"
    elif host in FACEBOOK_HOSTS:
        provider = "facebook"
    elif host in INSTAGRAM_HOSTS:
        provider = "instagram"
    else:
        provider = "other"
    return provider, "", url, host


# --------------------------------------------------------------------------- text


def clean_title(raw: str | None) -> str:
    title = one_line(raw, BROADCAST_TITLE_MAX_LENGTH + 40)
    if len(title) < 3:
        raise HTTPException(status_code=422, detail="Write the title of the broadcast.")
    if len(title) > BROADCAST_TITLE_MAX_LENGTH:
        raise HTTPException(
            status_code=422,
            detail=f"Keep the title to {BROADCAST_TITLE_MAX_LENGTH} characters.",
        )
    if has_non_latin_letters(title):
        raise HTTPException(
            status_code=422, detail="Write the title in English, with Latin letters."
        )
    if link_count(title) > 0:
        raise HTTPException(status_code=422, detail="Leave links out of the title.")
    return title


def clean_description(raw: str | None) -> str | None:
    lines = [one_line(line, 400) for line in strip_invisible(raw or "").splitlines()]
    text = "\n".join(line for line in lines if line)[:BROADCAST_DESCRIPTION_MAX_LENGTH].strip()
    if not text:
        return None
    if link_count(text) > 0:
        raise HTTPException(
            status_code=422, detail="Put the link in the link field, not in the description."
        )
    return text


def clean_organizer(raw: str | None) -> str | None:
    name = one_line(raw, BROADCAST_ORGANIZER_MAX_LENGTH + 40)
    if not name:
        return None
    if len(name) > BROADCAST_ORGANIZER_MAX_LENGTH:
        raise HTTPException(
            status_code=422,
            detail=f"Keep the organizer to {BROADCAST_ORGANIZER_MAX_LENGTH} characters.",
        )
    if link_count(name) > 0:
        raise HTTPException(status_code=422, detail="Leave links out of the organizer.")
    return name


def clean_zone(raw: str | None) -> str | None:
    """An IANA zone name as a safe word ("Europe/Berlin"); only shown, never trusted to compute."""
    name = (raw or "").strip()
    if not name:
        return None
    if len(name) > 64 or not all(ch.isascii() and (ch.isalnum() or ch in "/_+-") for ch in name):
        raise HTTPException(status_code=422, detail="Unknown time zone.")
    return name


def resolve_start(
    starts_at: datetime | None, zone: str | None, *, now: datetime | None = None
) -> tuple[datetime | None, str | None]:
    """(UTC start, zone name). A time without an offset needs the zone it was meant in."""
    name = clean_zone(zone)
    if starts_at is None:
        return None, None
    moment = now or now_utc()
    if starts_at.tzinfo is None:
        if name is None:
            raise HTTPException(
                status_code=422, detail="Say in which time zone the start is, or give an offset."
            )
        try:
            from zoneinfo import ZoneInfo

            starts_at = starts_at.replace(tzinfo=ZoneInfo(name))
        except Exception as exc:  # noqa: BLE001  (an unknown name, or no zone data on the server)
            raise HTTPException(status_code=422, detail="Unknown time zone.") from exc
    utc = starts_at.astimezone(UTC)
    if utc < moment - STARTED_AGO_MAX:
        raise HTTPException(status_code=422, detail="That start is already in the past.")
    if utc > moment + FAR_AHEAD_MAX:
        raise HTTPException(
            status_code=422, detail="Start dates more than a year ahead are not taken."
        )
    return utc, name or "UTC"


# --------------------------------------------------------------------------- state


def _aware(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=UTC)


def begins_at(b: Broadcast) -> datetime:
    return _aware(b.starts_at) if b.starts_at else _aware(b.created_at)


def ends_at(b: Broadcast) -> datetime:
    """When it ended or, if nobody said, when it is taken to end."""
    return _aware(b.ended_at) if b.ended_at else begins_at(b) + ASSUMED_DURATION


def phase(b: Broadcast, *, now: datetime | None = None) -> str:
    moment = now or now_utc()
    if b.ended_at and _aware(b.ended_at) <= moment:
        return "ended"
    if moment < begins_at(b):
        return "upcoming"
    return "now" if moment < ends_at(b) else "ended"


def is_archived(b: Broadcast, *, now: datetime | None = None) -> bool:
    moment = now or now_utc()
    return phase(b, now=moment) == "ended" and moment >= ends_at(b) + ARCHIVE_AFTER


def hidden_by_reports(b: Broadcast) -> bool:
    return (b.reports_count or 0) >= REPORTS_HIDE


def can_see(b: Broadcast, *, owner: bool, team: bool, now: datetime | None = None) -> bool:
    """Who may read a broadcast: everybody while it is live and in its week after the end; only
    its author and the team once it is removed, archived or hidden by reports."""
    if b.status == "removed" and b.removed_by == AUTHOR_DELETED_BY:
        return False  # the author deleted it: nobody reads it, not even the author
    if owner or team:
        return True
    return b.status == "published" and not is_archived(b, now=now) and not hidden_by_reports(b)


def public_out(
    b: Broadcast, *, viewer_id: UUID | None, team: bool, now: datetime | None = None
) -> BroadcastOut:
    moment = now or now_utc()
    mine = viewer_id is not None and b.member_id == viewer_id
    return BroadcastOut(
        id=str(b.id),
        provider=b.provider,  # type: ignore[arg-type]
        url=b.url,
        host=b.host,
        title=b.title,
        description=b.description,
        organizer=b.organizer,
        starts_at=_aware(b.starts_at) if b.starts_at else None,
        timezone=b.timezone,
        ends_at=ends_at(b),
        phase=phase(b, now=moment),  # type: ignore[arg-type]
        archived=is_archived(b, now=moment),
        thumbnail_url=b.thumbnail_url,
        link_status=b.link_status or "unknown",  # type: ignore[arg-type]
        status=b.status,  # type: ignore[arg-type]
        mine=mine,
        can_end=(mine or team) and b.status == "published",
        can_remove=mine or team,
        created_at=_aware(b.created_at),
        reports_count=(b.reports_count or 0) if (mine or team) else None,
    )


# --------------------------------------------------------------------------- reading


def _order_key(b: Broadcast, moment: datetime) -> tuple[int, float]:
    # live first (the oldest start first), then upcoming (the nearest first)
    kind = 0 if phase(b, now=moment) == "now" else 1
    return kind, begins_at(b).timestamp()


async def list_public(
    session: AsyncSession, *, which: str, limit: int = 40, now: datetime | None = None
) -> list[Broadcast]:
    """`shelf`: live and upcoming. `recent`: those and the ones that ended less than a week ago
    (newest end first, after the live ones). Hidden, removed and archived ones never show."""
    moment = now or now_utc()
    rows = (
        await session.scalars(
            select(Broadcast)
            .where(Broadcast.status == "published", Broadcast.reports_count < REPORTS_HIDE)
            .order_by(Broadcast.created_at.desc())
            .limit(500)
        )
    ).all()
    live = [b for b in rows if phase(b, now=moment) in ("now", "upcoming")]
    live.sort(key=lambda b: _order_key(b, moment))
    if which == "shelf":
        return live[:limit]
    ended = [b for b in rows if phase(b, now=moment) == "ended" and not is_archived(b, now=moment)]
    ended.sort(key=lambda b: ends_at(b), reverse=True)
    return (live + ended)[:limit]


async def list_mine(session: AsyncSession, member_id: UUID, limit: int = 100) -> list[Broadcast]:
    return list(
        (
            await session.scalars(
                select(Broadcast)
                .where(
                    Broadcast.member_id == member_id,
                    (Broadcast.status == "published") | (Broadcast.removed_by != AUTHOR_DELETED_BY),
                )
                .order_by(Broadcast.created_at.desc())
                .limit(limit)
            )
        ).all()
    )


# --------------------------------------------------------------------------- writing


async def broadcasts_in_last_day(session: AsyncSession, member_id: UUID) -> int:
    since = now_utc() - timedelta(days=1)
    return int(
        await session.scalar(
            select(func.count())
            .select_from(Broadcast)
            .where(Broadcast.member_id == member_id, Broadcast.created_at >= since)
        )
        or 0
    )


async def create(
    session: AsyncSession,
    *,
    member: UserAccount,
    team: bool,
    provider: str,
    external_id: str,
    url: str,
    host: str,
    title: str,
    description: str | None,
    organizer: str | None,
    starts_at: datetime | None,
    zone: str | None,
) -> Broadcast:
    """Store a checked broadcast. Everything that can refuse comes BEFORE the hourly allowance."""
    if not team and await broadcasts_in_last_day(session, member.id) >= DAILY_BROADCASTS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"You can post up to {DAILY_BROADCASTS} broadcasts a day.",
            headers={"X-Error-Code": DAILY_LIMIT_CODE},
        )
    moment = now_utc()
    mine = (
        await session.scalars(
            select(Broadcast).where(
                Broadcast.member_id == member.id, Broadcast.status == "published"
            )
        )
    ).all()
    open_ones = [b for b in mine if phase(b, now=moment) != "ended"]
    if any(b.url == url for b in open_ones):
        raise HTTPException(
            status_code=409,
            detail="You already posted this link.",
            headers={"X-Error-Code": DUPLICATE_CODE},
        )
    if not team and len(open_ones) >= MAX_LIVE_PER_MEMBER:
        raise HTTPException(
            status_code=409,
            detail=f"You already have {MAX_LIVE_PER_MEMBER} live or announced broadcasts.",
            headers={"X-Error-Code": LIVE_LIMIT_CODE},
        )
    limiter.hit(
        "add",
        str(member.id),
        limit=HOURLY_BROADCASTS_TEAM if team else HOURLY_BROADCASTS,
        window_seconds=3600,
    )
    row = Broadcast(
        member_id=member.id,
        provider=provider,
        external_id=external_id,
        url=url,
        host=host,
        title=title,
        description=description,
        organizer=organizer,
        starts_at=starts_at,
        timezone=zone,
    )
    session.add(row)
    await session.commit()
    await session.refresh(row)
    return row


async def end_now(session: AsyncSession, row: Broadcast) -> None:
    if row.status != "published":
        raise HTTPException(status_code=409, detail="This broadcast is removed.")
    if phase(row) == "ended":
        return
    row.ended_at = now_utc()
    await session.commit()


async def delete_by_author(session: AsyncSession, row: Broadcast) -> None:
    """Gone for everybody at once. The row stays (the daily allowance is not given back) with the
    link and the texts wiped."""
    if row.status == "removed":
        return
    row.status = "removed"
    row.removed_at = now_utc()
    row.removed_by = AUTHOR_DELETED_BY
    row.removed_reason = None
    row.url = ""
    row.external_id = ""
    row.host = ""
    row.title = ""
    row.description = None
    row.organizer = None
    row.thumbnail_url = None
    row.fetched_title = None
    await session.commit()


async def remove_by_team(session: AsyncSession, row: Broadcast, *, reason: str, by: str) -> None:
    row.status = "removed"
    row.removed_reason = one_line(reason, 500) or None
    row.removed_at = now_utc()
    row.removed_by = team_removed_by(by)
    await session.commit()


async def keep(session: AsyncSession, row: Broadcast) -> None:
    if row.status != "published":
        raise HTTPException(status_code=409, detail="Only a live broadcast can be kept.")
    row.reports_count = 0
    await session.commit()


async def add_report(
    session: AsyncSession,
    *,
    row: Broadcast,
    reporter_key: str,
    reporter_id: UUID | None,
    reason: str,
    note: str | None,
) -> bool:
    already = await session.scalar(
        select(BroadcastReport.id).where(
            BroadcastReport.broadcast_id == row.id, BroadcastReport.reporter_key == reporter_key
        )
    )
    if already is not None:
        return False
    session.add(
        BroadcastReport(
            broadcast_id=row.id,
            reporter_key=reporter_key,
            reporter_id=reporter_id,
            reason=reason,
            note=one_line(note, 1000) or None,
        )
    )
    row.reports_count = (row.reports_count or 0) + 1
    await session.commit()
    return True


async def review_queue(
    session: AsyncSession, *, which: str, limit: int, offset: int
) -> tuple[list[Broadcast], int]:
    conditions = [Broadcast.status == "published", Broadcast.reports_count > 0]
    if which == "removed":
        conditions = [Broadcast.status == "removed", Broadcast.removed_by != AUTHOR_DELETED_BY]
    total = await session.scalar(select(func.count()).select_from(Broadcast).where(*conditions))
    rows = (
        await session.scalars(
            select(Broadcast)
            .where(*conditions)
            .order_by(Broadcast.reports_count.desc(), Broadcast.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
    ).all()
    return list(rows), int(total or 0)


# --------------------------------------------------------------------------- YouTube look


async def fetch_youtube(
    external_id: str, *, client: httpx.AsyncClient | None = None
) -> tuple[video_checks.Probe, str | None, str | None]:
    """(what the look found, the video's own title, its thumbnail address). The address that is
    asked is built by `video_checks.probe_target` from the checked id. A thumbnail is kept only
    when it is an https address on YouTube's own image host."""
    target = video_checks.probe_target(
        "youtube", external_id, f"https://www.youtube.com/watch?v={external_id}"
    )
    if target is None:
        return "unknown", None, None
    own = client is None
    http = client or httpx.AsyncClient(
        timeout=video_checks.TIMEOUT_SECONDS,
        transport=video_checks.transport,
        follow_redirects=False,
    )
    try:
        response = await http.get(target, headers={"Accept": "application/json"})
        body = response.content[:8192]
        result = video_checks.read_answer("youtube", response.status_code, body)
        if result != "ok":
            return result, None, None
        try:
            data = json.loads(body)
        except ValueError:
            return result, None, None
        if not isinstance(data, dict):
            return result, None, None
        title = one_line(data.get("title") if isinstance(data.get("title"), str) else "", 200)
        return result, title or None, _thumbnail(data.get("thumbnail_url"))
    except (TimeoutError, httpx.HTTPError):
        return "unknown", None, None
    finally:
        if own:
            await http.aclose()


def _thumbnail(value: object) -> str | None:
    if not isinstance(value, str) or len(value) > 300:
        return None
    try:
        parts = urlsplit(value)
        port = parts.port
    except ValueError:
        return None
    if parts.scheme != "https" or parts.username or parts.password or port not in (None, 443):
        return None
    if (parts.hostname or "").lower() != YTIMG_HOST:
        return None
    return f"https://{YTIMG_HOST}{quote(parts.path, safe='/')}"


async def enrich(session: AsyncSession, broadcast_id: UUID) -> None:
    """Look at a YouTube broadcast once: its title, thumbnail and whether it still exists / may be
    shown inside the app. Soft: a failed look changes nothing. Never raises."""
    row = await session.get(Broadcast, broadcast_id)
    if row is None or row.provider != "youtube" or row.status != "published" or not row.external_id:
        return
    result, title, thumbnail = await fetch_youtube(row.external_id)
    row.checked_at = now_utc()
    if result == "ok":
        row.link_status, row.check_fails = "ok", 0
        row.fetched_title, row.thumbnail_url = title, thumbnail
    elif result == "no_embed":
        row.link_status, row.check_fails = "no_embed", 0
    elif result == "gone":
        row.check_fails = (row.check_fails or 0) + 1
        if row.check_fails >= video_checks.GONE_TWICE:
            row.link_status = "unavailable"
    await session.commit()


async def enrich_safely(factory, broadcast_id: UUID) -> None:  # type: ignore[no-untyped-def]
    try:
        async with factory() as session:
            await asyncio.wait_for(enrich(session, broadcast_id), timeout=20)
    except Exception:  # noqa: BLE001
        logger.warning("Broadcast look failed for %s", broadcast_id, exc_info=True)
