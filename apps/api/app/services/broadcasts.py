"""Broadcasts: link rules, state, limits and moderation (docs/broadcasts.md).

The pasted address is NEVER fetched. It is read as a URL (`urlsplit`, exact host names, no pattern
matching on the text), classified by its host, and rebuilt. The only requests the server makes are
the YouTube oEmbed look of `video_checks` (a fixed host, an address built from the checked video
id), for a YouTube broadcast. Zoom, Facebook, Instagram and every other site are only ever stored
and opened by the person in their own browser or app: the phone never loads them in a web view.

A broadcast can last days (a continuous Kiirtan of 7 to 10 days is an ordinary one), so there is
no assumed length. State (`phase`), worked out when read, never stored:

* upcoming  the start is in the future (or YouTube says the stream is announced, not begun)
* now       the start has come and the broadcast has not ended. A broadcast without a start counts
            as "now" from the moment it was posted. For a Zoom room nobody checks that it is
            really open: "now" means "by the clock of the organizer", and the page says so. For a
            YouTube link and with a key (services/youtube_status.py) it means "YouTube says live"
* ended     the author or the team said "it is over"; or YouTube reported the end; or the end the
            organizer announced came; or, with no end announced, MAX_DURATION passed since the
            start. Nothing is "on" longer than MAX_DURATION

Archive: ARCHIVE_AFTER after the ACTUAL end (whichever of the above came) a broadcast leaves every
public list and its page is closed to everybody but its author and the team ("My broadcasts" keeps
it), unless it has a recording that was accepted (services/broadcast_recordings.py).
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
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.models import UserAccount
from app.models.broadcasts import (
    BROADCAST_DESCRIPTION_MAX_LENGTH,
    BROADCAST_ORGANIZER_MAX_LENGTH,
    BROADCAST_TITLE_MAX_LENGTH,
    BROADCAST_URL_MAX_LENGTH,
    Broadcast,
    BroadcastRecording,
    BroadcastReport,
)
from app.schemas.broadcasts import BroadcastOut, BroadcastRecordingOut
from app.services import video_checks, youtube_status
from app.services.extras_common import AUTHOR_DELETED_BY, one_line
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

# The longest a broadcast is "on": a continuous Kiirtan of 7 to 10 days fits with room to spare.
# An end announced later than this is refused; with no end announced it ends here by itself.
MAX_DURATION = timedelta(days=14)
ARCHIVE_AFTER = timedelta(days=7)
# A look of the YouTube Data API older than this is not trusted any more (the clock rules again).
YT_FRESH = timedelta(minutes=10)
# After the clock says "ended", YouTube is still asked this long (a stream can run past the end
# the organizer announced), and an announced stream is asked about from this far ahead.
YT_RECHECK_AFTER_END = timedelta(hours=6)
YT_LOOK_AHEAD = timedelta(days=3)
STARTED_AGO_MAX = timedelta(hours=6)
FAR_AHEAD_MAX = timedelta(days=365)
# Reports that hide a broadcast from the public lists until the team has looked at it.
# A broadcast is hidden from the lists when the reports that count reach this weight: two from
# established members, or one from the team (it weighs this much). Anonymous reports and those of
# accounts younger than MEMBER_REPORT_MIN_AGE are stored and shown to the team but weigh nothing,
# so a few addresses or fresh accounts cannot take down somebody else's broadcast.
REPORTS_HIDE = 2
MEMBER_REPORT_MIN_AGE = timedelta(days=3)
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


def _to_utc(value: datetime, zone: str | None) -> datetime:
    """A time with an offset is taken as it is; one without needs the zone it was meant in."""
    if value.tzinfo is None:
        if zone is None:
            raise HTTPException(
                status_code=422, detail="Say in which time zone the time is, or give an offset."
            )
        try:
            from zoneinfo import ZoneInfo

            value = value.replace(tzinfo=ZoneInfo(zone))
        except Exception as exc:  # noqa: BLE001  (an unknown name, or no zone data on the server)
            raise HTTPException(status_code=422, detail="Unknown time zone.") from exc
    return value.astimezone(UTC)


def resolve_start(
    starts_at: datetime | None, zone: str | None, *, now: datetime | None = None
) -> tuple[datetime | None, str | None]:
    """(UTC start, zone name). A time without an offset needs the zone it was meant in."""
    name = clean_zone(zone)
    if starts_at is None:
        return None, None
    moment = now or now_utc()
    utc = _to_utc(starts_at, name)
    if utc < moment - STARTED_AGO_MAX:
        raise HTTPException(status_code=422, detail="That start is already in the past.")
    if utc > moment + FAR_AHEAD_MAX:
        raise HTTPException(
            status_code=422, detail="Start dates more than a year ahead are not taken."
        )
    return utc, name or "UTC"


def resolve_end(
    ends_at: datetime | None,
    zone: str | None,
    *,
    starts_at: datetime | None,
    now: datetime | None = None,
) -> datetime | None:
    """The end the organizer announced, in UTC, or None. It must come after the start (after now,
    when there is no start: the broadcast then begins when it is posted) and at most MAX_DURATION
    after it."""
    if ends_at is None:
        return None
    moment = now or now_utc()
    utc = _to_utc(ends_at, clean_zone(zone))
    begin = starts_at or moment
    if starts_at is not None and utc <= starts_at:
        raise HTTPException(status_code=422, detail="The end must come after the start.")
    if utc <= moment:
        raise HTTPException(status_code=422, detail="That end is already in the past.")
    if utc > begin + MAX_DURATION:
        days = MAX_DURATION.days
        raise HTTPException(
            status_code=422, detail=f"A broadcast can last up to {days} days from its start."
        )
    return utc


# --------------------------------------------------------------------------- state


def _aware(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=UTC)


def begins_at(b: Broadcast) -> datetime:
    return _aware(b.starts_at) if b.starts_at else _aware(b.created_at)


def _yt_fresh(b: Broadcast, moment: datetime) -> bool:
    return b.yt_checked_at is not None and moment - _aware(b.yt_checked_at) <= YT_FRESH


def _yt_says(b: Broadcast, moment: datetime) -> str | None:
    """ "live" or "upcoming" when a recent look of the YouTube API said so, else None."""
    if b.yt_state in ("live", "upcoming") and _yt_fresh(b, moment):
        return b.yt_state
    return None


def last_moment(b: Broadcast) -> datetime:
    """The latest a broadcast can be "on": MAX_DURATION after its start."""
    return begins_at(b) + MAX_DURATION


def ends_at(b: Broadcast, *, now: datetime | None = None) -> datetime:
    """When it ended or, while it still goes on, when it is taken to end. The first that holds:
    "it is over", the end YouTube reported, the end YouTube's live look overrides (a stream that
    runs past the announced end goes on, up to the limit), the announced end, the limit."""
    moment = now or now_utc()
    cap = last_moment(b)
    if b.ended_at:
        return min(_aware(b.ended_at), cap)
    if b.yt_ended_at:
        return min(_aware(b.yt_ended_at), cap)
    if _yt_says(b, moment) == "live" or not b.declared_ends_at:
        return cap
    return min(_aware(b.declared_ends_at), cap)


def phase(b: Broadcast, *, now: datetime | None = None) -> str:
    moment = now or now_utc()
    if b.ended_at and _aware(b.ended_at) <= moment:
        return "ended"
    if b.yt_ended_at and _aware(b.yt_ended_at) <= moment:
        return "ended"
    says = _yt_says(b, moment)
    if says == "upcoming":
        return "upcoming"
    if says == "live":
        return "now" if moment < last_moment(b) else "ended"
    if moment < begins_at(b):
        return "upcoming"
    return "now" if moment < ends_at(b, now=moment) else "ended"


def live_source(b: Broadcast, *, now: datetime | None = None) -> str:
    """ "youtube" when YouTube's own word decides the state, "clock" when the organizer's clock."""
    moment = now or now_utc()
    if b.yt_ended_at or _yt_says(b, moment):
        return "youtube"
    return "clock"


def is_archived(b: Broadcast, *, now: datetime | None = None) -> bool:
    moment = now or now_utc()
    return phase(b, now=moment) == "ended" and moment >= ends_at(b, now=moment) + ARCHIVE_AFTER


def hidden_by_reports(b: Broadcast) -> bool:
    return (b.reports_count or 0) >= REPORTS_HIDE


def is_hidden(b: Broadcast) -> bool:
    """Off the public lists: by the team's "Hide", or by the reports that count."""
    return b.hidden_at is not None or hidden_by_reports(b)


