"""Moods of recordings: the uploader suggests, listeners confirm, the team decides. The numbers
these pin are in docs/search-menu.md, section 6."""

# ruff: noqa: F811
from __future__ import annotations

import os

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://test:test@localhost/test")

from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta
from typing import Any, cast
from uuid import UUID, uuid4

import pytest
import pytest_asyncio
from sqlalchemy import Table, select, update
from test_author_profiles import (
    AS,
    AS_TEAM,
    MEMBER_A,
    MEMBER_B,
    MEMBER_C,
    TEAM,
    World,
    world,  # noqa: F401
)

from app.config import Settings
from app.models import UserAccount
from app.models.author_profiles import PlayEvent
from app.models.base import Base
from app.models.recording_moods import RecordingMood, RecordingMoodVote
from app.services import recording_moods as moods
from app.services.author_profiles import pepper
from app.services.author_stats import listener_key
from app.services.recording_moods import MoodError, decide


def code(response: Any) -> str:
    return str(response.headers.get("X-Error-Code"))


SETTINGS = Settings.model_validate({"_env_file": None, "NEXT_PUBLIC_API_BASE_URL": "http://t"})
API = "/api/v1/recording-moods"
ADMIN = "/api/v1/admin/recording-moods"


@pytest_asyncio.fixture
async def mworld(world: World) -> AsyncIterator[World]:
    """The author-profile world plus the two mood tables, with B and C grown-up accounts."""
    async with world.sessions() as session:
        conn = await session.connection()
        await conn.run_sync(
            lambda c: Base.metadata.create_all(
                c,
                tables=[
                    cast(Table, RecordingMood.__table__),
                    cast(Table, RecordingMoodVote.__table__),
                ],
            )
        )
        old = datetime.now(UTC) - timedelta(days=60)
        await session.execute(
            update(UserAccount)
            .where(UserAccount.id.in_([MEMBER_B, MEMBER_C, TEAM]))
            .values(created_at=old)
        )
        await session.commit()
    yield world


async def add_member(world: World, days_old: int = 60) -> UserAccount:
    async with world.sessions() as session:
        member = UserAccount(
            id=uuid4(),
            external_subject=f"test:{uuid4().hex}",
            identity_provider="test",
            display_name="Voter",
            email=f"{uuid4().hex[:8]}@example.org",
            last_seen_at=datetime.now(UTC),
            created_at=datetime.now(UTC) - timedelta(days=days_old),
        )
        session.add(member)
        await session.commit()
        return member


async def listened(world: World, rid: UUID, member_id: UUID) -> None:
    """A counted play of `member_id` (the play table holds only the short keyed hash)."""
    async with world.sessions() as session:
        session.add(
            PlayEvent(
                recording_id=rid,
                day=datetime.now(UTC).date(),
                listener_key=listener_key(pepper(SETTINGS), f"m:{member_id}"),
                listened_sec=60,
                created_at=datetime.now(UTC),
            )
        )
        await session.commit()


async def cast_vote(world: World, rid: UUID, member: UserAccount, mood: str, value: str) -> None:
    async with world.sessions() as session:
        recording = await moods.visible(session, rid)
        await moods.vote(session, SETTINGS, recording, member, mood, value)


async def suggest_as(world: World, rid: UUID, member_id: UUID, chosen: list[str]) -> None:
    async with world.sessions() as session:
        recording = await moods.visible(session, rid)
        member = await session.get(UserAccount, member_id)
        assert member is not None
        await moods.suggest(session, recording, member, chosen)


async def voter(world: World, rid: UUID, days_old: int = 60) -> UserAccount:
    member = await add_member(world, days_old)
    await listened(world, rid, member.id)
    return member


async def row(world: World, rid: UUID, mood: str) -> RecordingMood | None:
    async with world.sessions() as session:
        return await session.get(RecordingMood, (rid, mood))


async def confirmed(world: World) -> dict[str, list[str]]:
    r = await world.client.get(f"{API}/confirmed")
    assert r.status_code == 200
    return {i["recording_id"]: i["moods"] for i in r.json()["items"]}


