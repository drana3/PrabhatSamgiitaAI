"""Push notifications for replies (docs/comment-replies.md, "Push"): registering a phone, the
member's switch, and what is sent to Expo, always against a mocked Expo (no network, no keys).

SQLite in memory, as the other comment tests. APNs/FCM delivery to a real phone is NOT covered.
"""

from __future__ import annotations

import json
import os
from collections.abc import AsyncIterator, Callable
from datetime import UTC, datetime, timedelta
from typing import Any, cast
from uuid import uuid4

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://test:test@localhost/test")

import httpx
import pytest
import pytest_asyncio
import sqlalchemy as sa
from alembic.config import Config
from alembic.script import ScriptDirectory
from fastapi import HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool
from test_recording_duplicates_migration import VERSIONS, load, run

from app.api.v1 import push as push_api
from app.models import Base, UserAccount
from app.models.push import PushDelivery, PushDevice, PushPreference
from app.services import push, recording_comments
from tests.extras_support import MEMBER_A, MEMBER_B, REC, TABLES, TEAM, World, build_app, recording
from tests.test_recording_comments import post

TOKEN_A = "ExponentPushToken[AAAAAAAAAAAAAAAAAAAAAA]"
TOKEN_A2 = "ExponentPushToken[A2A2A2A2A2A2A2A2A2A2A2]"
TOKEN_B = "ExponentPushToken[BBBBBBBBBBBBBBBBBBBBBB]"
SECRET = "Secret sentence that must never leave in a push."
PUSH = "/api/v1/push"


class Expo:
    """A mocked Expo: records every call and answers with the tickets or receipts a test sets."""

    def __init__(self) -> None:
        self.calls: list[dict[str, Any]] = []
        self.tickets: Callable[[list[dict[str, Any]]], list[dict[str, Any]]] | None = None
        self.receipts: dict[str, Any] = {}
        self.fail = False

    def handler(self, request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        self.calls.append({"url": str(request.url), "body": body, "headers": dict(request.headers)})
        if self.fail:
            return httpx.Response(500, json={"errors": ["boom"]})
        if str(request.url).endswith("getReceipts"):
            return httpx.Response(200, json={"data": self.receipts})
        if self.tickets:
            return httpx.Response(200, json={"data": self.tickets(body)})
        return httpx.Response(
            200, json={"data": [{"status": "ok", "id": f"T-{uuid4().hex[:8]}"} for _ in body]}
        )

    @property
    def sends(self) -> list[dict[str, Any]]:
        return [c for c in self.calls if c["url"].endswith("/send")]

    @property
    def messages(self) -> list[dict[str, Any]]:
        return [m for c in self.sends for m in c["body"]]


@pytest_asyncio.fixture(name="world")
async def world_fixture() -> AsyncIterator[World]:
    engine = create_async_engine(
        "sqlite+aiosqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False}
    )
    tables = [
        cast(sa.Table, m.__table__) for m in (*TABLES, PushDevice, PushPreference, PushDelivery)
    ]
    async with engine.begin() as conn:
        await conn.run_sync(lambda c: Base.metadata.create_all(c, tables=tables))
    sessions = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    names = {MEMBER_A: "Ananda", MEMBER_B: "Bhakti", TEAM: "Carya"}
    async with sessions() as session:
        for member_id, name in names.items():
            session.add(
                UserAccount(
                    id=member_id,
                    external_subject=f"test:{name}",
                    identity_provider="test",
                    display_name=name,
                    email=f"{name.lower()}@example.org",
                    is_admin=member_id == TEAM,
                    last_seen_at=datetime.now(UTC),
                )
            )
        await session.commit()
        session.add(recording(REC, "Baba Nam Kevalam"))
        await session.commit()
    members = {"a": MEMBER_A, "b": MEMBER_B, "team": TEAM}
    app = build_app(sessions, members)
    app.include_router(push_api.router, prefix="/api/v1")

    async def member(
        request: Request,
    ) -> UserAccount:  # the push router has its own member dependency
        who = request.headers.get("X-Test-Member")
        if who not in members:
            raise HTTPException(status_code=401, detail="Sign in is required")
        async with sessions() as session:
            return await session.get(UserAccount, members[who])

    app.dependency_overrides[push_api.get_member] = member
    recording_comments.limiter.reset()
    push_api.limiter.reset()
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://t"
    ) as client:
        w = World(client, sessions)
        yield w
    await engine.dispose()


