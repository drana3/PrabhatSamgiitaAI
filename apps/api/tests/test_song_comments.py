"""Song comments: posting, anonymity, reports, deletion, team removal, limits, migration 0030.

Runs against an in-memory SQLite database. What PostgreSQL does with the migration is NOT covered
here (it has to be tried on a copy of the real database before a deploy).
"""

from __future__ import annotations

import importlib.util
import json
import os
from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta
from pathlib import Path
from types import ModuleType
from typing import Any, cast
from uuid import UUID, uuid4

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://test:test@localhost/test")

import httpx
import pytest
import pytest_asyncio
import sqlalchemy as sa
from alembic.config import Config
from alembic.migration import MigrationContext
from alembic.operations import Operations
from alembic.script import ScriptDirectory
from fastapi import FastAPI, HTTPException, Request
from sqlalchemy import Select, Table, select, update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.api.v1 import song_comments as api
from app.config import Settings, get_settings
from app.core.db import get_session
from app.models import Base, UserAccount
from app.models.song_comments import SongComment, SongCommentReport
from app.services import song_comments as service

MEMBER_A = UUID("00000000-0000-0000-0000-0000000000a1")
MEMBER_B = UUID("00000000-0000-0000-0000-0000000000b2")
TEAM = UUID("00000000-0000-0000-0000-0000000000c3")
NAMES = {MEMBER_A: "Ananda", MEMBER_B: "Bhakti", TEAM: "Carya"}
AVATAR = "https://img.example/ananda-secret-avatar.png"
URL = "/api/v1/song-comments"


class World:
    def __init__(self, client: httpx.AsyncClient, sessions: async_sessionmaker[AsyncSession]):
        self.client = client
        self.sessions = sessions

    async def post(
        self,
        who: str | None,
        song: int = 19,
        body: str = "A story.",
        anonymous: bool = False,
        parent: str | None = None,
        flood: bool = False,
    ) -> httpx.Response:
        """`flood=False` empties the anti-flood count first, so a test can post freely; the flood
        tests pass `flood=True` to keep it."""
        if not flood:
            service.limiter.reset()
        payload: dict[str, Any] = {"body": body, "is_anonymous": anonymous}
        if parent is not None:
            payload["parent_id"] = parent
        return await self.client.post(
            f"{URL}/songs/{song}", headers={"X-Test-Member": who} if who else {}, json=payload
        )

    async def listing(self, who: str | None = None, song: int = 19, **params: Any) -> Any:
        response = await self.client.get(
            f"{URL}/songs/{song}", headers={"X-Test-Member": who} if who else {}, params=params
        )
        assert response.status_code == 200, response.text
        return response

    async def rows(self) -> list[SongComment]:
        async with self.sessions() as session:
            return list(
                (await session.scalars(select(SongComment).order_by(SongComment.created_at))).all()
            )

    async def scalar(self, statement: Select[Any]) -> Any:
        async with self.sessions() as session:
            return await session.scalar(statement)


@pytest_asyncio.fixture
async def world() -> AsyncIterator[World]:
    engine = create_async_engine(
        "sqlite+aiosqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False}
    )
    tables = [cast(Table, m.__table__) for m in (UserAccount, SongComment, SongCommentReport)]
    async with engine.begin() as conn:
        await conn.run_sync(lambda c: Base.metadata.create_all(c, tables=tables))
    sessions = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with sessions() as session:
        for member_id, name in NAMES.items():
            session.add(
                UserAccount(
                    id=member_id,
                    external_subject=f"test:{name}",
                    identity_provider="test",
                    display_name=name,
                    email=f"{name.lower()}@example.org",
                    avatar_url=AVATAR if member_id == MEMBER_A else None,
                    is_admin=member_id == TEAM,
                    last_seen_at=datetime.now(UTC),
                )
            )
        await session.commit()

    settings = Settings.model_validate({"_env_file": None, "NEXT_PUBLIC_API_BASE_URL": "http://t"})
    app = FastAPI()
    app.include_router(api.router, prefix="/api/v1")
    members = {"a": MEMBER_A, "b": MEMBER_B, "team": TEAM}

    async def override_session() -> AsyncIterator[AsyncSession]:
        async with sessions() as session:
            yield session

    async def lookup(request: Request) -> UserAccount | None:
        who = request.headers.get("X-Test-Member")
        if who not in members:
            return None
        async with sessions() as session:
            return await session.get(UserAccount, members[who])

    async def override_member(request: Request) -> UserAccount:
        member = await lookup(request)
        if member is None:
            raise HTTPException(status_code=401, detail="Sign in is required")
        return member

    app.dependency_overrides[get_session] = override_session
    app.dependency_overrides[api.get_member] = override_member
    app.dependency_overrides[api.get_optional_member] = lookup
    app.dependency_overrides[get_settings] = lambda: settings
    service.limiter.reset()
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://t"
    ) as client:
        yield World(client, sessions)
    await engine.dispose()


