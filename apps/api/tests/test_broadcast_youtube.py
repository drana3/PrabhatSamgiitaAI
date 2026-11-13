"""Broadcasts and the YouTube Data API: live, upcoming, ended, the cache, the quota, no key.

The internet is a fake (`youtube_status.transport`): no request leaves the machine, and no real
key is used. An in-memory SQLite database. What PostgreSQL does is NOT covered here."""

from __future__ import annotations

import json
import logging
import os
from collections.abc import Iterator
from datetime import timedelta

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://test:test@localhost/test")

import httpx
import pytest
from sqlalchemy import select

from app.config import Settings, get_settings
from app.models.broadcasts import Broadcast, BroadcastRecording
from app.services import broadcasts as service
from app.services import youtube_status
from app.services.recordings import now_utc
from tests.extras_support import World
from tests.test_broadcasts import (  # noqa: F401  (fixtures used by name)
    URL,
    YT_LIVE,
    net,
    post,
    shelf,
    world_fixture,
)

pytestmark = pytest.mark.asyncio

KEY = "AIza-this-is-a-test-key-not-real"
VIDEO = "dQw4w9WgXcQ"
OTHER = "aaaaaaaaaaa"
THIRD = "bbbbbbbbbbb"


def settings(**values: object) -> Settings:
    base = {"_env_file": None, "NEXT_PUBLIC_API_BASE_URL": "http://t", "YOUTUBE_API_KEY": KEY}
    base.update({k.upper(): v for k, v in values.items()})
    return Settings.model_validate(base)


class Google:
    """A fake YouTube Data API: what it knows about each video id, and every request it got."""

    def __init__(self) -> None:
        self.videos: dict[str, dict[str, object]] = {}
        self.seen: list[httpx.Request] = []
        self.status = 200
        self.body: dict[str, object] | None = None

    def live(self, video_id: str, started: str = "2026-11-01T08:00:00Z") -> None:
        self.videos[video_id] = {
            "id": video_id,
            "snippet": {"liveBroadcastContent": "live"},
            "liveStreamingDetails": {"actualStartTime": started},
        }

    def upcoming(self, video_id: str) -> None:
        self.videos[video_id] = {
            "id": video_id,
            "snippet": {"liveBroadcastContent": "upcoming"},
            "liveStreamingDetails": {"scheduledStartTime": "2026-11-20T08:00:00Z"},
        }

    def ended(self, video_id: str, when: str = "2026-11-08T10:00:00Z") -> None:
        self.videos[video_id] = {
            "id": video_id,
            "snippet": {"liveBroadcastContent": "none"},
            "liveStreamingDetails": {
                "actualStartTime": "2026-11-01T08:00:00Z",
                "actualEndTime": when,
            },
        }

    def __call__(self, request: httpx.Request) -> httpx.Response:
        self.seen.append(request)
        if self.status != 200:
            return httpx.Response(self.status, json=self.body or {})
        asked = request.url.params["id"].split(",")
        return httpx.Response(
            200, json={"items": [self.videos[i] for i in asked if i in self.videos]}
        )


@pytest.fixture(name="google")
def google_fixture() -> Iterator[Google]:
    fake = Google()
    youtube_status.transport = httpx.MockTransport(fake)
    youtube_status.gate.reset()
    yield fake
    youtube_status.transport = None
    youtube_status.gate.reset()


def with_key(world: World, **values: object) -> Settings:
    made = settings(**values)
    world.app.dependency_overrides[get_settings] = lambda: made  # type: ignore[attr-defined]
    return made


async def youtube_broadcast(world: World, *, video: str = VIDEO, who: str = "team") -> str:
    got = await post(
        world, who, url=f"https://www.youtube.com/watch?v={video}", title=f"Live {video}"
    )
    assert got.status_code == 201, got.text
    return got.json()["id"]


async def set_row(world: World, rid: str, **values: object) -> None:
    from uuid import UUID

    await world.update(Broadcast, UUID(rid), **values)


