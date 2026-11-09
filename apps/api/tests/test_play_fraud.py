"""Suspicious play counts: the rule, what authors see, what the team can do (docs/play-fraud.md)."""

# ruff: noqa: F811
from __future__ import annotations

import os

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://test:test@localhost/test")

from collections.abc import AsyncIterator
from datetime import UTC, date, datetime, timedelta
from typing import Any, cast
from uuid import UUID, uuid4

import httpx
import pytest
import pytest_asyncio
from fastapi import FastAPI, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from test_author_profiles import AS, MEMBER_A, URL, World, world  # noqa: F401
from test_author_stats import event, send

from app.api.v1 import play_flags as flags_api
from app.core.db import get_session
from app.core.security import require_admin
from app.models.author_profiles import PlayDaily, PlayEvent
from app.models.play_flag import PlayFlag
from app.services import play_fraud as pf


def day_ago(n: int) -> date:
    return datetime.now(UTC).date() - timedelta(days=n)


async def add_plays(world: World, rid: UUID, day: date, count: int) -> None:
    """`count` plays on `day`, written straight to the counter (no listener data)."""
    async with world.sessions() as session:
        existing = await session.get(PlayDaily, (rid, day))
        if existing:
            existing.plays += count
        else:
            session.add(PlayDaily(recording_id=rid, day=day, plays=count))
        await session.commit()


async def history(world: World, rid: UUID, per_day: int = 10) -> None:
    for n in range(1, pf.BASELINE_DAYS + 1):
        await add_plays(world, rid, day_ago(n), per_day)


async def evaluate(world: World, rid: UUID, day: date) -> PlayFlag | None:
    async with world.sessions() as session:
        flag = await pf.evaluate(session, rid, day)
        await session.commit()
        return flag


async def mine(world: World) -> dict[str, Any]:
    r = await world.client.get(f"{URL}/me/stats", headers=AS["a"])
    assert r.status_code == 200
    return cast(dict[str, Any], r.json())


# --------------------------------------------------------------------------- the rule itself


def test_a_small_or_ordinary_day_is_not_a_spike() -> None:
    assert pf.judge(10, 3.0) is None
    assert pf.judge(pf.SPIKE_MIN_PLAYS - 1, pf.BASELINE_FLOOR) is None
    # busy but in line with the recording's own level
    assert pf.judge(150, 100.0) is None
    # a few more than the floor times the factor is still below the line
    assert pf.judge(int(pf.SPIKE_FACTOR * pf.BASELINE_FLOOR) - 1, pf.BASELINE_FLOOR) is None


def test_a_spike_holds_back_all_but_a_few_times_the_ordinary_level() -> None:
    verdict = pf.judge(400, 10.0)
    assert verdict is not None
    assert verdict.reason == "spike"
    assert verdict.held == 400 - int(pf.SHOWN_FACTOR * 10)
    assert verdict.plays - verdict.held == 30  # what an author may still see


def test_a_new_recording_is_judged_against_the_floor_not_zero() -> None:
    """With no history the ordinary level is the floor, so a first busy day is not a spike."""
    baseline = pf.baseline_of([])
    assert baseline == pf.BASELINE_FLOOR
    assert pf.judge(int(pf.SPIKE_FACTOR * baseline) - 1, baseline) is None
    assert pf.judge(int(pf.SPIKE_FACTOR * baseline) + 100, baseline) is not None


def test_one_busy_source_is_held_back_even_without_a_spike() -> None:
    verdict = pf.judge(60, 50.0, top_source=pf.SOURCE_KEEP + 15)
    assert verdict is not None
    assert verdict.reason == "one_source"
    assert verdict.held == 15
    # a household's worth of plays from one place is fine
    assert pf.judge(60, 50.0, top_source=pf.SOURCE_KEEP) is None


def test_both_signals_give_both_reasons_and_never_hold_more_than_the_plays() -> None:
    verdict = pf.judge(500, 10.0, top_source=490)
    assert verdict is not None
    assert verdict.reason == "spike+one_source"
    assert 0 < verdict.held <= verdict.plays


def test_the_baseline_is_a_mean_over_the_window_and_never_below_the_floor() -> None:
    assert pf.baseline_of([40] * pf.BASELINE_DAYS) == 40
    assert pf.baseline_of([1, 1]) == pf.BASELINE_FLOOR


# --------------------------------------------------------------------------- flags and numbers