@pytest.fixture(name="expo")
def expo_fixture(monkeypatch: pytest.MonkeyPatch, world: World) -> Expo:
    expo = Expo()
    monkeypatch.setenv("PUSH_ENABLED", "true")
    monkeypatch.delenv("EXPO_ACCESS_TOKEN", raising=False)
    monkeypatch.setattr(
        push, "_new_client", lambda: httpx.AsyncClient(transport=httpx.MockTransport(expo.handler))
    )
    monkeypatch.setattr(push, "_sessions", lambda: world.sessions)
    monkeypatch.setattr(push, "_last_receipt_check", 10**12)  # receipts only when a test asks
    return expo


async def add_device(world: World, who: str, token: str = TOKEN_A, language: str = "en") -> None:
    r = await world.call(
        "PUT",
        f"{PUSH}/devices",
        who,
        json={"token": token, "platform": "ios", "language": language},
    )
    assert r.status_code == 200, r.text


async def top(world: World, who: str = "a") -> str:
    r = await post(world, who, f"A story that needs an answer {uuid4().hex[:6]}.")
    assert r.status_code == 201, r.text
    return r.json()["id"]


async def reply(world: World, parent: str, who: str = "b", text: str = SECRET, **kw: Any) -> str:
    r = await post(world, who, f"{text} {uuid4().hex[:6]}", parent=parent, **kw)
    assert r.status_code == 201, r.text
    await push.drain()
    return r.json()["id"]


# --------------------------------------------------------------------------- migration


def test_0051_is_the_single_head_after_0050() -> None:
    script = ScriptDirectory.from_config(Config(str(VERSIONS.parents[1] / "alembic.ini")))
    assert len(script.get_heads()) == 1
    revision = script.get_revision("0051_push_replies")
    assert revision is not None and revision.down_revision == "0050_piano_sheets"


def test_upgrade_creates_the_tables_twice_and_downgrades() -> None:
    m51 = load("0051_push_replies")
    engine = sa.create_engine("sqlite://", poolclass=sa.pool.StaticPool)
    Base.metadata.create_all(engine, tables=[cast(sa.Table, UserAccount.__table__)])
    run(engine, m51.upgrade)
    run(engine, m51.upgrade)
    names = set(sa.inspect(engine).get_table_names())
    assert {"push_devices", "push_preferences", "push_deliveries"} <= names
    assert "uq_push_devices_token" in {
        u["name"] for u in sa.inspect(engine).get_unique_constraints("push_devices")
    }
    run(engine, m51.downgrade)
    assert not (
        {"push_devices", "push_preferences", "push_deliveries"}
        & set(sa.inspect(engine).get_table_names())
    )


# --------------------------------------------------------------------------- devices and switch


async def test_a_phone_registers_once_and_can_be_taken_off(world: World) -> None:
    await add_device(world, "a")
    await add_device(world, "a")  # the same token again only refreshes it
    assert len(await world.rows(PushDevice)) == 1
    gone = await world.call("POST", f"{PUSH}/devices/unregister", "a", json={"token": TOKEN_A})
    assert gone.status_code == 200 and gone.json() == {"registered": False}
    assert await world.rows(PushDevice) == []


async def test_a_bad_token_or_no_sign_in_is_refused(world: World) -> None:
    bad = await world.call(
        "PUT", f"{PUSH}/devices", "a", json={"token": "not-a-token-at-all", "platform": "ios"}
    )
    assert bad.status_code == 422 and bad.json()["detail"]["code"] == "bad_token"
    anon = await world.call(
        "PUT", f"{PUSH}/devices", None, json={"token": TOKEN_A, "platform": "ios"}
    )
    assert anon.status_code == 401
    assert (await world.call("GET", f"{PUSH}/preferences", None)).status_code == 401


async def test_a_token_that_changes_hands_moves_and_nobody_else_can_remove_it(world: World) -> None:
    await add_device(world, "a")
    other = await world.call("POST", f"{PUSH}/devices/unregister", "b", json={"token": TOKEN_A})
    assert other.status_code == 200
    (row,) = await world.rows(PushDevice)
    assert row.member_id == MEMBER_A  # b could not take a's phone off
    await add_device(world, "b", TOKEN_A)  # the phone is signed into b now
    (row,) = await world.rows(PushDevice)
    assert row.member_id == MEMBER_B


async def test_a_member_keeps_at_most_ten_phones(world: World) -> None:
    for n in range(12):
        await add_device(world, "a", f"ExponentPushToken[{n:022d}]")
    assert len(await world.rows(PushDevice)) == push.MAX_DEVICES_PER_MEMBER


async def test_the_replies_switch_defaults_on_and_is_saved(world: World, expo: Expo) -> None:
    first = (await world.call("GET", f"{PUSH}/preferences", "a")).json()
    assert first == {"replies": True, "server_enabled": True}
    saved = await world.call("PUT", f"{PUSH}/preferences", "a", json={"replies": False})
    assert saved.json()["replies"] is False
    assert (await world.call("GET", f"{PUSH}/preferences", "a")).json()["replies"] is False
    assert (await world.call("GET", f"{PUSH}/preferences", "b")).json()["replies"] is True


