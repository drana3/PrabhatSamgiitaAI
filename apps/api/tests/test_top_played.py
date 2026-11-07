"""Counted plays of catalogue songs, and the Top Played list.

The counting rules are the recordings' rules (tests/test_author_stats.py, docs/author-profiles.md);
this file pins that the SAME rules hold for a catalogue song, that the caps are not loosened, and
what the list returns (periods, kinds, paging, the minimum, the sources). Design:
docs/radio-mixing.md."""

# ruff: noqa: F811
from __future__ import annotations

import os

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://test:test@localhost/test")

from collections.abc import AsyncIterator
from datetime import UTC, date, datetime, timedelta
from typing import Any
from uuid import UUID

import pytest_asyncio
from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError
from test_author_profiles import AS, World, world  # noqa: F401

from app.models.author_profiles import PlayDaily
from app.models.song_plays import SongPlayDaily, SongPlayEvent
from app.services import author_stats as stats
from app.services import top_played as top

PLAYS = "/api/v1/plays"
TOP = "/api/v1/top-played"
TODAY = datetime.now(UTC).date()


@pytest_asyncio.fixture
async def tw(world: World) -> AsyncIterator[World]:
    """The author tests' world (it has the song tables) plus a bare `songs` table (title lookup)."""
    engine = world.sessions.kw["bind"]
    async with engine.begin() as conn:
        await conn.execute(
            text("CREATE TABLE songs (id INTEGER PRIMARY KEY, number INTEGER, title VARCHAR(255))")
        )
        await conn.execute(text("INSERT INTO songs VALUES (1, 1, 'Bandhu He Niye Calo')"))
    yield world


def song_event(number: int, seconds: int = 60, ago: timedelta = timedelta(minutes=1), **extra: Any):
    return {
        "song_number": number,
        "played_at": (datetime.now(UTC) - ago).isoformat(),
        "listened_sec": seconds,
        **extra,
    }


def rec_event(rid: UUID, seconds: int = 60, ago: timedelta = timedelta(minutes=1)) -> dict:
    return {
        "recording_id": str(rid),
        "played_at": (datetime.now(UTC) - ago).isoformat(),
        "listened_sec": seconds,
    }


async def send(world: World, events: list[dict], device: str | None = "device-0001"):
    payload: dict[str, Any] = {"events": events}
    if device:
        payload["device_id"] = device
    return await world.client.post(PLAYS, json=payload)


async def song_counts(world: World) -> tuple[int, int]:
    async with world.sessions() as session:
        events = await session.scalar(select(func.count()).select_from(SongPlayEvent))
        daily = await session.scalar(select(func.coalesce(func.sum(SongPlayDaily.plays), 0)))
    return int(events or 0), int(daily or 0)


async def put_song_plays(world: World, number: int, plays: int, day: date | None = None) -> None:
    async with world.sessions() as session:
        session.add(SongPlayDaily(song_number=number, day=day or TODAY, plays=plays))
        await session.commit()


async def put_rec_plays(world: World, rid: UUID, plays: int, day: date | None = None) -> None:
    async with world.sessions() as session:
        session.add(PlayDaily(recording_id=rid, day=day or TODAY, plays=plays))
        await session.commit()


# --------------------------------------------------------------------------- counting a song


async def test_a_song_listen_of_30_seconds_counts_and_29_does_not(tw: World) -> None:
    short = await send(tw, [song_event(1, 29)])
    assert short.json() == {"accepted": 0, "duplicates": 0, "rejected": {"short": 1}}
    ok = await send(tw, [song_event(1, 30)])
    assert ok.status_code == 200 and ok.json()["accepted"] == 1
    assert await song_counts(tw) == (1, 1)


async def test_the_phones_claimed_length_cannot_lower_the_bar_for_a_song(tw: World) -> None:
    cheat = await send(tw, [song_event(1, 12, duration_sec=20)])
    assert cheat.json()["rejected"] == {"short": 1}
    assert await song_counts(tw) == (0, 0)