async def test_a_spike_is_flagged_and_hidden_from_the_author(world: World) -> None:
    await world.create()
    rid = await world.recording(MEMBER_A)
    await history(world, rid)
    await add_plays(world, rid, day_ago(0), 500)
    flag = await evaluate(world, rid, day_ago(0))
    assert flag is not None and flag.status == "open" and flag.reason == "spike"
    shown = await mine(world)
    ordinary = 10 * pf.BASELINE_DAYS
    assert shown["total_plays"] == ordinary + (500 - flag.held)
    assert shown["total_plays"] < ordinary + 500
    assert shown["series"][-1]["plays"] == 500 - flag.held
    # nothing is deleted: the raw counter still has every play
    async with world.sessions() as session:
        raw = await session.get(PlayDaily, (rid, day_ago(0)))
    assert raw is not None and raw.plays == 500


async def test_an_ordinary_busy_day_is_left_alone(world: World) -> None:
    await world.create()
    rid = await world.recording(MEMBER_A)
    await history(world, rid, per_day=40)
    await add_plays(world, rid, day_ago(0), 100)
    assert await evaluate(world, rid, day_ago(0)) is None
    assert (await mine(world))["total_plays"] == 40 * pf.BASELINE_DAYS + 100


async def test_clearing_a_flag_gives_the_plays_back_and_it_stays_clear(world: World) -> None:
    await world.create()
    rid = await world.recording(MEMBER_A)
    await history(world, rid)
    await add_plays(world, rid, day_ago(0), 500)
    await evaluate(world, rid, day_ago(0))
    async with world.sessions() as session:
        done = await pf.review(session, rid, day_ago(0), verdict="cleared", by="api-key-admin")
    assert done is not None and done.status == "cleared" and done.reviewed_by == "api-key-admin"
    assert (await mine(world))["total_plays"] == 10 * pf.BASELINE_DAYS + 500
    # a later judgment of the same day does not undo a person's decision
    again = await evaluate(world, rid, day_ago(0))
    assert again is not None and again.status == "cleared"
    assert (await mine(world))["total_plays"] == 10 * pf.BASELINE_DAYS + 500


async def test_confirming_keeps_the_plays_held(world: World) -> None:
    await world.create()
    rid = await world.recording(MEMBER_A)
    await history(world, rid)
    await add_plays(world, rid, day_ago(0), 500)
    first = await evaluate(world, rid, day_ago(0))
    assert first is not None
    held = first.held
    async with world.sessions() as session:
        await pf.review(session, rid, day_ago(0), verdict="confirmed", by="team")
    await add_plays(world, rid, day_ago(0), 100)  # more plays later the same day
    after = await evaluate(world, rid, day_ago(0))
    assert after is not None and after.status == "confirmed"
    assert after.confirmed_held == held and after.held == 0
    assert (await mine(world))["total_plays"] == 10 * pf.BASELINE_DAYS + 500 + 100 - held


async def test_a_new_surge_after_a_cleared_day_is_flagged_again(world: World) -> None:
    """A person said "fine" to the plays the day had then. That is not a licence for more."""
    await world.create()
    rid = await world.recording(MEMBER_A)
    await history(world, rid)
    await add_plays(world, rid, day_ago(0), 500)
    await evaluate(world, rid, day_ago(0))
    async with world.sessions() as session:
        await pf.review(session, rid, day_ago(0), verdict="cleared", by="team")
    base = 10 * pf.BASELINE_DAYS + 500
    assert (await mine(world))["total_plays"] == base

    # a small trickle after the decision changes nothing: the decision stands
    await add_plays(world, rid, day_ago(0), 10)
    quiet = await evaluate(world, rid, day_ago(0))
    assert quiet is not None and quiet.status == "cleared"
    assert (await mine(world))["total_plays"] == base + 10

    # a new surge of the same size opens it again, and only the new part is held back
    await add_plays(world, rid, day_ago(0), 500)
    again = await evaluate(world, rid, day_ago(0))
    assert again is not None and again.status == "open"
    # the last decision stays as the audit trail
    assert again.last_decision == "cleared" and again.reviewed_by == "team"
    assert 0 < again.held <= 510
    assert (await mine(world))["total_plays"] == base + 510 - again.held

    # the second decision covers the new total, and another small step stays decided
    async with world.sessions() as session:
        done = await pf.review(session, rid, day_ago(0), verdict="cleared", by="team")
    assert done is not None and done.reviewed_plays == 1010
    await add_plays(world, rid, day_ago(0), 5)
    assert (await evaluate(world, rid, day_ago(0))) is not None
    assert (await mine(world))["total_plays"] == 10 * pf.BASELINE_DAYS + 1015