# --------------------------------------------------------------------------- pure helpers


def test_clean_body_keeps_paragraphs_and_drops_noise() -> None:
    assert service.clean_body("  Hello   world \r\n\r\n\r\n\r\nSecond\x00 line  ") == (
        "Hello world\n\nSecond line"
    )
    assert service.clean_body("   \n\n ") == ""
    assert len(service.clean_body("x" * 5000)) == 2000


def test_validate_body_refuses_empty_and_link_floods() -> None:
    with pytest.raises(HTTPException) as empty:
        service.validate_body("  \n ")
    assert empty.value.status_code == 422
    assert service.validate_body("see https://a.example and www.b.example") != ""
    with pytest.raises(HTTPException):
        service.validate_body("https://a.example https://b.example http://c.example")


def test_an_address_is_never_shown_as_a_name() -> None:
    member = UserAccount(display_name="someone@example.org")
    assert service.display_name(member) == "Member"
    assert service.display_name(UserAccount(display_name="  Ananda   Devi ")) == "Ananda Devi"


# --------------------------------------------------------------------------- posting and reading


async def test_a_named_comment_shows_name_and_avatar_newest_first(world: World) -> None:
    first = await world.post("a", body="First thought")
    assert first.status_code == 201, first.text
    assert first.json()["author"] == {"name": "Ananda", "avatar_url": AVATAR}
    assert first.json()["mine"] is True
    await world.post("b", body="Second thought")
    # the same instant on a fast machine: make the order unambiguous
    async with world.sessions() as session:
        await session.execute(
            update(SongComment)
            .where(SongComment.body == "First thought")
            .values(created_at=datetime.now(UTC) - timedelta(minutes=5))
        )
        await session.commit()
    data = (await world.listing()).json()
    assert [i["body"] for i in data["items"]] == ["Second thought", "First thought"]
    assert data["total"] == 2 and data["has_more"] is False
    assert all(i["mine"] is False and i["can_remove"] is False for i in data["items"])


async def test_comments_belong_to_their_song(world: World) -> None:
    await world.post("a", song=19, body="About nineteen")
    await world.post("a", song=20, body="About twenty")
    assert [i["body"] for i in (await world.listing(song=20)).json()["items"]] == ["About twenty"]


async def test_posting_needs_a_signed_in_member_and_a_real_song(world: World) -> None:
    assert (await world.post(None)).status_code == 401
    assert (await world.post("a", song=0)).status_code == 422
    assert (await world.post("a", song=5019)).status_code == 422
    assert (await world.client.get(f"{URL}/songs/5019")).status_code == 422
    assert (await world.post("a", song=5018)).status_code == 201
    assert (await world.post("a", song=1)).status_code == 201


async def test_a_guest_can_read(world: World) -> None:
    await world.post("a")
    assert (await world.listing(None)).json()["total"] == 1


async def test_body_rules(world: World) -> None:
    assert (await world.post("a", body="   ")).status_code == 422
    assert (await world.post("a", body="x" * 2001)).status_code == 422
    assert (await world.post("a", body="x" * 2000)).status_code == 201
    same = await world.post("a", body="Same words")
    again = await world.post("a", body="Same   words")
    assert same.status_code == 201 and again.status_code == 409


async def test_paging(world: World) -> None:
    for number in range(5):
        await world.post("a", body=f"comment {number}")
    first = (await world.listing(limit=2)).json()
    assert len(first["items"]) == 2 and first["has_more"] is True and first["total"] == 5
    last = (await world.listing(limit=2, offset=4)).json()
    assert len(last["items"]) == 1 and last["has_more"] is False
    assert (await world.client.get(f"{URL}/songs/19", params={"limit": 51})).status_code == 422


