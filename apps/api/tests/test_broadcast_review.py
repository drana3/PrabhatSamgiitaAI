"""Broadcasts, the team's side: the queue, Keep that is remembered, Hide, Remove, the history.

An in-memory SQLite database. What PostgreSQL does is NOT covered here."""

from __future__ import annotations

import os

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://test:test@localhost/test")

import pytest

from app.models.broadcasts import Broadcast, BroadcastDecision, BroadcastReport
from app.models.recordings import MemberNotice
from tests.extras_support import World
from tests.test_broadcasts import (  # noqa: F401  (fixtures used by name)
    URL,
    anonymous_report,
    net,
    post,
    shelf,
    world_fixture,
)

pytestmark = pytest.mark.asyncio


async def report(world: World, rid: str, who: str, reason: str = "spam"):  # type: ignore[no-untyped-def]
    return await world.call("POST", f"{URL}/{rid}/report", who, json={"reason": reason})


async def queue(world: World, which: str = "queue"):  # type: ignore[no-untyped-def]
    got = await world.call("GET", f"{URL}/review", "team", params={"which": which})
    assert got.status_code == 200, got.text
    return got.json()["items"]


async def test_keep_is_remembered_and_only_new_reports_count_beyond_it(world: World) -> None:
    rid = (await post(world)).json()["id"]
    await report(world, rid, "b")
    await report(world, rid, "c")
    assert await shelf(world) == []  # two established members hid it
    assert (await world.call("POST", f"{URL}/{rid}/keep", "team")).status_code == 204
    row = (await world.rows(Broadcast))[0]
    assert row.reviewed_by == "Carya" and row.reviewed_at is not None
    assert row.reviewed_reports == 2 and row.reports_count == 0
    assert [i["id"] for i in await shelf(world)] == [rid]
    assert await queue(world) == []  # nothing is waiting any more

    # the same people cannot send the same reason again ...
    assert (await report(world, rid, "b")).json()["status"] == "already_reported"
    assert (await report(world, rid, "c")).json()["status"] == "already_reported"
    assert [i["id"] for i in await shelf(world)] == [rid]
    # ... and the two old reports do not add up with the next one: one new person is not enough
    assert (await report(world, rid, "b", "broken")).json()["status"] == "received"
    assert [i["id"] for i in await shelf(world)] == [rid]
    assert (await world.rows(Broadcast))[0].reports_count == 1
    # the same person with a second reason is still one person
    await report(world, rid, "b", "other")
    assert (await world.rows(Broadcast))[0].reports_count == 1
    # a second new person brings it to the threshold again; nothing was frozen
    await report(world, rid, "c", "broken")
    assert await shelf(world) == []
    item = (await queue(world))[0]
    assert item["id"] == rid and item["state"] == "auto_hidden"
    assert item["reports"]["counted"] == 2 and item["reports"]["cleared"] == 2
    assert item["reviewed_by"] == "Carya" and item["reviewed_reports"] == 2


async def test_a_report_the_team_judged_stays_in_the_table(world: World) -> None:
    rid = (await post(world)).json()["id"]
    await report(world, rid, "b")
    await world.call("POST", f"{URL}/{rid}/keep", "team")
    rows = await world.rows(BroadcastReport)
    assert len(rows) == 1 and rows[0].cleared_at is not None and rows[0].cleared_by == "Carya"


async def test_the_queue_shows_anonymous_reports_that_did_not_count(world: World) -> None:
    rid = (await post(world)).json()["id"]
    for address in ("203.0.113.1", "203.0.113.2", "198.51.100.7"):
        await anonymous_report(world, address, rid)
    await report(world, rid, "b", "broken")
    [item] = await queue(world)
    assert item["state"] == "reported"
    assert item["reports"] == {
        "counted": 1,
        "open": 4,
        "anonymous": 3,
        "cleared": 0,
        "by_reason": {"spam": 3, "broken": 1},
        "notes": [],
    }
    assert item["url"].startswith("https://")  # the link is there to show as text
    assert "reporter" not in str(item).lower()  # nobody is named