async def test_a_confirmed_day_that_surges_again_holds_more(world: World) -> None:
    await world.create()
    rid = await world.recording(MEMBER_A)
    await history(world, rid)
    await add_plays(world, rid, day_ago(0), 500)
    first = await evaluate(world, rid, day_ago(0))
    assert first is not None
    held = first.held
    async with world.sessions() as session:
        await pf.review(session, rid, day_ago(0), verdict="confirmed", by="team")
    await add_plays(world, rid, day_ago(0), 500)
    after = await evaluate(world, rid, day_ago(0))
    assert after is not None and after.status == "open"
    assert after.confirmed_held == held  # the confirmed part is never lowered or re-counted
    assert after.held > 0
    assert after.confirmed_held + after.held <= after.plays


async def test_a_reopened_flag_keeps_to_the_new_plays_on_every_later_look(world: World) -> None:
    """After a decision the rules may suspect only the plays added since it, also while the flag is
    open and the day keeps growing (not just on the look that reopened it)."""
    await world.create()
    rid = await world.recording(MEMBER_A)
    await history(world, rid)
    await add_plays(world, rid, day_ago(0), 500)
    await evaluate(world, rid, day_ago(0))
    async with world.sessions() as session:
        await pf.review(session, rid, day_ago(0), verdict="cleared", by="team")
    base = 10 * pf.BASELINE_DAYS

    await add_plays(world, rid, day_ago(0), 600)
    first = await evaluate(world, rid, day_ago(0))
    assert first is not None and first.status == "open"
    assert first.held == 600  # not the whole day's excess (1070)
    await add_plays(world, rid, day_ago(0), 200)
    second = await evaluate(world, rid, day_ago(0))
    assert second is not None and second.status == "open"
    assert second.held == 800 and second.reviewed_plays == 500
    # the 500 a person called real are shown
    assert (await mine(world))["total_plays"] == base + 1300 - 800 == base + 500


async def test_clearing_a_later_surge_never_frees_what_was_confirmed(world: World) -> None:
    await world.create()
    rid = await world.recording(MEMBER_A)
    await history(world, rid)
    await add_plays(world, rid, day_ago(0), 500)
    first = await evaluate(world, rid, day_ago(0))
    assert first is not None
    confirmed = first.held
    async with world.sessions() as session:
        await pf.review(session, rid, day_ago(0), verdict="confirmed", by="first")
    base = 10 * pf.BASELINE_DAYS

    # a second surge opens the day again: the confirmed part is still left out, besides the new part
    await add_plays(world, rid, day_ago(0), 500)
    again = await evaluate(world, rid, day_ago(0))
    assert again is not None and again.status == "open"
    assert again.confirmed_held == confirmed and again.held > 0
    assert again.last_decision == "confirmed" and again.reviewed_by == "first"
    assert (await mine(world))["total_plays"] == base + 1000 - confirmed - again.held

    # a person clears the second surge: its plays come back, the confirmed ones do not
    async with world.sessions() as session:
        done = await pf.review(session, rid, day_ago(0), verdict="cleared", by="second")
    assert done is not None and done.status == "cleared" and done.confirmed_held == confirmed
    assert done.last_decision == "cleared" and done.reviewed_by == "second"
    assert (await mine(world))["total_plays"] == base + 1000 - confirmed

    # judged again later and cleared again: still the same confirmed part
    await add_plays(world, rid, day_ago(0), 600)
    third = await evaluate(world, rid, day_ago(0))
    assert third is not None and third.status == "open" and third.confirmed_held == confirmed
    async with world.sessions() as session:
        await pf.review(session, rid, day_ago(0), verdict="cleared", by="third")
    assert (await mine(world))["total_plays"] == base + 1600 - confirmed


async def test_confirming_a_cleared_day_moves_the_suspected_plays_into_the_confirmed_part(
    world: World,
) -> None:
    await world.create()
    rid = await world.recording(MEMBER_A)
    await history(world, rid)
    await add_plays(world, rid, day_ago(0), 500)
    first = await evaluate(world, rid, day_ago(0))
    assert first is not None
    suspected = first.held
    async with world.sessions() as session:
        await pf.review(session, rid, day_ago(0), verdict="cleared", by="team")
    assert (await mine(world))["total_plays"] == 10 * pf.BASELINE_DAYS + 500
    async with world.sessions() as session:
        await pf.review(session, rid, day_ago(0), verdict="confirmed", by="team")
    assert (await mine(world))["total_plays"] == 10 * pf.BASELINE_DAYS + 500 - suspected
    # confirming twice does not hold the same plays twice
    async with world.sessions() as session:
        again = await pf.review(session, rid, day_ago(0), verdict="confirmed", by="team")
    assert again is not None and again.confirmed_held == suspected and again.held == 0
    assert (await mine(world))["total_plays"] == 10 * pf.BASELINE_DAYS + 500 - suspected


