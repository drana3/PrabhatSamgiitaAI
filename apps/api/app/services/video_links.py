"""Video links of recordings and of Prabhat Samgiita songs (docs/recording-extras.md).

A member pastes a link; the server decides whether it is a single video on an allow-listed site,
rebuilds the stored address from the site and the video's own id, and keeps nothing else. The
pasted text is never fetched (no download, no scraping): the only requests the server makes are
the ones of `services/video_checks.py`, to three fixed hosts, with an address built from the
checked id, so a link cannot make the API call an address of the sender's choosing.

The allow-list is short on purpose (see `PROVIDERS`):

* YouTube: where nearly all kiirtan and Prabhat Samgiita videos are.
* Vimeo: the other common place for a team's own films.
* Internet Archive: stable, permanent addresses; old film and audio that nobody else keeps.

Everything else (Facebook, Instagram, TikTok, short-link services, a site of the sender's own) is
refused, because those need a login, track the viewer, hide where a link really goes, or change
their addresses. Adding a site means adding one entry here and one on the phone.
"""

from __future__ import annotations

import re
from typing import Any
from urllib.parse import parse_qs, urlsplit
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import UserAccount
from app.models.recording_extras import (
    VIDEO_TITLE_MAX_LENGTH,
    VIDEO_URL_MAX_LENGTH,
    VideoLink,
    VideoLinkReport,
)
from app.schemas.recording_extras import AdminVideoOut, VideoOut
from app.schemas.song_comments import CommentAuthor
from app.services.extras_common import (
    AUTHOR_DELETED_BY,
    display_name,
    one_line,
    team_removed_by,
    videos_in_last_day,
)
from app.services.recordings import RateLimiter, now_utc
from app.services.song_comments import link_count

# How many live videos one target (a recording, a song) takes, and one member on one target.
MAX_PER_TARGET = 12
MAX_PER_MEMBER_PER_TARGET = 3
DAILY_VIDEOS = 10
HOURLY_VIDEOS = 5
HOURLY_VIDEOS_TEAM = 60

BAD_LINK_CODE = "video_bad_link"
PROVIDER_CODE = "video_provider"
DUPLICATE_CODE = "video_duplicate"
TEAM_REMOVED_CODE = "video_team_removed"
TARGET_FULL_CODE = "video_target_full"
MEMBER_FULL_CODE = "video_member_full"
DAILY_LIMIT_CODE = "video_daily_limit"

limiter = RateLimiter()

_SPACE = re.compile(r"\s")
_YOUTUBE_ID = re.compile(r"[A-Za-z0-9_-]{11}")
_VIMEO_PATH = re.compile(
    r"/(?:(?:channels/[A-Za-z0-9_-]+|groups/[A-Za-z0-9_-]+/videos|video|album/\d+/video)/)?"
    r"(\d{6,12})(?:/([0-9a-f]{8,12}))?/?"
)
_ARCHIVE_ID = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]{2,99}")

YOUTUBE_HOSTS = frozenset(
    {"youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be"}
)
YOUTUBE_NOCOOKIE = "www.youtube-nocookie.com"
VIMEO_HOSTS = frozenset({"vimeo.com", "www.vimeo.com", "player.vimeo.com"})
ARCHIVE_HOSTS = frozenset({"archive.org", "www.archive.org"})

PROVIDERS = ("youtube", "vimeo", "archive")


