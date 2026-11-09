"""The recording of an ended broadcast: a link (allowlist, author and team, suggestions).

An in-memory SQLite database. The internet is a fake and nothing is ever downloaded. What
PostgreSQL does is NOT covered here."""

from __future__ import annotations

import os
from datetime import timedelta
from uuid import UUID

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://test:test@localhost/test")

import pytest

from app.models import UserAccount
from app.models.broadcasts import Broadcast, BroadcastRecording
from app.models.recordings import Recording
from app.services import broadcast_recordings as recordings
from app.services.recordings import now_utc
from app.services.video_links import VideoRefusedError
from tests.extras_support import MEMBER_A, REC, World
from tests.test_broadcasts import (  # noqa: F401  (fixtures used by name)
    URL,
    ZOOM,
    net,
    post,
    shelf,
    world_fixture,
)

pytestmark = pytest.mark.asyncio

ZOOM_REC = "https://us02web.zoom.us/rec/share/AbCdEf123-xyz"
YT_VIDEO = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"


async def ended_broadcast(world: World, who: str = "a", **fields: object) -> str:
    made = (await post(world, who, **fields)).json()
    await world.update(Broadcast, UUID(made["id"]), ended_at=now_utc() - timedelta(minutes=5))
    return made["id"]


async def add(world: World, rid: str, who: str, url: str = ZOOM_REC):  # type: ignore[no-untyped-def]
    return await world.call("POST", f"{URL}/{rid}/recordings", who, json={"url": url})


@pytest.mark.parametrize(
    ("raw", "provider"),
    [
        (YT_VIDEO, "youtube"),
        ("https://youtu.be/dQw4w9WgXcQ?si=x", "youtube"),
        (ZOOM_REC, "zoom"),
        ("https://vimeo.com/123456789", "other"),
        ("https://archive.org/details/satsang-2026", "other"),
    ],
)
async def test_good_recording_links(raw: str, provider: str) -> None:
    assert recordings.parse_recording_url(raw)[0] == provider


@pytest.mark.parametrize(
    "raw",
    [
        ZOOM,  # the meeting itself, not a recording
        "https://zoom.us/j/81234567890",
        "http://vimeo.com/123456789",  # not https
        "https://vimeo.com.evil.example/123",  # a look-alike
        "https://example.org/recording.mp4",  # not on the list
        "https://facebook.com/someone/videos/1",
        "https://user:pass@vimeo.com/1",
        "https://192.168.0.1/rec/share/x",
        "https://vimeo.com:8443/1",
        "javascript:alert(1)",
        "https://www.youtube.com/@somechannel",
        "",
    ],
)
async def test_bad_recording_links_are_refused(raw: str) -> None:
    with pytest.raises(VideoRefusedError):
        recordings.parse_recording_url(raw)


async def test_a_recording_can_only_be_added_after_the_end(world: World) -> None:
    rid = (await post(world)).json()["id"]
    got = await add(world, rid, "a")
    assert got.status_code == 409 and got.headers["X-Error-Code"] == "broadcast_not_ended"
    [live] = await shelf(world, "a")
    assert live["recording_action"] is None
    await world.call("POST", f"{URL}/{rid}/end", "a")
    ok = await add(world, rid, "a")
    assert ok.status_code == 201, ok.text
    assert ok.json()["kind"] == "link" and ok.json()["status"] == "accepted"
    assert ok.json()["source"] == "author" and ok.json()["provider"] == "zoom"


async def test_the_author_and_the_team_add_others_suggest_and_the_team_decides(
    world: World,
) -> None:
    rid = await ended_broadcast(world)
    got = (await world.call("GET", f"{URL}/{rid}", "b")).json()
    assert got["recording_action"] == "suggest"
    assert (await world.call("GET", f"{URL}/{rid}", "a")).json()["recording_action"] == "add"
    assert (await world.call("GET", f"{URL}/{rid}", "team")).json()["recording_action"] == "add"
    assert (await world.call("GET", f"{URL}/{rid}")).json()["recording_action"] is None
    assert (await add(world, rid, None)).status_code == 401

    suggested = await add(world, rid, "b", "https://vimeo.com/55")
    assert suggested.status_code == 201
    assert suggested.json()["status"] == "pending" and suggested.json()["mine"] is True
    link_id = suggested.json()["id"]
    # only the person who suggested it, and the team, see it
    seen = {
        who: (await world.call("GET", f"{URL}/{rid}", who)).json()
        for who in ("a", "b", "c", "team")
    }
    assert [r["status"] for r in seen["b"]["recordings"]] == ["pending"]
    assert [r["status"] for r in seen["team"]["recordings"]] == ["pending"]
    assert seen["a"]["recordings"] == [] and seen["c"]["recordings"] == []
    # the team's queue has it; nobody else may read or decide it
    queue = (await world.call("GET", f"{URL}/recording-suggestions", "team")).json()
    assert queue["total"] == 1 and queue["items"][0]["broadcast_title"] == "Sunday satsang"
    assert (await world.call("GET", f"{URL}/recording-suggestions", "a")).status_code == 403
    path = f"{URL}/recording-suggestions/{link_id}"
    assert (await world.call("POST", f"{path}/accept", "a")).status_code == 403
    assert (await world.call("POST", f"{path}/accept", "team")).status_code == 204
    assert (await world.call("POST", f"{path}/accept", "team")).status_code == 409
    again = (await world.call("GET", f"{URL}/{rid}", "c")).json()
    assert [r["url"] for r in again["recordings"]] == ["https://vimeo.com/55"]
    # a rejected suggestion is gone for good
    second = await add(world, rid, "b", "https://vimeo.com/56")
    assert (
        await world.call(
            "POST", f"{URL}/recording-suggestions/{second.json()['id']}/reject", "team"
        )
    ).status_code == 204
    gone = (await world.call("GET", f"{URL}/{rid}", "b")).json()
    assert [r["url"] for r in gone["recordings"]] == ["https://vimeo.com/55"]