def can_see(
    b: Broadcast,
    *,
    owner: bool,
    team: bool,
    now: datetime | None = None,
    has_recording: bool = False,
) -> bool:
    """Who may read a broadcast: everybody while it is live and in its week after the end; only
    its author and the team once it is removed, hidden, or archived. An archived one that has an
    accepted recording stays readable by its address (it is on no list), so that the recording
    can still be found."""
    if b.status == "removed" and b.removed_by == AUTHOR_DELETED_BY:
        return False  # the author deleted it: nobody reads it, not even the author
    if owner or team:
        return True
    if b.status != "published" or is_hidden(b):
        return False
    return not is_archived(b, now=now) or has_recording


def public_out(
    b: Broadcast,
    *,
    viewer_id: UUID | None,
    team: bool,
    now: datetime | None = None,
    recordings: list[BroadcastRecordingOut] | None = None,
    recording_action: str | None = None,
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
        ends_at=ends_at(b, now=moment),
        ends_declared=b.declared_ends_at is not None,
        live_source=live_source(b, now=moment),  # type: ignore[arg-type]
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
        hidden=is_hidden(b) if (mine or team) else None,
        recordings=recordings or [],
        recording_action=recording_action,  # type: ignore[arg-type]
    )


# --------------------------------------------------------------------------- reading