class VideoRefusedError(Exception):
    """A link that cannot be stored; `code` is the app's key for the sentence it shows."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


def refusal(error: VideoRefusedError) -> HTTPException:
    return HTTPException(
        status_code=422, detail=error.message, headers={"X-Error-Code": error.code}
    )


def _bad(message: str = "That does not look like a link to one video.") -> VideoRefusedError:
    return VideoRefusedError(BAD_LINK_CODE, message)


def parse_video_url(raw: str) -> tuple[str, str, str]:
    """(provider, external id, normalised url) of a pasted link, or `VideoRefusedError`.

    https only (a link typed without a scheme is read as https). No user name, no port, no
    non-ASCII host (a look-alike domain is not YouTube). Only a single video: a channel, a playlist,
    a search page or a profile is refused. Tracking parameters, fragments and the time stamp are
    dropped; the stored address is rebuilt from the provider and the id.
    """
    text = (raw or "").strip()
    if not text or len(text) > VIDEO_URL_MAX_LENGTH + 200:
        raise _bad()
    if _SPACE.search(text) or any(ord(c) < 32 or ord(c) == 127 for c in text):
        raise _bad()
    if "://" not in text:
        if text.lower().startswith(("javascript:", "data:", "file:", "mailto:", "intent:")):
            raise _bad()
        text = "https://" + text.lstrip("/")
    try:
        parts = urlsplit(text)
    except ValueError as exc:
        raise _bad() from exc
    if parts.scheme.lower() != "https":
        raise VideoRefusedError(BAD_LINK_CODE, "Only https links are accepted.")
    if "@" in parts.netloc:
        raise _bad()
    try:
        port = parts.port
    except ValueError as exc:
        raise _bad() from exc
    if port not in (None, 443):
        raise _bad()
    host = (parts.hostname or "").lower().rstrip(".")
    if not host or not host.isascii():
        raise _bad()

    if host in YOUTUBE_HOSTS or host == YOUTUBE_NOCOOKIE:
        video_id = _youtube_id(host, parts.path, parts.query)
        return "youtube", video_id, f"https://www.youtube.com/watch?v={video_id}"
    if host in VIMEO_HOSTS:
        match = _VIMEO_PATH.fullmatch(parts.path)
        if not match:
            raise _bad()
        video_id, unlisted = match.group(1), match.group(2)
        url = f"https://vimeo.com/{video_id}" + (f"/{unlisted}" if unlisted else "")
        return "vimeo", video_id, url
    if host in ARCHIVE_HOSTS:
        segments = [s for s in parts.path.split("/") if s]
        if len(segments) < 2 or segments[0] != "details" or not _ARCHIVE_ID.fullmatch(segments[1]):
            raise _bad()
        return "archive", segments[1], f"https://archive.org/details/{segments[1]}"
    raise VideoRefusedError(
        PROVIDER_CODE,
        "Links from this site are not accepted. Use YouTube, Vimeo or the Internet Archive.",
    )


def _youtube_id(host: str, path: str, query: str) -> str:
    segments = [s for s in path.split("/") if s]
    candidate = ""
    if host == "youtu.be":
        candidate = segments[0] if len(segments) == 1 else ""
    elif segments[:1] == ["watch"]:
        candidate = (parse_qs(query).get("v") or [""])[0]
    elif len(segments) == 2 and segments[0] in ("embed", "shorts", "live", "v"):
        candidate = segments[1]
    if not _YOUTUBE_ID.fullmatch(candidate):
        raise _bad()
    return candidate


def clean_title(raw: str | None) -> str | None:
    """The optional short title: invisible characters gone, spaces collapsed, no link, <= 80."""
    title = one_line(raw, VIDEO_TITLE_MAX_LENGTH + 40)
    if not title:
        return None
    if len(title) > VIDEO_TITLE_MAX_LENGTH:
        raise HTTPException(
            status_code=422,
            detail=f"Keep the title to {VIDEO_TITLE_MAX_LENGTH} characters.",
        )
    if link_count(title) > 0:
        raise HTTPException(status_code=422, detail="Leave links out of the title.")
    return title


def target_key_song(song_id: int) -> str:
    return f"song:{song_id}"


def target_key_recording(recording_id: UUID) -> str:
    return f"recording:{recording_id}"


def public_out(
    video: VideoLink, author: UserAccount | None, *, viewer_id: UUID | None, team: bool
) -> VideoOut:
    """What every reader gets. `author` is filled only for a NAMED link."""
    shown = None
    if not video.is_anonymous and author is not None:
        shown = CommentAuthor(name=display_name(author), avatar_url=author.avatar_url)
    return VideoOut(
        id=str(video.id),
        provider=video.provider,  # type: ignore[arg-type]
        url=video.url,
        title=video.title,
        created_at=video.created_at,
        is_anonymous=video.is_anonymous,
        author=shown,
        mine=viewer_id is not None and video.member_id == viewer_id,
        can_remove=team,
        link_status=video.link_status or "unknown",  # type: ignore[arg-type]
    )


def admin_out(video: VideoLink, author: UserAccount | None) -> AdminVideoOut:
    return AdminVideoOut(
        id=str(video.id),
        song_id=video.song_id,
        recording_id=str(video.recording_id) if video.recording_id else None,
        provider=video.provider,  # type: ignore[arg-type]
        url=video.url,
        title=video.title,
        created_at=video.created_at,
        is_anonymous=video.is_anonymous,
        status=video.status,  # type: ignore[arg-type]
        reports_count=video.reports_count,
        author_id=video.member_id,
        author_name=display_name(author),
        removed_reason=video.removed_reason,
        removed_by=video.removed_by,
        link_status=video.link_status or "unknown",  # type: ignore[arg-type]
        checked_at=video.checked_at,
    )


async def list_published(
    session: AsyncSession, target_key: str
) -> list[tuple[VideoLink, UserAccount | None]]:
    """The live videos of one target, oldest first (the first one added keeps its place)."""
    rows = (
        await session.execute(
            select(VideoLink, UserAccount)
            .join(UserAccount, UserAccount.id == VideoLink.member_id, isouter=True)
            .where(VideoLink.target_key == target_key, VideoLink.status == "published")
            .order_by(VideoLink.created_at.asc(), VideoLink.id.asc())
        )
    ).all()
    return [(v, a) for v, a in rows]


async def ensure_daily_allowance(
    session: AsyncSession, member_id: UUID, *, team: bool, limit: int = DAILY_VIDEOS
) -> None:
    """At most DAILY_VIDEOS in 24 hours; removed and deleted ones count (QA-009)."""
    if team:
        return
    if await videos_in_last_day(session, member_id) >= limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"You can add up to {limit} videos a day. Please come back tomorrow.",
            headers={"X-Error-Code": DAILY_LIMIT_CODE},
        )


async def create_video(
    session: AsyncSession,
    *,
    member: UserAccount,
    target_key: str,
    song_id: int | None,
    recording_id: UUID | None,
    provider: str,
    external_id: str,
    url: str,
    title: str | None,
    is_anonymous: bool,
    team: bool,
) -> VideoLink:
    """Store a checked link. Every check that can refuse comes BEFORE the hourly allowance."""
    await ensure_daily_allowance(session, member.id, team=team)
    same = (
        await session.scalars(
            select(VideoLink).where(
                VideoLink.target_key == target_key,
                VideoLink.provider == provider,
                VideoLink.external_id == external_id,
            )
        )
    ).all()
    if any(v.status == "published" for v in same):
        raise HTTPException(
            status_code=409,
            detail="This video is already on the list.",
            headers={"X-Error-Code": DUPLICATE_CODE},
        )
    if any(v.status == "removed" and v.removed_by != AUTHOR_DELETED_BY for v in same):
        # the team took this very video down here: it is not added again by anyone
        raise HTTPException(
            status_code=409,
            detail="The team removed this video from here.",
            headers={"X-Error-Code": TEAM_REMOVED_CODE},
        )
    live = (
        await session.scalars(
            select(VideoLink).where(
                VideoLink.target_key == target_key, VideoLink.status == "published"
            )
        )
    ).all()
    if len(live) >= MAX_PER_TARGET:
        raise HTTPException(
            status_code=409,
            detail=f"There are already {MAX_PER_TARGET} videos here. Remove one first.",
            headers={"X-Error-Code": TARGET_FULL_CODE},
        )
    if not team and sum(1 for v in live if v.member_id == member.id) >= MAX_PER_MEMBER_PER_TARGET:
        raise HTTPException(
            status_code=409,
            detail=f"You already added {MAX_PER_MEMBER_PER_TARGET} videos here.",
            headers={"X-Error-Code": MEMBER_FULL_CODE},
        )
    limiter.hit(
        "add",
        str(member.id),
        limit=HOURLY_VIDEOS_TEAM if team else HOURLY_VIDEOS,
        window_seconds=3600,
    )
    video = VideoLink(
        song_id=song_id,
        recording_id=recording_id,
        target_key=target_key,
        member_id=member.id,
        provider=provider,
        external_id=external_id,
        url=url,
        title=title,
        is_anonymous=is_anonymous,
    )
    session.add(video)
    await session.commit()
    await session.refresh(video)
    return video


async def add_report(
    session: AsyncSession,
    *,
    video: VideoLink,
    reporter_key: str,
    reporter_id: UUID | None,
    reason: str,
    note: str | None,
) -> bool:
    already = await session.scalar(
        select(VideoLinkReport.id).where(
            VideoLinkReport.video_id == video.id, VideoLinkReport.reporter_key == reporter_key
        )
    )
    if already is not None:
        return False
    session.add(
        VideoLinkReport(
            video_id=video.id,
            reporter_key=reporter_key,
            reporter_id=reporter_id,
            reason=reason,
            note=one_line(note, 1000) or None,
        )
    )
    video.reports_count = (video.reports_count or 0) + 1
    await session.commit()
    return True


async def remove_by_team(session: AsyncSession, video: VideoLink, *, reason: str, by: str) -> None:
    video.status = "removed"
    video.removed_reason = one_line(reason, 500) or None
    video.removed_at = now_utc()
    video.removed_by = team_removed_by(by)
    await session.commit()


async def delete_by_author(session: AsyncSession, video: VideoLink) -> bool:
    """The author deletes their own link. False when there is nothing to delete.

    It disappears at once. The row stays, marked removed by `author` with the title and the address
    wiped, so the daily allowance is not given back; a link the TEAM removed is left as it is."""
    if video.status == "removed":
        return video.removed_by != AUTHOR_DELETED_BY
    video.status = "removed"
    video.removed_reason = None
    video.removed_at = now_utc()
    video.removed_by = AUTHOR_DELETED_BY
    video.title = None
    video.url = ""
    video.external_id = ""
    await session.commit()
    return True


async def keep(session: AsyncSession, video: VideoLink) -> None:
    """The team looked at the reports and the link stays: the reports leave the queue. A link that
    is not live (removed, or deleted by its author) has nothing to keep."""
    if video.status != "published":
        raise HTTPException(status_code=409, detail="Only a live video can be kept.")
    video.reports_count = 0
    await session.commit()


async def restore(session: AsyncSession, video: VideoLink) -> None:
    """Removed by the team -> published again (a mistake). Refused when the same video is live
    already, or the target is full."""
    if video.status != "removed" or video.removed_by == AUTHOR_DELETED_BY:
        raise HTTPException(
            status_code=409, detail="Only a video the team removed can be restored."
        )
    live = (
        await session.scalars(
            select(VideoLink).where(
                VideoLink.target_key == video.target_key, VideoLink.status == "published"
            )
        )
    ).all()
    if any(v.provider == video.provider and v.external_id == video.external_id for v in live):
        raise HTTPException(
            status_code=409,
            detail="This video is on the list again already.",
            headers={"X-Error-Code": DUPLICATE_CODE},
        )
    if len(live) >= MAX_PER_TARGET:
        raise HTTPException(
            status_code=409,
            detail=f"There are already {MAX_PER_TARGET} videos here.",
            headers={"X-Error-Code": TARGET_FULL_CODE},
        )
    video.status = "published"
    video.removed_reason = None
    video.removed_at = None
    video.removed_by = None
    await session.commit()


async def review_queue(
    session: AsyncSession, *, which: str, limit: int, offset: int
) -> tuple[list[tuple[VideoLink, UserAccount | None]], int]:
    """reported = live and reported (most reported first); removed = taken down by the team;
    all. Author-deleted rows are not for the team to read, they never show."""
    conditions: list[Any] = [
        (VideoLink.status == "published") | (VideoLink.removed_by != AUTHOR_DELETED_BY)
    ]
    if which == "reported":
        conditions = [VideoLink.status == "published", VideoLink.reports_count > 0]
    elif which == "removed":
        conditions = [VideoLink.status == "removed", VideoLink.removed_by != AUTHOR_DELETED_BY]
    total = await session.scalar(select(func.count()).select_from(VideoLink).where(*conditions))
    order = (
        (VideoLink.reports_count.desc(), VideoLink.created_at.desc())
        if which == "reported"
        else (VideoLink.created_at.desc(),)
    )
    rows = (
        await session.execute(
            select(VideoLink, UserAccount)
            .join(UserAccount, UserAccount.id == VideoLink.member_id, isouter=True)
            .where(*conditions)
            .order_by(*order)
            .limit(limit)
            .offset(offset)
        )
    ).all()
    return [(v, a) for v, a in rows], int(total or 0)