async def test_held_plays_are_off_the_authors_top_list_and_split_by_kind(world: World) -> None:
    await world.create()
    busy = await world.recording(MEMBER_A, title="Busy", kind="kiirtan")
    calm = await world.recording(MEMBER_A, title="Calm", kind="kiirtan")
    await history(world, busy)
    await add_plays(world, busy, day_ago(0), 500)
    await add_plays(world, calm, day_ago(0), 200)
    flag = await evaluate(world, busy, day_ago(0))
    assert flag is not None and flag.held > 0
    shown_busy = 10 * pf.BASELINE_DAYS + 500 - flag.held

    stats = await mine(world)
    by_id = {r["recording_id"]: r["plays"] for r in stats["top_recordings"]}
    assert by_id[str(busy)] == shown_busy
    assert by_id[str(calm)] == 200
    assert stats["total_plays"] == shown_busy + 200
    assert sum(k["count"] for k in stats["by_kind"]) == stats["total_plays"]

    # a person clears it: the plays come back everywhere at once
    async with world.sessions() as session:
        await pf.review(session, busy, day_ago(0), verdict="cleared", by="team")
    stats = await mine(world)
    by_id = {r["recording_id"]: r["plays"] for r in stats["top_recordings"]}
    assert by_id[str(busy)] == 10 * pf.BASELINE_DAYS + 500
    assert sum(k["count"] for k in stats["by_kind"]) == stats["total_plays"]


async def test_plays_from_an_uncounted_flood_do_not_make_real_plays_look_like_one_source(
    world: World,
) -> None:
    """Events over a client's cap are stored but never became plays. They must not feed the
    one-source rule, or anyone could get a recording's real plays held back by spamming it."""
    await world.create()
    rid = await world.recording(MEMBER_A)
    today = datetime.now(UTC).date()
    plays = pf.SOURCE_MIN_PLAYS + 5
    async with world.sessions() as session:
        for i in range(plays):  # real plays, each from a different client
            session.add(_play_event(rid, today, f"real-{i}", counted=True))
        for i in range(plays + 10):  # the flood: one client, over its cap, never counted
            session.add(_play_event(rid, today, f"flood-{i}", counted=False, client="flooder"))
        session.add(PlayDaily(recording_id=rid, day=today, plays=plays))
        await session.commit()
    assert await evaluate(world, rid, today) is None
    assert (await mine(world))["total_plays"] == plays


async def test_one_counted_source_is_still_held_and_never_more_than_the_plays(
    world: World,
) -> None:
    await world.create()
    rid = await world.recording(MEMBER_A)
    today = datetime.now(UTC).date()
    plays = pf.SOURCE_MIN_PLAYS + 10
    async with world.sessions() as session:
        for i in range(plays):
            session.add(_play_event(rid, today, f"mine-{i}", counted=True, client="one-client"))
        session.add(PlayDaily(recording_id=rid, day=today, plays=plays))
        await session.commit()
    flag = await evaluate(world, rid, today)
    assert flag is not None and "one_source" in flag.reason
    assert flag.held == plays - pf.SOURCE_KEEP and flag.held <= flag.plays


def _play_event(
    rid: UUID, day: date, listener: str, *, counted: bool, client: str | None = None
) -> PlayEvent:
    return PlayEvent(
        recording_id=rid,
        day=day,
        listener_key=f"{listener}-{uuid4().hex}"[:64],
        country="PL",
        listened_sec=60,
        created_at=datetime.now(UTC),
        client_key=client or f"client-{listener}",
        counts_listener=counted,
        counted=counted,
    )


async def test_a_held_day_does_not_raise_the_bar_for_the_next(world: World) -> None:
    await world.create()
    rid = await world.recording(MEMBER_A)
    await history(world, rid)
    # yesterday was a flood (already held), today is another one
    async with world.sessions() as session:
        yesterday = await session.get(PlayDaily, (rid, day_ago(1)))
        assert yesterday is not None
        yesterday.plays = 900
        await session.commit()
    await add_plays(world, rid, day_ago(0), 700)
    # judge yesterday first so its excess is recorded, then today
    assert await evaluate(world, rid, day_ago(1)) is not None
    flag = await evaluate(world, rid, day_ago(0))
    assert flag is not None and flag.baseline < 20  # not dragged up by the 900


