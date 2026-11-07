"""Comments under a recording: posting, anonymity, reports, deletion, team removal, limits.

The rules are the song comments' own (tests/test_song_comments.py); this file checks that they hold
on the recording target too, and the parts that are new: the target itself (a removed or unknown
recording), and the daily allowance shared with the song comments.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta
from uuid import uuid4

from sqlalchemy import func, select

from app.models import UserAccount
from app.models.recording_extras import RecordingComment
from app.models.song_comments import SongComment
from app.services import recording_comments as service
from app.services import song_comments as base
from app.services.extras_common import AUTHOR_DELETED_BY, team_removed_by
from tests.extras_support import (
    AVATAR,
    MEMBER_A,
    REC,
    REC_REMOVED,
    TEAM,
    World,
)
from tests.extras_support import world_fixture as world_fixture  # noqa: F401

URL = "/api/v1/recording-comments"


async def post(
    world: World,
    who: str | None = "a",
    body: str = "A story.",
    anonymous: bool = False,
    rec=REC,
    parent: str | None = None,
    flood: bool = False,
):
    """`flood=False` empties the anti-flood count first so a test can post freely."""
    if not flood:
        service.limiter.reset()
    payload = {"body": body, "is_anonymous": anonymous}
    if parent is not None:
        payload["parent_id"] = parent
    return await world.call("POST", f"{URL}/recordings/{rec}", who, json=payload)


async def listing(world: World, who: str | None = None, rec=REC, **params):
    response = await world.call("GET", f"{URL}/recordings/{rec}", who, params=params)
    assert response.status_code == 200, response.text
    return response


# --------------------------------------------------------------------------- target


async def test_empty_list_is_private_and_not_cached(world: World) -> None:
    response = await listing(world)
    assert response.json()["items"] == []
    assert response.headers["cache-control"] == "private, no-store"


async def test_unknown_and_removed_recordings_are_404_for_everything(world: World) -> None:
    for rec in (uuid4(), REC_REMOVED):
        assert (await world.call("GET", f"{URL}/recordings/{rec}")).status_code == 404
        assert (await post(world, rec=rec)).status_code == 404
    assert await world.rows(RecordingComment) == []


async def test_guest_cannot_post(world: World) -> None:
    assert (await post(world, who=None)).status_code == 401


# --------------------------------------------------------------------------- anonymity


async def test_anonymous_comment_leaves_no_trace_of_its_author(world: World) -> None:
    named = await post(world, "a", "A named story.")
    anonymous = await post(world, "a", "An anonymous story.", anonymous=True)
    assert named.status_code == anonymous.status_code == 201
    assert named.json()["author"] == {"name": "Ananda", "avatar_url": AVATAR}
    assert anonymous.json()["author"] is None
    for who in (None, "a", "b", "team"):
        items = (await listing(world, who)).json()["items"]
        only_anonymous = json.dumps([c for c in items if c["is_anonymous"]])
        assert only_anonymous != "[]"
        for needle in (str(MEMBER_A), MEMBER_A.hex, "ananda@example.org", AVATAR, "Ananda"):
            assert needle not in only_anonymous, (who, needle)


async def test_mine_is_true_only_for_the_author_and_team_can_remove(world: World) -> None:
    await post(world, "a", "Mine.")
    by_a = (await listing(world, "a")).json()["items"][0]
    by_b = (await listing(world, "b")).json()["items"][0]
    by_team = (await listing(world, "team")).json()["items"][0]
    assert (by_a["mine"], by_b["mine"], by_team["mine"]) == (True, False, False)
    assert (by_a["can_remove"], by_b["can_remove"], by_team["can_remove"]) == (False, False, True)


async def test_an_address_is_never_shown_as_a_name(world: World) -> None:
    await world.update(UserAccount, MEMBER_A, display_name="ananda@example.org")
    await post(world, "a", "Hello there.")
    assert (await listing(world)).json()["items"][0]["author"]["name"] == "Member"


# --------------------------------------------------------------------------- content rules


async def test_content_rules_are_the_song_comments(world: World) -> None:
    assert (await post(world, body="   ")).status_code == 422
    assert (await post(world, body="a http://a.com b.org c.net")).status_code == 422
    ok = await post(world, body="Hel‮lo​ wor⁦ld")
    assert ok.status_code == 201
    assert ok.json()["body"] == "Hello world"
    duplicate = await post(world, body="HELLO, world!")
    assert duplicate.status_code == 409


async def test_a_refused_post_does_not_use_the_flood_allowance(world: World) -> None:
    for _ in range(12):
        assert (await post(world, body="   ", flood=True)).status_code == 422
    for _ in range(3):
        assert (await post(world, rec=REC_REMOVED, flood=True)).status_code == 404
    for n in range(service.POSTS_PER_MINUTE):
        assert (await post(world, body=f"A real one {n}.", flood=True)).status_code == 201
    assert (await post(world, body="One too many.", flood=True)).status_code == 429


# --------------------------------------------------------------------------- anti-flood


async def test_one_flood_rule_for_songs_recordings_and_replies_and_no_daily_limit(
    world: World,
) -> None:
    """At most POSTS_PER_MINUTE posts per member in 60 seconds, shared by every kind of comment."""
    assert service.POSTS_PER_MINUTE == base.POSTS_PER_MINUTE
    first = (await post(world, "a", "The first.", flood=True)).json()
    for n in range(service.POSTS_PER_MINUTE - 1):
        kind = await post(world, "a", f"Reply {n} here.", parent=first["id"], flood=True)
        assert kind.status_code == 201
    over = await post(world, "a", "One more.", flood=True)
    assert over.status_code == 429 and over.headers.get("x-error-code") is None
    # a song comment by the same member is counted in the same minute
    assert base.limiter is service.limiter
    # another member is free, and the team has a roomier limit
    assert (await post(world, "b", "Another member.", flood=True)).status_code == 201
    for i in range(service.POSTS_PER_MINUTE + 3):
        assert (await post(world, "team", f"Team note {i} ok", flood=True)).status_code == 201


async def test_there_is_no_daily_allowance_any_more(world: World) -> None:
    """Many comments spread over a day are fine, however many of them are removed or deleted."""
    async with world.sessions() as session:
        for i in range(40):
            session.add(
                RecordingComment(
                    recording_id=REC,
                    member_id=MEMBER_A,
                    body=f"old {i}",
                    status="removed",
                    removed_by=AUTHOR_DELETED_BY,
                )
            )
            session.add(SongComment(song_id=19, member_id=MEMBER_A, body=f"song {i}"))
        await session.commit()
    assert (await post(world, body="Still welcome")).status_code == 201
    assert not hasattr(service, "DAILY_COMMENTS") and not hasattr(service, "DAILY_LIMIT_CODE")


# --------------------------------------------------------------------------- delete and remove


async def test_author_delete_wipes_the_text_and_keeps_the_row(world: World) -> None:
    created = (await post(world, "a", "Private memory", anonymous=True)).json()
    assert (await world.call("DELETE", f"{URL}/{created['id']}", "b")).status_code == 404
    assert (await world.call("DELETE", f"{URL}/{created['id']}", "a")).status_code == 204
    # readers get a tombstone: no text, no author, nothing to act on (docs/recording-extras.md)
    for who in (None, "a", "b", "team"):
        (item,) = (await listing(world, who)).json()["items"]
        assert item["id"] == created["id"] and item["deleted"] is True
        assert item["body"] == "" and item["author"] is None
        assert item["mine"] is False and item["can_remove"] is False
        assert "Private memory" not in str(item) and "Ananda" not in str(item)
    (row,) = await world.rows(RecordingComment)
    assert row.status == "removed" and row.removed_by == AUTHOR_DELETED_BY
    assert "Private memory" not in row.body
    assert (await world.call("DELETE", f"{URL}/{created['id']}", "a")).status_code == 404
    # a tombstone cannot be reported, removed again or counted as a duplicate
    reply = await world.call("POST", f"{URL}/{created['id']}/report", "b", json={"reason": "spam"})
    assert "already removed" in reply.json()["message"]
    assert (await post(world, "a", "Private memory")).status_code == 201


async def test_live_total_is_the_number_to_show_and_leaves_tombstones_out(world: World) -> None:
    """QA-057: `total` pages through tombstones too, `live_total` counts what people can read."""
    first = (await post(world, "a", "One")).json()
    await post(world, "b", "Two")
    await post(world, "a", "Three")
    assert (await world.call("DELETE", f"{URL}/{first['id']}", "a")).status_code == 204
    body = (await listing(world, "b", limit=1)).json()
    assert body["total"] == 3 and body["live_total"] == 2 and len(body["items"]) == 1
    assert body["has_more"] is True
    # a team removal leaves neither a tombstone nor a count
    other = (await post(world, "b", "Rude words")).json()
    await world.call("DELETE", f"{URL}/{other['id']}", "team", json={"reason": "unkind"})
    body = (await listing(world, "b")).json()
    assert body["total"] == 3 and body["live_total"] == 2


async def test_a_team_removal_leaves_no_tombstone(world: World) -> None:
    created = (await post(world, "a", "Rude words")).json()
    await world.call("DELETE", f"{URL}/{created['id']}", "team", json={"reason": "unkind"})
    assert (await listing(world, "b")).json()["items"] == []
    assert (await listing(world, "b")).json()["total"] == 0


async def test_a_team_member_named_author_does_not_make_a_removal_look_like_an_author_delete(
    world: World,
) -> None:
    """QA-056: the marker of an author's own delete can never equal a display name."""
    await world.update(UserAccount, TEAM, display_name="author")
    created = (await post(world, "a", "Rude words")).json()
    await world.call("DELETE", f"{URL}/{created['id']}", "team", json={"reason": "unkind"})
    (row,) = await world.rows(RecordingComment)
    assert row.removed_by == "author" and row.removed_by != AUTHOR_DELETED_BY
    listed = (await listing(world, "b")).json()
    assert listed["items"] == [] and listed["total"] == 0  # no tombstone for a team removal


