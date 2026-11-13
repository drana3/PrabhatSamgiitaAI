"""Listening statistics: what is counted, how listeners are hidden, how numbers are worked out.

The rules (docs/author-profiles.md, "Statistics"):

* A play counts after PLAY_MIN_SECONDS of real listening, or half of a short track (never under
  PLAY_FLOOR_SECONDS). The phone checks it; the server checks it again against the recording's own
  length.
* One count per listener per recording per UTC day. The database enforces it (unique key).
* A listener is never stored as an id. `listener_key` is a 24-bit slice of a keyed hash
  (HMAC-SHA256 with
  a server secret): about 500 people in the world share one key, so a stored key cannot point at a
  person,
  and without the secret nobody can even reproduce it. Distinct keys are counted and corrected for
  collisions (`estimate_distinct`).
* The listener's own plays of their own recordings are not counted.
* Countries: only a coarse device region, and only shown for a country with at least
  COUNTRY_MIN_LISTENERS
  listeners, and only when the total is large enough that a small country cannot single anyone out.
* Raw events are deleted after PLAY_EVENT_RETENTION_DAYS; daily counters stay (they hold no
  listener data).
"""

from __future__ import annotations

import hashlib
import hmac
import ipaddress
import math
from dataclasses import dataclass, field
from datetime import UTC, date, datetime, timedelta
from typing import Any
from uuid import UUID

from sqlalchemy import Select, delete, func, select
from sqlalchemy.dialects import postgresql, sqlite
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.author_profiles import PlayDaily, PlayEvent
from app.models.recordings import Recording
from app.models.song_plays import SongPlayEvent
from app.services import play_fraud

# ---- the knobs (one place each) --------------------------------------------------------------

PLAY_MIN_SECONDS = 30
PLAY_FLOOR_SECONDS = 10
PLAY_SHORT_TRACK_FRACTION = 0.5
# 24 bits of the keyed hash. Raise it for more exact counts, lower it for more anonymity.
LISTENER_KEY_BITS = 24
# 0 = one key per listener for ever. N > 0 = the salt changes every N days (1 = the daily rotation
# Dada
# proposed). Rotation makes "monthly listeners" count a regular listener once per salt period, so a
# value above 0 means the monthly number is an upper bound. Default off, see the doc.
LISTENER_SALT_ROTATION_DAYS = 0
PLAY_EVENT_RETENTION_DAYS = 400  # about 13 months
MAX_EVENTS_PER_BATCH = 50
MAX_EVENT_AGE_DAYS = 7
CLOCK_SKEW_MINUTES = 5
DAILY_EVENT_CAP = 300  # counted plays per listener per day; more is a script, not a person
COUNTRY_MIN_LISTENERS = 5
COUNTRY_MIN_TOTAL = 20
# Below this many counted plays the PUBLIC page shows "counting since ..." instead of numbers.
MIN_PUBLIC_PLAYS = 10
MONTH_DAYS = 30
PUBLIC_WEEKS = 12  # weeks in the public weekly line, the last one ending today
SNAPSHOT_TTL_SECONDS = 15 * 60
PRUNE_EVERY_HOURS = 24
# Signed-out listeners are only a made-up device id, so one client (an address bucket) may add only
# so many NEW listeners: per recording per day, and in all per day. Beyond that the plays still
# count as plays, but the device is not counted as a new listener. Households, schools and mobile
# networks share addresses, so the caps are generous for people and small for a script.
NEW_LISTENERS_PER_CLIENT_PER_RECORDING_DAY = 10
NEW_LISTENERS_PER_CLIENT_PER_DAY = 30
# The same client may also add only so many signed-out PLAYS: per recording per day, and in all per
# day. A play over the cap is still stored (so it can be looked at) but is not added to any public
# number: not the plays counters and not the listeners. Signed-in members are not capped.
UNSIGNED_PLAYS_PER_CLIENT_PER_RECORDING_DAY = 200
UNSIGNED_PLAYS_PER_CLIENT_PER_DAY = 1000

_last_prune: datetime | None = None


def now_utc() -> datetime:
    return datetime.now(UTC)


# ---- listener keys ---------------------------------------------------------------------------


def listener_key(pepper: str, who: str, on: date | None = None) -> str:
    """Hex of the first LISTENER_KEY_BITS bits of HMAC(pepper [+ salt period], who).

    `who` is "m:<member id>" or "d:<device id>". Never stored; only the short key is.
    """
    salt = ""
    if LISTENER_SALT_ROTATION_DAYS > 0 and on is not None:
        salt = f"|{on.toordinal() // LISTENER_SALT_ROTATION_DAYS}"
    digest = hmac.new((pepper + salt).encode(), who.encode(), hashlib.sha256).digest()
    bits = int.from_bytes(digest[:8], "big") >> (64 - LISTENER_KEY_BITS)
    return f"{bits:0{(LISTENER_KEY_BITS + 3) // 4}x}"