async def test_the_server_says_when_push_is_off(
    world: World, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.delenv("PUSH_ENABLED", raising=False)
    assert (await world.call("GET", f"{PUSH}/preferences", "a")).json()["server_enabled"] is False


# --------------------------------------------------------------------------- sending


async def test_a_reply_wakes_the_phone_with_the_name_and_no_text(world: World, expo: Expo) -> None:
    await add_device(world, "a")
    parent = await top(world)
    await reply(world, parent)
    (message,) = expo.messages
    assert message["to"] == TOKEN_A
    assert message["title"] == "New reply"
    assert message["body"] == "Bhakti replied to your comment."
    assert message["channelId"] == "replies"
    assert message["data"]["kind"] == "comment_reply"
    assert message["data"]["parent_id"] == parent and message["data"]["recording_id"] == str(REC)
    assert SECRET not in json.dumps(expo.calls)  # the text of a comment never leaves
    assert "Authorization" not in {k.title() for k in expo.sends[0]["headers"]}


async def test_the_access_token_is_sent_when_it_is_set(
    world: World, expo: Expo, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("EXPO_ACCESS_TOKEN", "secret-key")
    await add_device(world, "a")
    await reply(world, await top(world))
    assert expo.sends[0]["headers"]["authorization"] == "Bearer secret-key"


async def test_an_anonymous_reply_carries_no_name(world: World, expo: Expo) -> None:
    await add_device(world, "a")
    await reply(world, await top(world), anonymous=True)
    (message,) = expo.messages
    assert message["body"] == "Someone replied to your comment."
    assert "Bhakti" not in json.dumps(expo.calls)


async def test_the_words_follow_the_language_of_the_phone(world: World, expo: Expo) -> None:
    await add_device(world, "a", TOKEN_A, "ru-RU")
    await add_device(world, "a", TOKEN_A2, "es")
    await reply(world, await top(world))
    by_token = {m["to"]: m for m in expo.messages}
    assert by_token[TOKEN_A]["title"] == "Новый ответ"
    assert by_token[TOKEN_A2]["body"] == "Bhakti respondió a tu comentario."


async def test_push_off_sends_nothing_and_changes_nothing(
    world: World, expo: Expo, monkeypatch: pytest.MonkeyPatch
) -> None:
    await add_device(world, "a")
    monkeypatch.delenv("PUSH_ENABLED")
    await reply(world, await top(world))
    assert expo.calls == []
    assert len(await world.rows(PushDelivery)) == 0


async def test_nothing_is_sent_to_a_member_without_a_phone_or_who_switched_it_off(
    world: World, expo: Expo
) -> None:
    parent = await top(world)
    await reply(world, parent)  # a has no phone
    assert expo.calls == []
    await add_device(world, "a")
    await world.call("PUT", f"{PUSH}/preferences", "a", json={"replies": False})
    await reply(world, await top(world))
    assert expo.calls == []


async def test_nobody_is_woken_about_their_own_reply(world: World, expo: Expo) -> None:
    await add_device(world, "a")
    parent = await top(world)
    await reply(world, parent, "a", "Answering myself here.")
    assert expo.calls == []
    # and the job itself refuses even if one were built
    job = push.ReplyPush(uuid4(), MEMBER_A, MEMBER_A, "x", "Ananda")
    assert await push.deliver(job) == 0


async def test_replies_to_one_discussion_fold_into_one_push(world: World, expo: Expo) -> None:
    await add_device(world, "a")
    parent = await top(world)
    await reply(world, parent, text="First answer for you.")
    await reply(world, parent, "team", "Second answer for you.")
    assert len(expo.messages) == 1
    other = await top(world)
    await reply(world, other, text="An answer elsewhere.")
    assert len(expo.messages) == 2  # another discussion is another push


async def test_one_member_gets_a_few_pushes_an_hour_at_most(world: World, expo: Expo) -> None:
    await add_device(world, "a")
    sent = []
    for n in range(push.HOURLY_MAX + 3):
        job = push.ReplyPush(
            uuid4(), MEMBER_A, MEMBER_B, f"thread-{n}", "Bhakti", {"parent_id": f"thread-{n}"}
        )
        sent.append(await push.deliver(job))
    assert sent == [1] * push.HOURLY_MAX + [0] * 3
    # an hour later the allowance is back
    async with world.sessions() as session:
        for row in (await session.scalars(select(PushDelivery))).all():
            row.sent_at = datetime.now(UTC) - timedelta(hours=2)
        await session.commit()
    job = push.ReplyPush(uuid4(), MEMBER_A, MEMBER_B, "later", "Bhakti", {"parent_id": "later"})
    assert await push.deliver(job) == 1


async def test_a_dead_phone_loses_its_token_at_once(world: World, expo: Expo) -> None:
    await add_device(world, "a", TOKEN_A)
    await add_device(world, "a", TOKEN_A2)

    def tickets(body: list[dict[str, Any]]) -> list[dict[str, Any]]:
        return [
            {"status": "error", "message": "gone", "details": {"error": "DeviceNotRegistered"}}
            if m["to"] == TOKEN_A
            else {"status": "ok", "id": "T-fine"}
            for m in body
        ]

    expo.tickets = tickets
    await reply(world, await top(world))
    assert [d.token for d in await world.rows(PushDevice)] == [TOKEN_A2]


async def test_a_dead_phone_found_in_the_receipt_loses_its_token(world: World, expo: Expo) -> None:
    await add_device(world, "a", TOKEN_A)
    await add_device(world, "a", TOKEN_A2)
    expo.tickets = lambda body: [{"status": "ok", "id": f"T-{i}"} for i, _ in enumerate(body)]
    await reply(world, await top(world))
    async with world.sessions() as session:  # the pushes are 20 minutes old
        for row in (await session.scalars(select(PushDelivery))).all():
            row.sent_at = datetime.now(UTC) - timedelta(minutes=20)
        await session.commit()
    rows = await world.rows(PushDelivery)
    dead = next(r for r in rows if r.token == TOKEN_A)
    fine = next(r for r in rows if r.token == TOKEN_A2)
    expo.receipts = {
        dead.ticket_id: {"status": "error", "details": {"error": "DeviceNotRegistered"}},
        fine.ticket_id: {"status": "ok"},
    }
    assert await push.check_receipts(world.sessions) == 2
    assert [d.token for d in await world.rows(PushDevice)] == [TOKEN_A2]
    states = {r.token: r.status for r in await world.rows(PushDelivery)}
    assert states == {TOKEN_A: "error", TOKEN_A2: "ok"}
    assert await push.check_receipts(world.sessions) == 0  # read once


async def test_old_delivery_rows_are_purged(world: World, expo: Expo) -> None:
    await add_device(world, "a")
    await reply(world, await top(world))
    async with world.sessions() as session:
        for row in (await session.scalars(select(PushDelivery))).all():
            row.sent_at = datetime.now(UTC) - timedelta(days=9)
        await session.commit()
    await push.check_receipts(world.sessions)
    assert await world.rows(PushDelivery) == []


async def test_expo_being_down_never_breaks_the_reply(world: World, expo: Expo) -> None:
    await add_device(world, "a")
    expo.fail = True
    parent = await top(world)
    answered = await post(world, "b", "An answer while Expo is down.", parent=parent)
    assert answered.status_code == 201
    await push.drain()
    assert len(await world.rows(PushDevice)) == 1  # a failed call costs no token
    (row,) = await world.rows(PushDelivery)
    assert row.status == "error"


async def test_a_rolled_back_reply_sends_nothing(world: World, expo: Expo) -> None:
    async with world.sessions() as session:
        notice = push.MemberNotice(
            user_id=MEMBER_A,
            kind="comment_reply",
            title="New reply",
            body="x",
            payload={"parent_id": "p"},
        )
        session.add(notice)
        push.queue_reply_push(session, notice, sender_id=MEMBER_B)
        assert session.sync_session.info[push.PENDING_KEY]
        await session.rollback()
        assert push.PENDING_KEY not in session.sync_session.info
    await push.drain()
    assert expo.calls == []


def test_token_and_language_checks() -> None:
    assert push.valid_token(TOKEN_A) and push.valid_token("ExpoPushToken[abcdefgh12345]")
    for bad in ("", "ExponentPushToken[]", "ExponentPushToken[bad token]", "fcm:abcdefghijkl"):
        assert not push.valid_token(bad)
    assert push.clean_language("RU_ru") == "ru" and push.clean_language("pt-BR") == "en"
    assert push.clean_language(None) == "en"


def test_the_message_has_no_room_for_a_comment_text() -> None:
    job = push.ReplyPush(uuid4(), MEMBER_A, MEMBER_B, "p", "  Bhakti\nSecret  ", {"parent_id": "p"})
    assert job.from_name is not None
    cleaned = push._clean_name("  Bhakti\nSecret  ")
    assert cleaned == "Bhakti Secret"
    assert push._clean_name(None) is None and push._clean_name("   ") is None
    assert len(push._clean_name("x" * 100) or "") == push.NAME_MAX
