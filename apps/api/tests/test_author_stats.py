"""Listening statistics end to end: what is counted, what is refused, what the page may show.

The rules these pin are in docs/author-profiles.md ("Statistics")."""

# ruff: noqa: F811
from __future__ import annotations

import os

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://test:test@localhost/test")

from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID, uuid4

import httpx
import pytest
from sqlalchemy import func, select
from test_author_profiles import AS, MEMBER_A, MEMBER_B, URL, World, world  # noqa: F401

from app.api.v1.author_profiles import PLAY_BATCHES_PER_MINUTE_PER_HOST
from app.models.author_profiles import AuthorStatsSnapshot, PlayDaily, PlayEvent
from app.services import author_stats as stats

PLAYS = "/api/v1/plays"


def event(
    rid: UUID, seconds: int = 60, ago: timedelta = timedelta(minutes=1), **extra: Any
) -> dict:
    return {
        "recording_id": str(rid),
        "played_at": (datetime.now(UTC) - ago).isoformat(),
        "listened_sec": seconds,
        **extra,
    }


async def send(
    world: World,
    events: list[dict],
    device: str | None = "device-0001",
    who: str | None = None,
    **extra: Any,
) -> httpx.Response:
    payload: dict[str, Any] = {"events": events, **extra}
    if device:
        payload["device_id"] = device
    headers = AS[who] if who else {}
    return await world.client.post(PLAYS, json=payload, headers=headers)


async def counts(world: World) -> tuple[int, int]:
    async with world.sessions() as session:
        events = await session.scalar(select(func.count()).select_from(PlayEvent))
        daily = await session.scalar(select(func.coalesce(func.sum(PlayDaily.plays), 0)))
    return int(events or 0), int(daily or 0)


# --------------------------------------------------------------------------- what counts


async def test_a_listen_of_30_seconds_counts_and_29_does_not(world: World) -> None:
    rid = await world.recording(None, duration=300)
    short = await send(world, [event(rid, 29)])
    assert short.json() == {"accepted": 0, "duplicates": 0, "rejected": {"short": 1}}
    ok = await send(world, [event(rid, 30)])
    assert ok.status_code == 200 and ok.json()["accepted"] == 1
    assert await counts(world) == (1, 1)


async def test_half_of_a_short_track_counts(world: World) -> None:
    rid = await world.recording(None, duration=24)
    assert (await send(world, [event(rid, 11)])).json()["rejected"] == {"short": 1}
    assert (await send(world, [event(rid, 12)])).json()["accepted"] == 1


async def test_the_server_uses_its_own_length_not_the_phones(world: World) -> None:
    rid = await world.recording(None, duration=600)
    cheat = await send(world, [event(rid, 12, duration_sec=20)])  # the phone says 20 s long
    assert cheat.json()["rejected"] == {"short": 1}


async def test_one_listener_counts_once_per_recording_per_day(world: World) -> None:
    rid = await world.recording(None)
    other = await world.recording(None, title="Other")
    first = await send(world, [event(rid), event(rid), event(other)])
    assert first.json() == {"accepted": 2, "duplicates": 1, "rejected": {}}
    again = await send(world, [event(rid)])
    assert again.json()["duplicates"] == 1 and again.json()["accepted"] == 0
    assert await counts(world) == (2, 2)


async def test_the_same_listener_counts_again_the_next_day(world: World) -> None:
    rid = await world.recording(None)
    await send(world, [event(rid)])
    tomorrow = await send(world, [event(rid, ago=timedelta(days=1))])
    assert tomorrow.json()["accepted"] == 1
    assert await counts(world) == (2, 2)


async def test_different_listeners_count_separately(world: World) -> None:
    rid = await world.recording(None)
    for i in range(3):
        await send(world, [event(rid)], device=f"device-100{i}")
    assert await counts(world) == (3, 3)


async def test_the_database_itself_refuses_a_second_count_of_the_same_day(world: World) -> None:
    """The rule is a unique key, not only a code check, so two requests at once cannot both win."""
    from sqlalchemy.exc import IntegrityError

    rid = await world.recording(None)
    async with world.sessions() as session:
        for _ in range(2):
            session.add(
                PlayEvent(
                    recording_id=rid,
                    day=datetime.now(UTC).date(),
                    listener_key="abcdef",
                    listened_sec=60,
                    created_at=datetime.now(UTC),
                )
            )
        raised = False
        try:
            await session.commit()
        except IntegrityError:
            raised = True
    assert raised