async def test_the_answer_is_never_shared_between_readers(world: World) -> None:
    response = await world.listing("a")
    assert "no-store" in response.headers["cache-control"]


# --------------------------------------------------------------------------- anonymity


def walk(value: Any) -> list[str]:
    """Every string in a JSON value, keys included."""
    if isinstance(value, dict):
        return [s for k, v in value.items() for s in [k, *walk(v)]]
    if isinstance(value, list):
        return [s for v in value for s in walk(v)]
    return [value] if isinstance(value, str) else []


async def test_an_anonymous_comment_carries_no_trace_of_its_author(world: World) -> None:
    created = await world.post("a", body="My private realization", anonymous=True)
    assert created.status_code == 201
    assert created.json()["author"] is None
    for viewer in (None, "a", "b", "team"):
        raw = (await world.listing(viewer)).text
        data = json.loads(raw)
        item = data["items"][0]
        assert item["author"] is None and item["is_anonymous"] is True
        # the author's id, name, address and avatar appear nowhere in the answer
        for secret in (str(MEMBER_A), MEMBER_A.hex, "Ananda", "ananda", AVATAR, "avatar", "member"):
            assert secret not in raw, (viewer, secret)
        assert set(item) == {
            "id",
            "song_id",
            "body",
            "created_at",
            "is_anonymous",
            "author",
            "mine",
            "can_remove",
            "deleted",
            "parent_id",
            "reply_to",
            "reply_count",
            "replies",
        }
    # the comment id is a fresh random id, not derived from the account
    assert str(MEMBER_A) not in walk(created.json())


async def test_only_the_author_sees_mine_on_an_anonymous_comment(world: World) -> None:
    await world.post("a", body="Mine and anonymous", anonymous=True)
    assert (await world.listing("a")).json()["items"][0]["mine"] is True
    assert (await world.listing("b")).json()["items"][0]["mine"] is False
    assert (await world.listing(None)).json()["items"][0]["mine"] is False


async def test_the_author_is_kept_in_the_database_for_the_team(world: World) -> None:
    await world.post("a", anonymous=True)
    row = await world.scalar(select(SongComment))
    assert row is not None and row.member_id == MEMBER_A and row.is_anonymous is True


# --------------------------------------------------------------------------- deleting


async def test_the_author_deletes_their_own_comment_also_an_anonymous_one(world: World) -> None:
    named = (await world.post("a", body="named")).json()
    hidden = (await world.post("a", body="hidden", anonymous=True)).json()
    for item in (named, hidden):
        assert (
            await world.client.delete(f"{URL}/{item['id']}", headers={"X-Test-Member": "a"})
        ).status_code == 204
    listed = (await world.listing()).json()
    # each leaves a tombstone: no text, no author; none is counted as a comment people can read
    assert listed["total"] == 2 and listed["live_total"] == 0
    assert all(i["deleted"] and i["body"] == "" and i["author"] is None for i in listed["items"])
    # the row stays but the text is gone for good
    rows = await world.rows()
    assert len(rows) == 2
    assert {r.status for r in rows} == {"removed"}
    assert {r.removed_by for r in rows} == {service.AUTHOR_DELETED_BY}
    assert {r.body for r in rows} == {service.AUTHOR_DELETED_BODY}
    assert "named" not in json.dumps((await world.listing("team")).json())
    # deleting it a second time finds nothing, like any missing comment
    again = await world.client.delete(f"{URL}/{named['id']}", headers={"X-Test-Member": "a"})
    assert again.status_code == 404


async def test_the_author_cannot_wipe_a_comment_the_team_removed(world: World) -> None:
    """QA-008: the team keeps a removed comment for the record; the author's delete changes none."""
    item = (await world.post("a", body="Evidence text", anonymous=True)).json()
    await world.client.request(
        "DELETE", f"{URL}/{item['id']}", headers={"X-Test-Member": "team"}, json={"reason": "Abuse"}
    )
    before = (await world.rows())[0]
    answer = await world.client.delete(f"{URL}/{item['id']}", headers={"X-Test-Member": "a"})
    assert answer.status_code == 204  # the same answer as for a normal delete
    after = await world.rows()
    assert len(after) == 1
    assert after[0].body == "Evidence text" == before.body
    assert after[0].status == "removed" and after[0].removed_reason == "Abuse"
    assert after[0].removed_by == "Carya" and after[0].removed_by != service.AUTHOR_DELETED_BY


