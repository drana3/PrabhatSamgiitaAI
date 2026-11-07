"""Video links on recordings and on songs: the address rules, limits, moderation, anonymity."""

from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import pytest

from app.models import UserAccount
from app.models.recording_extras import VideoLink
from app.services import video_links as service
from app.services.extras_common import AUTHOR_DELETED_BY
from tests.extras_support import (
    AVATAR,
    MEMBER_A,
    REC,
    REC_REMOVED,
    TEAM,
    World,
)
from tests.extras_support import world_fixture as world_fixture  # noqa: F401

URL = "/api/v1/video-links"
YT = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"


def yt(video_id: str) -> str:
    assert len(video_id) == 11
    return f"https://youtu.be/{video_id}"


def ids(n: int) -> str:
    return f"abcdefghi{n:02d}"


async def add(world: World, who: str | None = "a", link: str = YT, rec=REC, **extra):
    return await world.call("POST", f"{URL}/recordings/{rec}", who, json={"url": link, **extra})


async def add_song(world: World, who: str | None = "a", link: str = YT, song: int = 19, **extra):
    return await world.call("POST", f"{URL}/songs/{song}", who, json={"url": link, **extra})


async def listing(world: World, who: str | None = None, rec=REC):
    response = await world.call("GET", f"{URL}/recordings/{rec}", who)
    assert response.status_code == 200, response.text
    return response.json()


# --------------------------------------------------------------------------- the address rules


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        (YT, ("youtube", "dQw4w9WgXcQ", YT)),
        ("youtu.be/dQw4w9WgXcQ?t=42&si=track", ("youtube", "dQw4w9WgXcQ", YT)),
        (
            "https://m.youtube.com/watch?v=dQw4w9WgXcQ&list=PLx&index=2#t=1",
            ("youtube", "dQw4w9WgXcQ", YT),
        ),
        ("https://www.youtube.com/embed/dQw4w9WgXcQ", ("youtube", "dQw4w9WgXcQ", YT)),
        ("https://www.youtube.com/shorts/dQw4w9WgXcQ", ("youtube", "dQw4w9WgXcQ", YT)),
        ("https://www.youtube.com/live/dQw4w9WgXcQ", ("youtube", "dQw4w9WgXcQ", YT)),
        ("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ", ("youtube", "dQw4w9WgXcQ", YT)),
        ("HTTPS://WWW.YOUTUBE.COM:443/watch?v=dQw4w9WgXcQ", ("youtube", "dQw4w9WgXcQ", YT)),
        ("https://vimeo.com/123456789", ("vimeo", "123456789", "https://vimeo.com/123456789")),
        (
            "https://vimeo.com/123456789/abcdef1234",
            ("vimeo", "123456789", "https://vimeo.com/123456789/abcdef1234"),
        ),
        (
            "https://player.vimeo.com/video/123456789?h=zz",
            ("vimeo", "123456789", "https://vimeo.com/123456789"),
        ),
        (
            "https://vimeo.com/channels/staffpicks/123456789",
            ("vimeo", "123456789", "https://vimeo.com/123456789"),
        ),
        (
            "https://archive.org/details/kiirtan-1990?tab=about",
            ("archive", "kiirtan-1990", "https://archive.org/details/kiirtan-1990"),
        ),
    ],
)
def test_good_links_are_rebuilt_from_provider_and_id(raw: str, expected: tuple) -> None:
    assert service.parse_video_url(raw) == expected


@pytest.mark.parametrize(
    "raw",
    [
        "",
        "   ",
        "http://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "javascript:alert(1)",
        "data:text/html,hi",
        "file:///etc/passwd",
        "ftp://youtube.com/watch?v=dQw4w9WgXcQ",
        "https://user:pw@www.youtube.com/watch?v=dQw4w9WgXcQ",
        "https://www.youtube.com:8443/watch?v=dQw4w9WgXcQ",
        "https://www.youtube.com/watch?v=short",
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ%00",
        "https://www.youtube.com/@channel",
        "https://www.youtube.com/playlist?list=PLabc",
        "https://www.youtube.com/results?search_query=baba",
        "https://www.youtube.com/watch",
        "https://youtu.be/",
        "https://youtu.be/dQw4w9WgXcQ/extra",
        "https://vimeo.com/user12345",
        "https://vimeo.com/123",
        "https://vimeo.com/channels/staffpicks",
        "https://archive.org/search?query=kiirtan",
        "https://archive.org/details/",
        "https://archive.org/download/kiirtan/file.mp3",
        "https://www.youtuбe.com/watch?v=dQw4w9WgXcQ",
        "https://www.youtube.com/watch?v=dQw4w9 XcQ",
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ\nhttps://evil.example",
    ],
)
def test_bad_links_are_refused(raw: str) -> None:
    with pytest.raises(service.VideoRefusedError) as caught:
        service.parse_video_url(raw)
    assert caught.value.code in {service.BAD_LINK_CODE, service.PROVIDER_CODE}