async def test_my_own_listening_to_my_own_recording_is_not_counted(world: World) -> None:
    mine = await world.recording(MEMBER_A)
    theirs = await world.recording(MEMBER_B)
    r = await send(world, [event(mine), event(theirs)], device=None, who="a")
    assert r.json() == {"accepted": 1, "duplicates": 0, "rejected": {"own": 1}}


async def test_old_future_unknown_and_removed_recordings_are_refused(world: World) -> None:
    rid = await world.recording(None)
    gone = await world.recording(None, title="Gone", status="removed")
    r = await send(
        world,
        [
            event(rid, ago=timedelta(days=8)),
            event(rid, ago=timedelta(minutes=-30)),
            event(uuid4()),
            event(gone),
        ],
    )
    assert r.json() == {
        "accepted": 0,
        "duplicates": 0,
        "rejected": {"stale": 1, "future": 1, "unknown": 2},
    }
    assert await counts(world) == (0, 0)


async def test_a_listener_is_needed_but_not_an_account(world: World) -> None:
    rid = await world.recording(None)
    assert (await send(world, [event(rid)], device=None)).status_code == 400
    assert (await send(world, [event(rid)], device="short")).status_code == 422
    assert (await send(world, [event(rid)], device="bad id with spaces!")).status_code == 400
    assert (await send(world, [event(rid)], device="device-0001")).status_code == 200
    assert (await send(world, [event(rid)], device=None, who="b")).status_code == 200


async def test_a_batch_has_a_size_limit(world: World) -> None:
    rid = await world.recording(None)
    assert (await send(world, [])).status_code == 422
    too_many = [event(rid) for _ in range(201)]
    assert (await send(world, too_many)).status_code == 422
    batch = [
        event(await world.recording(None, title=f"R{i}"))
        for i in range(stats.MAX_EVENTS_PER_BATCH + 3)
    ]
    r = await send(world, batch)
    assert r.json()["accepted"] == stats.MAX_EVENTS_PER_BATCH
    assert r.json()["rejected"] == {"batch_limit": 3}


async def test_a_script_is_stopped(world: World) -> None:
    rid = await world.recording(None)
    last = None
    for i in range(PLAY_BATCHES_PER_MINUTE_PER_HOST + 2):
        last = await send(world, [event(rid)], device=f"device-{i:05d}")
        if last.status_code == 429:
            break
    assert last is not None and last.status_code == 429


async def test_what_is_stored_holds_no_member_device_or_address(world: World) -> None:
    rid = await world.recording(None)
    await send(world, [event(rid)], device="device-secret-77", region="pl")
    await send(world, [event(rid)], device=None, who="b")
    async with world.sessions() as session:
        rows = (await session.scalars(select(PlayEvent))).all()
    assert len(rows) == 2
    for row in rows:
        values = " ".join(str(v) for v in vars(row).values()).lower()
        assert "device-secret" not in values and str(MEMBER_B).lower() not in values
        assert len(row.listener_key) == stats.LISTENER_KEY_BITS // 4
    assert {row.country for row in rows} == {"PL", None}
    columns = {c.name for c in PlayEvent.__table__.columns}
    assert not columns & {"member_id", "user_id", "device_id", "ip", "ip_address", "user_agent"}


# --------------------------------------------------------------------------- what a page may show


async def test_a_new_page_shows_no_numbers_only_when_counting_started(world: World) -> None:
    await world.create()
    rid = await world.recording(MEMBER_A)
    page = (await world.get("madhu-vrata")).json()
    assert page["stats"] == {
        "enough_data": False,
        "counting_since": None,
        "monthly_listeners": None,
        "total_plays": None,
    }
    for i in range(stats.MIN_PUBLIC_PLAYS - 1):
        await send(world, [event(rid)], device=f"device-200{i}")
    page = (await world.get("madhu-vrata", who="a")).json()
    assert page["stats"]["enough_data"] is False  # 4 plays are not a number worth showing
    assert page["stats"]["monthly_listeners"] is None and page["stats"]["total_plays"] is None
    assert page["stats"]["counting_since"] == datetime.now(UTC).date().isoformat()


