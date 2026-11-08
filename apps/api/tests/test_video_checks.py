"""Is a video link still alive.

What each site's answer means, the two-in-a-row rule, who triggers a look (adding, reading, a
"broken" report, the team) and that only three fixed hosts are ever asked."""

from __future__ import annotations

from datetime import timedelta

import httpx
import pytest

from app.models.recording_extras import VideoLink
from app.services import video_checks
from app.services.recordings import now_utc
from tests.extras_support import REC, World
from tests.extras_support import world_fixture as world_fixture  # noqa: F401

URL = "/api/v1/video-links"
YT = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
YT_ID = "dQw4w9WgXcQ"


class Net:
    """A fake internet: records every request and answers by host and a scripted status."""

    def __init__(self) -> None:
        self.seen: list[httpx.Request] = []
        self.status = 200
        self.body = b"{}"

    def __call__(self, request: httpx.Request) -> httpx.Response:
        self.seen.append(request)
        return httpx.Response(self.status, content=self.body)


@pytest.fixture(autouse=True)
def net():
    fake = Net()
    video_checks.transport = httpx.MockTransport(fake)
    yield fake
    video_checks.transport = None


async def add(world: World, who: str = "a", url: str = YT):
    response = await world.call("POST", f"{URL}/recordings/{REC}", who, json={"url": url})
    assert response.status_code == 201, response.text
    return response.json()


async def stored(world: World) -> VideoLink:
    return (await world.rows(VideoLink))[0]


# --------------------------------------------------------------------------- what an answer means


@pytest.mark.parametrize(
    ("provider", "code", "body", "meaning"),
    [
        ("youtube", 200, b"{}", "ok"),
        ("youtube", 401, b"", "no_embed"),
        ("youtube", 404, b"", "gone"),
        ("youtube", 500, b"", "unknown"),
        ("youtube", 429, b"", "unknown"),
        ("vimeo", 200, b"{}", "ok"),
        ("vimeo", 403, b"", "no_embed"),
        ("vimeo", 404, b"", "gone"),
        ("archive", 200, b'{"metadata":{"title":"x"}}', "ok"),
        ("archive", 200, b"{}", "gone"),
        ("archive", 503, b"", "unknown"),
    ],
)
def test_what_a_sites_answer_means(provider: str, code: int, body: bytes, meaning: str) -> None:
    assert video_checks.read_answer(provider, code, body) == meaning


def test_only_three_fixed_hosts_are_ever_asked() -> None:
    youtube = video_checks.probe_target("youtube", YT_ID, YT)
    vimeo = video_checks.probe_target("vimeo", "123456789", "https://vimeo.com/123456789")
    archive = video_checks.probe_target(
        "archive", "some-item", "https://archive.org/details/some-item"
    )
    assert youtube and youtube.startswith("https://www.youtube.com/oembed?")
    assert vimeo and vimeo.startswith("https://vimeo.com/api/oembed.json?")
    assert archive and archive.startswith("https://archive.org/metadata/")
    assert video_checks.probe_target("facebook", "1", "https://facebook.com/1") is None


# --------------------------------------------------------------------------- who triggers a look


async def test_a_link_that_was_just_added_is_looked_at_after_the_answer(
    world: World, net: Net
) -> None:
    body = await add(world)
    assert body["link_status"] == "unknown"  # the answer does not wait for the look
    assert [r.url.host for r in net.seen] == ["www.youtube.com"]
    row = await stored(world)
    assert row.link_status == "ok" and row.checked_at is not None and row.check_fails == 0
    listed = (await world.call("GET", f"{URL}/recordings/{REC}")).json()["items"]
    assert listed[0]["link_status"] == "ok"


async def test_a_video_the_owner_does_not_let_others_show_is_no_embed(
    world: World, net: Net
) -> None:
    net.status = 401
    await add(world)
    assert (await stored(world)).link_status == "no_embed"