async def test_the_team_screens_are_closed_to_everybody_else_on_the_server(world: World) -> None:
    rid = (await post(world)).json()["id"]
    for who in ("a", "b", None):
        paths = [
            ("GET", f"{URL}/review"),
            ("GET", f"{URL}/decisions"),
            ("GET", f"{URL}/recording-suggestions"),
            ("POST", f"{URL}/{rid}/keep"),
            ("POST", f"{URL}/{rid}/hide"),
            ("POST", f"{URL}/{rid}/remove"),
        ]
        for method, path in paths:
            kwargs = {"json": {"reason": "no"}} if method == "POST" and "keep" not in path else {}
            got = await world.call(method, path, who, **kwargs)
            assert got.status_code in (401, 403), (who, path, got.status_code)
    assert [i["id"] for i in await shelf(world)] == [rid]


async def test_hide_needs_a_reason_hides_from_lists_and_tells_the_author(world: World) -> None:
    rid = (await post(world, title="Sunday satsang")).json()["id"]
    no_reason = await world.call("POST", f"{URL}/{rid}/hide", "team", json={"reason": " "})
    assert no_reason.status_code == 422
    assert no_reason.headers["X-Error-Code"] == "broadcast_reason_needed"
    done = await world.call("POST", f"{URL}/{rid}/hide", "team", json={"reason": "Wrong link"})
    assert done.status_code == 204
    assert await shelf(world) == []
    assert (await world.call("GET", f"{URL}/{rid}", "b")).status_code == 404
    mine = (await world.call("GET", f"{URL}/{rid}", "a")).json()
    assert mine["hidden"] is True and mine["status"] == "published"
    assert [i["id"] for i in await queue(world, "hidden")] == [rid]
    assert await queue(world) == []
    [notice] = await world.rows(MemberNotice)
    assert (
        notice.kind == "broadcast_hidden"
        and notice.user_id == (await world.rows(Broadcast))[0].member_id
    )
    assert "Wrong link" in notice.body and "Sunday satsang" in notice.body
    assert notice.payload["broadcast_id"] == rid
    # Keep shows it again and says so
    await world.call("POST", f"{URL}/{rid}/keep", "team")
    assert [i["id"] for i in await shelf(world)] == [rid]
    assert sorted(n.kind for n in await world.rows(MemberNotice)) == [
        "broadcast_hidden",
        "broadcast_restored",
    ]


async def test_remove_needs_a_reason_and_tells_the_author(world: World) -> None:
    rid = (await post(world)).json()["id"]
    refused = await world.call("POST", f"{URL}/{rid}/remove", "team", json={})
    assert refused.status_code == 422
    done = await world.call(
        "POST", f"{URL}/{rid}/remove", "team", json={"reason": "Not a broadcast"}
    )
    assert done.status_code == 204
    assert await shelf(world) == []
    [removed] = await queue(world, "removed")
    assert removed["state"] == "removed" and removed["removed_reason"] == "Not a broadcast"
    [notice] = await world.rows(MemberNotice)
    assert notice.kind == "broadcast_removed" and "Not a broadcast" in notice.body
    # a second Remove changes nothing and sends nothing
    again = await world.call("POST", f"{URL}/{rid}/remove", "team", json={"reason": "again"})
    assert again.status_code == 204 and len(await world.rows(MemberNotice)) == 1


async def test_the_history_lists_every_verdict_with_the_numbers_of_the_moment(world: World) -> None:
    rid = (await post(world, title="First")).json()["id"]
    await anonymous_report(world, "203.0.113.9", rid)
    await report(world, rid, "b")
    await report(world, rid, "c", "broken")
    await world.call("POST", f"{URL}/{rid}/keep", "team")
    await world.call("POST", f"{URL}/{rid}/hide", "team", json={"reason": "Spam link"})
    await world.call("POST", f"{URL}/{rid}/remove", "team", json={"reason": "Gone for good"})
    got = (await world.call("GET", f"{URL}/decisions", "team")).json()
    assert got["total"] == 3
    assert [d["action"] for d in got["items"]] == ["remove", "hide", "keep"]
    keep = got["items"][2]
    assert keep["reports_total"] == 3 and keep["reports_counted"] == 2
    assert keep["decided_by"] == "Carya" and keep["broadcast_title"] == "First"
    assert got["items"][1]["reason"] == "Spam link"
    assert len(await world.rows(BroadcastDecision)) == 3
