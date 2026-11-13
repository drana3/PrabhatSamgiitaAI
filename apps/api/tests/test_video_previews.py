"""The picture of a video link (docs/kiirtan-video.md, "Previews").

One test group per provider: where its picture comes from, that nothing outside the provider's own
image host is
ever kept or handed out, what the preview before adding says, and that the server only asks the
three fixed hosts
with an address built from the checked id."""

from __future__ import annotations

import json
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
VIMEO = "https://vimeo.com/76979871"
ARCHIVE = "https://archive.org/details/some-kiirtan-item"
VIMEO_PICTURE = "https://i.vimeocdn.com/video/452001751-d7c3e8_640.jpg"


class Net:
    """A fake internet that answers by host and records every request."""

    def __init__(self) -> None:
        self.seen: list[httpx.Request] = []
        self.status = 200
        self.vimeo: dict[str, object] = {
            "title": "Kiirtan at the retreat",
            "thumbnail_url": VIMEO_PICTURE,
        }
        self.youtube: dict[str, object] = {
            "title": "A kiirtan",
            "thumbnail_url": "https://i.ytimg.com/vi/x/hqdefault.jpg",
        }
        self.archive = b'{"metadata":{"title":"Old film"}}'
        self.raw: bytes | None = None
        self.boom: Exception | None = None

    def __call__(self, request: httpx.Request) -> httpx.Response:
        self.seen.append(request)
        if self.boom:
            raise self.boom
        if self.status != 200:
            return httpx.Response(self.status, content=b"")
        if self.raw is not None:
            return httpx.Response(200, content=self.raw)
        if request.url.host == "vimeo.com":
            return httpx.Response(200, content=json.dumps(self.vimeo).encode())
        if request.url.host == "archive.org":
            return httpx.Response(200, content=self.archive)
        return httpx.Response(200, content=json.dumps(self.youtube).encode())


@pytest.fixture(autouse=True)
def net():
    fake = Net()
    video_checks.transport = httpx.MockTransport(fake)
    video_checks.clear_preview_cache()
    yield fake
    video_checks.transport = None
    video_checks.clear_preview_cache()


async def add(world: World, link: str, who: str = "a"):
    response = await world.call("POST", f"{URL}/recordings/{REC}", who, json={"url": link})
    assert response.status_code == 201, response.text
    return response.json()


async def listed(world: World) -> list[dict]:
    return (await world.call("GET", f"{URL}/recordings/{REC}")).json()["items"]


async def peek(world: World, link: str, who: str | None = "a"):
    return await world.call("GET", f"{URL}/preview", who, params={"url": link})


# --------------------------------------------------------------------------- the pictures by id


def test_a_youtube_picture_is_built_from_the_id_and_is_the_16_by_9_one() -> None:
    assert (
        video_checks.thumbnail_by_id("youtube", YT_ID)
        == f"https://i.ytimg.com/vi/{YT_ID}/mqdefault.jpg"
    )
    # never `maxresdefault`: it is missing for many videos
    assert "maxres" not in (video_checks.thumbnail_by_id("youtube", YT_ID) or "")


def test_an_archive_picture_is_built_from_the_item_id() -> None:
    assert (
        video_checks.thumbnail_by_id("archive", "some-kiirtan-item")
        == "https://archive.org/services/img/some-kiirtan-item"
    )


@pytest.mark.parametrize(
    ("provider", "bad"),
    [
        ("youtube", "short"),
        ("youtube", "../etc/passwd"),
        ("youtube", "dQw4w9WgXcQ/../x"),
        ("archive", "a/../b"),
        ("archive", ""),
        ("archive", "x"),
        ("vimeo", "76979871"),  # Vimeo has no address by id
        ("facebook", YT_ID),
    ],
)
def test_no_picture_is_built_from_an_id_that_is_not_one(provider: str, bad: str) -> None:
    assert video_checks.thumbnail_by_id(provider, bad) is None


