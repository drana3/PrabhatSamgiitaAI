"""Top Played: which recordings and songs were listened to most, from the COUNTED plays only.

Source of truth (nothing new is counted here, see docs/radio-mixing.md):

* a recording's plays are `play_daily` (services/author_stats.py: 30 seconds or half of a short
  track, one per listener per recording per day, the signed-out caps per client);
* a catalogue song's plays are `song_play_daily` (services/song_plays.py: the same rule and caps).

The legacy `recordings.plays` counter (a bare "someone opened it") is NOT used: it has no threshold.
A period is a window of whole UTC days ending today ("7d" = today and the 6 days before).
Items under TOP_MIN_PLAYS counted plays are not listed: a list of "1 play" entries says nothing
and one person could make a whole list alone.
"""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any
from uuid import UUID

from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.author_profiles import PlayDaily
from app.models.recordings import (
    PS_SONG_COUNT,
    RECORDING_KINDS,
    Recording,
    public_kind,
    stored_kinds,
)
from app.models.song import Song
from app.models.song_plays import SongPlayDaily
from app.schemas.top_played import Period, TopPlayedItem, TopPlayedPage
from app.services import author_stats as stats
from app.services import play_fraud
from app.services.recordings import VISIBLE, recording_out

# One place for each number.
TOP_MIN_PLAYS = 5
PERIOD_DAYS: dict[str, int | None] = {"all": None, "30d": 30, "7d": 7}
MAX_LIMIT = 100

PS_KIND = "prabhat_samgiita"


def period_start(period: Period, today: date) -> date | None:
    days = PERIOD_DAYS[period]
    return None if days is None else today - timedelta(days=days - 1)


def clean_kinds(kinds: list[str] | None) -> list[str]:
    """Only real kinds, in the app's order, no repeats; empty means "every kind"."""
    wanted = {public_kind(k) for k in (kinds or [])}
    return [k for k in RECORDING_KINDS if k in wanted]


def _recording_query(start: date | None, kinds: list[str]) -> Select[Any]:
    # Plays held back by services/play_fraud.py are not shown here either: they are subtracted
    # per recording (for the same period), both in the number and in the minimum below.
    held = play_fraud.held_per_recording(since=start)
    shown = func.sum(PlayDaily.plays) - func.coalesce(func.max(held.c.held), 0)
    plays = shown.label("plays")
    query = (
        select(PlayDaily.recording_id, plays)
        .join(Recording, Recording.id == PlayDaily.recording_id)
        .outerjoin(held, held.c.recording_id == PlayDaily.recording_id)
        .where(Recording.status.in_(VISIBLE))
    )
    if start is not None:
        query = query.where(PlayDaily.day >= start)
    if kinds:
        stored = [s for k in kinds for s in stored_kinds(k)]
        query = query.where(Recording.kind.in_(stored))
    return query.group_by(PlayDaily.recording_id).having(shown >= TOP_MIN_PLAYS)


def _song_query(start: date | None) -> Select[Any]:
    plays = func.sum(SongPlayDaily.plays).label("plays")
    query = select(SongPlayDaily.song_number, plays)
    if start is not None:
        query = query.where(SongPlayDaily.day >= start)
    return query.group_by(SongPlayDaily.song_number).having(
        func.sum(SongPlayDaily.plays) >= TOP_MIN_PLAYS
    )


async def top_played(
    session: AsyncSession,
    *,
    period: Period = "all",
    kinds: list[str] | None = None,
    limit: int = 30,
    offset: int = 0,
    today: date | None = None,
) -> TopPlayedPage:
    today = today or stats.now_utc().date()
    limit = max(1, min(limit, MAX_LIMIT))
    offset = max(0, offset)
    chosen = clean_kinds(kinds)
    start = period_start(period, today)
    take = offset + limit + 1  # one more than the page, to know if there is a next page

    rec_sub = _recording_query(start, chosen).subquery()
    rec_rows = (
        await session.execute(
            select(rec_sub.c.recording_id, rec_sub.c.plays)
            .order_by(rec_sub.c.plays.desc(), rec_sub.c.recording_id)
            .limit(take)
        )
    ).all()
    total = int(await session.scalar(select(func.count()).select_from(rec_sub)) or 0)

    song_rows: list[Any] = []
    if not chosen or PS_KIND in chosen:
        song_sub = _song_query(start).subquery()
        song_rows = list(
            (
                await session.execute(
                    select(song_sub.c.song_number, song_sub.c.plays)
                    .where(song_sub.c.song_number.between(1, PS_SONG_COUNT))
                    .order_by(song_sub.c.plays.desc(), song_sub.c.song_number)
                    .limit(take)
                )
            ).all()
        )
        total += int(await session.scalar(select(func.count()).select_from(song_sub)) or 0)

    merged: list[tuple[int, str, str]] = []  # (plays, tie-break key, ref)
    for row in rec_rows:
        merged.append((int(row.plays), f"rec:{row.recording_id}", "rec"))
    for row in song_rows:
        merged.append((int(row.plays), f"ps:{row.song_number:05d}", "ps"))
    merged.sort(key=lambda m: (-m[0], m[1]))
    page = merged[offset : offset + limit]

    rec_ids = [UUID(m[1][4:]) for m in page if m[2] == "rec"]
    recordings: dict[str, Recording] = {}
    if rec_ids:
        found = (await session.scalars(select(Recording).where(Recording.id.in_(rec_ids)))).all()
        recordings = {str(r.id): r for r in found}
    numbers = [int(m[1][3:]) for m in page if m[2] == "ps"]
    titles: dict[int, str] = {}
    if numbers:
        titles = {
            int(n): str(t)
            for n, t in (
                await session.execute(
                    select(Song.number, Song.title).where(Song.number.in_(numbers))
                )
            ).all()
        }

    since = await stats.stats_since(session)
    items: list[TopPlayedItem] = []
    for index, (plays, key, ref) in enumerate(page):
        rank = offset + index + 1
        if ref == "rec":
            rec = recordings.get(key[4:])
            if rec is None:  # removed between the two reads: skip it
                continue
            items.append(
                TopPlayedItem(
                    rank=rank,
                    ref="rec",
                    id=key[4:],
                    kind=public_kind(rec.kind),
                    title=rec.title,
                    author=rec.author,
                    plays=plays,
                    recording=recording_out(rec),
                )
            )
        else:
            number = int(key[3:])
            items.append(
                TopPlayedItem(
                    rank=rank,
                    ref="ps",
                    id=str(number),
                    kind=PS_KIND,
                    title=titles.get(number) or f"Prabhat Samgiita {number}",
                    author="",
                    plays=plays,
                    song_number=number,
                )
            )
    return TopPlayedPage(
        period=period,
        kinds=chosen,
        items=items,
        total=total,
        has_more=len(merged) > offset + limit or total > offset + limit,
        since=since.isoformat() if since else None,
        min_plays=TOP_MIN_PLAYS,
    )