async def test_numbers_appear_after_enough_plays(world: World) -> None:
    await world.create()
    rid = await world.recording(MEMBER_A)
    for i in range(stats.MIN_PUBLIC_PLAYS):
        await send(world, [event(rid)], device=f"device-300{i}")
    async with world.sessions() as session:
        snap = await session.get(AuthorStatsSnapshot, (await world.profile("madhu-vrata")).id)
        if snap:  # the page was read before: let the numbers be worked out again
            snap.computed_at = datetime.now(UTC) - timedelta(hours=1)
            await session.commit()
    page = (await world.get("madhu-vrata")).json()
    assert page["stats"]["enough_data"] is True
    assert page["stats"]["total_plays"] == stats.MIN_PUBLIC_PLAYS
    assert page["stats"]["monthly_listeners"] == stats.MIN_PUBLIC_PLAYS


async def test_the_owner_can_switch_the_numbers_off(world: World) -> None:
    await world.create()
    rid = await world.recording(MEMBER_A)
    await world.listen(rid, 10)
    assert (await world.get("madhu-vrata")).json()["stats"]["enough_data"] is True
    await world.client.patch(f"{URL}/me", headers=AS["a"], json={"show_stats": False})
    assert (await world.get("madhu-vrata")).json()["stats"] is None
    mine = (await world.client.get(f"{URL}/me/stats", headers=AS["a"])).json()
    assert (
        mine["total_plays"] == 10 and mine["public_visible"] is False
    )  # the owner still sees them


async def test_the_page_counts_the_plays_of_its_own_recordings_only(world: World) -> None:
    await world.create()
    await world.create(who="b", slug="bhakti-music", display_name="Bhakti Music")
    ra = await world.recording(MEMBER_A)
    rb = await world.recording(MEMBER_B)
    await world.listen(ra, 12)
    await world.listen(rb, 20)
    a = (await world.get("madhu-vrata")).json()["stats"]
    b = (await world.get("bhakti-music")).json()["stats"]
    assert (a["total_plays"], b["total_plays"]) == (12, 20)


# --------------------------------------------------------------------------- the owner's numbers


async def test_owner_statistics(world: World) -> None:
    await world.create()
    rid = await world.recording(MEMBER_A, title="Popular")
    quiet = await world.recording(MEMBER_A, title="Quiet", kind="bhajan")
    today = datetime.now(UTC).date()
    await world.listen(rid, 9, day=today)
    await world.listen(rid, 3, day=today - timedelta(days=2))
    await world.listen(quiet, 2, day=today - timedelta(days=40))  # outside the month
    s = (await world.client.get(f"{URL}/me/stats", headers=AS["a"], params={"days": 7})).json()
    assert s["period_days"] == 7 and len(s["series"]) == 7  # zero days are there too
    assert s["series"][-1] == {"day": today.isoformat(), "plays": 9, "listeners": 9}
    assert s["series"][-3]["plays"] == 3 and s["series"][-2]["plays"] == 0
    assert s["total_plays"] == 14 and s["plays_in_period"] == 12
    assert s["monthly_listeners"] == 12 and s["public_enough_data"] is True
    assert s["top_recordings"][0] == {
        "recording_id": str(rid),
        "title": "Popular",
        "kind": "kiirtan",
        "plays": 12,
    }
    assert s["by_kind"] == [{"kind": "kiirtan", "count": 12}]
    assert "counting_rule" in s["notes"] and "listener_estimate" in s["notes"]
    month = (await world.client.get(f"{URL}/me/stats", headers=AS["a"], params={"days": 90})).json()
    assert len(month["series"]) == 90 and month["plays_in_period"] == 14
    assert (
        await world.client.get(f"{URL}/me/stats", headers=AS["a"], params={"days": 5})
    ).status_code == 422


async def test_owner_statistics_are_private_and_honest_with_no_data(world: World) -> None:
    assert (await world.client.get(f"{URL}/me/stats")).status_code == 401
    assert (
        await world.client.get(f"{URL}/me/stats", headers=AS["b"])
    ).status_code == 404  # no page
    await world.create()
    await world.recording(MEMBER_A)
    s = (await world.client.get(f"{URL}/me/stats", headers=AS["a"])).json()
    assert s["total_plays"] == 0 and s["counting_since"] is None and "no_data_yet" in s["notes"]
    assert s["top_recordings"] == [] and s["countries"] is None