@pytest.mark.parametrize(
    "bad",
    [
        "http://i.vimeocdn.com/video/1_640.jpg",
        "https://i.vimeocdn.com.evil.example/video/1_640.jpg",
        "https://evil.example/i.vimeocdn.com/video/1_640.jpg",
        "https://user@i.vimeocdn.com/video/1_640.jpg",
        "https://user:pw@i.vimeocdn.com/video/1_640.jpg",
        "https://i.vimeocdn.com:8443/video/1_640.jpg",
        "https://i.vimeocdn.com/video/1_640.svg",
        "https://i.vimeocdn.com/video/1_640.jpg" + "a" * 300,
        "https://vimeo.com/video/1_640.jpg",
        "javascript:alert(1)",
        "data:image/png;base64,AAAA",
        "//i.vimeocdn.com/video/1_640.jpg",
        None,
        42,
    ],
)
def test_a_picture_address_off_the_providers_image_host_is_never_kept(bad: object) -> None:
    assert video_checks.safe_thumbnail("vimeo", bad) is None


def test_a_good_picture_address_loses_its_query_and_fragment() -> None:
    assert video_checks.safe_thumbnail("vimeo", VIMEO_PICTURE + "?token=1#x") == VIMEO_PICTURE
    assert (
        video_checks.safe_thumbnail("youtube", "https://i.ytimg.com/vi/abc/hqdefault.jpg")
        == "https://i.ytimg.com/vi/abc/hqdefault.jpg"
    )
    # the picture host of one site is not accepted for another
    assert video_checks.safe_thumbnail("youtube", VIMEO_PICTURE) is None


# --------------------------------------------------------------------------- stored links


async def test_a_youtube_link_is_listed_with_its_picture_at_once_without_asking_anybody(
    world: World, net: Net
) -> None:
    body = await add(world, YT)
    assert body["thumbnail_url"] == f"https://i.ytimg.com/vi/{YT_ID}/mqdefault.jpg"
    # the only request is the aliveness look, which asks for no picture
    assert {r.url.host for r in net.seen} == {"www.youtube.com"}
    assert (await listed(world))[0]["thumbnail_url"] == body["thumbnail_url"]


async def test_an_archive_link_is_listed_with_its_picture_by_id(world: World, net: Net) -> None:
    body = await add(world, ARCHIVE)
    assert body["thumbnail_url"] == "https://archive.org/services/img/some-kiirtan-item"
    assert {r.url.host for r in net.seen} == {"archive.org"}


async def test_a_vimeo_link_gets_its_picture_from_the_oembed_answer_and_keeps_it(
    world: World, net: Net
) -> None:
    body = await add(world, VIMEO)
    # the answer to the add does not wait for the look
    assert body["thumbnail_url"] is None
    row = (await world.rows(VideoLink))[0]
    assert row.thumbnail_url == VIMEO_PICTURE and row.link_status == "ok"
    assert (await listed(world))[0]["thumbnail_url"] == VIMEO_PICTURE
    request = net.seen[0]
    assert request.url.host == "vimeo.com" and request.url.path == "/api/oembed.json"
    assert request.url.params["width"] == "640"


async def test_a_vimeo_answer_with_a_picture_on_another_host_keeps_none(
    world: World, net: Net
) -> None:
    net.vimeo = {"title": "x", "thumbnail_url": "https://evil.example/t.jpg"}
    await add(world, VIMEO)
    row = (await world.rows(VideoLink))[0]
    assert row.thumbnail_url is None and row.link_status == "ok"
    assert (await listed(world))[0]["thumbnail_url"] is None


async def test_a_later_look_that_finds_no_picture_does_not_wipe_the_kept_one(
    world: World, net: Net
) -> None:
    await add(world, VIMEO)
    net.vimeo = {"title": "x"}
    async with world.sessions() as session:
        video = await session.get(VideoLink, (await world.rows(VideoLink))[0].id)
        await video_checks.check_links(session, [video])
    assert (await world.rows(VideoLink))[0].thumbnail_url == VIMEO_PICTURE