async def test_one_listener_counts_once_per_song_per_day_and_again_tomorrow(tw: World) -> None:
    first = await send(tw, [song_event(1), song_event(1), song_event(2)])
    assert first.json() == {"accepted": 2, "duplicates": 1, "rejected": {}}
    assert (await send(tw, [song_event(1)])).json()["duplicates"] == 1
    tomorrow = await send(tw, [song_event(1, ago=timedelta(days=1))])
    assert tomorrow.json()["accepted"] == 1
    assert await song_counts(tw) == (3, 3)


async def test_different_listeners_count_separately(tw: World) -> None:
    for i in range(3):
        await send(tw, [song_event(7)], device=f"device-300{i}")
    assert await song_counts(tw) == (3, 3)


async def test_the_database_refuses_a_second_count_of_the_same_day(tw: World) -> None:
    async with tw.sessions() as session:
        for _ in range(2):
            session.add(
                SongPlayEvent(
                    song_number=1,
                    day=TODAY,
                    listener_key="abcdef",
                    created_at=datetime.now(UTC),
                )
            )
        try:
            await session.commit()
            raise AssertionError("the unique key did not stop the second row")
        except IntegrityError:
            await session.rollback()


async def test_old_future_and_unknown_songs_are_refused(tw: World) -> None:
    old = await send(tw, [song_event(1, ago=timedelta(days=9))])
    assert old.json()["rejected"] == {"stale": 1}
    future = await send(tw, [song_event(1, ago=-timedelta(hours=2))])
    assert future.json()["rejected"] == {"future": 1}
    # the schema stops numbers outside 1..5018 before they reach the counter
    assert (await send(tw, [song_event(0)])).status_code == 422
    assert (await send(tw, [song_event(5019)])).status_code == 422
    assert await song_counts(tw) == (0, 0)


async def test_an_event_names_a_recording_or_a_song_never_both_or_neither(tw: World) -> None:
    rid = await tw.recording(None)
    both = {**rec_event(rid), "song_number": 3}
    assert (await send(tw, [both])).status_code == 422
    neither = {"played_at": datetime.now(UTC).isoformat(), "listened_sec": 60}
    assert (await send(tw, [neither])).status_code == 422


async def test_a_mixed_batch_counts_both_kinds(tw: World) -> None:
    rid = await tw.recording(None)
    r = await send(tw, [rec_event(rid), song_event(1), song_event(2)])
    assert r.json() == {"accepted": 3, "duplicates": 0, "rejected": {}}
    assert await song_counts(tw) == (2, 2)


async def test_one_batch_limit_covers_recordings_and_songs_together(tw: World) -> None:
    events = [song_event(n) for n in range(1, 51)] + [song_event(100), song_event(101)]
    r = await send(tw, events)
    assert r.json()["accepted"] == 50 and r.json()["rejected"] == {"batch_limit": 2}


async def test_the_daily_cap_of_a_listener_counts_recordings_and_songs_together(
    tw: World, monkeypatch
) -> None:
    monkeypatch.setattr(stats, "DAILY_EVENT_CAP", 2)
    rid = await tw.recording(None)
    assert (await send(tw, [rec_event(rid)])).json()["accepted"] == 1
    assert (await send(tw, [song_event(1)])).json()["accepted"] == 1
    third = await send(tw, [song_event(2)])
    assert third.json() == {"accepted": 0, "duplicates": 0, "rejected": {"limit": 1}}


