"""Play-count fraud: find a day that looks inflated and hold its excess back (docs/play-fraud.md).

What `author_stats.ingest_plays` already does is not repeated here: a play needs real listening
time (checked again on the server), one play counts per listener per recording per day, a listener
has a daily cap, and a signed-out client (an address bucket) can add only so many new listeners and
plays. This module is the second line. It looks at the result, not at one request:

* **Spike**: a day with many plays compared with the recording's own ordinary level.
* **One source**: one client bucket produced most of a day's plays, beyond what a household or a
  school would.

When either shows, a `PlayFlag` row records how many plays are *held*. Held plays stay in the
database (nothing is deleted, so a person can look) but are subtracted from every number an author
or the public sees. A person can clear the flag (the plays were real) or confirm it. Flags carry
counts and a reason only; nobody can find out who played from them.
"""

from __future__ import annotations

import logging
import math
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from typing import Any
from uuid import UUID

from sqlalchemy import ColumnElement, Select, Subquery, case, func, select
from sqlalchemy.dialects import postgresql, sqlite
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.author_profiles import PlayDaily, PlayEvent
from app.models.play_flag import PlayFlag

logger = logging.getLogger(__name__)

# ---- the knobs (one place each) --------------------------------------------------------------

# Under this many plays in a day nothing is a spike: small numbers are noise.
SPIKE_MIN_PLAYS = 50
# A day is a spike when it is at least this many times the ordinary level ...
SPIKE_FACTOR = 6.0
# ... and the ordinary level is never taken below this (a new recording has no history).
BASELINE_FLOOR = 10.0
# Days of history that make "ordinary". Held days are left out so a flood cannot raise the bar.
BASELINE_DAYS = 14
# What an author may still see on a spike day: this many times the ordinary level. The rest is held.
SHOWN_FACTOR = 3.0
# One client bucket may account for this many plays of one recording in a day before the rest is
# held. A household, a school or a mobile network is a few; a script is hundreds.
SOURCE_KEEP = 25
# One source is looked at only when the day has this many plays.
SOURCE_MIN_PLAYS = 30
# A day a person already decided is judged again when it grew by at least this many plays AND by at
# least this share of what it had at the decision (so the decision is not a licence for more).
REVIEW_REGROWTH_MIN = 50
REVIEW_REGROWTH_SHARE = 0.5


@dataclass(frozen=True)
class Verdict:
    plays: int
    held: int
    baseline: float
    reason: str


def baseline_of(shown_plays: list[int]) -> float:
    """The ordinary daily level: the mean of the last days, never below the floor."""
    if not shown_plays:
        return BASELINE_FLOOR
    return max(BASELINE_FLOOR, sum(shown_plays) / BASELINE_DAYS)


def judge(plays: int, baseline: float, *, top_source: int = 0) -> Verdict | None:
    """Pure rule: how many of today's `plays` to hold, or None when the day looks ordinary.

    `baseline` is the ordinary daily level, `top_source` the plays from the single busiest client
    bucket (0 when unknown).
    """
    reasons: list[str] = []
    held = 0
    if plays >= SPIKE_MIN_PLAYS and plays >= SPIKE_FACTOR * baseline:
        allowed = math.ceil(SHOWN_FACTOR * baseline)
        held = max(held, plays - allowed)
        reasons.append("spike")
    if plays >= SOURCE_MIN_PLAYS and top_source > SOURCE_KEEP:
        held = max(held, top_source - SOURCE_KEEP)
        reasons.append("one_source")
    held = min(held, plays)
    if held <= 0:
        return None
    return Verdict(plays=plays, held=held, baseline=round(baseline, 2), reason="+".join(reasons))


def held_expression() -> ColumnElement[int]:
    """What one flag leaves out of the numbers: the part a person confirmed (always) plus the part
    still under suspicion (only while the flag is open). The one place that says so; every query
    that sums plays uses it."""
    return PlayFlag.confirmed_held + case((PlayFlag.status == "open", PlayFlag.held), else_=0)


def _insert(session: AsyncSession) -> Any:
    return postgresql.insert if session.get_bind().dialect.name == "postgresql" else sqlite.insert