async def test_another_member_cannot_delete_and_learns_nothing(world: World) -> None:
    item = (await world.post("a", anonymous=True)).json()
    other = await world.client.delete(f"{URL}/{item['id']}", headers={"X-Test-Member": "b"})
    missing = await world.client.delete(f"{URL}/{uuid4()}", headers={"X-Test-Member": "b"})
    assert other.status_code == missing.status_code == 404
    assert other.json() == missing.json()
    assert (await world.client.delete(f"{URL}/{item['id']}")).status_code == 401
    assert (await world.listing()).json()["total"] == 1


async def test_the_team_removes_any_comment_with_a_reason(world: World) -> None:
    item = (await world.post("a", anonymous=True)).json()
    listing = (await world.listing("team")).json()
    assert listing["items"][0]["can_remove"] is True
    done = await world.client.request(
        "DELETE", f"{URL}/{item['id']}", headers={"X-Test-Member": "team"}, json={"reason": "Abuse"}
    )
    assert done.status_code == 204
    assert (await world.listing()).json()["total"] == 0
    row = await world.scalar(select(SongComment))
    assert row is not None and row.status == "removed" and row.removed_reason == "Abuse"
    assert row.removed_by == "Carya" and row.removed_at is not None
    # a removed comment can no longer be removed again, and cannot be reported into a queue
    again = await world.client.delete(f"{URL}/{item['id']}", headers={"X-Test-Member": "team"})
    assert again.status_code == 404


# --------------------------------------------------------------------------- reports


async def test_anyone_can_report_once(world: World) -> None:
    item = (await world.post("a", anonymous=True)).json()
    body = {"reason": "offensive", "note": "  rude   words "}
    guest = await world.client.post(f"{URL}/{item['id']}/report", json=body)
    assert guest.status_code == 201 and guest.json()["status"] == "received"
    again = await world.client.post(f"{URL}/{item['id']}/report", json=body)
    assert again.json()["status"] == "already_reported"
    member = await world.client.post(
        f"{URL}/{item['id']}/report", json={"reason": "spam"}, headers={"X-Test-Member": "b"}
    )
    assert member.json()["status"] == "received"
    row = await world.scalar(select(SongComment))
    assert row is not None and row.reports_count == 2 and row.status == "published"
    stored = await world.scalar(
        select(SongCommentReport).where(SongCommentReport.reporter_id.is_(None))
    )
    assert stored is not None and stored.note == "rude words"
    bad = await world.client.post(f"{URL}/{item['id']}/report", json={"reason": "nonsense"})
    assert bad.status_code == 422
    assert (await world.client.post(f"{URL}/{uuid4()}/report", json=body)).status_code == 404


async def test_the_team_queue_shows_reported_comments_with_their_author(world: World) -> None:
    quiet = (await world.post("b", body="quiet")).json()
    loud = (await world.post("a", body="loud", anonymous=True)).json()
    for who in ("a", "b", "team"):
        await world.client.post(
            f"{URL}/{loud['id']}/report", json={"reason": "other"}, headers={"X-Test-Member": who}
        )
    await world.client.post(f"{URL}/{quiet['id']}/report", json={"reason": "other"})
    assert (
        await world.client.get(f"{URL}/reported", headers={"X-Test-Member": "a"})
    ).status_code == 403
    assert (await world.client.get(f"{URL}/reported")).status_code == 401
    queue = (await world.client.get(f"{URL}/reported", headers={"X-Test-Member": "team"})).json()
    assert [i["body"] for i in queue["items"]] == ["loud", "quiet"]
    assert queue["items"][0]["author_id"] == str(MEMBER_A)
    assert queue["items"][0]["reports_count"] == 3


# --------------------------------------------------------------------------- limits