async def test_the_same_link_twice_and_the_limits(world: World) -> None:
    rid = await ended_broadcast(world)
    assert (await add(world, rid, "a")).status_code == 201
    dup = await add(world, rid, "a")
    assert dup.status_code == 409 and dup.headers["X-Error-Code"] == "broadcast_recording_duplicate"
    # a bad link is told with its own code
    bad = await add(world, rid, "a", "https://example.org/x.mp4")
    assert bad.status_code == 422 and bad.headers["X-Error-Code"] == "broadcast_recording_link"
    # a member has two suggestions waiting at most
    assert (await add(world, rid, "b", "https://vimeo.com/1")).status_code == 201
    assert (await add(world, rid, "b", "https://vimeo.com/2")).status_code == 201
    third = await add(world, rid, "b", "https://vimeo.com/3")
    assert third.status_code == 409
    # the broadcast holds five accepted recordings at most
    for n in range(10, 14):
        assert (await add(world, rid, "a", f"https://vimeo.com/{n}")).status_code == 201
    full = await add(world, rid, "a", "https://vimeo.com/99")
    assert full.status_code == 409 and full.headers["X-Error-Code"] == "broadcast_recording_full"


async def test_the_author_takes_a_link_off_and_a_stranger_cannot(world: World) -> None:
    rid = await ended_broadcast(world)
    link = (await add(world, rid, "a")).json()["id"]
    path = f"{URL}/{rid}/recordings/{link}"
    assert (await world.call("DELETE", path, "b")).status_code == 403
    assert (await world.call("DELETE", path, "a")).status_code == 204
    assert (await world.call("GET", f"{URL}/{rid}", "a")).json()["recordings"] == []


async def test_an_archived_broadcast_with_a_recording_can_still_be_found_by_its_address(
    world: World,
) -> None:
    with_recording = await ended_broadcast(world, url="https://a.example.org/x", title="Kept")
    without = await ended_broadcast(world, url="https://b.example.org/x", title="Lost")
    await add(world, with_recording, "a")
    for rid in (with_recording, without):
        await world.update(Broadcast, UUID(rid), ended_at=now_utc() - timedelta(days=9))
    assert await shelf(world, which="recent") == []  # on no list
    assert (await world.call("GET", f"{URL}/{with_recording}", "b")).status_code == 200
    assert (await world.call("GET", f"{URL}/{without}", "b")).status_code == 404
    mine = (await world.call("GET", f"{URL}/{without}", "a")).json()
    assert mine["archived"] is True
    # an unaccepted suggestion does not open it
    await add(world, without, "b", "https://vimeo.com/7")
    assert (await world.call("GET", f"{URL}/{without}", "c")).status_code == 404


async def test_deleting_a_broadcast_drops_the_links_and_keeps_the_library_recording(
    world: World,
) -> None:
    rid = await ended_broadcast(world)
    await add(world, rid, "a")
    async with world.sessions() as session:
        broadcast = await session.get(Broadcast, UUID(rid))
        assert broadcast is not None
        member = await session.get(UserAccount, MEMBER_A)
        assert member is not None
        await recordings.attach_file(
            session, broadcast, member=member, team=False, recording_id=REC
        )
    assert len(await world.rows(BroadcastRecording)) == 2
    assert (await world.call("DELETE", f"{URL}/{rid}", "a")).status_code == 204
    assert await world.rows(BroadcastRecording) == []
    assert len(await world.rows(Recording)) == 1  # the library recording is still there


async def test_a_library_recording_linked_to_a_broadcast_is_marked_on_its_own_page(
    world: World,
) -> None:
    rid = await ended_broadcast(world, title="Nine days of Kiirtan")
    async with world.sessions() as session:
        broadcast = await session.get(Broadcast, UUID(rid))
        assert broadcast is not None
        member = await session.get(UserAccount, MEMBER_A)
        assert member is not None
        await recordings.attach_file(
            session, broadcast, member=member, team=False, recording_id=REC
        )
        mark = await recordings.from_broadcast(session, REC)
    assert mark is not None and mark["title"] == "Nine days of Kiirtan"
    assert mark["id"] == rid and mark["date"] == now_utc().date()
    item = (await world.call("GET", f"{URL}/{rid}", "b")).json()
    [link] = item["recordings"]
    assert link["kind"] == "file" and link["recording_id"] == str(REC)
    assert link["recording_title"] == "Baba Nam Kevalam"
    # a broadcast the team removed leaves no mark
    await world.call("POST", f"{URL}/{rid}/remove", "team", json={"reason": "Not suitable"})
    async with world.sessions() as session:
        assert await recordings.from_broadcast(session, REC) is None