def test_team_removed_by_strips_control_characters_so_the_marker_cannot_be_typed() -> None:
    assert team_removed_by("\x1fauthor") == "author"
    assert team_removed_by("\x1fauthor") != AUTHOR_DELETED_BY
    assert team_removed_by("\x00\x1f") == "team"
    assert team_removed_by(None) == "team"
    assert AUTHOR_DELETED_BY.startswith("\x1f")


async def test_team_removes_with_a_reason_and_the_author_cannot_wipe_it_afterwards(
    world: World,
) -> None:
    created = (await post(world, "a", "Rude words")).json()
    assert (await world.call("DELETE", f"{URL}/{created['id']}", None)).status_code == 401
    removed = await world.call(
        "DELETE", f"{URL}/{created['id']}", "team", json={"reason": "  unkind  "}
    )
    assert removed.status_code == 204
    (row,) = await world.rows(RecordingComment)
    assert row.status == "removed" and row.removed_reason == "unkind" and row.body == "Rude words"
    again = await world.call("DELETE", f"{URL}/{created['id']}", "a")
    assert again.status_code == 204
    (row,) = await world.rows(RecordingComment)
    assert row.body == "Rude words" and row.removed_by != AUTHOR_DELETED_BY
    assert (await world.call("DELETE", f"{URL}/{created['id']}", "team")).status_code == 404