async def _shown_history(session: AsyncSession, recording_id: UUID, day: date) -> list[int]:
    """Daily plays of the days before `day`, with what was held back already taken off."""
    start = day - timedelta(days=BASELINE_DAYS)
    plays = {
        row.day: int(row.plays)
        for row in (
            await session.execute(
                select(PlayDaily.day, PlayDaily.plays).where(
                    PlayDaily.recording_id == recording_id,
                    PlayDaily.day >= start,
                    PlayDaily.day < day,
                )
            )
        ).all()
    }
    held = {
        row.day: int(row.held)
        for row in (
            await session.execute(
                select(PlayFlag.day, held_expression().label("held")).where(
                    PlayFlag.recording_id == recording_id,
                    PlayFlag.day >= start,
                    PlayFlag.day < day,
                )
            )
        ).all()
    }
    return [max(0, n - held.get(d, 0)) for d, n in plays.items()]


async def _top_source(session: AsyncSession, recording_id: UUID, day: date) -> int:
    count = func.count()
    busiest = await session.scalar(
        select(count)
        .where(
            PlayEvent.recording_id == recording_id,
            PlayEvent.day == day,
            PlayEvent.client_key.is_not(None),
            # only plays that really became plays: an uncounted flood changes nothing here
            PlayEvent.counted.is_(True),
        )
        .group_by(PlayEvent.client_key)
        .order_by(count.desc())
        .limit(1)
    )
    return int(busiest or 0)


async def evaluate(
    session: AsyncSession, recording_id: UUID, day: date, *, now: datetime | None = None
) -> PlayFlag | None:
    """Judge one recording on one day and record the result. Returns the flag, if there is one.

    Three parts are kept apart (see `PlayFlag`): what a person confirmed (`confirmed_held`, never
    lowered), what the rules suspect and nobody decided yet (`held`), and how many plays the last
    decision covered (`reviewed_plays`). After a decision, the rules may suspect only the plays
    added since (`new_part`), on every later look, so a decision is never a licence for more and a
    cleared surge never gives back what an earlier one confirmed.
    """
    existing = await session.get(PlayFlag, (recording_id, day))
    plays = int(
        await session.scalar(
            select(PlayDaily.plays).where(
                PlayDaily.recording_id == recording_id, PlayDaily.day == day
            )
        )
        or 0
    )
    decided = existing is not None and existing.status != "open"
    if decided:
        assert existing is not None
        covered = existing.reviewed_plays if existing.reviewed_plays is not None else existing.plays
        grown = plays - covered
        if grown < REVIEW_REGROWTH_MIN or grown < REVIEW_REGROWTH_SHARE * covered:
            return existing
    if plays < min(SPIKE_MIN_PLAYS, SOURCE_MIN_PLAYS):
        return existing
    baseline = baseline_of(await _shown_history(session, recording_id, day))
    verdict = judge(plays, baseline, top_source=await _top_source(session, recording_id, day))
    if verdict is None:
        return existing
    when = now or datetime.now(UTC)
    if existing is None:
        flag = PlayFlag(
            recording_id=recording_id,
            day=day,
            plays=verdict.plays,
            held=verdict.held,
            confirmed_held=0,
            baseline=verdict.baseline,
            reason=verdict.reason,
            status="open",
            created_at=when,
        )
        session.add(flag)
        logger.warning(
            "play spike held back: recording=%s day=%s plays=%d held=%d reason=%s",
            recording_id,
            day,
            verdict.plays,
            verdict.held,
            verdict.reason,
        )
        return flag
    # what the rules may suspect: all of it before any decision, afterwards only the new plays
    new_part = verdict.held
    if existing.reviewed_plays is not None or decided:
        covered = existing.reviewed_plays if existing.reviewed_plays is not None else existing.plays
        new_part = min(verdict.held, max(0, verdict.plays - covered))
    if decided:
        # open again; the suspected part starts from the new plays only
        suspected = new_part
        existing.status = (
            "open"  # reviewed_by / reviewed_at / last_decision stay as the audit trail
        )
        logger.warning(
            "play spike held back again after a decision: recording=%s day=%s plays=%d held=%d",
            recording_id,
            day,
            verdict.plays,
            new_part,
        )
    else:
        # still open: the numbers may have grown since the last look; the suspected part holds
        suspected = max(existing.held, new_part)
    # together with the confirmed part it can never exceed the day's plays
    existing.held = min(suspected, max(0, verdict.plays - existing.confirmed_held))
    existing.plays = verdict.plays
    existing.baseline = verdict.baseline
    existing.reason = verdict.reason
    return existing