async def test_a_signed_out_client_over_its_cap_is_stored_but_not_counted(
    tw: World, monkeypatch
) -> None:
    monkeypatch.setattr(stats, "UNSIGNED_PLAYS_PER_CLIENT_PER_RECORDING_DAY", 2)
    for i in range(4):  # four "devices" behind one address, all hearing song 5
        r = await send(tw, [song_event(5)], device=f"device-40{i}")
        assert r.json()["accepted"] == 1  # the phone is told the same every time
    events, daily = await song_counts(tw)
    assert events == 4 and daily == 2  # two counted, two stored and left out of every number
    async with tw.sessions() as session:
        uncounted = await session.scalar(
            select(func.count()).select_from(SongPlayEvent).where(SongPlayEvent.counted.is_(False))
        )
    assert uncounted == 2


async def test_erasing_a_listener_removes_their_song_rows_too(tw: World) -> None:
    await send(tw, [song_event(1)], device="device-5000")
    async with tw.sessions() as session:
        removed = await stats.erase_listener(session, pepper="p", who_values=["d:device-5000"])
        assert removed == 0  # a different pepper: the key does not match
    from app.config import Settings
    from app.services import author_profiles as service

    pepper = service.pepper(
        Settings.model_validate({"_env_file": None, "NEXT_PUBLIC_API_BASE_URL": "http://t"})
    )
    async with tw.sessions() as session:
        removed = await stats.erase_listener(session, pepper=pepper, who_values=["d:device-5000"])
    assert removed == 1
    assert (await song_counts(tw))[0] == 0


# --------------------------------------------------------------------------- the list


async def top_list(world: World, **params: Any) -> dict:
    r = await world.client.get(TOP, params=params)
    assert r.status_code == 200, r.text
    return r.json()


async def test_an_empty_list_says_so(tw: World) -> None:
    page = await top_list(tw)
    assert page["items"] == [] and page["total"] == 0 and page["has_more"] is False
    assert page["since"] is None and page["min_plays"] == top.TOP_MIN_PLAYS


async def test_songs_and_recordings_share_one_ranked_list(tw: World) -> None:
    kiirtan = await tw.recording(None, title="Baba Nam Kevalam", kind="kiirtan")
    await put_rec_plays(tw, kiirtan, 20)
    await put_song_plays(tw, 1, 30)
    await put_song_plays(tw, 2, 8)
    page = await top_list(tw)
    assert [(i["rank"], i["id"], i["plays"]) for i in page["items"]] == [
        (1, "1", 30),
        (2, str(kiirtan), 20),
        (3, "2", 8),
    ]
    first = page["items"][0]
    assert first["ref"] == "ps" and first["kind"] == "prabhat_samgiita"
    assert first["title"] == "Bandhu He Niye Calo" and first["song_number"] == 1
    assert page["items"][2]["title"] == "Prabhat Samgiita 2"  # no row in songs: a plain title
    second = page["items"][1]
    assert second["ref"] == "rec" and second["recording"]["id"] == str(kiirtan)
    assert page["total"] == 3 and page["since"] == TODAY.isoformat()


async def test_items_under_the_minimum_are_not_listed(tw: World) -> None:
    await put_song_plays(tw, 1, top.TOP_MIN_PLAYS - 1)
    await put_song_plays(tw, 2, top.TOP_MIN_PLAYS)
    page = await top_list(tw)
    assert [i["id"] for i in page["items"]] == ["2"]


async def test_the_period_counts_whole_days_ending_today(tw: World) -> None:
    rid = await tw.recording(None, title="Old favourite")
    await put_rec_plays(tw, rid, 50, TODAY - timedelta(days=40))
    await put_rec_plays(tw, rid, 6, TODAY - timedelta(days=6))
    await put_song_plays(tw, 9, 7, TODAY)
    await put_song_plays(tw, 10, 9, TODAY - timedelta(days=7))  # just outside "7d", inside "30d"
    allt = await top_list(tw, period="all")
    assert [(i["id"], i["plays"]) for i in allt["items"]][0] == (str(rid), 56)
    week = await top_list(tw, period="7d")
    assert [(i["id"], i["plays"]) for i in week["items"]] == [("9", 7), (str(rid), 6)]
    month = await top_list(tw, period="30d")
    assert [(i["id"], i["plays"]) for i in month["items"]] == [("10", 9), ("9", 7), (str(rid), 6)]


