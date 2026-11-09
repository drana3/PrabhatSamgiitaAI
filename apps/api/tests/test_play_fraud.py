"""Suspicious play counts: the rule, what authors see, what the team can do (docs/play-fraud.md)."""

# ruff: noqa: F811
from __future__ import annotations

import os

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://test:test@localhost/test")

from collections.abc import AsyncIterator
from datetime import UTC, date, datetime, timedelta
from typing import Any, cast
from uuid import UUID

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
from app.models.author_profiles import PlayDaily
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
    assert after is not None and after.status == "confirmed" and after.held == held
    assert (await mine(world))["total_plays"] == 10 * pf.BASELINE_DAYS + 500 + 100 - held


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
