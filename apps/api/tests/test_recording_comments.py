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
from tests.extras_support import (
    AVATAR,
    MEMBER_A,
    REC,
    REC_REMOVED,
    World,
)
from tests.extras_support import world_fixture as world_fixture  # noqa: F401

URL = "/api/v1/recording-comments"


async def post(
    world: World, who: str | None = "a", body: str = "A story.", anonymous: bool = False, rec=REC
):
    return await world.call(
        "POST",
        f"{URL}/recordings/{rec}",
        who,
        json={"body": body, "is_anonymous": anonymous},
    )


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


async def test_a_refused_post_does_not_use_the_hourly_allowance(world: World) -> None:
    for _ in range(12):
        assert (await post(world, body="   ")).status_code == 422
    for _ in range(3):
        assert (await post(world, rec=REC_REMOVED)).status_code == 404
    assert (await post(world, body="A real one.")).status_code == 201


async def test_hourly_brake_for_members_not_for_the_team(world: World) -> None:
    for i in range(10):
        assert (await post(world, body=f"Story number {i} here")).status_code == 201
    over = await post(world, body="One more story")
    assert over.status_code == 429
    assert over.headers.get("x-error-code") is None  # the hourly brake, not the daily allowance
    for i in range(11):
        assert (await post(world, "team", body=f"Team note {i} ok")).status_code == 201


# --------------------------------------------------------------------------- daily allowance


async def _fill_day(world: World, count: int, model=RecordingComment, **extra) -> None:
    async with world.sessions() as session:
        for i in range(count):
            if model is RecordingComment:
                session.add(
                    RecordingComment(recording_id=REC, member_id=MEMBER_A, body=f"old {i}", **extra)
                )
            else:
                session.add(SongComment(song_id=19, member_id=MEMBER_A, body=f"song {i}", **extra))
        await session.commit()


async def test_daily_allowance_counts_removed_ones_and_the_team_is_free(world: World) -> None:
    await _fill_day(world, 20, status="removed", removed_by="author")
    blocked = await post(world, body="Another one today")
    assert blocked.status_code == 429
    assert blocked.headers["x-error-code"] == "comment_daily_limit"
    assert (await post(world, "team", body="Team is free")).status_code == 201


async def test_old_comments_do_not_count(world: World) -> None:
    await _fill_day(world, 20)
    async with world.sessions() as session:
        old = datetime.now(UTC) - timedelta(hours=25)
        for row in (await session.scalars(select(RecordingComment))).all():
            row.created_at = old
        await session.commit()
    assert (await post(world, body="A new day")).status_code == 201


async def test_the_allowance_is_shared_with_song_comments(world: World) -> None:
    await _fill_day(world, 19, model=SongComment)
    assert (await post(world, body="Number twenty")).status_code == 201
    blocked = await post(world, body="Number twenty-one")
    assert blocked.status_code == 429
    assert blocked.headers["x-error-code"] == "comment_daily_limit"


async def test_deleting_does_not_give_the_allowance_back(world: World) -> None:
    await _fill_day(world, 19)
    created = await post(world, body="The twentieth")
    assert created.status_code == 201
    assert (await world.call("DELETE", f"{URL}/{created.json()['id']}", "a")).status_code == 204
    blocked = await post(world, body="After deleting")
    assert blocked.status_code == 429
    assert blocked.headers["x-error-code"] == "comment_daily_limit"


# --------------------------------------------------------------------------- delete and remove


async def test_author_delete_wipes_the_text_and_keeps_the_row(world: World) -> None:
    created = (await post(world, "a", "Private memory", anonymous=True)).json()
    assert (await world.call("DELETE", f"{URL}/{created['id']}", "b")).status_code == 404
    assert (await world.call("DELETE", f"{URL}/{created['id']}", "a")).status_code == 204
    assert (await listing(world)).json()["items"] == []
    (row,) = await world.rows(RecordingComment)
    assert row.status == "removed" and row.removed_by == "author"
    assert "Private memory" not in row.body
    assert (await world.call("DELETE", f"{URL}/{created['id']}", "a")).status_code == 404


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
    assert row.body == "Rude words" and row.removed_by != "author"
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