def client_key(pepper: str, client: str) -> str:
    """A short keyed hash of the client address bucket (an IPv6 client is bucketed by its /64, since
    one person owns a whole /64). The address itself is never stored."""
    try:
        address = ipaddress.ip_address(client)
        if address.version == 6:
            client = str(ipaddress.ip_network(f"{client}/64", strict=False).network_address)
    except ValueError:
        pass
    digest = hmac.new((pepper + "|client").encode(), client.encode(), hashlib.sha256).hexdigest()
    return digest[:12]


def estimate_distinct(observed: int) -> int:
    """Distinct listeners from distinct short keys. Two people sharing a key count once, so the raw
    count
    is a little low; linear counting (`-m ln(1 - d/m)`) puts it right. Exact for small numbers."""
    if observed <= 0:
        return 0
    space = 2**LISTENER_KEY_BITS
    if observed >= space:
        return observed
    return int(round(-space * math.log1p(-observed / space)))


# ---- the counting rule -----------------------------------------------------------------------


def play_threshold(duration_sec: int | None) -> int:
    """Seconds of listening that make a play: 30, or half of a track shorter than a minute (>=
    10)."""
    if not duration_sec or duration_sec <= 0:
        return PLAY_MIN_SECONDS
    half = int(math.ceil(duration_sec * PLAY_SHORT_TRACK_FRACTION))
    return max(PLAY_FLOOR_SECONDS, min(PLAY_MIN_SECONDS, half))


def qualifies(listened_sec: int, duration_sec: int | None) -> bool:
    return listened_sec >= play_threshold(duration_sec)


def country_code(value: str | None) -> str | None:
    code = (value or "").strip().upper()
    return code if len(code) == 2 and code.isalpha() else None


def visible_countries(counts: dict[str, int]) -> list[dict[str, Any]] | None:
    """k-anonymity for countries: only those with enough listeners, and only when the whole is big
    enough. None means "hidden" (the app says there is not enough data yet)."""
    total = sum(counts.values())
    if total < COUNTRY_MIN_TOTAL:
        return None
    shown = [
        {"country": c, "listeners": n}
        for c, n in sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))
        if n >= COUNTRY_MIN_LISTENERS
    ]
    return shown or None


# ---- the report of plays ---------------------------------------------------------------------


@dataclass
class PlayIn:
    recording_id: UUID
    played_at: datetime
    listened_sec: int
    duration_sec: int | None = None


@dataclass
class IngestResult:
    accepted: int = 0
    duplicates: int = 0
    # stored but over the client's daily play cap, so not in any public number (never sent to the
    # app: a script must not learn where the cap is)
    uncounted: int = 0
    rejected: dict[str, int] = field(default_factory=dict)

    def reject(self, why: str) -> None:
        self.rejected[why] = self.rejected.get(why, 0) + 1


def _insert(session: AsyncSession) -> Any:
    name = session.get_bind().dialect.name
    return postgresql.insert if name == "postgresql" else sqlite.insert


async def _may_count_as_listener(
    session: AsyncSession, ckey: str | None, key: str, recording_id: UUID, day: date
) -> bool:
    """False when this device would be one new listener too many for its client today."""
    if ckey is None:
        return True  # a signed-in member: tied to an account, not to a made-up id
    known = await session.scalar(
        select(PlayEvent.id)
        .where(
            PlayEvent.listener_key == key,
            PlayEvent.day == day,
            PlayEvent.counts_listener.is_(True),
        )
        .limit(1)
    )
    if known is not None:
        return True  # already one of today's listeners: counting it again changes nothing
    on_recording = int(
        await session.scalar(
            select(func.count(func.distinct(PlayEvent.listener_key))).where(
                PlayEvent.client_key == ckey,
                PlayEvent.day == day,
                PlayEvent.recording_id == recording_id,
                PlayEvent.counts_listener.is_(True),
            )
        )
        or 0
    )
    if on_recording >= NEW_LISTENERS_PER_CLIENT_PER_RECORDING_DAY:
        return False
    in_all = int(
        await session.scalar(
            select(func.count(func.distinct(PlayEvent.listener_key))).where(
                PlayEvent.client_key == ckey,
                PlayEvent.day == day,
                PlayEvent.counts_listener.is_(True),
            )
        )
        or 0
    )
    return in_all < NEW_LISTENERS_PER_CLIENT_PER_DAY


