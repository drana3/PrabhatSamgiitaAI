"""Replies under recording comments (docs/comment-replies.md): one level, attached to the top-level
comment, counted right, deleted and removed with the tombstone rules, and the team's review calls.

The song comments use the same code (`services/comment_threads.py`); their reply tests are at the
end of test_song_comments.py.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

from app.models.recording_extras import RecordingComment
from app.services import comment_threads as threads
from app.services.song_comments import AUTHOR_DELETED_BY
from tests.extras_support import MEMBER_A, MEMBER_B, REC, World
from tests.extras_support import world_fixture as world_fixture  # noqa: F401
from tests.test_recording_comments import URL, listing, post


async def stamp(world: World, *ids: str) -> None:
    """Give the comments different times, in the order given (SQLite times are whole seconds)."""
    base = datetime(2026, 1, 1, tzinfo=UTC)
    for number, comment_id in enumerate(ids):
        await world.update(
            RecordingComment, UUID(comment_id), created_at=base + timedelta(minutes=number)
        )


async def reply(world: World, parent: str, who: str = "b", body: str = "A reply.", **kw):
    return await post(world, who, body, parent=parent, **kw)


async def top(world: World, who: str = "a", body: str = "A story.", **kw) -> dict:
    created = await post(world, who, body, **kw)
    assert created.status_code == 201, created.text
    return created.json()


async def items(world: World, who: str | None = "b") -> dict:
    return (await listing(world, who)).json()


# --------------------------------------------------------------------------- shape and counts


async def test_a_reply_hangs_under_its_comment_and_is_counted(world: World) -> None:
    first = await top(world)
    answered = await reply(world, first["id"], body="Thank you for sharing.")
    assert answered.status_code == 201
    out = answered.json()
    assert out["parent_id"] == first["id"] and out["reply_to"] is None and out["replies"] == []
    body = await items(world)
    assert body["total"] == 1  # the list pages through top-level comments
    assert body["live_total"] == 2  # but the number to show counts the reply too
    (entry,) = body["items"]
    assert entry["reply_count"] == 1 and entry["parent_id"] is None
    assert [r["body"] for r in entry["replies"]] == ["Thank you for sharing."]
    assert entry["replies"][0]["author"]["name"] == "Bhakti"


async def test_replies_come_oldest_first_and_paging_is_by_top_level_comments(world: World) -> None:
    older = await top(world, body="Older story.")
    newer = await top(world, body="Newer story.")
    made = [
        (await reply(world, older["id"], body=f"Reply number {n} here.")).json()["id"]
        for n in range(3)
    ]
    await stamp(world, older["id"], newer["id"], *made)
    page = (await listing(world, "b", limit=1)).json()
    assert [i["id"] for i in page["items"]] == [newer["id"]]
    assert page["total"] == 2 and page["has_more"] is True and page["live_total"] == 5
    second = (await listing(world, "b", limit=1, offset=1)).json()
    assert [r["body"] for r in second["items"][0]["replies"]] == [
        "Reply number 0 here.",
        "Reply number 1 here.",
        "Reply number 2 here.",
    ]


async def test_a_reply_to_a_reply_attaches_to_the_same_top_comment_and_says_to_whom(
    world: World,
) -> None:
    first = await top(world)
    second = (await reply(world, first["id"], "b", "First reply here.")).json()
    third = await reply(world, second["id"], "a", "Answering the reply.")
    assert third.status_code == 201
    out = third.json()
    assert out["parent_id"] == first["id"]  # never a third level
    assert out["reply_to"] == {"name": "Bhakti", "deleted": False}
    (entry,) = (await items(world))["items"]
    by_body = {r["body"]: r for r in entry["replies"]}
    assert {r["parent_id"] for r in by_body.values()} == {first["id"]}
    assert by_body["Answering the reply."]["reply_to"]["name"] == "Bhakti"
    assert by_body["First reply here."]["reply_to"] is None


async def test_replying_to_an_anonymous_reply_never_names_the_person(world: World) -> None:
    first = await top(world)
    hidden = (await reply(world, first["id"], "b", "Shy reply here.", anonymous=True)).json()
    answer = (await reply(world, hidden["id"], "a", "Answer to a shy one.")).json()
    assert answer["reply_to"] == {"name": None, "deleted": False}
    raw = (await listing(world, "a")).text
    for secret in (str(MEMBER_B), MEMBER_B.hex, "Bhakti", "bhakti@example.org"):
        assert secret not in raw


async def test_a_reply_to_a_deleted_reply_says_it_is_gone(world: World) -> None:
    first = await top(world)
    gone = (await reply(world, first["id"], "b", "Soon gone here.")).json()
    keep = (await reply(world, first["id"], "a", "Staying here ok.")).json()
    # answering the reply, then the reply's author deletes it: the answer says "to a deleted
    # comment"
    answer = (await reply(world, gone["id"], "a", "Answer before delete.")).json()
    await world.call("DELETE", f"{URL}/{gone['id']}", "b")
    (entry,) = (await items(world))["items"]
    by_id = {r["id"]: r for r in entry["replies"]}
    assert gone["id"] not in by_id and keep["id"] in by_id
    assert by_id[answer["id"]]["reply_to"] == {"name": None, "deleted": True}


# --------------------------------------------------------------------------- what can be answered


async def test_the_parent_must_be_a_live_comment_of_the_same_recording(world: World) -> None:
    first = await top(world)
    assert (await reply(world, str(uuid4()))).status_code == 404
    assert (await reply(world, first["id"], rec=REC)).status_code == 201
    from tests.extras_support import REC_REMOVED, recording

    async with world.sessions() as session:
        other = recording(uuid4(), "Another recording")
        session.add(other)
        await session.commit()
        other_id = other.id
    # a comment of another recording cannot be answered from this one
    assert (
        await post(world, "b", "Elsewhere.", rec=other_id, parent=first["id"])
    ).status_code == 404
    assert (
        await post(world, "b", "Hidden.", rec=REC_REMOVED, parent=first["id"])
    ).status_code == 404


async def test_a_deleted_or_removed_comment_cannot_be_answered(world: World) -> None:
    tombstoned = await top(world, body="Deleting this one.")
    removed = await top(world, "a", "The team removes this.")
    await world.call("DELETE", f"{URL}/{tombstoned['id']}", "a")
    await world.call("DELETE", f"{URL}/{removed['id']}", "team", json={"reason": "unkind"})
    assert (await reply(world, tombstoned["id"])).status_code == 404
    assert (await reply(world, removed["id"])).status_code == 404


async def test_a_full_conversation_takes_no_more_replies(world: World) -> None:
    first = await top(world)
    async with world.sessions() as session:
        for n in range(threads.THREAD_MAX_REPLIES):
            session.add(
                RecordingComment(
                    recording_id=REC,
                    member_id=MEMBER_B,
                    body=f"filler {n}",
                    parent_id=UUID(first["id"]),
                )
            )
        await session.commit()
    full = await reply(world, first["id"], "a", "One too many.")
    assert full.status_code == 409 and full.headers["x-error-code"] == threads.THREAD_FULL_CODE
    # a new top-level comment is not affected
    assert (await post(world, "a", "A fresh topic.")).status_code == 201


async def test_the_same_words_can_be_said_in_two_conversations_not_twice_in_one(
    world: World,
) -> None:
    one = await top(world, body="First topic.")
    two = await top(world, body="Second topic.")
    assert (await reply(world, one["id"], "b", "Thank you!")).status_code == 201
    assert (await reply(world, two["id"], "b", "Thank you!")).status_code == 201
    assert (await reply(world, one["id"], "b", "thank you")).status_code == 409
    # a reply may repeat the words of a top-level comment: they are different conversations
    assert (await post(world, "b", "Thank you!")).status_code == 201


async def test_a_refused_reply_costs_nothing(world: World) -> None:
    first = await top(world)
    for _ in range(8):
        assert (await reply(world, first["id"], "b", "   ", flood=True)).status_code == 422
        assert (
            await reply(world, str(uuid4()), "b", "Nobody home.", flood=True)
        ).status_code == 404
    assert (await reply(world, first["id"], "b", "Real one.", flood=True)).status_code == 201


# --------------------------------------------------------------------------- delete and remove


async def test_a_deleted_reply_just_goes_and_the_count_follows(world: World) -> None:
    first = await top(world)
    mine = (await reply(world, first["id"], "b", "My reply here.")).json()
    assert (await items(world))["live_total"] == 2
    assert (await world.call("DELETE", f"{URL}/{mine['id']}", "a")).status_code == 404
    assert (await world.call("DELETE", f"{URL}/{mine['id']}", "b")).status_code == 204
    body = await items(world)
    assert body["live_total"] == 1 and body["items"][0]["replies"] == []
    assert body["items"][0]["reply_count"] == 0
    (row,) = [r for r in await world.rows(RecordingComment) if r.parent_id]
    assert row.status == "removed" and row.removed_by == AUTHOR_DELETED_BY


async def test_a_deleted_top_comment_keeps_a_tombstone_and_its_replies(world: World) -> None:
    first = await top(world, body="Secret first words.")
    await reply(world, first["id"], "b", "Kind reply here.")
    await world.call("DELETE", f"{URL}/{first['id']}", "a")
    body = await items(world)
    (entry,) = body["items"]
    assert entry["deleted"] is True and entry["body"] == "" and entry["author"] is None
    assert [r["body"] for r in entry["replies"]] == ["Kind reply here."]
    assert (
        body["total"] == 1 and body["live_total"] == 1
    )  # the tombstone is not a comment, the reply is
    assert "Secret first words" not in json.dumps(body)


async def test_a_team_removal_takes_the_replies_out_of_sight_and_a_restore_brings_them_back(
    world: World,
) -> None:
    first = await top(world, body="Will be removed.")
    await reply(world, first["id"], "b", "A reply under it.")
    await top(world, "b", "Another topic stays.")
    assert (await items(world))["live_total"] == 3
    removed = await world.call("DELETE", f"{URL}/{first['id']}", "team", json={"reason": "unkind"})
    assert removed.status_code == 204
    body = await items(world)
    assert body["total"] == 1 and body["live_total"] == 1
    assert "A reply under it." not in json.dumps(body)
    restored = await world.call("POST", f"{URL}/{first['id']}/restore", "team")
    assert restored.status_code == 200 and restored.json()["parent_id"] is None
    body = await items(world)
    assert body["total"] == 2 and body["live_total"] == 3


async def test_a_team_removed_reply_goes_alone(world: World) -> None:
    first = await top(world)
    rude = (await reply(world, first["id"], "b", "Rude words here.")).json()
    await reply(world, first["id"], "a", "A kind one here.")
    await world.call("DELETE", f"{URL}/{rude['id']}", "team", json={"reason": "unkind"})
    (entry,) = (await items(world))["items"]
    assert [r["body"] for r in entry["replies"]] == ["A kind one here."]
    assert (await items(world))["live_total"] == 2


# --------------------------------------------------------------------------- reports and review


async def test_a_reply_can_be_reported_and_never_by_its_own_author(world: World) -> None:
    first = await top(world)
    mine = (await reply(world, first["id"], "b", "My reply here.")).json()
    own = await world.call("POST", f"{URL}/{mine['id']}/report", "b", json={"reason": "spam"})
    assert own.status_code == 422
    other = await world.call("POST", f"{URL}/{mine['id']}/report", "a", json={"reason": "spam"})
    assert other.status_code == 201
    queue = (await world.call("GET", f"{URL}/review", "team")).json()
    assert [(i["body"], i["parent_id"]) for i in queue["items"]] == [
        ("My reply here.", first["id"])
    ]


async def test_the_team_reviews_keeps_and_restores_and_only_the_team(world: World) -> None:
    first = await top(world, body="Reported words here.")
    other = await top(world, "a", "Removed words here.")
    await world.call("POST", f"{URL}/{first['id']}/report", "b", json={"reason": "spam"})
    await world.call("DELETE", f"{URL}/{other['id']}", "team", json={"reason": "unkind"})
    mine = await top(world, "b", "Author deleted this.")
    await world.call("DELETE", f"{URL}/{mine['id']}", "b")
    for who, status in (("a", 403), (None, 401)):
        assert (await world.call("GET", f"{URL}/review", who)).status_code == status
        assert (await world.call("POST", f"{URL}/{first['id']}/keep", who)).status_code == status
        assert (await world.call("POST", f"{URL}/{other['id']}/restore", who)).status_code == status
    reported = (await world.call("GET", f"{URL}/review", "team")).json()
    assert [i["body"] for i in reported["items"]] == ["Reported words here."]
    removed = (
        await world.call("GET", f"{URL}/review", "team", params={"filter": "removed"})
    ).json()
    # an author's own delete is not for the team to read or restore
    assert [i["body"] for i in removed["items"]] == ["Removed words here."]
    assert (await world.call("POST", f"{URL}/{mine['id']}/restore", "team")).status_code == 409
    assert (await world.call("POST", f"{URL}/{first['id']}/restore", "team")).status_code == 409
    kept = await world.call("POST", f"{URL}/{first['id']}/keep", "team")
    assert kept.status_code == 200 and kept.json()["reports_count"] == 0
    assert (await world.call("GET", f"{URL}/review", "team")).json()["items"] == []
    assert (await world.call("POST", f"{URL}/{uuid4()}/keep", "team")).status_code == 404
    assert str(MEMBER_A) not in json.dumps((await items(world, None))["items"])


# --------------------------------------------------------------------------- notice to the author


async def reply_notices(world: World) -> list:
    from app.models import MemberNotice

    return [n for n in await world.rows(MemberNotice) if n.kind == threads.REPLY_NOTICE_KIND]


async def test_a_reply_tells_the_author_of_the_answered_comment(world: World) -> None:
    first = await top(world, who="a")
    made = (await reply(world, first["id"], "b", "Thank you for sharing.")).json()
    (notice,) = await reply_notices(world)
    assert notice.user_id == MEMBER_A and notice.read_at is None
    assert notice.recording_id == REC
    assert notice.body == "Bhakti replied to your comment."
    assert notice.payload["parent_id"] == first["id"]
    assert notice.payload["comment_id"] == made["id"]
    assert notice.payload["recording_id"] == str(REC)
    assert notice.payload["from_name"] == "Bhakti"


async def test_a_reply_to_a_reply_tells_the_author_of_that_reply(world: World) -> None:
    first = await top(world, who="a")
    second = (await reply(world, first["id"], "b", "First reply here.")).json()
    await reply(world, second["id"], "a", "Answering the reply.")
    notices = await reply_notices(world)
    assert [n.user_id for n in notices] == [MEMBER_A, MEMBER_B]
    # the thread to open is still the top comment
    assert notices[1].payload["parent_id"] == first["id"]


async def test_nobody_is_told_about_their_own_reply_or_a_plain_comment(world: World) -> None:
    first = await top(world, who="a")
    assert await reply_notices(world) == []  # a top-level comment tells nobody
    await reply(world, first["id"], "a", "Adding to my own story.")
    assert await reply_notices(world) == []


async def test_an_anonymous_reply_is_announced_as_someone_and_never_named(world: World) -> None:
    first = await top(world, who="a")
    await reply(world, first["id"], "b", "A shy reply here.", anonymous=True)
    (notice,) = await reply_notices(world)
    assert notice.body == "Someone replied to your comment."
    assert notice.payload["from_name"] is None
    raw = json.dumps([notice.body, notice.title, notice.payload])
    for secret in (str(MEMBER_B), MEMBER_B.hex, "Bhakti", "bhakti@example.org"):
        assert secret not in raw


async def test_a_refused_reply_or_a_deleted_comment_makes_no_notice(world: World) -> None:
    first = await top(world, who="a")
    await world.call("DELETE", f"{URL}/{first['id']}", "a")
    assert (await reply(world, first["id"], "b", "Too late for this.")).status_code == 404
    assert await reply_notices(world) == []