async def test_a_flood_from_one_client_is_held_through_the_real_endpoint(world: World) -> None:
    await world.create()
    rid = await world.recording(MEMBER_A)
    for i in range(pf.SOURCE_MIN_PLAYS + 10):
        sent = await send(world, [event(rid)], device=f"fake-device-{i:04d}")
        assert sent.json()["accepted"] == 1
    async with world.sessions() as session:
        flag = await session.get(PlayFlag, (rid, datetime.now(UTC).date()))
    assert flag is not None and "one_source" in flag.reason
    assert (await mine(world))["total_plays"] == pf.SOURCE_KEEP


async def test_the_answer_to_the_phone_does_not_reveal_the_flag(world: World) -> None:
    await world.create()
    rid = await world.recording(MEMBER_A)
    last: dict[str, Any] = {}
    for i in range(pf.SOURCE_MIN_PLAYS + 10):
        last = (await send(world, [event(rid)], device=f"fake-device-{i:04d}")).json()
    assert last == {"accepted": 1, "duplicates": 0, "rejected": {}}


async def test_a_failing_check_never_loses_the_plays(
    world: World, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def boom(*args: Any, **kwargs: Any) -> None:
        raise RuntimeError("check is broken")

    monkeypatch.setattr(pf, "evaluate", boom)
    await world.create()
    rid = await world.recording(MEMBER_A)
    sent = await send(world, [event(rid)])
    assert sent.status_code == 200 and sent.json()["accepted"] == 1
    async with world.sessions() as session:
        counted = await session.scalar(select(PlayDaily.plays).where(PlayDaily.recording_id == rid))
    assert counted == 1


def test_a_flag_holds_no_listener_or_address_data() -> None:
    columns = {c.name for c in PlayFlag.__table__.columns}
    assert columns == {
        "recording_id",
        "day",
        "plays",
        "held",
        "baseline",
        "reason",
        "status",
        "created_at",
        "reviewed_by",
        "reviewed_at",
        "reviewed_plays",
        "confirmed_held",
        "last_decision",
    }


# --------------------------------------------------------------------------- the team


@pytest_asyncio.fixture(name="admin")
async def admin_fixture(world: World) -> AsyncIterator[httpx.AsyncClient]:
    app = FastAPI()
    app.include_router(flags_api.router, prefix="/api/v1")
    state = {"admin": True}

    async def db() -> AsyncIterator[AsyncSession]:
        async with world.sessions() as session:
            yield session

    def admin() -> str:
        if not state["admin"]:
            raise HTTPException(status_code=401, detail="Invalid admin credentials")
        return "api-key-admin"

    app.dependency_overrides[get_session] = db
    app.dependency_overrides[require_admin] = admin
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://t") as client:
        client.state = state  # type: ignore[attr-defined]
        yield client


async def test_the_team_lists_and_decides(world: World, admin: httpx.AsyncClient) -> None:
    await world.create()
    rid = await world.recording(MEMBER_A, title="Flooded")
    await history(world, rid)
    await add_plays(world, rid, day_ago(0), 500)
    await evaluate(world, rid, day_ago(0))

    listing = (await admin.get("/api/v1/admin/play-flags")).json()
    assert len(listing) == 1
    row = listing[0]
    assert row["recording_title"] == "Flooded" and row["status"] == "open" and row["held"] > 0
    assert set(row) == {
        "recording_id",
        "recording_title",
        "day",
        "plays",
        "held",
        "confirmed_held",
        "last_decision",
        "baseline",
        "reason",
        "status",
        "created_at",
        "reviewed_by",
        "reviewed_at",
    }

    day = day_ago(0).isoformat()
    confirmed = await admin.post(f"/api/v1/admin/play-flags/{rid}/{day}/confirm")
    assert confirmed.status_code == 200 and confirmed.json()["status"] == "confirmed"
    assert (await admin.get("/api/v1/admin/play-flags")).json() == []
    assert len((await admin.get("/api/v1/admin/play-flags?status=confirmed")).json()) == 1
    cleared = await admin.post(f"/api/v1/admin/play-flags/{rid}/{day}/clear")
    assert cleared.json()["status"] == "cleared"
    missing = await admin.post(f"/api/v1/admin/play-flags/{rid}/{day_ago(3).isoformat()}/clear")
    assert missing.status_code == 404


async def test_the_flags_are_for_the_team_only(world: World, admin: httpx.AsyncClient) -> None:
    admin.state["admin"] = False  # type: ignore[attr-defined]
    assert (await admin.get("/api/v1/admin/play-flags")).status_code == 401
    rid = await world.recording(MEMBER_A)
    day = day_ago(0).isoformat()
    assert (await admin.post(f"/api/v1/admin/play-flags/{rid}/{day}/clear")).status_code == 401