async def test_the_anti_flood_stops_a_script_and_there_is_no_daily_limit(world: World) -> None:
    """One rule: at most POSTS_PER_MINUTE posts per member in 60 seconds. Nothing else counts."""
    results = [(await world.post("b", body=f"burst {n}", flood=True)).status_code for n in range(8)]
    assert results[: service.POSTS_PER_MINUTE] == [201] * service.POSTS_PER_MINUTE
    assert results[service.POSTS_PER_MINUTE :] == [429] * (8 - service.POSTS_PER_MINUTE)
    assert not hasattr(service, "DAILY_COMMENTS")
    # a member who waited a minute posts again, and may post 40 comments in a day, a minute apart
    for number in range(40):
        assert (await world.post("b", body=f"spread {number}")).status_code == 201


async def test_the_team_has_a_roomier_flood_limit_and_each_member_their_own(world: World) -> None:
    for number in range(service.POSTS_PER_MINUTE):
        assert (await world.post("b", body=f"b{number}", flood=True)).status_code == 201
    assert (await world.post("b", body="one more", flood=True)).status_code == 429
    # another member is not held back by b
    assert (await world.post("a", body="a first", flood=True)).status_code == 201
    for number in range(service.POSTS_PER_MINUTE + 3):
        assert (await world.post("team", body=f"t{number}", flood=True)).status_code == 201


async def test_refused_posts_do_not_use_up_the_flood_allowance(world: World) -> None:
    """QA-009: an empty post or a link flood is refused before it is counted."""
    for _ in range(service.POSTS_PER_MINUTE + 5):
        assert (await world.post("b", body="   ", flood=True)).status_code == 422
        assert (await world.post("b", body="a.com b.org c.net", flood=True)).status_code == 422
    results = [
        (await world.post("b", body=f"real {n}", flood=True)).status_code
        for n in range(service.POSTS_PER_MINUTE + 1)
    ]
    assert results[: service.POSTS_PER_MINUTE] == [201] * service.POSTS_PER_MINUTE
    assert results[-1] == 429


async def test_a_team_member_named_author_does_not_pass_for_an_author_delete(world: World) -> None:
    """QA-059: the marker of an author's own delete can never equal a display name."""
    async with world.sessions() as session:
        team = await session.get(UserAccount, TEAM)
        assert team is not None
        team.display_name = "author"
        await session.commit()
    item = (await world.post("a", body="Rude words")).json()
    await world.client.request(
        "DELETE",
        f"{URL}/{item['id']}",
        headers={"X-Test-Member": "team"},
        json={"reason": "unkind"},
    )
    (row,) = await world.rows()
    assert row.removed_by == "author" and row.removed_by != service.AUTHOR_DELETED_BY
    listed = (await world.listing("b")).json()
    assert listed["items"] == [] and listed["total"] == 0  # a team removal leaves no tombstone
    assert service.team_removed_by("\x1fauthor") != service.AUTHOR_DELETED_BY
    assert service.AUTHOR_DELETED_BY.startswith("\x1f")


# ------------------------------------------------------------ invisible text, links, duplicates


def test_bidi_overrides_and_zero_width_characters_are_stripped() -> None:
    """QA-010."""
    tricky = "start \u202eevil\u202c a\u200bb\u2060c\ufeffd \u2066x\u2069 \u200ey\u200f \u00adz"
    assert service.clean_body(tricky) == "start evil abcd x y z"
    assert service.clean_body("\u200b\u200c\u200d\u202e") == ""
    # joiners that shape Indic letters and emoji stay; everywhere else they go
    assert service.clean_body("क्\u200dष") == "क्\u200dष"
    assert service.clean_body("ab\u200dcd ef\u200cgh") == "abcd efgh"
    assert service.clean_body("👨\u200d👩") == "👨\u200d👩"


async def test_an_invisible_only_comment_is_empty_and_the_stored_text_is_clean(
    world: World,
) -> None:
    assert (await world.post("a", body="\u200b\u202e\u200d")).status_code == 422
    posted = await world.post("a", body="Jai \u202eguru\u202c\u200b!")
    assert posted.status_code == 201 and posted.json()["body"] == "Jai guru!"
    assert (await world.rows())[0].body == "Jai guru!"


