"""Counting listens of Prabhat Samgiita CATALOGUE songs (the same rules as a recording's).

Everything here reuses services/author_stats.py: the 30 second rule, the keyed listener hash, the
client bucket, the age and clock limits, the per-listener daily cap and the signed-out caps per
client. Nothing is loosened. Two things differ, both on purpose:

* The server knows no length for a catalogue song, so the phone's claimed length is NOT used to
  lower the bar: a catalogue play always needs PLAY_MIN_SECONDS of real listening.
* The caps of one listener and of one client per day count the recordings' rows AND the songs'
  rows together, so songs cannot be used to get around the recordings' caps.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.recordings import PS_SONG_COUNT
from app.models.song_plays import SongPlayDaily, SongPlayEvent
from app.services import author_stats as stats


@dataclass
class SongPlayIn:
    song_number: int
    played_at: datetime
    listened_sec: int


async def ingest_song_plays(
    session: AsyncSession,
    *,
    pepper: str,
    who: str,
    events: list[SongPlayIn],
    now: datetime | None = None,
    client: str | None = None,
) -> stats.IngestResult:
    """Count a batch of catalogue-song listens. Never raises for a bad event: it is rejected with a
    reason and the rest go on. Commits."""
    now = now or stats.now_utc()
    result = stats.IngestResult()
    insert = stats._insert(session)
    ckey = stats.client_key(pepper, client) if client and who.startswith("d:") else None
    oldest = now - timedelta(days=stats.MAX_EVENT_AGE_DAYS)
    newest = now + timedelta(minutes=stats.CLOCK_SKEW_MINUTES)
    per_day: dict[date, int] = {}
    client_song: dict[tuple[date, int], int] = {}
    client_all: dict[date, int] = {}
    for event in events[: stats.MAX_EVENTS_PER_BATCH]:
        if not 1 <= event.song_number <= PS_SONG_COUNT:
            result.reject("unknown")
            continue
        played = event.played_at if event.played_at.tzinfo else event.played_at.replace(tzinfo=UTC)
        if played > newest:
            result.reject("future")
            continue
        if played < oldest:
            result.reject("stale")
            continue
        if event.listened_sec < stats.PLAY_MIN_SECONDS:
            result.reject("short")
            continue
        day = played.astimezone(UTC).date()
        key = stats.listener_key(pepper, who, day)
        if day not in per_day:
            per_day[day] = await stats.listener_plays_today(session, key, day)
        if per_day[day] >= stats.DAILY_EVENT_CAP:
            result.reject("limit")
            continue
        over_cap = False
        if ckey is not None:
            if (day, event.song_number) not in client_song:
                (
                    client_song[(day, event.song_number)],
                    client_all[day],
                ) = await stats.client_plays_today(
                    session, ckey, day, song_number=event.song_number
                )
            over_cap = (
                client_song[(day, event.song_number)]
                >= stats.UNSIGNED_PLAYS_PER_CLIENT_PER_RECORDING_DAY
                or client_all[day] >= stats.UNSIGNED_PLAYS_PER_CLIENT_PER_DAY
            )
        stmt = (
            insert(SongPlayEvent)
            .values(
                song_number=event.song_number,
                day=day,
                listener_key=key,
                listened_sec=min(event.listened_sec, 6 * 3600),
                created_at=now,
                client_key=ckey,
                counted=not over_cap,
            )
            .on_conflict_do_nothing(index_elements=["song_number", "listener_key", "day"])
            .returning(SongPlayEvent.id)
        )
        outcome = await session.execute(stmt)
        # Not `outcome.rowcount`: for an ORM insert psycopg reports -1 whether the row went in or
        # hit the unique key, so every repeat would be counted (found in the PostgreSQL rehearsal).
        if outcome.first() is None:
            result.duplicates += 1
            continue
        per_day[day] += 1
        if ckey is not None:
            client_song[(day, event.song_number)] += 1
            client_all[day] += 1
        if over_cap:
            result.uncounted += 1
            result.accepted += 1  # the app is told the same as for a counted play
            continue
        counter = insert(SongPlayDaily).values(song_number=event.song_number, day=day, plays=1)
        await session.execute(
            counter.on_conflict_do_update(
                index_elements=["song_number", "day"],
                set_={"plays": SongPlayDaily.plays + 1},
            )
        )
        result.accepted += 1
    for _ in events[stats.MAX_EVENTS_PER_BATCH :]:
        result.reject("batch_limit")
    await session.commit()
    return result