@pytest.mark.parametrize(
    "raw",
    [
        "https://evil.example/watch?v=dQw4w9WgXcQ",
        "https://www.youtube.com.evil.example/watch?v=dQw4w9WgXcQ",
        "https://notyoutube.com/watch?v=dQw4w9WgXcQ",
        "https://www.facebook.com/watch/?v=1234567890",
        "https://www.instagram.com/reel/abc123/",
        "https://www.tiktok.com/@a/video/1234567890",
        "https://bit.ly/abcdef",
        "https://127.0.0.1/video",
        "https://localhost/video",
        "https://169.254.169.254/latest/meta-data",
    ],
)
def test_other_sites_are_refused_as_not_allowed(raw: str) -> None:
    with pytest.raises(service.VideoRefusedError) as caught:
        service.parse_video_url(raw)
    assert caught.value.code == service.PROVIDER_CODE


def test_titles() -> None:
    assert service.clean_title("  Evening ‮kiirtan​  2019 ") == "Evening kiirtan 2019"
    assert service.clean_title("   ") is None and service.clean_title(None) is None
    for bad in ("x" * 81, "watch https://evil.example now", "see evil.com/x"):
        with pytest.raises(Exception) as caught:
            service.clean_title(bad)
        assert getattr(caught.value, "status_code", None) == 422


# --------------------------------------------------------------------------- adding


async def test_add_and_read_on_a_recording(world: World) -> None:
    created = await add(world, "a", "youtu.be/dQw4w9WgXcQ?t=5", title="  Retreat 2019 ")
    assert created.status_code == 201, created.text
    out = created.json()
    assert out["url"] == YT and out["provider"] == "youtube" and out["title"] == "Retreat 2019"
    assert out["mine"] is True and out["author"] == {"name": "Ananda", "avatar_url": AVATAR}
    body = await listing(world)
    assert body["total"] == 1 and body["room"] == service.MAX_PER_TARGET - 1
    assert body["items"][0]["mine"] is False


async def test_add_and_read_on_a_song(world: World) -> None:
    created = await add_song(world, "a", song=19)
    assert created.status_code == 201
    listed = await world.call("GET", f"{URL}/songs/19")
    assert listed.json()["total"] == 1
    assert (await world.call("GET", f"{URL}/songs/20")).json()["total"] == 0
    # a song and a recording keep separate lists
    assert (await listing(world))["total"] == 0
    (row,) = await world.rows(VideoLink)
    assert row.song_id == 19 and row.recording_id is None and row.target_key == "song:19"


async def test_song_numbers_are_checked(world: World) -> None:
    for number in (0, 5019, -1):
        assert (await add_song(world, "a", song=number)).status_code == 422
        assert (await world.call("GET", f"{URL}/songs/{number}")).status_code == 422
    assert (await add_song(world, "a", song=5018)).status_code == 201


async def test_guest_cannot_add_and_bad_targets_are_404(world: World) -> None:
    assert (await add(world, None)).status_code == 401
    assert (await add_song(world, None)).status_code == 401
    assert (await add(world, "a", rec=uuid4())).status_code == 404
    assert (await add(world, "a", rec=REC_REMOVED)).status_code == 404
    assert (await world.call("GET", f"{URL}/recordings/{REC_REMOVED}")).status_code == 404


async def test_refused_input_says_why_and_uses_no_allowance(world: World) -> None:
    other = await add(world, "a", "https://evil.example/x")
    assert other.status_code == 422 and other.headers["x-error-code"] == "video_provider"
    garbage = await add(world, "a", "not a link at all")
    assert garbage.status_code == 422 and garbage.headers["x-error-code"] == "video_bad_link"
    plain = await add(world, "a", "http://www.youtube.com/watch?v=dQw4w9WgXcQ")
    assert plain.status_code == 422
    long_title = await add(world, "a", title="x" * 90)
    assert long_title.status_code == 422
    assert (await add(world, "a", title="see evil.com")).status_code == 422
    for _ in range(8):
        assert (await add(world, "a", "https://evil.example/x")).status_code == 422
    assert await world.rows(VideoLink) == []
    assert (await add(world, "a")).status_code == 201


