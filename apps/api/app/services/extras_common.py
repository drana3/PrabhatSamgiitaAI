"""Pieces the three recording extras share (comments, chord sheets, video links).

docs/recording-extras.md. Text rules (invisible characters, links, "the same text") are NOT repeated
here: they are the song comments' own functions (`services/song_comments.py`), imported by every
extra, so one fix reaches all of them.
"""

from __future__ import annotations

import re
from datetime import timedelta
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import UserAccount
from app.models.recording_extras import (
    RecordingComment,
    VideoLink,
)
from app.models.recordings import PS_SONG_COUNT, Recording
from app.services.recordings import VISIBLE, clean_text, now_utc
from app.services.song_comments import FALLBACK_NAME, strip_invisible

# What the author's own delete writes into `removed_by`. It starts with a control character, which
# `team_removed_by` strips from every name a team removal records, so no display name (however it
# was chosen) can ever equal it: a team removal can never pass for an author delete (QA-056).
AUTHOR_DELETED_BY = "\x1fauthor"
_CONTROL = re.compile(r"[\x00-\x1f\x7f]")


def team_removed_by(name: str | None, fallback: str = "team") -> str:
    """The `removed_by` of a team removal: the member's name, never equal to the author marker."""
    return _CONTROL.sub("", name or "").strip()[:255] or fallback


def check_song(song_id: int) -> int:
    if not 1 <= song_id <= PS_SONG_COUNT:
        raise HTTPException(status_code=422, detail="Unknown song number.")
    return song_id


async def visible_recording(session: AsyncSession, recording_id: UUID) -> Recording:
    """A recording people can see (published or flagged). A removed or unknown one is a plain 404:
    nobody learns that a removed recording ever existed."""
    recording = await session.get(Recording, recording_id)
    if recording is None or recording.status not in VISIBLE:
        raise HTTPException(status_code=404, detail="Recording not found")
    return recording


def one_line(raw: str | None, limit: int) -> str:
    """Short free text (a title, a note, a reason): invisible characters gone, spaces collapsed."""
    return clean_text(strip_invisible(raw or ""), limit)


def display_name(member: UserAccount | None) -> str:
    """The name shown beside a named item. An address is never shown as a name."""
    if member is None:
        return FALLBACK_NAME
    name = one_line(member.display_name, 80)
    return FALLBACK_NAME if not name or "@" in name else name


async def comments_in_last_day(session: AsyncSession, member_id: UUID) -> int:
    since = now_utc() - timedelta(hours=24)
    total = await session.scalar(
        select(func.count())
        .select_from(RecordingComment)
        .where(RecordingComment.member_id == member_id, RecordingComment.created_at >= since)
    )
    return int(total or 0)


async def videos_in_last_day(session: AsyncSession, member_id: UUID) -> int:
    since = now_utc() - timedelta(hours=24)
    total = await session.scalar(
        select(func.count())
        .select_from(VideoLink)
        .where(VideoLink.member_id == member_id, VideoLink.created_at >= since)
    )
    return int(total or 0)