async def test_countries_are_shown_only_when_nobody_can_be_singled_out(world: World) -> None:
    await world.create()
    rid = await world.recording(MEMBER_A)
    await world.listen(rid, 6, country="PL")
    await world.listen(rid, 3, country="IS")
    first = (await world.client.get(f"{URL}/me/stats", headers=AS["a"])).json()
    assert first["countries"] is None and "countries_hidden" in first["notes"]  # 9 listeners in all
    await world.listen(rid, 12, country="DE", day=datetime.now(UTC).date() - timedelta(days=1))
    shown = (await world.client.get(f"{URL}/me/stats", headers=AS["a"])).json()
    assert shown["countries"] == [
        {"country": "DE", "listeners": 12},
        {"country": "PL", "listeners": 6},
    ]  # Iceland has only 3 listeners: it is not named


# --------------------------------------------------------------------------- keeping data


async def test_raw_events_are_deleted_after_the_retention_but_the_counters_stay(
    world: World,
) -> None:
    rid = await world.recording(None)
    old = datetime.now(UTC).date() - timedelta(days=stats.PLAY_EVENT_RETENTION_DAYS + 5)
    await world.listen(rid, 4, day=old)
    await world.listen(rid, 2)
    async with world.sessions() as session:
        removed = await stats.prune_play_events(session, force=True)
    assert removed == 4
    events, daily = await counts(world)
    assert events == 2 and daily == 6  # the counters keep the old days
    async with world.sessions() as session:
        again = await stats.prune_play_events(session)  # throttled: once a day
    assert again == 0


async def test_a_listener_can_have_their_raw_rows_erased(world: World) -> None:
    rid = await world.recording(None)
    await send(world, [event(rid)], device=None, who="b")
    await send(world, [event(rid)], device="device-0009")
    from test_author_profiles import Settings

    settings = Settings.model_validate({"_env_file": None, "NEXT_PUBLIC_API_BASE_URL": "http://t"})
    from app.services.author_profiles import pepper

    async with world.sessions() as session:
        removed = await stats.erase_listener(
            session, pepper=pepper(settings), who_values=[f"m:{MEMBER_B}"]
        )
    assert removed == 1
    assert (await counts(world))[0] == 1


# ------------------------------------------------------------------ one client, many device ids


async def test_one_client_cannot_make_many_new_listeners_with_made_up_device_ids(
    world: World,
) -> None:
    await world.create()  # member A's published page
    rid = await world.recording(MEMBER_A)
    for i in range(40):
        sent = await send(world, [event(rid)], device=f"fake-device-{i:04d}")
        assert sent.json()["accepted"] == 1
    # every play counts as a play ...
    assert (await counts(world)) == (40, 40)
    # ... but only a few of the devices are new listeners
    async with world.sessions() as session:
        listeners = await session.scalar(
            select(func.count(func.distinct(PlayEvent.listener_key))).where(
                PlayEvent.counts_listener.is_(True)
            )
        )
    assert listeners == stats.NEW_LISTENERS_PER_CLIENT_PER_RECORDING_DAY
    mine = (await world.client.get(f"{URL}/me/stats", headers=AS["a"])).json()
    assert mine["total_plays"] == 40
    assert mine["monthly_listeners"] == stats.NEW_LISTENERS_PER_CLIENT_PER_RECORDING_DAY
    assert mine["series"][-1]["listeners"] == stats.NEW_LISTENERS_PER_CLIENT_PER_RECORDING_DAY


async def test_one_client_is_also_capped_over_all_recordings_in_a_day(world: World) -> None:
    await world.create()
    total = stats.NEW_LISTENERS_PER_CLIENT_PER_DAY + 10
    for i in range(total):
        rid = await world.recording(MEMBER_A, title=f"Song {i}")
        await send(world, [event(rid)], device=f"fake-device-{i:04d}")
    mine = (await world.client.get(f"{URL}/me/stats", headers=AS["a"])).json()
    assert mine["total_plays"] == total
    assert mine["monthly_listeners"] == stats.NEW_LISTENERS_PER_CLIENT_PER_DAY