async def test_a_video_is_listed_once_per_target(world: World) -> None:
    assert (await add(world, "a")).status_code == 201
    same = await add(world, "b", "https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=9")
    assert same.status_code == 409 and same.headers["x-error-code"] == "video_duplicate"
    assert (await add(world, "b", "https://vimeo.com/123456789")).status_code == 201
    # the same video on a song is another target
    assert (await add_song(world, "b")).status_code == 201


async def test_caps_per_member_and_per_target(world: World) -> None:
    for n in range(3):
        assert (await add(world, "a", yt(ids(n)))).status_code == 201
    fourth = await add(world, "a", yt(ids(3)))
    assert fourth.status_code == 409 and fourth.headers["x-error-code"] == "video_member_full"
    for who, start in (("b", 10), ("team", 20)):
        for n in range(start, start + 3):
            assert (await add(world, who, yt(ids(n)))).status_code == 201, (who, n)
    for n in range(30, 33):  # the team has no per-member cap, only the target's
        assert (await add(world, "team", yt(ids(n)))).status_code == 201, n
    full = await add(world, "team", yt(ids(50)))
    assert full.status_code == 409 and full.headers["x-error-code"] == "video_target_full"
    body = await listing(world)
    assert body["total"] == service.MAX_PER_TARGET and body["room"] == 0


async def test_hourly_and_daily_limits(world: World) -> None:
    codes = []
    for n in range(7):
        who = "a"
        # keep clear of the three-per-member cap on one target: spread over songs
        codes.append((await add_song(world, who, yt(ids(n)), song=100 + n)).status_code)
    assert codes[:5] == [201] * 5 and 429 in codes[5:]
    # the team has a far higher hourly brake
    for n in range(8):
        assert (await add_song(world, "team", yt(ids(40 + n)), song=300 + n)).status_code == 201


async def test_daily_allowance_counts_deleted_ones(world: World) -> None:
    async with world.sessions() as session:
        for n in range(9):
            session.add(
                VideoLink(
                    target_key=f"song:{500 + n}",
                    song_id=500 + n,
                    member_id=MEMBER_A,
                    provider="youtube",
                    external_id="",
                    url="",
                    status="removed",
                    removed_by=AUTHOR_DELETED_BY,
                )
            )
        await session.commit()
    created = await add(world, "a")
    assert created.status_code == 201
    assert (await world.call("DELETE", f"{URL}/{created.json()['id']}", "a")).status_code == 204
    blocked = await add(world, "a", yt(ids(1)))
    assert blocked.status_code == 429 and blocked.headers["x-error-code"] == "video_daily_limit"
    assert (await add(world, "team", yt(ids(2)))).status_code == 201


async def test_old_rows_do_not_count(world: World) -> None:
    old = datetime.now(UTC) - timedelta(hours=25)
    async with world.sessions() as session:
        for n in range(10):
            session.add(
                VideoLink(
                    target_key=f"song:{600 + n}",
                    song_id=600 + n,
                    member_id=MEMBER_A,
                    provider="youtube",
                    external_id=f"old{n}",
                    url=f"https://www.youtube.com/watch?v=old{n}",
                    created_at=old,
                )
            )
        await session.commit()
    assert (await add(world, "a")).status_code == 201


# --------------------------------------------------------------------------- anonymity


async def test_anonymous_link_has_no_trace_of_its_author(world: World) -> None:
    created = await add(world, "a", is_anonymous=True)
    assert created.json()["author"] is None
    await add(world, "b", yt(ids(1)), title="Named one")
    for who in (None, "a", "b", "team"):
        items = [i for i in (await listing(world, who))["items"] if i["is_anonymous"]]
        assert len(items) == 1
        text = json.dumps(items)
        for needle in (str(MEMBER_A), "Ananda", "ananda@example.org", AVATAR):
            assert needle not in text, (who, needle)
    queue = (await world.call("GET", f"{URL}/review", "team", params={"filter": "all"})).json()
    anonymous = [i for i in queue["items"] if i["is_anonymous"]]
    assert anonymous[0]["author_name"] == "Ananda" and anonymous[0]["author_id"] == str(MEMBER_A)