# --------------------------------------------------------------------------- the pure rule


def test_the_numbers_of_the_rule() -> None:
    assert decide("uploader", 3, 0, True) == "confirmed"
    assert decide("uploader", 2, 0, True) == "suggested"  # three people are needed
    assert decide("uploader", 3, 1, True) == "confirmed"  # 75 percent
    assert decide("uploader", 3, 2, True) == "suggested"  # 60 percent
    assert decide("uploader", 3, 0, False) == "suggested"  # nobody with an older account yet
    assert decide("listeners", 4, 0, True) == "suggested"  # five when nobody suggested it
    assert decide("listeners", 5, 2, True) == "confirmed"  # 71 percent
    assert decide("listeners", 5, 3, True) == "suggested"
    assert decide("uploader", 1, 4, True) == "rejected"  # under 30 percent after five votes
    assert decide("uploader", 0, 4, True) == "suggested"  # four votes are not enough to reject
    assert decide("uploader", 1, 2, True) == "suggested"


# --------------------------------------------------------------------------- the uploader


async def test_the_uploader_suggests_one_or_two_moods(mworld: World) -> None:
    rid = await mworld.recording(MEMBER_A, title="Mine")
    put = f"{API}/recordings/{rid}/suggest"
    r = await mworld.client.put(put, headers=AS["a"], json={"moods": ["joyful", "calm"]})
    assert r.status_code == 204, r.text
    state = (await mworld.client.get(f"{API}/recordings/{rid}", headers=AS["a"])).json()
    by_mood = {m["mood"]: m for m in state["moods"]}
    assert by_mood["joyful"]["status"] == "suggested" and by_mood["joyful"]["source"] == "uploader"
    assert by_mood["sad"]["status"] == "none"
    assert state["can_suggest"] is True and state["can_vote"] is False
    assert state["cannot_vote_because"] == "own"
    # a suggestion is not a confirmation: nothing is public yet
    assert await confirmed(mworld) == {}
    three = await mworld.client.put(put, headers=AS["a"], json={"moods": ["joyful", "calm", "sad"]})
    assert three.status_code == 422 and code(three) == "too_many"
    odd = await mworld.client.put(put, headers=AS["a"], json={"moods": ["furious"]})
    assert odd.status_code == 422 and code(odd) == "bad_mood"
    other = await mworld.client.put(put, headers=AS["b"], json={"moods": ["calm"]})
    assert other.status_code == 403 and code(other) == "not_uploader"
    nobody = await mworld.client.put(put, json={"moods": ["calm"]})
    assert nobody.status_code == 401


async def test_not_sure_takes_back_the_suggestions_nobody_confirmed(mworld: World) -> None:
    rid = await mworld.recording(MEMBER_A)
    await suggest_as(mworld, rid, MEMBER_A, ["joyful", "calm"])
    await suggest_as(mworld, rid, MEMBER_A, ["calm"])
    assert await row(mworld, rid, "joyful") is None and await row(mworld, rid, "calm") is not None
    await suggest_as(mworld, rid, MEMBER_A, [])
    assert await row(mworld, rid, "calm") is None


async def test_a_library_recording_has_no_uploader_to_suggest(mworld: World) -> None:
    rid = await mworld.recording(None, title="From the library")
    r = await mworld.client.put(
        f"{API}/recordings/{rid}/suggest", headers=AS["a"], json={"moods": ["calm"]}
    )
    assert r.status_code == 403 and code(r) == "not_uploader"


# --------------------------------------------------------------------------- listeners