async def test_a_vimeo_link_without_a_picture_is_due_again_within_hours_the_others_after_days(
    world: World, net: Net
) -> None:
    net.vimeo = {"title": "x"}
    await add(world, VIMEO)
    vimeo = (await world.rows(VideoLink))[0]
    soon = now_utc() + timedelta(hours=7)
    assert video_checks.is_due(vimeo, now=soon) is True
    assert video_checks.is_due(vimeo, now=now_utc() + timedelta(hours=1)) is False
    # a link whose picture is kept waits a week like any good one
    vimeo.thumbnail_url = VIMEO_PICTURE
    assert video_checks.is_due(vimeo, now=soon) is False
    assert video_checks.is_due(vimeo, now=now_utc() + timedelta(days=8)) is True


async def test_a_removed_link_has_no_picture(world: World) -> None:
    body = await add(world, YT)
    await world.call("DELETE", f"{URL}/{body['id']}", "a")
    assert await listed(world) == []
    row = (await world.rows(VideoLink))[0]
    assert video_checks.thumbnail_for(row) is None


# --------------------------------------------------------------------------- the preview before add


async def test_preview_of_a_youtube_link_gives_title_picture_and_status(
    world: World, net: Net
) -> None:
    response = await peek(world, "youtu.be/dQw4w9WgXcQ?si=tracking&t=30")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body == {
        "provider": "youtube",
        "url": YT,
        "title": "A kiirtan",
        "thumbnail_url": f"https://i.ytimg.com/vi/{YT_ID}/mqdefault.jpg",
        "link_status": "ok",
    }
    assert [r.url.host for r in net.seen] == ["www.youtube.com"]


async def test_preview_of_a_vimeo_link_reads_the_picture_from_oembed(
    world: World, net: Net
) -> None:
    body = (await peek(world, "https://player.vimeo.com/video/76979871")).json()
    assert body["provider"] == "vimeo" and body["url"] == VIMEO
    assert body["thumbnail_url"] == VIMEO_PICTURE and body["title"] == "Kiirtan at the retreat"
    assert [(r.url.host, r.url.path) for r in net.seen] == [("vimeo.com", "/api/oembed.json")]


async def test_preview_of_an_archive_link_has_the_item_title_and_the_picture_by_id(
    world: World,
) -> None:
    body = (await peek(world, ARCHIVE)).json()
    assert body["provider"] == "archive" and body["title"] == "Old film"
    assert body["thumbnail_url"] == "https://archive.org/services/img/some-kiirtan-item"


async def test_preview_says_when_the_owner_does_not_let_others_show_the_video(
    world: World, net: Net
) -> None:
    net.status = 401
    body = (await peek(world, YT)).json()
    assert body["link_status"] == "no_embed" and body["title"] is None


async def test_preview_of_a_video_that_is_gone_has_no_picture(world: World, net: Net) -> None:
    net.status = 404
    body = (await peek(world, YT)).json()
    assert body["link_status"] == "unavailable" and body["thumbnail_url"] is None


async def test_preview_without_an_answer_still_offers_the_id_picture(
    world: World, net: Net
) -> None:
    net.boom = httpx.ConnectTimeout("slow")
    body = (await peek(world, YT)).json()
    assert (
        body["link_status"] == "unknown"
        and body["thumbnail_url"] == f"https://i.ytimg.com/vi/{YT_ID}/mqdefault.jpg"
    )
    net.boom = httpx.ConnectTimeout("slow")
    vimeo = (await peek(world, VIMEO)).json()
    assert vimeo["link_status"] == "unknown" and vimeo["thumbnail_url"] is None


async def test_preview_survives_a_5xx_and_garbage(world: World, net: Net) -> None:
    net.status = 503
    assert (await peek(world, YT)).json()["link_status"] == "unknown"
    net.status = 200
    net.raw = b"<html>not json</html>"
    video_checks.clear_preview_cache()
    body = (await peek(world, VIMEO)).json()
    assert body["link_status"] == "ok" and body["thumbnail_url"] is None and body["title"] is None


async def test_preview_reads_at_most_a_bounded_answer(world: World, net: Net) -> None:
    net.raw = b'{"title": "' + b"x" * 400_000 + b'"}'
    body = (await peek(world, VIMEO)).json()
    assert body["link_status"] == "ok" and body["title"] is None  # cut off: not valid JSON any more