async def test_mine_and_can_remove_flags(world: World) -> None:
    await add(world, "a")
    by = {who: (await listing(world, who))["items"][0] for who in (None, "a", "b", "team")}
    assert [by[w]["mine"] for w in (None, "a", "b", "team")] == [False, True, False, False]
    assert [by[w]["can_remove"] for w in (None, "a", "b", "team")] == [False, False, False, True]
    assert (await world.call("GET", f"{URL}/recordings/{REC}")).headers["cache-control"] == (
        "private, no-store"
    )


# --------------------------------------------------------------------------- delete and remove


async def test_author_delete_wipes_the_address_and_frees_the_place(world: World) -> None:
    created = (await add(world, "a", title="Mine")).json()
    assert (await world.call("DELETE", f"{URL}/{created['id']}", "b")).status_code == 404
    assert (await world.call("DELETE", f"{URL}/{created['id']}", None)).status_code == 401
    assert (await world.call("DELETE", f"{URL}/{created['id']}", "a")).status_code == 204
    assert (await listing(world))["total"] == 0
    (row,) = await world.rows(VideoLink)
    assert (row.status, row.removed_by, row.url, row.title, row.external_id) == (
        "removed",
        AUTHOR_DELETED_BY,
        "",
        None,
        "",
    )
    assert (await world.call("DELETE", f"{URL}/{created['id']}", "a")).status_code == 404
    # the same video can be added again by anyone: the author withdrew it, nobody banned it
    assert (await add(world, "b")).status_code == 201


async def test_team_removal_keeps_the_row_and_blocks_the_same_video(world: World) -> None:
    created = (await add(world, "a")).json()
    removed = await world.call(
        "DELETE", f"{URL}/{created['id']}", "team", json={"reason": "  wrong film "}
    )
    assert removed.status_code == 204
    (row,) = await world.rows(VideoLink)
    assert row.status == "removed" and row.removed_reason == "wrong film"
    assert row.removed_by == "Carya" and row.url == YT
    again = await add(world, "b")
    assert again.status_code == 409 and again.headers["x-error-code"] == "video_team_removed"
    # the author deleting afterwards does not wipe the team's record
    assert (await world.call("DELETE", f"{URL}/{created['id']}", "a")).status_code == 204
    (row,) = await world.rows(VideoLink)
    assert row.url == YT and row.removed_by == "Carya"
    assert (await world.call("DELETE", f"{URL}/{created['id']}", "b")).status_code == 404


async def test_a_team_member_named_author_still_counts_as_a_team_removal(world: World) -> None:
    """QA-056: the author-delete marker cannot be a display name, so the team's removal stays a
    team removal: it blocks the same video and can be restored."""
    await world.update(UserAccount, TEAM, display_name="author")
    created = (await add(world, "a")).json()
    await world.call("DELETE", f"{URL}/{created['id']}", "team", json={"reason": "wrong film"})
    (row,) = await world.rows(VideoLink)
    assert row.removed_by == "author" and row.removed_by != AUTHOR_DELETED_BY and row.url == YT
    again = await add(world, "b")
    assert again.status_code == 409 and again.headers["x-error-code"] == "video_team_removed"
    restored = await world.call("POST", f"{URL}/{created['id']}/restore", "team")
    assert restored.status_code in (200, 204)


async def test_team_queue_and_restore(world: World) -> None:
    created = (await add(world, "a")).json()
    assert (await world.call("GET", f"{URL}/review", "a")).status_code == 403
    assert (await world.call("GET", f"{URL}/review", None)).status_code == 401
    assert (await world.call("POST", f"{URL}/{created['id']}/restore", "a")).status_code == 403
    assert (await world.call("POST", f"{URL}/{created['id']}/restore", "team")).status_code == 409
    await world.call("POST", f"{URL}/{created['id']}/report", "b", json={"reason": "broken"})
    reported = (await world.call("GET", f"{URL}/review", "team")).json()
    assert reported["total"] == 1 and reported["items"][0]["reports_count"] == 1
    await world.call("DELETE", f"{URL}/{created['id']}", "team", json={"reason": "bad"})
    assert (await world.call("GET", f"{URL}/review", "team")).json()["total"] == 0
    removed = (
        await world.call("GET", f"{URL}/review", "team", params={"filter": "removed"})
    ).json()
    assert removed["total"] == 1 and removed["items"][0]["status"] == "removed"
    restored = await world.call("POST", f"{URL}/{created['id']}/restore", "team")
    assert restored.status_code == 200 and restored.json()["status"] == "published"
    assert (await listing(world))["total"] == 1
    assert (await world.call("POST", f"{URL}/{uuid4()}/restore", "team")).status_code == 404