async def test_who_may_vote_and_why_not(mworld: World) -> None:
    rid = await mworld.recording(MEMBER_A)
    await suggest_as(mworld, rid, MEMBER_A, ["joyful"])
    put = f"{API}/recordings/{rid}/votes/joyful"
    anon = await mworld.client.put(put, json={"vote": "yes"})
    assert anon.status_code == 401
    own = await mworld.client.put(put, headers=AS["a"], json={"vote": "yes"})
    assert own.status_code == 409 and code(own) == "own_recording"
    # B has an old account but has not listened yet
    early = await mworld.client.put(put, headers=AS["b"], json={"vote": "yes"})
    assert early.status_code == 403 and code(early) == "listen_first"
    state = (await mworld.client.get(f"{API}/recordings/{rid}", headers=AS["b"])).json()
    assert state["can_vote"] is False and state["cannot_vote_because"] == "listen_first"
    await listened(mworld, rid, MEMBER_B)
    ok = await mworld.client.put(put, headers=AS["b"], json={"vote": "yes"})
    assert ok.status_code == 204, ok.text
    state = (await mworld.client.get(f"{API}/recordings/{rid}", headers=AS["b"])).json()
    joyful = next(m for m in state["moods"] if m["mood"] == "joyful")
    assert joyful["mine"] == "yes" and joyful["yes"] == 1 and state["can_vote"] is True
    # a vote can be changed and taken back
    await mworld.client.put(put, headers=AS["b"], json={"vote": "no"})
    assert (await row(mworld, rid, "joyful")).no_count == 1  # type: ignore[union-attr]
    await mworld.client.put(put, headers=AS["b"], json={"vote": "clear"})
    gone = await row(mworld, rid, "joyful")
    assert gone is not None and gone.yes_count == 0 and gone.no_count == 0


async def test_a_young_account_cannot_vote(mworld: World) -> None:
    rid = await mworld.recording(MEMBER_B)
    await suggest_as(mworld, rid, MEMBER_B, ["calm"])
    await listened(mworld, rid, MEMBER_A)  # A's account is minutes old
    r = await mworld.client.put(
        f"{API}/recordings/{rid}/votes/calm", headers=AS["a"], json={"vote": "yes"}
    )
    assert r.status_code == 403 and code(r) == "too_new"
    state = (await mworld.client.get(f"{API}/recordings/{rid}", headers=AS["a"])).json()
    assert state["cannot_vote_because"] == "too_new"


async def test_a_vote_for_a_mood_nobody_proposed_starts_it_but_a_no_cannot(
    mworld: World,
) -> None:
    rid = await mworld.recording(MEMBER_A)
    await listened(mworld, rid, MEMBER_B)
    no = await mworld.client.put(
        f"{API}/recordings/{rid}/votes/sad", headers=AS["b"], json={"vote": "no"}
    )
    assert no.status_code == 409 and code(no) == "not_proposed"
    yes = await mworld.client.put(
        f"{API}/recordings/{rid}/votes/sad", headers=AS["b"], json={"vote": "yes"}
    )
    assert yes.status_code == 204
    made = await row(mworld, rid, "sad")
    assert made is not None and made.source == "listeners" and made.status == "suggested"
    # nothing stands behind it once the only vote is taken back
    await mworld.client.put(
        f"{API}/recordings/{rid}/votes/sad", headers=AS["b"], json={"vote": "clear"}
    )
    assert await row(mworld, rid, "sad") is None