async def listener_plays_today(session: AsyncSession, key: str, day: date) -> int:
    """Plays stored today for one listener key, recordings AND catalogue songs together: the daily
    cap of a listener is one cap, whichever way the plays are sent."""
    recordings = await session.scalar(
        select(func.count())
        .select_from(PlayEvent)
        .where(PlayEvent.listener_key == key, PlayEvent.day == day)
    )
    songs = await session.scalar(
        select(func.count())
        .select_from(SongPlayEvent)
        .where(SongPlayEvent.listener_key == key, SongPlayEvent.day == day)
    )
    return int(recordings or 0) + int(songs or 0)


async def client_plays_today(
    session: AsyncSession,
    ckey: str,
    day: date,
    *,
    recording_id: UUID | None = None,
    song_number: int | None = None,
) -> tuple[int, int]:
    """Plays stored today for this client: on the one recording or song asked about, and in all
    (recordings and catalogue songs together: the per-day cap of a client is one cap)."""
    if recording_id is not None:
        on_item = await session.scalar(
            select(func.count())
            .select_from(PlayEvent)
            .where(
                PlayEvent.client_key == ckey,
                PlayEvent.day == day,
                PlayEvent.recording_id == recording_id,
            )
        )
    else:
        on_item = await session.scalar(
            select(func.count())
            .select_from(SongPlayEvent)
            .where(
                SongPlayEvent.client_key == ckey,
                SongPlayEvent.day == day,
                SongPlayEvent.song_number == song_number,
            )
        )
    recordings = await session.scalar(
        select(func.count())
        .select_from(PlayEvent)
        .where(PlayEvent.client_key == ckey, PlayEvent.day == day)
    )
    songs = await session.scalar(
        select(func.count())
        .select_from(SongPlayEvent)
        .where(SongPlayEvent.client_key == ckey, SongPlayEvent.day == day)
    )
    return int(on_item or 0), int(recordings or 0) + int(songs or 0)


async def ingest_plays(
    session: AsyncSession,
    *,
    pepper: str,
    who: str,
    owner_member_id: UUID | None,
    country: str | None,
    events: list[PlayIn],
    now: datetime | None = None,
    client: str | None = None,
) -> IngestResult:
    """Count a batch. Never raises for a bad event: it is rejected with a reason and the rest go
    on."""
    now = now or now_utc()
    result = IngestResult()
    insert = _insert(session)
    cc = country_code(country)
    ckey = client_key(pepper, client) if client and who.startswith("d:") else None
    oldest = now - timedelta(days=MAX_EVENT_AGE_DAYS)
    newest = now + timedelta(minutes=CLOCK_SKEW_MINUTES)
    ids = {e.recording_id for e in events}
    recordings: dict[UUID, Recording] = {}
    if ids:
        rows = (await session.scalars(select(Recording).where(Recording.id.in_(ids)))).all()
        recordings = {r.id: r for r in rows}
    per_day: dict[date, int] = {}
    client_rec: dict[tuple[date, UUID], int] = {}
    client_all: dict[date, int] = {}
    touched: set[tuple[UUID, date]] = set()
    for event in events[:MAX_EVENTS_PER_BATCH]:
        recording = recordings.get(event.recording_id)
        if recording is None or recording.status not in ("published", "flagged"):
            result.reject("unknown")
            continue
        played = event.played_at if event.played_at.tzinfo else event.played_at.replace(tzinfo=UTC)
        if played > newest:
            result.reject("future")
            continue
        if played < oldest:
            result.reject("stale")
            continue
        duration = recording.duration_sec or event.duration_sec
        if not qualifies(event.listened_sec, duration):
            result.reject("short")
            continue
        if owner_member_id is not None and recording.author_id == owner_member_id:
            result.reject("own")
            continue
        day = played.astimezone(UTC).date()
        key = listener_key(pepper, who, day)
        if day not in per_day:
            per_day[day] = await listener_plays_today(session, key, day)
        if per_day[day] >= DAILY_EVENT_CAP:
            result.reject("limit")
            continue
        over_cap = False
        if ckey is not None:
            if (day, recording.id) not in client_rec:
                client_rec[(day, recording.id)], client_all[day] = await client_plays_today(
                    session, ckey, day, recording_id=recording.id
                )
            over_cap = (
                client_rec[(day, recording.id)] >= UNSIGNED_PLAYS_PER_CLIENT_PER_RECORDING_DAY
                or client_all[day] >= UNSIGNED_PLAYS_PER_CLIENT_PER_DAY
            )
        counts = (not over_cap) and await _may_count_as_listener(
            session, ckey, key, recording.id, day
        )
        stmt = (
            insert(PlayEvent)
            .values(
                recording_id=recording.id,
                day=day,
                listener_key=key,
                country=cc,
                listened_sec=min(event.listened_sec, 6 * 3600),
                created_at=now,
                client_key=ckey,
                counts_listener=counts,
                counted=not over_cap,
            )
            .on_conflict_do_nothing(index_elements=["recording_id", "listener_key", "day"])
            .returning(PlayEvent.id)
        )
        outcome = await session.execute(stmt)
        # Not `outcome.rowcount`: for an ORM insert psycopg reports -1 whether the row went in or
        # hit the unique key, so every repeat would be counted (found in the PostgreSQL rehearsal).
        if outcome.first() is None:
            result.duplicates += 1
            continue
        per_day[day] += 1
        if ckey is not None:
            client_rec[(day, recording.id)] += 1
            client_all[day] += 1
        if over_cap:
            result.uncounted += 1
            result.accepted += 1  # the app is told the same as for a counted play
            continue
        counter = insert(PlayDaily).values(recording_id=recording.id, day=day, plays=1)
        await session.execute(
            counter.on_conflict_do_update(
                index_elements=["recording_id", "day"],
                set_={"plays": PlayDaily.plays + 1},
            )
        )
        result.accepted += 1
        touched.add((recording.id, day))
    for _ in events[MAX_EVENTS_PER_BATCH:]:
        result.reject("batch_limit")
    await session.commit()
    # The second line of defence: a day that looks inflated is held back (services/play_fraud.py).
    if touched:
        await play_fraud.evaluate_after_ingest(session, touched, now=now)
    return result