async def test_one_client_plays_over_the_daily_cap_are_stored_but_not_counted(
    world: World, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(stats, "UNSIGNED_PLAYS_PER_CLIENT_PER_RECORDING_DAY", 6)
    monkeypatch.setattr(stats, "UNSIGNED_PLAYS_PER_CLIENT_PER_DAY", 9)
    await world.create()
    rid = await world.recording(MEMBER_A)
    for i in range(20):
        sent = await send(world, [event(rid)], device=f"forged-device-{i:04d}")
        assert sent.json()["accepted"] == 1  # the app is told nothing about the cap
        assert sent.json()["rejected"] == {}
    async with world.sessions() as session:
        stored = int(await session.scalar(select(func.count()).select_from(PlayEvent)) or 0)
        counted_listeners = int(
            await session.scalar(select(func.count()).where(PlayEvent.counts_listener.is_(True)))
            or 0
        )
    assert stored == 20  # every play is kept
    assert (await counts(world))[1] == 6  # but only 6 are in the public counters
    mine = (await world.client.get(f"{URL}/me/stats", headers=AS["a"])).json()
    assert mine["total_plays"] == 6
    assert mine["monthly_listeners"] == counted_listeners <= 6


async def test_one_client_is_also_capped_in_plays_over_all_recordings_in_a_day(
    world: World, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(stats, "UNSIGNED_PLAYS_PER_CLIENT_PER_RECORDING_DAY", 6)
    monkeypatch.setattr(stats, "UNSIGNED_PLAYS_PER_CLIENT_PER_DAY", 9)
    await world.create()
    for n in range(3):
        rid = await world.recording(MEMBER_A, title=f"Song {n}")
        for i in range(4):  # under the per-recording cap each time
            await send(world, [event(rid)], device=f"forged-device-{n}-{i}")
    events, counted = await counts(world)
    assert events == 12 and counted == 9


async def test_signed_in_listeners_are_not_held_by_the_client_play_cap(
    world: World, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(stats, "UNSIGNED_PLAYS_PER_CLIENT_PER_RECORDING_DAY", 1)
    monkeypatch.setattr(stats, "UNSIGNED_PLAYS_PER_CLIENT_PER_DAY", 1)
    await world.create()
    rid = await world.recording(MEMBER_A)
    for who in ("b", "c"):
        await send(world, [event(rid)], device=None, who=who)
    assert (await counts(world))[1] == 2


async def test_a_device_already_counted_today_is_never_dropped(world: World) -> None:
    await world.create()
    first = await world.recording(MEMBER_A, title="One")
    second = await world.recording(MEMBER_A, title="Two")
    await send(world, [event(first)], device="device-real-1")
    for i in range(10):
        await send(world, [event(first)], device=f"fake-device-{i:04d}")
    # the real listener, counted first, is still a listener when they play another song
    await send(world, [event(second)], device="device-real-1")
    async with world.sessions() as session:
        rows = (
            await session.scalars(select(PlayEvent).where(PlayEvent.recording_id == second))
        ).all()
    assert [r.counts_listener for r in rows] == [True]


async def test_the_client_address_is_never_stored(world: World) -> None:
    rid = await world.recording(None)
    await send(world, [event(rid)], device="device-0001")
    async with world.sessions() as session:
        row = (await session.scalars(select(PlayEvent))).one()
    assert row.client_key is not None and len(row.client_key) == 12
    for column in (row.client_key, row.listener_key, row.country or ""):
        assert "127.0.0.1" not in column and "testclient" not in column
    assert stats.client_key("pepper", "203.0.113.5") != stats.client_key("pepper", "203.0.113.6")
    assert stats.client_key("pepper", "203.0.113.5") != stats.client_key("other", "203.0.113.5")
    # one person owns a whole IPv6 /64: its addresses are one client
    assert stats.client_key("p", "2001:db8:1:2::1") == stats.client_key("p", "2001:db8:1:2:ffff::9")


async def test_signed_in_listeners_are_not_capped_by_the_client(world: World) -> None:
    await world.create()
    rid = await world.recording(MEMBER_A)
    for who in ("b", "c"):
        await send(world, [event(rid)], device=None, who=who)
    async with world.sessions() as session:
        rows = (await session.scalars(select(PlayEvent))).all()
    assert all(r.counts_listener and r.client_key is None for r in rows)