async def evaluate_after_ingest(
    session: AsyncSession, touched: set[tuple[UUID, date]], *, now: datetime | None = None
) -> int:
    """Called when a batch of plays was counted. Never raises: counting plays comes first."""
    flagged = 0
    try:
        for recording_id, day in touched:
            flag = await evaluate(session, recording_id, day, now=now)
            flagged += 1 if flag is not None and flag.status == "open" else 0
        await session.commit()
    except Exception:
        await session.rollback()
        logger.exception("play spike check failed; the plays themselves were counted")
        return 0
    return flagged


# ---- what authors and the public see ---------------------------------------------------------


async def held_by_day(
    session: AsyncSession, recording_ids: Select[Any], *, since: date | None = None
) -> dict[date, int]:
    """Plays held back per day for these recordings (`held_expression`: confirmed part always, the
    suspected part while the flag is open)."""
    query = (
        select(PlayFlag.day, func.sum(held_expression()).label("n"))
        .where(PlayFlag.recording_id.in_(recording_ids))
        .group_by(PlayFlag.day)
    )
    if since is not None:
        query = query.where(PlayFlag.day >= since)
    return {row.day: int(row.n) for row in (await session.execute(query)).all()}


def held_per_recording(*, since: date | None = None) -> Subquery:
    """A subquery (recording_id, held): plays held back per recording (`held_expression`). LEFT JOIN
    it to any query that sums `play_daily.plays`, and subtract it, so no number anywhere shows plays
    that were held back."""
    query = select(PlayFlag.recording_id, func.sum(held_expression()).label("held"))
    if since is not None:
        query = query.where(PlayFlag.day >= since)
    return query.group_by(PlayFlag.recording_id).subquery("held_plays")


# ---- the team ---------------------------------------------------------------------------------


async def review(
    session: AsyncSession, recording_id: UUID, day: date, *, verdict: str, by: str
) -> PlayFlag | None:
    """A person decides: `cleared` (the suspected plays are real) or `confirmed` (inflated).

    `confirmed` moves the suspected part into `confirmed_held`, which is permanent. `cleared` gives
    the suspected part back and leaves `confirmed_held` alone: clearing a later surge never frees
    plays a person once confirmed as inflated.
    """
    if verdict not in ("cleared", "confirmed"):
        raise ValueError("verdict must be 'cleared' or 'confirmed'")
    flag = await session.get(PlayFlag, (recording_id, day))
    if flag is None:
        return None
    # the decision covers the plays the day has right now
    current = await session.scalar(
        select(PlayDaily.plays).where(PlayDaily.recording_id == recording_id, PlayDaily.day == day)
    )
    plays = int(current if current is not None else flag.plays)
    if verdict == "confirmed":
        flag.confirmed_held = min(flag.confirmed_held + flag.held, plays)
        flag.held = 0
    flag.status = verdict
    flag.last_decision = verdict
    flag.reviewed_by = by[:120]
    flag.reviewed_at = datetime.now(UTC)
    flag.reviewed_plays = plays
    await session.commit()
    return flag


class NothingConfirmedError(Exception):
    """`unconfirm` on a flag that has no confirmed part."""


async def unconfirm(
    session: AsyncSession, recording_id: UUID, day: date, *, by: str
) -> PlayFlag | None:
    """A person takes back a "confirmed as inflated" decision made by mistake.

    The confirmed part goes back into the numbers (`confirmed_held` becomes 0). A `confirmed` flag
    becomes `cleared`; an `open` one (a later surge on the same day) stays open and keeps judging
    only its suspected part. This is the only call that lowers `confirmed_held`; it records who and
    when in `last_decision = "unconfirmed"`, `reviewed_by` and `reviewed_at`
    (docs/decisions-security.md).
    """
    flag = await session.get(PlayFlag, (recording_id, day))
    if flag is None:
        return None
    if flag.confirmed_held <= 0:
        raise NothingConfirmedError
    flag.confirmed_held = 0
    if flag.status == "confirmed":
        flag.status = "cleared"
    flag.last_decision = "unconfirmed"
    flag.reviewed_by = by[:120]
    flag.reviewed_at = datetime.now(UTC)
    await session.commit()
    return flag