async def erase_listener(session: AsyncSession, *, pepper: str, who_values: list[str]) -> int:
    """Delete the raw events of one listener (the member asked). The counters are not personal data
    and stay. Recomputes the key for every day it could have used when rotation is on."""
    removed = 0
    keys: set[str] = set()
    today = now_utc().date()
    days = (
        [today - timedelta(days=i) for i in range(PLAY_EVENT_RETENTION_DAYS)]
        if LISTENER_SALT_ROTATION_DAYS
        else [today]
    )
    for who in who_values:
        for day in days:
            keys.add(listener_key(pepper, who, day))
    if keys:
        outcome = await session.execute(delete(PlayEvent).where(PlayEvent.listener_key.in_(keys)))
        removed = int(outcome.rowcount or 0)  # type: ignore[attr-defined]
        # the same listener's catalogue-song rows (services/song_plays.py) go too
        songs = await session.execute(
            delete(SongPlayEvent).where(SongPlayEvent.listener_key.in_(keys))
        )
        removed += int(songs.rowcount or 0)  # type: ignore[attr-defined]
        await session.commit()
    return removed


async def prune_play_events(
    session: AsyncSession, *, now: datetime | None = None, force: bool = False
) -> int:
    """Delete raw events older than the retention window. Runs at most daily on its own."""
    global _last_prune
    now = now or now_utc()
    if not force and _last_prune and now - _last_prune < timedelta(hours=PRUNE_EVERY_HOURS):
        return 0
    _last_prune = now
    cutoff = now.date() - timedelta(days=PLAY_EVENT_RETENTION_DAYS)
    outcome = await session.execute(delete(PlayEvent).where(PlayEvent.day < cutoff))
    songs = await session.execute(delete(SongPlayEvent).where(SongPlayEvent.day < cutoff))
    await session.commit()
    return int(outcome.rowcount or 0) + int(songs.rowcount or 0)  # type: ignore[attr-defined]


def reset_prune_clock() -> None:
    global _last_prune
    _last_prune = None


# ---- the numbers of a set of recordings ------------------------------------------------------


@dataclass
class Numbers:
    monthly_listeners: int = 0
    total_plays: int = 0
    plays_30d: int = 0


async def stats_since(session: AsyncSession) -> date | None:
    """The first day anything was counted: numbers start here, not at the first upload."""
    value = await session.scalar(select(func.min(PlayDaily.day)))
    return value