async def test_a_kind_filter_keeps_only_those_kinds(tw: World) -> None:
    kiirtan = await tw.recording(None, title="K", kind="kiirtan")
    bhajan = await tw.recording(None, title="B", kind="bhajan", language="en")
    ps_rec = await tw.recording(None, title="P", kind="prabhat_samgiita", ps_song_number=3)
    for rid in (kiirtan, bhajan, ps_rec):
        await put_rec_plays(tw, rid, 10)
    await put_song_plays(tw, 1, 10)
    only_k = await top_list(tw, kind="kiirtan")
    assert [i["id"] for i in only_k["items"]] == [str(kiirtan)]
    two = await top_list(tw, kind=["kiirtan", "bhajan"])
    assert {i["id"] for i in two["items"]} == {str(kiirtan), str(bhajan)}
    ps = await top_list(tw, kind="prabhat_samgiita")
    assert {i["id"] for i in ps["items"]} == {
        "1",
        str(ps_rec),
    }  # the catalogue song and the recording
    assert ps["kinds"] == ["prabhat_samgiita"]
    # a kind that does not exist is ignored; with nothing left it is the same as no filter
    ignored = await top_list(tw, kind="nonsense")
    assert ignored["kinds"] == [] and ignored["total"] == 4


async def test_a_legacy_devotional_song_counts_as_a_bhajan(tw: World) -> None:
    legacy = await tw.recording(None, title="Old", kind="devotional_song")
    await put_rec_plays(tw, legacy, 10)
    page = await top_list(tw, kind="bhajan")
    assert [i["id"] for i in page["items"]] == [str(legacy)]
    assert page["items"][0]["kind"] == "bhajan"


async def test_removed_recordings_are_not_listed_and_flagged_ones_are(tw: World) -> None:
    gone = await tw.recording(None, title="Gone", status="removed")
    held = await tw.recording(None, title="Held", status="flagged")
    await put_rec_plays(tw, gone, 99)
    await put_rec_plays(tw, held, 10)
    page = await top_list(tw)
    assert [i["id"] for i in page["items"]] == [str(held)]


async def test_paging_gives_every_item_once_in_order(tw: World) -> None:
    for n in range(1, 8):
        await put_song_plays(tw, n, 10 + n)
    seen: list[str] = []
    offset = 0
    while True:
        page = await top_list(tw, limit=3, offset=offset)
        seen += [i["id"] for i in page["items"]]
        assert [i["rank"] for i in page["items"]] == list(
            range(offset + 1, offset + 1 + len(page["items"]))
        )
        if not page["has_more"]:
            break
        offset += 3
    assert seen == ["7", "6", "5", "4", "3", "2", "1"]


async def test_bad_parameters_are_refused(tw: World) -> None:
    assert (await tw.client.get(TOP, params={"period": "year"})).status_code == 422
    assert (await tw.client.get(TOP, params={"limit": 0})).status_code == 422
    assert (await tw.client.get(TOP, params={"limit": 500})).status_code == 422
    assert (await tw.client.get(TOP, params={"offset": -1})).status_code == 422


async def test_the_list_is_cacheable_for_a_few_minutes(tw: World) -> None:
    r = await tw.client.get(TOP)
    assert r.headers["cache-control"] == "public, max-age=300"


async def test_the_old_open_counter_is_not_what_the_list_counts(tw: World) -> None:
    """`recordings.plays` has no threshold; only counted plays (play_daily) rank a recording."""
    rid = await tw.recording(None, title="Opened a lot", plays=500)
    assert (await top_list(tw))["items"] == []
    await put_rec_plays(tw, rid, 6)
    assert [i["plays"] for i in (await top_list(tw))["items"]] == [6]