async def test_team_keeps_a_reported_video(world: World) -> None:
    created = (await add(world, "a")).json()
    await world.call("POST", f"{URL}/{created['id']}/report", "b", json={"reason": "broken"})
    assert (await world.call("POST", f"{URL}/{created['id']}/keep", "a")).status_code == 403
    assert (await world.call("POST", f"{URL}/{created['id']}/keep", None)).status_code == 401
    assert (await world.call("POST", f"{URL}/{uuid4()}/keep", "team")).status_code == 404
    kept = await world.call("POST", f"{URL}/{created['id']}/keep", "team")
    assert kept.status_code == 200 and kept.json()["reports_count"] == 0
    assert (await world.call("GET", f"{URL}/review", "team")).json()["total"] == 0
    assert (await listing(world))["total"] == 1
    # a removed link has nothing to keep; it is restored instead
    await world.call("DELETE", f"{URL}/{created['id']}", "team", json={"reason": "bad"})
    assert (await world.call("POST", f"{URL}/{created['id']}/keep", "team")).status_code == 409


async def test_author_deleted_rows_never_reach_the_team_and_cannot_be_restored(
    world: World,
) -> None:
    created = (await add(world, "a")).json()
    await world.call("DELETE", f"{URL}/{created['id']}", "a")
    for name in ("all", "removed", "reported"):
        got = (await world.call("GET", f"{URL}/review", "team", params={"filter": name})).json()
        assert got["total"] == 0, name
    assert (await world.call("POST", f"{URL}/{created['id']}/restore", "team")).status_code == 409


# --------------------------------------------------------------------------- reports


async def test_reports(world: World) -> None:
    created = (await add(world, "a")).json()
    first = await world.call(
        "POST", f"{URL}/{created['id']}/report", None, json={"reason": "broken"}
    )
    assert first.status_code == 201 and first.json()["status"] == "received"
    again = await world.call(
        "POST", f"{URL}/{created['id']}/report", None, json={"reason": "broken"}
    )
    assert again.json()["status"] == "already_reported"
    other = await world.call(
        "POST",
        f"{URL}/{created['id']}/report",
        "b",
        json={"reason": "not_about_this", "note": " other film "},
    )
    assert other.json()["status"] == "received"
    assert (await world.rows(VideoLink))[0].reports_count == 2
    bad = await world.call("POST", f"{URL}/{created['id']}/report", "b", json={"reason": "nope"})
    assert bad.status_code == 422
    missing = await world.call("POST", f"{URL}/{uuid4()}/report", "b", json={"reason": "spam"})
    assert missing.status_code == 404
    await world.call("DELETE", f"{URL}/{created['id']}", "a")
    gone = await world.call("POST", f"{URL}/{created['id']}/report", "b", json={"reason": "spam"})
    assert gone.status_code == 201 and "already removed" in gone.json()["message"]


async def test_nobody_reports_their_own_video(world: World) -> None:
    created = (await add(world, "a")).json()
    own = await world.call("POST", f"{URL}/{created['id']}/report", "a", json={"reason": "spam"})
    assert own.status_code == 422 and "your own" in own.json()["detail"]
    assert (await world.rows(VideoLink))[0].reports_count == 0
    guest = await world.call("POST", f"{URL}/{created['id']}/report", None, json={"reason": "spam"})
    assert guest.status_code == 201


async def test_report_flood_is_limited(world: World) -> None:
    created = (await add(world, "a")).json()
    codes = [
        (
            await world.call("POST", f"{URL}/{created['id']}/report", None, json={"reason": "spam"})
        ).status_code
        for _ in range(32)
    ]
    assert 429 in codes


async def test_oldest_first(world: World) -> None:
    first = (await add(world, "a", yt(ids(1)))).json()["id"]
    second = (await add(world, "b", yt(ids(2)))).json()["id"]
    base = datetime.now(UTC) - timedelta(hours=1)
    await world.update(VideoLink, UUID(first), created_at=base)
    await world.update(VideoLink, UUID(second), created_at=base + timedelta(minutes=1))
    assert [i["id"] for i in (await listing(world))["items"]] == [first, second]