def test_bare_domains_count_as_links() -> None:
    """QA-016."""
    assert service.link_count("example.com") == 1
    assert service.link_count("see example.com, shop.example.org/page and www.c.net") == 3
    assert service.link_count("https://a.example https://b.example") == 2
    assert service.link_count("https://a.com,https://b.com,https://c.com") == 3
    assert service.link_count("https://example.com/path") == 1  # one link, not two
    for plain in (
        "yes.No it ended.Next",
        "e.g. this, i.e. that",
        "mail me: a@b.com",
        "v1.2 is out",
        "Dr.Smith",
    ):
        assert service.link_count(plain) == 0, plain
    with pytest.raises(HTTPException):
        service.validate_body("a.com b.org c.net")
    assert service.validate_body("a.com and b.org") != ""


def test_same_text_ignores_case_spaces_punctuation_and_invisible_marks() -> None:
    """QA-017."""
    key = service.same_text_key("Hello world")
    for variant in (
        "hello WORLD",
        "  Hello,   world!! ",
        "H e l l o w-o-r-l-d",
        "hel\u200blo world",
        "ＨＥＬＬＯ world",
    ):
        assert service.same_text_key(variant) == key, variant
    assert service.same_text_key("Hello there") != key
    # vowel signs are part of a word: not the same
    assert service.same_text_key("कि") != service.same_text_key("क")


async def test_a_disguised_copy_of_a_comment_is_still_a_duplicate(world: World) -> None:
    assert (await world.post("a", body="Beautiful song")).status_code == 201
    for variant in (
        "beautiful song",
        "Beautiful   song!!!",
        "BEAUTIFUL, SONG.",
        "Beautiful\u200b song",
    ):
        stopped = await world.post("a", body=variant)
        assert stopped.status_code == 409, variant
    # another song, another member, or a really different text are fine
    assert (await world.post("a", body="Beautiful song", song=20)).status_code == 201
    assert (await world.post("b", body="Beautiful song")).status_code == 201
    assert (await world.post("a", body="Beautiful song indeed")).status_code == 201


async def test_a_deleted_comment_can_be_written_again(world: World) -> None:
    first = (await world.post("a", body="Say it again")).json()
    await world.client.delete(f"{URL}/{first['id']}", headers={"X-Test-Member": "a"})
    assert (await world.post("a", body="Say it again")).status_code == 201


# --------------------------------------------------------------------------- replies


async def test_song_replies_nest_count_and_keep_the_tombstone_rules(world: World) -> None:
    """The same code as the recording comments (tests/test_comment_replies.py), on a song."""
    first = (await world.post("a", body="Top words here")).json()
    reply = await world.post("b", body="A reply here", parent=first["id"])
    assert reply.status_code == 201 and reply.json()["parent_id"] == first["id"]
    answer = await world.post("a", body="Answering that", parent=reply.json()["id"])
    assert answer.json()["parent_id"] == first["id"]  # still one level
    assert answer.json()["reply_to"] == {"name": "Bhakti", "deleted": False}
    listed = (await world.listing("b")).json()
    assert listed["total"] == 1 and listed["live_total"] == 3
    assert listed["items"][0]["reply_count"] == 2
    # the author deletes the top comment: a tombstone with its replies; the count drops by one
    await world.client.delete(f"{URL}/{first['id']}", headers={"X-Test-Member": "a"})
    listed = (await world.listing("b")).json()
    entry = listed["items"][0]
    assert entry["deleted"] is True and entry["body"] == "" and len(entry["replies"]) == 2
    assert listed["live_total"] == 2
    # a deleted comment cannot be answered; another song cannot be reached through its id
    assert (await world.post("b", body="Too late", parent=first["id"])).status_code == 404
    live = (await world.post("a", body="Live one here")).json()
    assert (await world.post("b", body="Wrong song", song=20, parent=live["id"])).status_code == 404