async def test_without_a_key_nothing_is_asked_and_the_clock_rules(
    world: World, google: Google
) -> None:
    rid = await youtube_broadcast(world)
    items = await shelf(world)
    assert [i["id"] for i in items] == [rid]
    assert items[0]["live_source"] == "clock" and items[0]["phase"] == "now"
    assert google.seen == []
    # a key with the flag switched off is the same
    with_key(world, youtube_status_enabled=False)
    await shelf(world)
    assert google.seen == []


async def test_live_on_youtube_keeps_it_on_past_the_announced_end(
    world: World, google: Google
) -> None:
    with_key(world)
    rid = await youtube_broadcast(world)
    await set_row(
        world,
        rid,
        starts_at=now_utc() - timedelta(days=2),
        declared_ends_at=now_utc() - timedelta(hours=1),
    )
    google.live(VIDEO)
    [item] = await shelf(world)
    assert item["phase"] == "now" and item["live_source"] == "youtube"
    assert len(google.seen) == 1
    request = google.seen[0]
    # the key goes in a header, never in the address
    assert request.headers["X-Goog-Api-Key"] == KEY
    assert KEY not in str(request.url) and request.url.params["id"] == VIDEO
    # and the client gets the state only: nothing of the answer, and no key
    assert KEY not in json.dumps(item) and "yt_" not in json.dumps(item)


async def test_announced_but_not_begun_is_upcoming_even_when_the_clock_says_it_began(
    world: World, google: Google
) -> None:
    with_key(world)
    rid = await youtube_broadcast(world)
    await set_row(world, rid, starts_at=now_utc() - timedelta(minutes=1))
    google.upcoming(VIDEO)
    [item] = await shelf(world)
    assert item["phase"] == "upcoming" and item["live_source"] == "youtube"


async def test_ended_on_youtube_ends_it_and_the_same_video_becomes_the_recording(
    world: World, google: Google
) -> None:
    with_key(world)
    rid = await youtube_broadcast(world)
    google.ended(VIDEO, when=(now_utc() - timedelta(hours=3)).strftime("%Y-%m-%dT%H:%M:%SZ"))
    assert await shelf(world) == []  # off the shelf: it is over
    [item] = await shelf(world, which="recent")
    assert item["phase"] == "ended" and item["live_source"] == "youtube"
    [recording] = item["recordings"]
    assert recording["kind"] == "link" and recording["source"] == "youtube"
    assert recording["status"] == "accepted" and recording["url"].endswith(VIDEO)
    # looked at again later: still one
    row = (await world.rows(Broadcast))[0]
    assert row.yt_ended_at is not None and rid == str(row.id)
    await world.call("GET", f"{URL}/{rid}", "a")
    assert len(await world.rows(BroadcastRecording)) == 1


async def test_the_answer_is_reused_for_every_viewer_for_a_minute(
    world: World, google: Google
) -> None:
    with_key(world)
    rid = await youtube_broadcast(world)
    google.live(VIDEO)
    for who in (None, "a", "b", "c", None):
        await shelf(world, who)
    assert len(google.seen) == 1
    await set_row(world, rid, yt_checked_at=now_utc() - timedelta(seconds=61))
    await shelf(world)
    assert len(google.seen) == 2


async def test_a_list_is_one_batched_call_not_one_per_broadcast(
    world: World, google: Google
) -> None:
    with_key(world)
    for video in (VIDEO, OTHER, THIRD):
        await youtube_broadcast(world, video=video)
        google.live(video)
    items = await shelf(world)
    assert len(items) == 3 and all(i["live_source"] == "youtube" for i in items)
    assert len(google.seen) == 1
    assert sorted(google.seen[0].url.params["id"].split(",")) == sorted([VIDEO, OTHER, THIRD])


async def test_a_zoom_broadcast_and_a_private_video_are_never_asked_about_twice(
    world: World, google: Google
) -> None:
    with_key(world)
    await post(world, "team")  # a Zoom link
    await youtube_broadcast(world)  # a YouTube one the API does not return (private)
    [first, second] = sorted(await shelf(world), key=lambda i: i["provider"])
    assert second["provider"] == "zoom" and first["provider"] == "youtube"
    assert first["live_source"] == "clock" and first["phase"] == "now"
    assert len(google.seen) == 1 and google.seen[0].url.params["id"] == VIDEO
    await shelf(world)
    assert len(google.seen) == 1  # the "unknown" answer is cached too