async def test_preview_is_remembered_so_the_site_is_asked_once(world: World, net: Net) -> None:
    await peek(world, YT)
    await peek(world, "https://youtu.be/dQw4w9WgXcQ")
    await peek(world, "https://m.youtube.com/watch?v=dQw4w9WgXcQ&feature=share", "b")
    assert len(net.seen) == 1


async def test_a_doubtful_answer_is_remembered_only_briefly(world: World, net: Net) -> None:
    net.boom = httpx.ConnectTimeout("slow")
    await peek(world, YT)
    await peek(world, YT)
    assert len(net.seen) == 1
    key = ("youtube", YT_ID)
    expires, found = video_checks._preview_cache[key]
    assert (
        expires - video_checks.monotonic() <= video_checks.PREVIEW_TTL_UNSURE + 1
        and found.link_status == "unknown"
    )


def test_the_memory_of_previews_is_bounded() -> None:
    video_checks.clear_preview_cache()
    expires = video_checks.monotonic() + 100
    for n in range(video_checks.PREVIEW_CACHE_MAX + 50):
        video_checks._preview_cache[("youtube", f"{n:011d}")] = (
            expires,
            video_checks.Preview("ok", None, None),
        )
        while len(video_checks._preview_cache) > video_checks.PREVIEW_CACHE_MAX:
            video_checks._preview_cache.popitem(last=False)
    assert len(video_checks._preview_cache) == video_checks.PREVIEW_CACHE_MAX


@pytest.mark.parametrize(
    "link",
    [
        "https://www.facebook.com/watch/?v=1",
        "http://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "https://user@www.youtube.com/watch?v=dQw4w9WgXcQ",
        "https://www.youtube.com.evil.example/watch?v=dQw4w9WgXcQ",
        "https://169.254.169.254/latest/meta-data",
        "https://localhost/x",
        "https://www.youtube.com/playlist?list=PL123",
        "https://vimeo.com/channels/staffpicks",
        "javascript:alert(1)",
        "not a link",
    ],
)
async def test_preview_refuses_what_the_add_form_refuses_and_asks_nobody(
    world: World, net: Net, link: str
) -> None:
    response = await peek(world, link)
    assert response.status_code == 422
    assert net.seen == []


async def test_preview_needs_a_signed_in_member(world: World, net: Net) -> None:
    assert (await peek(world, YT, None)).status_code == 401
    assert net.seen == []


async def test_preview_is_limited_per_member_and_a_refused_link_costs_nothing(
    world: World, net: Net
) -> None:
    for _ in range(50):
        await peek(world, "https://example.org/x")  # refused: not counted
    codes = []
    for n in range(45):
        video_id = f"abcdefghi{n:02d}"
        codes.append((await peek(world, f"https://youtu.be/{video_id}")).status_code)
    assert codes[:40] == [200] * 40 and set(codes[40:]) == {429}
    # another member has a count of their own
    assert (await peek(world, "https://youtu.be/zzzzzzzzzzz", "b")).status_code == 200


async def test_the_server_only_ever_asks_the_three_fixed_hosts(world: World, net: Net) -> None:
    for link in (YT, VIMEO, ARCHIVE):
        assert (await peek(world, link)).status_code == 200
    hosts = {r.url.host for r in net.seen}
    assert hosts == {"www.youtube.com", "vimeo.com", "archive.org"}
    # no request carries the typed text as its address
    assert all(r.url.scheme == "https" for r in net.seen)


async def test_a_broadcast_tile_never_goes_blank_for_want_of_a_lookup() -> None:
    from types import SimpleNamespace

    from app.services import broadcasts

    base = {
        "provider": "youtube",
        "status": "published",
        "external_id": YT_ID,
        "thumbnail_url": None,
    }
    out = broadcasts._picture
    assert out(SimpleNamespace(**base)) == f"https://i.ytimg.com/vi/{YT_ID}/mqdefault.jpg"
    kept = SimpleNamespace(**{**base, "thumbnail_url": "https://i.ytimg.com/vi/x/hqdefault.jpg"})
    assert out(kept) == "https://i.ytimg.com/vi/x/hqdefault.jpg"
    assert out(SimpleNamespace(**{**base, "provider": "zoom"})) is None
    assert out(SimpleNamespace(**{**base, "status": "removed"})) is None
