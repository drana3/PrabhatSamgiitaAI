"""Broadcasts: link rules, state, limits, the shelf, reports and the YouTube look.

An in-memory SQLite database; the internet is a fake (`video_checks.transport`). What PostgreSQL
does is NOT covered here."""

from __future__ import annotations

import os

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://test:test@localhost/test")

import json
from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta
from typing import cast
from uuid import UUID

import httpx
import pytest
import pytest_asyncio
from sqlalchemy import Table
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.api.v1.broadcasts import get_session_factory
from app.api.v1.broadcasts import router as broadcasts_router
from app.models import Base, UserAccount
from app.models.broadcasts import Broadcast, BroadcastReport
from app.services import broadcasts as service
from app.services import video_checks
from app.services.recordings import now_utc
from app.services.video_links import VideoRefusedError
from tests.extras_support import (
    MEMBER_A,
    MEMBER_B,
    NAMES,
    REC,
    TABLES,
    TEAM,
    World,
    build_app,
    recording,
)

URL = "/api/v1/broadcasts"
YT_LIVE = "https://www.youtube.com/live/dQw4w9WgXcQ"
MEMBER_C = UUID("00000000-0000-0000-0000-0000000000d4")  # a third, established member
ZOOM = "https://us02web.zoom.us/j/81234567890?pwd=AbCdEf123"


@pytest_asyncio.fixture(name="world")
async def world_fixture() -> AsyncIterator[World]:
    engine = create_async_engine(
        "sqlite+aiosqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False}
    )
    tables = [cast(Table, m.__table__) for m in (*TABLES, Broadcast, BroadcastReport)]
    async with engine.begin() as conn:
        await conn.run_sync(lambda c: Base.metadata.create_all(c, tables=tables))
    sessions = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with sessions() as session:
        old = datetime.now(UTC) - timedelta(days=30)  # established accounts
        for member_id, name in {**NAMES, MEMBER_C: "Dharma"}.items():
            session.add(
                UserAccount(
                    id=member_id,
                    external_subject=f"test:{name}",
                    identity_provider="test",
                    display_name=name,
                    email=f"{name.lower()}@example.org",
                    is_admin=member_id == TEAM,
                    last_seen_at=datetime.now(UTC),
                    created_at=old,
                )
            )
        await session.commit()
        session.add(recording(REC, "Baba Nam Kevalam"))
        await session.commit()
    app = build_app(sessions, {"a": MEMBER_A, "b": MEMBER_B, "c": MEMBER_C, "team": TEAM})
    app.include_router(broadcasts_router, prefix="/api/v1")
    app.dependency_overrides[get_session_factory] = lambda: sessions
    service.limiter.reset()
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://t"
    ) as client:
        made = World(client, sessions)
        made.app = app  # type: ignore[attr-defined]
        yield made
    await engine.dispose()


class Net:
    """A fake internet: every request is recorded, the answer is scripted."""

    def __init__(self) -> None:
        self.seen: list[httpx.Request] = []
        self.status = 200
        self.body = json.dumps(
            {
                "title": "Live satsang from Berlin",
                "thumbnail_url": "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
            }
        ).encode()

    def __call__(self, request: httpx.Request) -> httpx.Response:
        self.seen.append(request)
        return httpx.Response(self.status, content=self.body)


@pytest.fixture(autouse=True)
def net():  # type: ignore[no-untyped-def]
    fake = Net()
    video_checks.transport = httpx.MockTransport(fake)
    yield fake
    video_checks.transport = None


def soon(hours: float = 2.0) -> str:
    return (now_utc() + timedelta(hours=hours)).isoformat()


async def post(world: World, who: str = "a", **fields):  # type: ignore[no-untyped-def]
    body = {"url": ZOOM, "title": "Sunday satsang", **fields}
    return await world.call("POST", URL, who, json=body)