async def test_gone_twice_in_a_row_is_unavailable_and_one_good_look_forgives(
    world: World, net: Net
) -> None:
    await add(world)
    net.status = 404
    async with world.sessions() as session:
        video = await session.get(VideoLink, (await stored(world)).id)
        await video_checks.check_links(session, [video])
    first = await stored(world)
    assert first.link_status == "ok" and first.check_fails == 1  # one miss is not enough
    async with world.sessions() as session:
        video = await session.get(VideoLink, first.id)
        await video_checks.check_links(session, [video])
    second = await stored(world)
    assert second.link_status == "unavailable" and second.check_fails == 2
    net.status = 200
    async with world.sessions() as session:
        video = await session.get(VideoLink, first.id)
        await video_checks.check_links(session, [video])
    third = await stored(world)
    assert third.link_status == "ok" and third.check_fails == 0


async def test_a_trouble_the_check_cannot_read_changes_nothing(world: World, net: Net) -> None:
    await add(world)
    net.status = 503
    async with world.sessions() as session:
        video = await session.get(VideoLink, (await stored(world)).id)
        await video_checks.check_links(session, [video])
    row = await stored(world)
    assert row.link_status == "ok" and row.check_fails == 0


async def test_a_timeout_is_unknown_not_unavailable(world: World, net: Net) -> None:
    await add(world)

    def boom(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectTimeout("slow", request=request)

    video_checks.transport = httpx.MockTransport(boom)
    async with world.sessions() as session:
        video = await session.get(VideoLink, (await stored(world)).id)
        counts = await video_checks.check_links(session, [video])
    assert counts["unknown"] == 1
    assert (await stored(world)).link_status == "ok"


async def test_reading_a_page_looks_at_old_links_only(world: World, net: Net) -> None:
    await add(world)
    net.seen.clear()
    await world.call("GET", f"{URL}/recordings/{REC}")
    assert net.seen == []  # looked at a moment ago
    row = await stored(world)
    await world.update(VideoLink, row.id, checked_at=now_utc() - timedelta(days=8))
    await world.call("GET", f"{URL}/recordings/{REC}")
    assert len(net.seen) == 1


async def test_a_broken_report_looks_at_the_link_at_once(world: World, net: Net) -> None:
    await add(world)
    net.seen.clear()
    row = await stored(world)
    net.status = 404
    reported = await world.call("POST", f"{URL}/{row.id}/report", "b", json={"reason": "broken"})
    assert reported.status_code == 201
    assert len(net.seen) == 1 and (await stored(world)).check_fails == 1
    net.seen.clear()
    other = await world.call("POST", f"{URL}/{row.id}/report", "team", json={"reason": "spam"})
    assert other.status_code == 201 and net.seen == []


async def test_the_team_can_check_now_and_a_member_cannot(world: World, net: Net) -> None:
    await add(world)
    row = await stored(world)
    await world.update(VideoLink, row.id, checked_at=None, link_status="unknown")
    net.seen.clear()
    assert (await world.call("POST", f"{URL}/review/recheck", "a")).status_code == 403
    done = await world.call("POST", f"{URL}/review/recheck", "team")
    assert done.status_code == 200, done.text
    assert done.json()["ok"] == 1 and len(net.seen) == 1
    # nothing is due now: a second call asks nobody
    net.seen.clear()
    again = await world.call("POST", f"{URL}/review/recheck", "team")
    assert again.json() == {"ok": 0, "no_embed": 0, "gone": 0, "unknown": 0} and net.seen == []
    everything = await world.call("POST", f"{URL}/review/recheck?everything=true", "team")
    assert everything.json()["ok"] == 1


async def test_nothing_is_hidden_because_a_link_looks_gone(world: World, net: Net) -> None:
    await add(world)
    row = await stored(world)
    await world.update(VideoLink, row.id, link_status="unavailable", check_fails=2)
    listed = (await world.call("GET", f"{URL}/recordings/{REC}")).json()["items"]
    assert [v["link_status"] for v in listed] == ["unavailable"]


async def test_the_team_queue_shows_the_status(world: World, net: Net) -> None:
    await add(world)
    row = await stored(world)
    await world.call("POST", f"{URL}/{row.id}/report", "b", json={"reason": "other"})
    queue = (await world.call("GET", f"{URL}/review", "team")).json()["items"]
    assert queue[0]["link_status"] == "ok" and queue[0]["checked_at"] is not None