async def numbers_for(session: AsyncSession, recording_ids: Select[Any], *, today: date) -> Numbers:
    """`recording_ids` is a SELECT of recording ids (the recordings that belong to a profile).

    Plays that `play_fraud` holds back are not in any of these numbers.
    """
    start = today - timedelta(days=MONTH_DAYS - 1)
    total = await session.scalar(
        select(func.coalesce(func.sum(PlayDaily.plays), 0)).where(
            PlayDaily.recording_id.in_(recording_ids)
        )
    )
    month = await session.scalar(
        select(func.coalesce(func.sum(PlayDaily.plays), 0)).where(
            PlayDaily.recording_id.in_(recording_ids), PlayDaily.day >= start
        )
    )
    held = await play_fraud.held_by_day(session, recording_ids)
    held_total = sum(held.values())
    held_month = sum(n for day, n in held.items() if day >= start)
    distinct = await session.scalar(
        select(func.count(func.distinct(PlayEvent.listener_key))).where(
            PlayEvent.recording_id.in_(recording_ids),
            PlayEvent.day >= start,
            PlayEvent.counts_listener.is_(True),
        )
    )
    return Numbers(
        monthly_listeners=estimate_distinct(int(distinct or 0)),
        total_plays=max(0, int(total or 0) - held_total),
        plays_30d=max(0, int(month or 0) - held_month),
    )


async def daily_series(
    session: AsyncSession, recording_ids: Select[Any], *, today: date, days: int
) -> list[dict[str, Any]]:
    """Plays and distinct listeners for each of the last `days` days, zeros included."""
    start = today - timedelta(days=days - 1)
    plays = {
        row.day: int(row.n)
        for row in (
            await session.execute(
                select(PlayDaily.day, func.sum(PlayDaily.plays).label("n"))
                .where(PlayDaily.recording_id.in_(recording_ids), PlayDaily.day >= start)
                .group_by(PlayDaily.day)
            )
        ).all()
    }
    listeners = {
        row.day: int(row.n)
        for row in (
            await session.execute(
                select(PlayEvent.day, func.count(func.distinct(PlayEvent.listener_key)).label("n"))
                .where(
                    PlayEvent.recording_id.in_(recording_ids),
                    PlayEvent.day >= start,
                    PlayEvent.counts_listener.is_(True),
                )
                .group_by(PlayEvent.day)
            )
        ).all()
    }
    held = await play_fraud.held_by_day(session, recording_ids, since=start)
    out = []
    for i in range(days):
        day = start + timedelta(days=i)
        shown = max(0, plays.get(day, 0) - held.get(day, 0))
        out.append({"day": day.isoformat(), "plays": shown, "listeners": listeners.get(day, 0)})
    return out


async def weekly_plays(
    session: AsyncSession,
    recording_ids: Select[Any],
    *,
    today: date,
    since: date | None,
    weeks: int = PUBLIC_WEEKS,
) -> list[dict[str, Any]]:
    """Plays per week for the public line: `weeks` blocks of seven days, the last one ending
    `today`, oldest first, empty weeks as zero. Weeks that ended before counting started
    (`since`) are left out, so the line never starts with a flat stretch of "nothing" that was only
    "not counted yet". Only totals: no listeners, no countries, no recordings. Plays above the
    daily caps never reach `play_daily` (see `ingest_plays`), so they are not here either."""
    first = today - timedelta(days=7 * weeks - 1)
    rows = (
        await session.execute(
            select(PlayDaily.day, func.sum(PlayDaily.plays).label("n"))
            .where(PlayDaily.recording_id.in_(recording_ids), PlayDaily.day >= first)
            .group_by(PlayDaily.day)
        )
    ).all()
    held = await play_fraud.held_by_day(session, recording_ids, since=first)
    per_day = {row.day: max(0, int(row.n) - held.get(row.day, 0)) for row in rows}
    out: list[dict[str, Any]] = []
    for i in range(weeks):
        start = first + timedelta(days=7 * i)
        end = start + timedelta(days=6)
        if since is not None and end < since:
            continue
        total = sum(per_day.get(start + timedelta(days=k), 0) for k in range(7))
        out.append({"start": start.isoformat(), "plays": total})
    return out


async def country_counts(
    session: AsyncSession, recording_ids: Select[Any], *, today: date
) -> dict[str, int]:
    start = today - timedelta(days=MONTH_DAYS - 1)
    rows = (
        await session.execute(
            select(PlayEvent.country, func.count(func.distinct(PlayEvent.listener_key)))
            .where(
                PlayEvent.recording_id.in_(recording_ids),
                PlayEvent.day >= start,
                PlayEvent.country.is_not(None),
                PlayEvent.counts_listener.is_(True),
            )
            .group_by(PlayEvent.country)
        )
    ).all()
    return {str(c): int(n) for c, n in rows}