def _order_key(b: Broadcast, moment: datetime) -> tuple[int, float]:
    # live first (the oldest start first), then upcoming (the nearest first)
    kind = 0 if phase(b, now=moment) == "now" else 1
    return kind, begins_at(b).timestamp()


def _needs_look(b: Broadcast, moment: datetime, ttl: timedelta) -> bool:
    """Is a YouTube look due for this broadcast? Not when it is over for good, far in the future,
    long past, or was looked at within the cache time."""
    if b.provider != "youtube" or not b.external_id or b.status != "published":
        return False
    if b.ended_at or b.yt_ended_at:
        return False
    if begins_at(b) > moment + YT_LOOK_AHEAD or moment > last_moment(b):
        return False
    clock_end = min(_aware(b.declared_ends_at), last_moment(b)) if b.declared_ends_at else None
    if clock_end is not None and moment > clock_end + YT_RECHECK_AFTER_END:
        return False
    return b.yt_checked_at is None or moment - _aware(b.yt_checked_at) >= ttl


async def refresh_status(
    session: AsyncSession,
    rows: list[Broadcast],
    settings: Settings | None,
    *,
    now: datetime | None = None,
) -> None:
    """Ask the YouTube Data API about the YouTube broadcasts that are due, in ONE batched call per
    50, and keep the answer on the rows (the cache). Without a key, or when anything goes wrong,
    nothing changes and the clock rules. Never raises."""
    if settings is None or not youtube_status.is_on(settings):
        return
    moment = now or now_utc()
    ttl = timedelta(seconds=settings.youtube_status_ttl_seconds)
    due = [b for b in rows if _needs_look(b, moment, ttl)]
    if not due:
        return
    try:
        facts = await youtube_status.look([b.external_id for b in due], settings, now=moment)
        for b in due:
            got = facts.get(b.external_id)
            if got is None:
                continue  # not asked (ceiling, failure): the old answer stays
            b.yt_checked_at = moment
            b.yt_state, b.yt_started_at, b.yt_ended_at = got.state, got.started, got.ended
            if got.ended is not None:
                await _add_youtube_recording(session, b)
        await session.commit()
    except Exception as exc:  # noqa: BLE001
        await session.rollback()
        logger.warning("YouTube status could not be kept: %s", type(exc).__name__)


async def _add_youtube_recording(session: AsyncSession, b: Broadcast) -> None:
    """The stream is over: on YouTube the same video stays as the recording. Added once."""
    have = await session.scalar(
        select(BroadcastRecording.id).where(
            BroadcastRecording.broadcast_id == b.id, BroadcastRecording.source == "youtube"
        )
    )
    if have is None:
        session.add(
            BroadcastRecording(
                broadcast_id=b.id,
                kind="link",
                provider="youtube",
                url=b.url,
                host=b.host,
                status="accepted",
                source="youtube",
            )
        )