async def test_at_most_thirty_votes_a_day(mworld: World, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(moods, "VOTES_PER_DAY", 2)
    rid = await mworld.recording(MEMBER_A)
    await listened(mworld, rid, MEMBER_B)
    for mood in ("joyful", "calm"):
        r = await mworld.client.put(
            f"{API}/recordings/{rid}/votes/{mood}", headers=AS["b"], json={"vote": "yes"}
        )
        assert r.status_code == 204
    third = await mworld.client.put(
        f"{API}/recordings/{rid}/votes/sad", headers=AS["b"], json={"vote": "yes"}
    )
    assert third.status_code == 429 and code(third) == "vote_limit"
    # changing a vote already cast is not a new vote
    again = await mworld.client.put(
        f"{API}/recordings/{rid}/votes/joyful", headers=AS["b"], json={"vote": "no"}
    )
    assert again.status_code == 204


# --------------------------------------------------------------------------- confirming


async def test_three_yes_confirm_what_the_uploader_suggested(mworld: World) -> None:
    rid = await mworld.recording(MEMBER_A)
    await suggest_as(mworld, rid, MEMBER_A, ["devotion"])
    first, second, third = [await voter(mworld, rid) for _ in range(3)]
    await cast_vote(mworld, rid, first, "devotion", "yes")
    await cast_vote(mworld, rid, second, "devotion", "yes")
    assert (await row(mworld, rid, "devotion")).status == "suggested"  # type: ignore[union-attr]
    assert await confirmed(mworld) == {}
    await cast_vote(mworld, rid, third, "devotion", "yes")
    done = await row(mworld, rid, "devotion")
    assert done is not None and done.status == "confirmed" and done.confirmed_at is not None
    assert await confirmed(mworld) == {str(rid): ["devotion"]}
    # a "no" that brings the share under 70 percent takes the confirmation away again
    for _ in range(2):
        await cast_vote(mworld, rid, await voter(mworld, rid), "devotion", "no")
    assert (await row(mworld, rid, "devotion")).status == "suggested"  # type: ignore[union-attr]
    assert await confirmed(mworld) == {}


async def test_votes_of_new_accounts_alone_do_not_confirm(mworld: World) -> None:
    """Three accounts a fortnight old: enough votes, but none of them is old enough to vouch."""
    rid = await mworld.recording(MEMBER_A)
    await suggest_as(mworld, rid, MEMBER_A, ["calm"])
    for _ in range(3):
        await cast_vote(mworld, rid, await voter(mworld, rid, days_old=14), "calm", "yes")
    assert (await row(mworld, rid, "calm")).status == "suggested"  # type: ignore[union-attr]
    await cast_vote(mworld, rid, await voter(mworld, rid, days_old=90), "calm", "yes")
    assert (await row(mworld, rid, "calm")).status == "confirmed"  # type: ignore[union-attr]


async def test_without_a_suggestion_five_people_must_agree(mworld: World) -> None:
    rid = await mworld.recording(None, title="Library")
    for _ in range(4):
        await cast_vote(mworld, rid, await voter(mworld, rid), "ecstatic", "yes")
    assert (await row(mworld, rid, "ecstatic")).status == "suggested"  # type: ignore[union-attr]
    await cast_vote(mworld, rid, await voter(mworld, rid), "ecstatic", "yes")
    assert (await row(mworld, rid, "ecstatic")).status == "confirmed"  # type: ignore[union-attr]
    assert await confirmed(mworld) == {str(rid): ["ecstatic"]}


async def test_the_uploader_joining_later_lowers_the_bar_to_three(mworld: World) -> None:
    rid = await mworld.recording(MEMBER_A)
    for _ in range(3):
        await cast_vote(mworld, rid, await voter(mworld, rid), "joyful", "yes")
    assert (await row(mworld, rid, "joyful")).status == "suggested"  # type: ignore[union-attr]
    await suggest_as(mworld, rid, MEMBER_A, ["joyful"])
    assert (await row(mworld, rid, "joyful")).status == "confirmed"  # type: ignore[union-attr]


async def test_many_no_reject_and_a_rejected_mood_is_hidden(mworld: World) -> None:
    rid = await mworld.recording(MEMBER_A)
    await suggest_as(mworld, rid, MEMBER_A, ["sad"])
    await cast_vote(mworld, rid, await voter(mworld, rid), "sad", "yes")
    for _ in range(4):
        await cast_vote(mworld, rid, await voter(mworld, rid), "sad", "no")
    assert (await row(mworld, rid, "sad")).status == "rejected"  # type: ignore[union-attr]
    assert await confirmed(mworld) == {}
    listener = await mworld.client.get(f"{API}/recordings/{rid}", headers=AS["b"])
    assert next(m for m in listener.json()["moods"] if m["mood"] == "sad")["status"] == "none"
    team = await mworld.client.get(f"{API}/recordings/{rid}", headers=AS_TEAM)
    assert next(m for m in team.json()["moods"] if m["mood"] == "sad")["status"] == "rejected"


async def test_removed_recordings_never_show_their_moods(mworld: World) -> None:
    rid = await mworld.recording(MEMBER_A)
    await mworld.client.put(
        f"{ADMIN}/recordings/{rid}/calm", headers=AS_TEAM, json={"decision": "confirmed"}
    )
    assert str(rid) in await confirmed(mworld)
    from app.models.recordings import Recording

    async with mworld.sessions() as session:
        await session.execute(update(Recording).where(Recording.id == rid).values(status="removed"))
        await session.commit()
    assert await confirmed(mworld) == {}
    gone = await mworld.client.get(f"{API}/recordings/{rid}", headers=AS["a"])
    assert gone.status_code == 404


# --------------------------------------------------------------------------- the team


async def test_the_team_decides_and_locks_then_hands_back_to_the_votes(mworld: World) -> None:
    rid = await mworld.recording(MEMBER_A)
    await suggest_as(mworld, rid, MEMBER_A, ["calm"])
    put = f"{ADMIN}/recordings/{rid}/calm"
    denied = await mworld.client.put(put, headers=AS["b"], json={"decision": "confirmed"})
    assert denied.status_code == 403
    ok = await mworld.client.put(put, headers=AS_TEAM, json={"decision": "confirmed"})
    assert ok.status_code == 204
    assert await confirmed(mworld) == {str(rid): ["calm"]}
    # votes no longer move a locked mood
    await listened(mworld, rid, MEMBER_B)
    locked = await mworld.client.put(
        f"{API}/recordings/{rid}/votes/calm", headers=AS["b"], json={"vote": "no"}
    )
    assert locked.status_code == 409 and code(locked) == "locked"
    # the team can say no, too, on a mood nobody proposed
    await mworld.client.put(
        f"{ADMIN}/recordings/{rid}/sad", headers=AS_TEAM, json={"decision": "rejected"}
    )
    state = (await mworld.client.get(f"{API}/recordings/{rid}", headers=AS_TEAM)).json()
    assert next(m for m in state["moods"] if m["mood"] == "sad")["locked"] is True
    # clear: the votes decide again; here only the uploader's suggestion is left
    await mworld.client.put(put, headers=AS_TEAM, json={"decision": "clear"})
    await mworld.client.put(
        f"{ADMIN}/recordings/{rid}/sad", headers=AS_TEAM, json={"decision": "clear"}
    )
    back = await row(mworld, rid, "calm")
    assert back is not None and back.locked is False and back.status == "suggested"
    assert await row(mworld, rid, "sad") is None  # a team-only row leaves with its lock
    assert await confirmed(mworld) == {}


async def test_recompute_after_an_account_was_deleted(mworld: World) -> None:
    rid = await mworld.recording(MEMBER_A)
    await suggest_as(mworld, rid, MEMBER_A, ["joyful"])
    members = [await voter(mworld, rid) for _ in range(3)]
    for m in members:
        await cast_vote(mworld, rid, m, "joyful", "yes")
    assert (await row(mworld, rid, "joyful")).status == "confirmed"  # type: ignore[union-attr]
    async with mworld.sessions() as session:  # what the account's deletion does to its votes
        votes = await session.scalars(
            select(RecordingMoodVote).where(RecordingMoodVote.member_id == members[0].id)
        )
        for vote in votes.all():
            await session.delete(vote)
        await session.commit()
    r = await mworld.client.post(f"{ADMIN}/recompute", headers=AS_TEAM)
    assert r.status_code == 200 and r.json()["rows"] == 1
    assert (await row(mworld, rid, "joyful")).status == "suggested"  # type: ignore[union-attr]


async def test_a_mood_error_is_a_plain_code(mworld: World) -> None:
    rid = await mworld.recording(MEMBER_A)
    async with mworld.sessions() as session:
        recording = await moods.visible(session, rid)
        with pytest.raises(MoodError) as raised:
            await moods.team_decide(session, recording, "furious", "confirmed", "team")
        assert raised.value.code == "bad_mood"
    other: Any = await mworld.client.get(f"{API}/recordings/{uuid4()}")
    assert other.status_code == 404