async def test_the_daily_ceiling_stops_the_calls_and_the_clock_takes_over(
    world: World, google: Google
) -> None:
    made = with_key(world, youtube_daily_request_limit=2)
    rid = await youtube_broadcast(world)
    google.live(VIDEO)
    for _ in range(4):
        await set_row(world, rid, yt_checked_at=now_utc() - timedelta(minutes=3))
        assert len(await shelf(world)) == 1
    assert len(google.seen) == 2 and made.youtube_daily_request_limit == 2
    # tomorrow the counter starts again
    later = now_utc() + timedelta(days=1, minutes=10)
    async with world.sessions() as session:
        rows = list((await session.scalars(select(Broadcast))).all())
        await service.refresh_status(session, rows, made, now=later)
    assert len(google.seen) == 3


async def test_a_refusal_pauses_the_calls_and_never_logs_the_key(
    world: World, google: Google, caplog: pytest.LogCaptureFixture
) -> None:
    with_key(world)
    rid = await youtube_broadcast(world)
    google.status = 403
    google.body = {"error": {"errors": [{"reason": "quotaExceeded"}], "message": f"key {KEY}"}}
    caplog.set_level(logging.DEBUG)
    for _ in range(3):
        await set_row(world, rid, yt_checked_at=None)
        [item] = await shelf(world)
        assert item["live_source"] == "clock" and item["phase"] == "now"
    assert len(google.seen) == 1  # quota used up: left alone until tomorrow
    ours = "\n".join(r.getMessage() for r in caplog.records if r.name.startswith("app."))
    assert KEY not in ours and "googleapis" not in ours
    assert "HTTP 403" in ours


async def test_a_server_error_pauses_for_a_minute_only(world: World, google: Google) -> None:
    made = with_key(world)
    rid = await youtube_broadcast(world)
    google.status = 500
    await shelf(world)
    await shelf(world)
    assert len(google.seen) == 1
    google.status = 200
    google.live(VIDEO)
    async with world.sessions() as session:
        rows = list((await session.scalars(select(Broadcast))).all())
        await service.refresh_status(session, rows, made, now=now_utc() + timedelta(minutes=2))
    assert len(google.seen) == 2
    assert (await world.rows(Broadcast))[0].yt_state == "live" and rid


async def test_a_network_failure_is_logged_by_class_only(
    world: World, google: Google, caplog: pytest.LogCaptureFixture
) -> None:
    with_key(world)
    await youtube_broadcast(world)

    def boom(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError(f"cannot reach {request.url}", request=request)

    youtube_status.transport = httpx.MockTransport(boom)
    caplog.set_level(logging.DEBUG)
    [item] = await shelf(world)
    assert item["live_source"] == "clock"
    ours = "\n".join(r.getMessage() for r in caplog.records if r.name.startswith("app."))
    assert "ConnectError" in ours
    assert "googleapis" not in ours and KEY not in ours


async def test_a_look_ahead_limit_spares_the_quota(world: World, google: Google) -> None:
    with_key(world)
    rid = await youtube_broadcast(world)
    await set_row(world, rid, starts_at=now_utc() + timedelta(days=10))
    await shelf(world)
    assert google.seen == []  # an announcement ten days away is not worth a call
    await set_row(world, rid, starts_at=now_utc() + timedelta(days=2))
    google.upcoming(VIDEO)
    await shelf(world)
    assert len(google.seen) == 1


async def test_a_youtube_link_posted_by_a_member_needs_nothing_from_the_organizer(
    world: World, google: Google
) -> None:
    """Any member posts a public or unlisted link; our key looks at it, the organizer does
    nothing."""
    with_key(world)
    got = await post(world, "a", url=YT_LIVE, title="Somebody else's stream")
    assert got.status_code == 201
    google.live(VIDEO)
    [item] = await shelf(world, "b")
    assert item["live_source"] == "youtube" and item["mine"] is False