async def list_public(
    session: AsyncSession,
    *,
    which: str,
    limit: int = 40,
    now: datetime | None = None,
    settings: Settings | None = None,
) -> list[Broadcast]:
    """`shelf`: live and upcoming. `recent`: those and the ones that ended less than a week ago
    (newest end first, after the live ones). Hidden, removed and archived ones never show."""
    moment = now or now_utc()
    rows = list(
        (
            await session.scalars(
                select(Broadcast)
                .where(
                    Broadcast.status == "published",
                    Broadcast.reports_count < REPORTS_HIDE,
                    Broadcast.hidden_at.is_(None),
                )
                .order_by(Broadcast.created_at.desc())
                .limit(500)
            )
        ).all()
    )
    await refresh_status(session, rows, settings, now=moment)
    live = [b for b in rows if phase(b, now=moment) in ("now", "upcoming")]
    live.sort(key=lambda b: _order_key(b, moment))
    if which == "shelf":
        return live[:limit]
    ended = [b for b in rows if phase(b, now=moment) == "ended" and not is_archived(b, now=moment)]
    ended.sort(key=lambda b: ends_at(b, now=moment), reverse=True)
    return (live + ended)[:limit]


async def list_mine(
    session: AsyncSession,
    member_id: UUID,
    limit: int = 100,
    *,
    settings: Settings | None = None,
) -> list[Broadcast]:
    rows = list(
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
    await refresh_status(session, rows, settings)
    return rows


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
    ends_at: datetime | None = None,
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
        declared_ends_at=ends_at,
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
    row.hidden_reason = None
    # the links to its recordings go; the recordings themselves are ordinary library recordings
    # of the people who uploaded them and stay
    await session.execute(
        delete(BroadcastRecording).where(BroadcastRecording.broadcast_id == row.id)
    )
    await session.commit()


def anonymous_key(host: str) -> str:
    """The key of an anonymous reporter: the address, or for IPv6 its /64 network (one home or
    one rented block holds billions of addresses). Not an address at all: the host text, cut."""
    try:
        address = ipaddress.ip_address(host)
    except ValueError:
        return f"anon:{host}"[:80]
    if address.version == 6:
        network = ipaddress.ip_network(f"{address}/64", strict=False)
        return f"anon:{network.network_address}/64"[:80]
    return f"anon:{address}"


def report_weight(*, member: UserAccount | None, team: bool, now: datetime | None = None) -> int:
    """What a report adds to the hiding count: the team hides at once, an established member
    counts one, an anonymous reader or a fresh account nothing."""
    if team:
        return REPORTS_HIDE
    if member is None:
        return 0
    created = member.created_at
    if created is None:
        return 0
    if created.tzinfo is None:
        created = created.replace(tzinfo=UTC)
    return 1 if (now or now_utc()) - created >= MEMBER_REPORT_MIN_AGE else 0


async def counted_weight(session: AsyncSession, row: Broadcast) -> int:
    """What the reports that the team has not yet judged add up to: each person counts once, with
    the largest weight of their open reports."""
    best: dict[str, int] = {}
    for key, weight in (
        await session.execute(
            select(BroadcastReport.reporter_key, BroadcastReport.weight).where(
                BroadcastReport.broadcast_id == row.id, BroadcastReport.cleared_at.is_(None)
            )
        )
    ).all():
        best[key] = max(best.get(key, 0), weight or 0)
    return sum(best.values())


async def add_report(
    session: AsyncSession,
    *,
    row: Broadcast,
    reporter_key: str,
    reporter_id: UUID | None,
    reason: str,
    note: str | None,
    weight: int = 0,
) -> bool:
    """One report per person and reason. A report the team already judged ("Keep") still blocks
    the same person from sending the same reason again; another reason, or another person, is
    new, and only the new ones count towards hiding."""
    already = await session.scalar(
        select(BroadcastReport.id).where(
            BroadcastReport.broadcast_id == row.id,
            BroadcastReport.reporter_key == reporter_key,
            BroadcastReport.reason == reason,
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
            weight=weight,
        )
    )
    await session.flush()
    row.reports_count = await counted_weight(session, row)
    await session.commit()
    return True


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