async def shelf(world: World, who: str | None = None, which: str = "shelf"):  # type: ignore[no-untyped-def]
    got = await world.call("GET", URL, who, params={"which": which})
    assert got.status_code == 200, got.text
    return got.json()["items"]


# --------------------------------------------------------------------------- the link rules


@pytest.mark.parametrize(
    ("raw", "provider", "stored"),
    [
        (YT_LIVE, "youtube", "https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
        ("youtu.be/dQw4w9WgXcQ?si=track", "youtube", "https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
        (ZOOM, "zoom", ZOOM),
        ("https://zoom.us/j/123456789#fragment", "zoom", "https://zoom.us/j/123456789"),
        ("https://company.zoomgov.com/my/room", "zoom", "https://company.zoomgov.com/my/room"),
        ("https://www.facebook.com/page/live/123", "facebook", None),
        ("https://fb.watch/abc123/", "facebook", None),
        ("https://www.instagram.com/someone/live/", "instagram", None),
        ("https://meet.example.org/satsang", "other", None),
        ("HTTPS://MEET.Example.ORG:443/Satsang", "other", "https://meet.example.org/Satsang"),
    ],
)
def test_good_links_are_classified_by_their_exact_host(
    raw: str, provider: str, stored: str | None
) -> None:
    got_provider, _, url, _ = service.parse_broadcast_url(raw)
    assert got_provider == provider
    if stored:
        assert url == stored


@pytest.mark.parametrize(
    "raw",
    [
        "",
        "   ",
        "http://zoom.us/j/123456789",
        "javascript:alert(1)",
        "data:text/html,hi",
        "file:///etc/passwd",
        "ftp://example.org/live",
        "https://user:pw@zoom.us/j/123456789",
        "https://zoom.us@evil.example/j/123456789",
        "https://zoom.us:8443/j/123456789",
        "https://127.0.0.1/live",
        "https://[::1]/live",
        "https://10.0.0.5/live",
        "https://localhost/live",
        "https://printer.local/live",
        "https://intranet/live",
        "https://zoom.us",
        "https://zoom.us/",
        "https://zoom.us/j/1 2",
        "https://zoom.us/j/1\nhttps://evil.example",
        "https://zoom.us\\@evil.example/j/1",
        "https://zоom.us/j/123456789",  # a Cyrillic o
        "https://-bad-.example.org/live",
        "https://example.org/" + "a" * 600,
        "https://www.youtube.com/@channel/live",
        "https://www.youtube.com/playlist?list=PLabc",
        "https://www.youtube.com/watch?v=short",
    ],
)
def test_bad_links_are_refused(raw: str) -> None:
    with pytest.raises(VideoRefusedError):
        service.parse_broadcast_url(raw)


def test_a_look_alike_host_is_not_zoom_or_youtube() -> None:
    # neither a prefix nor a suffix of the text decides: only the whole host or a real subdomain
    assert service.parse_broadcast_url("https://zoom.us.evil.example/j/123456789")[0] == "other"
    assert service.parse_broadcast_url("https://evilzoom.us/j/123456789")[0] == "other"
    assert service.parse_broadcast_url("https://notyoutube.com/live/dQw4w9WgXcQ")[0] == "other"
    assert (
        service.parse_broadcast_url("https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ")[0]
        == "other"
    )


# --------------------------------------------------------------------------- the state


def _row(
    starts: datetime | None, *, ended: datetime | None = None, made: datetime | None = None
) -> Broadcast:
    return Broadcast(
        member_id=MEMBER_A,
        provider="zoom",
        url="https://zoom.us/j/1",
        host="zoom.us",
        title="T",
        starts_at=starts,
        ended_at=ended,
        created_at=made or now_utc(),
        reports_count=0,
        status="published",
    )


def test_the_state_is_worked_out_from_the_clock() -> None:
    now = datetime(2026, 11, 9, 12, 0, tzinfo=UTC)
    assert service.phase(_row(now + timedelta(minutes=1)), now=now) == "upcoming"
    assert service.phase(_row(now - timedelta(minutes=1)), now=now) == "now"
    assert service.phase(_row(now - service.ASSUMED_DURATION), now=now) == "ended"
    # without a start it is live from the moment it was posted
    assert service.phase(_row(None, made=now - timedelta(hours=1)), now=now) == "now"
    assert service.phase(_row(None, made=now - timedelta(hours=7)), now=now) == "ended"
    # "it is over" ends it early
    assert service.phase(_row(now - timedelta(hours=1), ended=now), now=now) == "ended"


def test_a_week_after_the_end_it_is_archived() -> None:
    now = datetime(2026, 11, 9, 12, 0, tzinfo=UTC)
    start = now - service.ASSUMED_DURATION - service.ARCHIVE_AFTER
    assert service.is_archived(_row(start - timedelta(minutes=1)), now=now)
    assert not service.is_archived(_row(start + timedelta(minutes=1)), now=now)
    assert not service.is_archived(_row(now + timedelta(days=1)), now=now)


# --------------------------------------------------------------------------- posting


async def test_a_broadcast_is_posted_and_shown_without_the_account_of_its_author(
    world: World,
) -> None:
    made = await post(
        world,
        starts_at=soon(),
        timezone="Europe/Berlin",
        organizer="Berlin sangha",
        description="Kiirtan and a talk.\nAll welcome.",
    )
    assert made.status_code == 201, made.text
    body = made.json()
    assert (body["provider"], body["phase"], body["mine"]) == ("zoom", "upcoming", True)
    assert body["url"] == ZOOM and body["host"] == "us02web.zoom.us"
    assert body["organizer"] == "Berlin sangha" and body["timezone"] == "Europe/Berlin"
    seen = await world.call("GET", f"{URL}/{body['id']}")
    assert seen.status_code == 200 and seen.json()["mine"] is False
    assert "member" not in seen.text and str(MEMBER_A) not in seen.text
    assert "reports_count" not in {k for k, v in seen.json().items() if v is not None}


async def test_the_title_is_latin_and_without_links_and_texts_hold_no_links(world: World) -> None:
    for fields in (
        {"title": "Воскресный сатсанг"},
        {"title": "Join at https://zoom.us/j/123"},
        {"title": "ab"},
        {"description": "Join: https://evil.example/x"},
        {"organizer": "see www.example.org"},
    ):
        got = await post(world, **fields)
        assert got.status_code == 422, (fields, got.text)
    assert await world.rows(Broadcast) == []


async def test_the_start_rules(world: World) -> None:
    naive = (now_utc() + timedelta(hours=3)).replace(tzinfo=None).isoformat()
    # a start without an offset needs its zone, an unknown or unsafe zone is refused
    assert (await post(world, starts_at=naive)).status_code == 422
    assert (await post(world, starts_at=naive, timezone="Mars/Olympus")).status_code == 422
    assert (await post(world, starts_at=naive, timezone="../etc")).status_code == 422
    ok = await post(world, starts_at=naive, timezone="Asia/Kolkata")
    assert ok.status_code == 201, ok.text
    # the start is stored in UTC
    row = (await world.rows(Broadcast))[0]
    assert row.starts_at is not None and row.starts_at.utcoffset() in (None, timedelta(0))
    # far in the past and more than a year ahead are refused
    assert (
        await post(world, "team", url="https://a.example.org/x", starts_at=soon(-24))
    ).status_code == 422
    assert (
        await post(world, "team", url="https://b.example.org/x", starts_at=soon(24 * 400))
    ).status_code == 422


async def test_a_member_must_be_signed_in_and_a_bad_link_is_refused_with_its_code(
    world: World,
) -> None:
    assert (await post(world, who="nobody")).status_code == 401
    refused = await post(world, url="http://zoom.us/j/1")
    assert refused.status_code == 422 and refused.headers["X-Error-Code"] == "broadcast_bad_link"


async def test_limits_a_day_a_live_list_and_the_same_link(world: World) -> None:
    first = await post(world, url="https://a.example.org/live")
    assert first.status_code == 201
    again = await post(world, url="https://a.example.org/live")
    assert again.status_code == 409 and again.headers["X-Error-Code"] == "broadcast_duplicate"
    for i in range(2):
        assert (await post(world, url=f"https://b{i}.example.org/live")).status_code == 201
    over = await post(world, url="https://c.example.org/live")
    assert over.status_code == 429 and over.headers["X-Error-Code"] == "broadcast_daily_limit"
    # the team is not limited, another member has their own count
    assert (await post(world, "team", url="https://c.example.org/live")).status_code == 201
    assert (await post(world, "b", url="https://d.example.org/live")).status_code == 201


# --------------------------------------------------------------------------- the shelf


async def test_the_shelf_shows_live_first_then_the_nearest_upcoming(world: World) -> None:
    await post(world, url="https://later.example.org/x", title="Later", starts_at=soon(30))
    await post(world, url="https://soon.example.org/x", title="Soon", starts_at=soon(2))
    await post(world, url="https://now.example.org/x", title="Now")
    titles = [i["title"] for i in await shelf(world)]
    assert titles == ["Now", "Soon", "Later"]
    assert [i["phase"] for i in await shelf(world)] == ["now", "upcoming", "upcoming"]


async def test_an_ended_one_leaves_the_shelf_stays_in_recent_and_is_archived_after_a_week(
    world: World,
) -> None:
    made = (await post(world, title="Old talk")).json()
    row = (await world.rows(Broadcast))[0]
    await world.update(Broadcast, row.id, starts_at=now_utc() - timedelta(hours=10))
    assert await shelf(world) == []
    assert [i["title"] for i in await shelf(world, which="recent")] == ["Old talk"]
    await world.update(Broadcast, row.id, starts_at=now_utc() - timedelta(days=9))
    assert await shelf(world, which="recent") == []
    # closed to strangers, kept for its author and the team
    assert (await world.call("GET", f"{URL}/{made['id']}", "b")).status_code == 404
    mine = await world.call("GET", f"{URL}/{made['id']}", "a")
    assert mine.status_code == 200 and mine.json()["archived"] is True
    assert (await world.call("GET", f"{URL}/{made['id']}", "team")).status_code == 200
    listing = (await world.call("GET", f"{URL}/mine", "a")).json()["items"]
    assert [i["title"] for i in listing] == ["Old talk"]


async def test_the_author_ends_a_broadcast_and_nobody_else_can(world: World) -> None:
    made = (await post(world)).json()
    assert (await world.call("POST", f"{URL}/{made['id']}/end", "b")).status_code == 403
    done = await world.call("POST", f"{URL}/{made['id']}/end", "a")
    assert done.status_code == 200 and done.json()["phase"] == "ended"
    assert await shelf(world) == []


# --------------------------------------------------------------------------- reports and the team


async def anonymous_report(world: World, address: str, rid: str) -> httpx.Response:
    """A report from somebody who is not signed in, coming from the given network address."""
    app = world.app  # type: ignore[attr-defined]
    transport = httpx.ASGITransport(app=app, client=(address, 5000))
    async with httpx.AsyncClient(transport=transport, base_url="http://t") as client:
        return await client.post(f"{URL}/{rid}/report", json={"reason": "spam"})


async def test_two_established_members_hide_it_and_the_team_can_keep_or_remove(
    world: World,
) -> None:
    made = (await post(world)).json()
    rid = made["id"]
    own = await world.call("POST", f"{URL}/{rid}/report", "a", json={"reason": "spam"})
    assert own.status_code == 422
    first = await world.call("POST", f"{URL}/{rid}/report", "b", json={"reason": "broken"})
    assert first.status_code == 201 and first.json()["status"] == "received"
    again = await world.call("POST", f"{URL}/{rid}/report", "b", json={"reason": "broken"})
    assert again.json()["status"] == "already_reported"
    assert [i["id"] for i in await shelf(world)] == [rid]  # one member: still on the shelf
    await world.call("POST", f"{URL}/{rid}/report", "c", json={"reason": "other"})
    assert await shelf(world) == []  # two established members: hidden until the team looks
    assert (await world.call("GET", f"{URL}/{rid}", "b")).status_code == 404
    queue = (await world.call("GET", f"{URL}/review", "team")).json()
    assert [i["id"] for i in queue["items"]] == [rid] and queue["items"][0]["reports_count"] == 2
    assert (await world.call("GET", f"{URL}/review", "b")).status_code == 403
    assert (await world.call("POST", f"{URL}/{rid}/keep", "b")).status_code == 403
    assert (await world.call("POST", f"{URL}/{rid}/keep", "team")).status_code == 204
    assert [i["id"] for i in await shelf(world)] == [rid]
    assert await world.rows(BroadcastReport) == []  # the verdict clears the reports
    assert (
        await world.call("POST", f"{URL}/{rid}/remove", "team", json={"reason": "not a broadcast"})
    ).status_code == 204
    assert await shelf(world) == []
    row = (await world.rows(Broadcast))[0]
    assert row.status == "removed" and row.removed_by == "Carya"


async def test_anonymous_reports_never_hide_but_reach_the_team(world: World) -> None:
    rid = (await post(world)).json()["id"]
    for address in ("203.0.113.1", "203.0.113.2", "198.51.100.7", "192.0.2.9"):
        got = await anonymous_report(world, address, rid)
        assert got.status_code == 201 and got.json()["status"] == "received"
    assert [i["id"] for i in await shelf(world)] == [rid]  # four addresses: still there
    row = (await world.rows(Broadcast))[0]
    assert row.reports_count == 0 and len(await world.rows(BroadcastReport)) == 4
    queue = (await world.call("GET", f"{URL}/review", "team")).json()
    assert [i["id"] for i in queue["items"]] == [rid]  # but the team sees it
    # one established member next to them is still not enough
    await world.call("POST", f"{URL}/{rid}/report", "b", json={"reason": "spam"})
    assert [i["id"] for i in await shelf(world)] == [rid]


async def test_anonymous_reporters_are_told_apart_by_network_not_by_address(
    world: World,
) -> None:
    assert service.anonymous_key("203.0.113.1") == "anon:203.0.113.1"
    one = service.anonymous_key("2001:db8:1:2:aaaa:bbbb:cccc:dddd")
    two = service.anonymous_key("2001:db8:1:2:1111:2222:3333:4444")
    assert one == two == "anon:2001:db8:1:2::/64"
    assert service.anonymous_key("2001:db8:1:3::1") != one
    rid = (await post(world)).json()["id"]
    first = await anonymous_report(world, "2001:db8:1:2:aaaa:bbbb:cccc:dddd", rid)
    second = await anonymous_report(world, "2001:db8:1:2:1111:2222:3333:4444", rid)
    assert first.json()["status"] == "received"
    assert second.json()["status"] == "already_reported"
    assert len(await world.rows(BroadcastReport)) == 1


async def test_a_fresh_account_reports_without_weight_and_the_team_hides_at_once(
    world: World,
) -> None:
    rid = (await post(world)).json()["id"]
    await world.update(UserAccount, MEMBER_B, created_at=now_utc() - timedelta(hours=5))
    await world.update(UserAccount, MEMBER_C, created_at=now_utc() - timedelta(days=1))
    for who in ("b", "c"):
        assert (
            await world.call("POST", f"{URL}/{rid}/report", who, json={"reason": "spam"})
        ).status_code == 201
    assert [i["id"] for i in await shelf(world)] == [rid]  # new accounts do not add up
    assert (await world.rows(Broadcast))[0].reports_count == 0
    await world.call("POST", f"{URL}/{rid}/report", "team", json={"reason": "spam"})
    assert await shelf(world) == []  # one report from the team hides it


async def test_the_author_deletes_their_own_and_the_link_is_wiped(world: World) -> None:
    made = (await post(world)).json()
    assert (await world.call("DELETE", f"{URL}/{made['id']}", "b")).status_code == 403
    assert (await world.call("DELETE", f"{URL}/{made['id']}", "a")).status_code == 204
    row = (await world.rows(Broadcast))[0]
    assert (row.status, row.url, row.title) == ("removed", "", "")
    assert (await world.call("GET", f"{URL}/{made['id']}", "b")).status_code == 404
    assert (await world.call("GET", f"{URL}/{made['id']}", "a")).status_code == 404
    # the daily allowance is not given back
    assert (await post(world, url="https://x1.example.org/a")).status_code == 201
    assert (await post(world, url="https://x2.example.org/a")).status_code == 201
    assert (await post(world, url="https://x3.example.org/a")).status_code == 429


# --------------------------------------------------------------------------- the YouTube look


async def test_a_youtube_broadcast_gets_its_title_and_thumbnail_after_the_answer(
    world: World, net: Net
) -> None:
    made = await post(world, url=YT_LIVE, title="Live from Berlin")
    assert made.status_code == 201 and made.json()["provider"] == "youtube"
    row = (await world.rows(Broadcast))[0]
    assert row.link_status == "ok" and row.fetched_title == "Live satsang from Berlin"
    assert row.thumbnail_url == "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg"
    # the author's own title is kept; only the fixed oEmbed address was asked, built from the id
    assert row.title == "Live from Berlin"
    assert [r.url.host for r in net.seen] == ["www.youtube.com"]
    assert net.seen[0].url.path == "/oembed"
    shown = (await world.call("GET", f"{URL}/{row.id}")).json()
    assert shown["thumbnail_url"] == row.thumbnail_url


async def test_a_thumbnail_from_anywhere_but_youtubes_image_host_is_dropped(
    world: World, net: Net
) -> None:
    net.body = json.dumps(
        {"title": "x" * 300, "thumbnail_url": "https://evil.example/t.jpg"}
    ).encode()
    await post(world, url=YT_LIVE)
    row = (await world.rows(Broadcast))[0]
    assert row.thumbnail_url is None and len(row.fetched_title or "") <= 200
    for bad in (
        "http://i.ytimg.com/a.jpg",
        "https://i.ytimg.com.evil.example/a.jpg",
        "https://user@i.ytimg.com/a.jpg",
        "https://i.ytimg.com:8443/a.jpg",
        None,
        7,
    ):
        assert service._thumbnail(bad) is None


async def test_a_video_that_is_gone_twice_is_marked_unavailable_and_a_failed_look_changes_nothing(
    world: World, net: Net
) -> None:
    net.status = 404
    await post(world, url=YT_LIVE)
    row = (await world.rows(Broadcast))[0]
    assert (row.link_status, row.check_fails) == ("unknown", 1)
    async with world.sessions() as session:
        await service.enrich(session, row.id)
    assert (await world.rows(Broadcast))[0].link_status == "unavailable"
    net.status = 503
    async with world.sessions() as session:
        await service.enrich(session, row.id)
    assert (await world.rows(Broadcast))[0].link_status == "unavailable"
    net.status = 401
    async with world.sessions() as session:
        await service.enrich(session, row.id)
    assert (await world.rows(Broadcast))[0].link_status == "no_embed"


async def test_nothing_but_youtube_is_ever_looked_at(world: World, net: Net) -> None:
    for url in (ZOOM, "https://www.facebook.com/x/live/1", "https://meet.example.org/room"):
        assert (await post(world, "team", url=url)).status_code == 201
    assert net.seen == []