# --------------------------------------------------------------------------- reports


async def test_reports_once_each_and_the_team_sees_who_wrote_an_anonymous_comment(
    world: World,
) -> None:
    created = (await post(world, "a", "Doubtful text", anonymous=True)).json()
    guest = await world.call("POST", f"{URL}/{created['id']}/report", json={"reason": "spam"})
    assert guest.status_code == 201 and guest.json()["status"] == "received"
    again = await world.call("POST", f"{URL}/{created['id']}/report", json={"reason": "spam"})
    assert again.json()["status"] == "already_reported"
    member = await world.call(
        "POST", f"{URL}/{created['id']}/report", "b", json={"reason": "offensive", "note": "x"}
    )
    assert member.json()["status"] == "received"
    assert (await world.call("GET", f"{URL}/reported", "b")).status_code == 403
    queue = (await world.call("GET", f"{URL}/reported", "team")).json()
    (item,) = queue["items"]
    assert item["author_name"] == "Ananda" and item["author_id"] == str(MEMBER_A)
    assert item["reports_count"] == 2
    bad = await world.call("POST", f"{URL}/{created['id']}/report", json={"reason": "nope"})
    assert bad.status_code == 422


async def test_nobody_reports_their_own_comment(world: World) -> None:
    created = (await post(world, "a", "My own words")).json()
    own = await world.call("POST", f"{URL}/{created['id']}/report", "a", json={"reason": "spam"})
    assert own.status_code == 422 and "your own" in own.json()["detail"]
    assert (await world.rows(RecordingComment))[0].reports_count == 0
    team = await world.call("POST", f"{URL}/{created['id']}/report", "b", json={"reason": "spam"})
    assert team.status_code == 201


async def test_reporting_a_removed_or_unknown_comment(world: World) -> None:
    created = (await post(world, "a", "Soon gone")).json()
    await world.call("DELETE", f"{URL}/{created['id']}", "a")
    reply = await world.call("POST", f"{URL}/{created['id']}/report", json={"reason": "spam"})
    assert reply.status_code == 201 and "already removed" in reply.json()["message"]
    missing = await world.call("POST", f"{URL}/{uuid4()}/report", json={"reason": "spam"})
    assert missing.status_code == 404


async def test_report_flood_is_limited(world: World) -> None:
    created = (await post(world, "a", "Target")).json()
    codes = []
    for _ in range(32):
        codes.append(
            (
                await world.call("POST", f"{URL}/{created['id']}/report", json={"reason": "spam"})
            ).status_code
        )
    assert 429 in codes


# --------------------------------------------------------------------------- paging


async def test_paging_newest_first(world: World) -> None:
    async with world.sessions() as session:
        base = datetime.now(UTC) - timedelta(hours=2)
        for i in range(5):
            session.add(
                RecordingComment(
                    recording_id=REC,
                    member_id=MEMBER_A,
                    body=f"c{i}",
                    created_at=base + timedelta(minutes=i),
                )
            )
        await session.commit()
    page = (await listing(world, limit=2, offset=0)).json()
    assert [c["body"] for c in page["items"]] == ["c4", "c3"]
    assert page["total"] == 5 and page["has_more"] is True
    last = (await listing(world, limit=2, offset=4)).json()
    assert [c["body"] for c in last["items"]] == ["c0"] and last["has_more"] is False
    assert (
        await world.call("GET", f"{URL}/recordings/{REC}", params={"limit": 0})
    ).status_code == 422
    count = await world.scalar(select(func.count()).select_from(RecordingComment))
    assert count == 5