async def test_a_counted_song_listen_reaches_the_list(tw: World) -> None:
    """End to end: the phone reports, the counter counts, the list shows it (once it has enough)."""
    for i in range(top.TOP_MIN_PLAYS):
        await send(tw, [song_event(1)], device=f"device-60{i}")
    page = await top_list(tw)
    assert [(i["id"], i["plays"]) for i in page["items"]] == [("1", top.TOP_MIN_PLAYS)]


# --------------------------------------------------------------------------- one cap, two doors


async def recording_daily_total(world: World) -> int:
    async with world.sessions() as session:
        return int(await session.scalar(select(func.coalesce(func.sum(PlayDaily.plays), 0))) or 0)


async def test_the_listener_cap_is_shared_songs_first_then_recordings(
    tw: World, monkeypatch
) -> None:
    monkeypatch.setattr(stats, "DAILY_EVENT_CAP", 2)
    rid = await tw.recording(None)
    assert (await send(tw, [song_event(1), song_event(2)])).json()["accepted"] == 2
    over = await send(tw, [rec_event(rid)])
    assert over.json() == {"accepted": 0, "duplicates": 0, "rejected": {"limit": 1}}
    assert await recording_daily_total(tw) == 0


async def test_the_listener_cap_is_shared_recordings_first_then_songs(
    tw: World, monkeypatch
) -> None:
    monkeypatch.setattr(stats, "DAILY_EVENT_CAP", 2)
    first = await tw.recording(None, title="One")
    second = await tw.recording(None, title="Two")
    assert (await send(tw, [rec_event(first), rec_event(second)])).json()["accepted"] == 2
    over = await send(tw, [song_event(1)])
    assert over.json() == {"accepted": 0, "duplicates": 0, "rejected": {"limit": 1}}
    assert await song_counts(tw) == (0, 0)


async def test_the_client_day_cap_is_shared_songs_first_then_recordings(
    tw: World, monkeypatch
) -> None:
    monkeypatch.setattr(stats, "UNSIGNED_PLAYS_PER_CLIENT_PER_DAY", 3)
    rid = await tw.recording(None)
    for i in range(3):  # three devices behind one address fill the client's day with songs
        await send(tw, [song_event(10 + i)], device=f"device-70{i}")
    assert await song_counts(tw) == (3, 3)
    late = await send(tw, [rec_event(rid)], device="device-7099")
    assert late.json()["accepted"] == 1  # the phone is told the same
    assert await recording_daily_total(tw) == 0  # stored, but in no public number


async def test_the_client_day_cap_is_shared_recordings_first_then_songs(
    tw: World, monkeypatch
) -> None:
    monkeypatch.setattr(stats, "UNSIGNED_PLAYS_PER_CLIENT_PER_DAY", 3)
    for i in range(3):
        rid = await tw.recording(None, title=f"R{i}")
        await send(tw, [rec_event(rid)], device=f"device-80{i}")
    assert await recording_daily_total(tw) == 3
    late = await send(tw, [song_event(5)], device="device-8099")
    assert late.json()["accepted"] == 1
    assert await song_counts(tw) == (1, 0)  # stored, but not counted


async def test_signed_in_members_are_not_held_by_the_client_caps(tw: World, monkeypatch) -> None:
    monkeypatch.setattr(stats, "UNSIGNED_PLAYS_PER_CLIENT_PER_DAY", 1)
    monkeypatch.setattr(stats, "UNSIGNED_PLAYS_PER_CLIENT_PER_RECORDING_DAY", 1)
    rec_a = await tw.recording(None, title="A")
    rec_b = await tw.recording(None, title="B")
    r = await tw.client.post(
        PLAYS,
        json={"events": [rec_event(rec_a), rec_event(rec_b), song_event(1), song_event(2)]},
        headers=AS["a"],
    )
    assert r.json() == {"accepted": 4, "duplicates": 0, "rejected": {}}
    assert await recording_daily_total(tw) == 2
    assert await song_counts(tw) == (2, 2)