async def test_song_replies_are_reported_removed_and_restored_by_the_team(world: World) -> None:
    first = (await world.post("a", body="Top words here")).json()
    rude = (await world.post("b", body="Rude reply here", parent=first["id"])).json()
    report = await world.client.post(
        f"{URL}/{rude['id']}/report", headers={"X-Test-Member": "a"}, json={"reason": "spam"}
    )
    assert report.status_code == 201
    queue = (await world.client.get(f"{URL}/review", headers={"X-Test-Member": "team"})).json()
    assert [(i["body"], i["parent_id"]) for i in queue["items"]] == [
        ("Rude reply here", first["id"])
    ]
    assert (
        await world.client.get(f"{URL}/review", headers={"X-Test-Member": "a"})
    ).status_code == 403
    await world.client.request(
        "DELETE", f"{URL}/{rude['id']}", headers={"X-Test-Member": "team"}, json={"reason": "no"}
    )
    assert (await world.listing("a")).json()["live_total"] == 1
    removed = (
        await world.client.get(
            f"{URL}/review", headers={"X-Test-Member": "team"}, params={"filter": "removed"}
        )
    ).json()
    assert [i["body"] for i in removed["items"]] == ["Rude reply here"]
    back = await world.client.post(f"{URL}/{rude['id']}/restore", headers={"X-Test-Member": "team"})
    assert back.status_code == 200
    assert (await world.listing("a")).json()["live_total"] == 2
    kept = await world.client.post(f"{URL}/{first['id']}/keep", headers={"X-Test-Member": "team"})
    assert kept.status_code == 200


# --------------------------------------------------------------------------- migration 0030

VERSIONS = Path(__file__).resolve().parents[1] / "alembic" / "versions"


def load_migration() -> ModuleType:
    spec = importlib.util.spec_from_file_location("m0030", VERSIONS / "0030_song_comments.py")
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def run(engine: sa.Engine, step: Any) -> None:
    with engine.begin() as connection:
        with Operations.context(MigrationContext.configure(connection)):
            step()


def test_the_chain_ends_in_0030_after_0029() -> None:
    script = ScriptDirectory.from_config(Config(str(VERSIONS.parents[1] / "alembic.ini")))
    # later migrations may follow 0030 (0031 chord proposals): the chain just has to stay linear
    assert len(script.get_heads()) == 1
    assert "0030_song_comments" in {r.revision for r in script.walk_revisions()}
    assert script.get_revision("0030_song_comments").down_revision == "0029_recording_duplicates"  # type: ignore[union-attr]


def test_the_migration_builds_the_tables_runs_twice_and_matches_the_model() -> None:
    migration = load_migration()
    engine = sa.create_engine("sqlite://", poolclass=sa.pool.StaticPool)
    with engine.begin() as connection:
        connection.execute(sa.text("CREATE TABLE user_accounts (id CHAR(32) PRIMARY KEY)"))
    run(engine, migration.upgrade)
    run(engine, migration.upgrade)  # again: nothing breaks
    replies = importlib.util.spec_from_file_location("m0037", VERSIONS / "0037_comment_replies.py")
    assert replies and replies.loader
    later = importlib.util.module_from_spec(replies)
    replies.loader.exec_module(later)
    run(engine, later.upgrade)  # the reply columns come with 0037
    inspector = sa.inspect(engine)
    for model in (SongComment, SongCommentReport):
        table = cast(Table, model.__table__)
        assert {c["name"] for c in inspector.get_columns(table.name)} == {
            c.name for c in table.columns
        }
        assert {i["name"] for i in inspector.get_indexes(table.name)} >= {
            i.name for i in table.indexes
        }
    with engine.begin() as connection:
        user = uuid4().hex
        connection.execute(sa.text("INSERT INTO user_accounts (id) VALUES (:i)"), {"i": user})
        insert = sa.text(
            "INSERT INTO song_comments (id, song_id, member_id, body) VALUES (:i, :s, :m, :b)"
        )
        connection.execute(insert, {"i": uuid4().hex, "s": 19, "m": user, "b": "fine"})
        for song, text in ((0, "x"), (5019, "x"), (19, ""), (19, "x" * 2001)):
            with pytest.raises(sa.exc.IntegrityError):
                with connection.begin_nested():
                    connection.execute(insert, {"i": uuid4().hex, "s": song, "m": user, "b": text})
    run(engine, migration.downgrade)
    run(engine, migration.downgrade)
    assert not sa.inspect(engine).has_table("song_comments")
    engine.dispose()


def test_the_migration_leaves_tables_that_create_all_made_alone() -> None:
    migration = load_migration()
    engine = sa.create_engine("sqlite://", poolclass=sa.pool.StaticPool)
    Base.metadata.create_all(
        engine,
        tables=[cast(Table, m.__table__) for m in (UserAccount, SongComment, SongCommentReport)],
    )
    run(engine, migration.upgrade)
    assert sa.inspect(engine).has_table("song_comment_reports")
    engine.dispose()
