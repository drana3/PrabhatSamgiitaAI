"""A recording of a live broadcast made with the ordinary upload wizard (`broadcast_id`).

The real recordings routes on an in-memory SQLite database and local disk storage. What PostgreSQL
does is NOT covered here."""

from __future__ import annotations

import os
from collections.abc import AsyncIterator
from datetime import timedelta
from pathlib import Path
from typing import cast
from uuid import UUID, uuid4

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://test:test@localhost/test")

import pytest
import pytest_asyncio
from sqlalchemy import Table, func, select

from app.models import Base
from app.models.broadcasts import Broadcast, BroadcastDecision, BroadcastRecording, BroadcastReport
from app.models.recordings import Recording
from app.services.recordings import now_utc
from tests.test_recordings import MEMBER_A, MEMBER_B, World, build_world, mp3

pytestmark = pytest.mark.asyncio


@pytest_asyncio.fixture(name="world")
async def world_fixture(tmp_path: Path) -> AsyncIterator[World]:
    async with build_world(tmp_path, file_database=False) as built:
        engine = built.sessions.kw["bind"]
        tables = [
            cast(Table, m.__table__)
            for m in (Broadcast, BroadcastReport, BroadcastDecision, BroadcastRecording)
        ]
        async with engine.begin() as conn:
            await conn.run_sync(lambda c: Base.metadata.create_all(c, tables=tables))
        yield built


async def broadcast(
    world: World, *, ended: bool = True, title: str = "Nine days of Kiirtan"
) -> UUID:
    row = Broadcast(
        id=uuid4(),
        member_id=MEMBER_A,
        provider="zoom",
        url="https://zoom.us/j/1",
        host="zoom.us",
        title=title,
        starts_at=now_utc() - timedelta(days=9),
        ended_at=now_utc() - timedelta(hours=1) if ended else None,
    )
    async with world.sessions() as session:
        session.add(row)
        await session.commit()
    return row.id


async def links(world: World) -> list[BroadcastRecording]:
    return await world.sessions_scalars(select(BroadcastRecording))


async def test_the_author_of_the_broadcast_links_a_recording_at_once(world: World) -> None:
    bid = await broadcast(world)
    done = await world.publish("a", mp3(1), broadcast_id=str(bid))
    assert done.status_code == 201, done.text
    [link] = await links(world)
    assert link.kind == "file" and link.status == "accepted" and link.source == "author"
    assert str(link.recording_id) == done.json()["id"] and link.broadcast_id == bid
    # its own page says where it came from
    page = await world.client.get(f"/api/v1/recordings/{done.json()['id']}")
    mark = page.json()["from_broadcast"]
    assert mark["title"] == "Nine days of Kiirtan" and mark["id"] == str(bid)
    assert mark["date"] == (now_utc() - timedelta(days=9)).date().isoformat()


async def test_another_member_suggests_and_the_mark_waits_for_the_team(world: World) -> None:
    bid = await broadcast(world)
    done = await world.publish("b", mp3(2), broadcast_id=str(bid))
    assert done.status_code == 201, done.text
    [link] = await links(world)
    assert link.status == "pending" and link.source == "member" and link.member_id == MEMBER_B
    page = await world.client.get(f"/api/v1/recordings/{done.json()['id']}")
    assert page.json()["from_broadcast"] is None  # not accepted yet: no mark
    # the recording itself is an ordinary one, theirs, in the library
    assert page.json()["author_id"] == str(MEMBER_B)


async def test_it_is_refused_before_anything_is_stored_when_the_broadcast_cannot_take_it(
    world: World,
) -> None:
    live = await broadcast(world, ended=False)
    for bad in (str(uuid4()), str(live)):
        got = await world.publish("a", mp3(3), broadcast_id=bad)
        assert got.status_code in (404, 409), got.text
    count = await world.scalar(select(func.count()).select_from(Recording))
    assert count == 0 and await links(world) == []
    # without a broadcast the wizard works as before
    assert (await world.publish("a", mp3(4))).status_code == 201
    assert await links(world) == []
