"""Learn progress sync: per-song last-write-wins merge, size limit, member auth, migration 0028.

The API runs against an in-memory SQLite database. Not covered here: Postgres (JSONB, row locks,
the migration against a real server).
"""

from __future__ import annotations

import base64
import json
import os
from collections.abc import AsyncIterator
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, cast
from uuid import UUID

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://test:test@localhost/test")

import httpx
import pytest
import pytest_asyncio
import sqlalchemy as sa
from fastapi import FastAPI, HTTPException, Request
from sqlalchemy import Table, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.api.v1 import learn_sync as api
from app.config import Settings
from app.core.db import get_session
from app.models import Base, MemberLearnProgress, UserAccount
from app.schemas.learn_sync import MAX_ENTRIES, LearnSongEntry
from app.services import learn_sync as service

MEMBER_A = UUID("00000000-0000-0000-0000-00000000000a")
MEMBER_B = UUID("00000000-0000-0000-0000-00000000000b")
URL = "/api/v1/members/me/learn-progress"
DAY = service.DAY_MS


def now_ms() -> int:
    return int(datetime.now(UTC).timestamp() * 1000)


def entry(
    number: int,
    *,
    at: int,
    title: str | None = None,
    removed: bool = False,
    **path: bool,
) -> dict[str, Any]:
    return {
        "song_id": f"ps-{number}",
        "number": number,
        "title": title or f"Song {number}",
        "started_at": 1_000,
        "removed": removed,
        "path": {"listen": False, "words": False, "meaning": False, "chords": False, **path},
        "updated_at": at,
    }


def model(number: int, *, at: int, removed: bool = False) -> LearnSongEntry:
    return LearnSongEntry.model_validate(entry(number, at=at, removed=removed))


# --------------------------------------------------------------------------- pure merge


def test_a_newer_entry_replaces_an_older_one_and_an_older_one_is_ignored() -> None:
    now = 10 * DAY
    stored = {"ps-1": model(1, at=5 * DAY)}
    newer = LearnSongEntry.model_validate(entry(1, at=6 * DAY, listen=True))
    older = LearnSongEntry.model_validate(entry(1, at=4 * DAY, words=True))

    merged = service.merge_entries(stored, [newer], now=now)
    assert merged["ps-1"].path.listen is True

    merged = service.merge_entries(stored, [older], now=now)
    assert merged["ps-1"].updated_at == 5 * DAY
    assert merged["ps-1"].path.words is False


def test_a_tie_keeps_the_stored_entry() -> None:
    stored = {"ps-1": LearnSongEntry.model_validate(entry(1, at=5 * DAY, title="First"))}
    tie = LearnSongEntry.model_validate(entry(1, at=5 * DAY, title="Second"))
    assert service.merge_entries(stored, [tie], now=10 * DAY)["ps-1"].title == "First"


def test_a_timestamp_from_the_future_is_cut_back_to_the_server_clock() -> None:
    far = LearnSongEntry.model_validate(entry(1, at=50 * DAY))
    merged = service.merge_entries({}, [far], now=10 * DAY)
    assert merged["ps-1"].updated_at == 10 * DAY
    # and it cannot pin the song: a real later edit still wins
    later = LearnSongEntry.model_validate(entry(1, at=11 * DAY, listen=True))
    assert service.merge_entries(merged, [later], now=12 * DAY)["ps-1"].path.listen is True


def test_old_removal_markers_are_dropped_but_live_songs_never() -> None:
    now = 400 * DAY
    old = (service.TOMBSTONE_DAYS + 1) * DAY
    stored = {
        "ps-1": model(1, at=1 * DAY, removed=True),  # long ago removed
        "ps-2": model(2, at=1 * DAY),  # long ago, still on the list
        "ps-3": model(3, at=now - old // 2, removed=True),  # recently removed
    }
    merged = service.merge_entries(stored, [], now=now)
    assert set(merged) == {"ps-2", "ps-3"}


def test_too_many_entries_is_refused() -> None:
    stored = {f"ps-{n}": model(n, at=DAY) for n in range(1, MAX_ENTRIES + 1)}
    assert len(service.merge_entries(stored, [model(1, at=2 * DAY)], now=3 * DAY)) == MAX_ENTRIES
    with pytest.raises(service.LearnProgressTooLargeError):
        service.merge_entries(stored, [model(MAX_ENTRIES + 1, at=2 * DAY)], now=3 * DAY)


def test_a_broken_stored_document_is_read_as_far_as_it_is_valid() -> None:
    document = {
        "songs": {
            "ps-1": entry(1, at=DAY),
            "ps-2": {"nonsense": True},
            "ps-3": entry(4, at=DAY),  # key does not match its own id
        }
    }
    assert set(service.stored_entries(document)) == {"ps-1"}
    assert service.stored_entries(None) == {}
    assert service.stored_entries({"songs": []}) == {}


# --------------------------------------------------------------------------- API on SQLite


class World:
    def __init__(self, client: httpx.AsyncClient, sessions: async_sessionmaker[AsyncSession]):
        self.client = client
        self.sessions = sessions

    def headers(self, who: str | None) -> dict[str, str]:
        return {"X-Test-Member": who} if who else {}

    async def get(self, who: str | None = "a") -> httpx.Response:
        return await self.client.get(URL, headers=self.headers(who))

    async def put(self, songs: list[dict[str, Any]], who: str | None = "a") -> httpx.Response:
        return await self.client.put(URL, json={"songs": songs}, headers=self.headers(who))

    async def rows(self) -> list[MemberLearnProgress]:
        async with self.sessions() as session:
            return list((await session.scalars(select(MemberLearnProgress))).all())


@pytest_asyncio.fixture
async def world(monkeypatch: pytest.MonkeyPatch) -> AsyncIterator[World]:
    engine = create_async_engine(
        "sqlite+aiosqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False}
    )
    tables = [cast(Table, m.__table__) for m in (UserAccount, MemberLearnProgress)]
    async with engine.begin() as conn:
        await conn.run_sync(lambda c: Base.metadata.create_all(c, tables=tables))
    sessions = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with sessions() as session:
        for member_id, name in ((MEMBER_A, "Ananda"), (MEMBER_B, "Bhakti")):
            session.add(
                UserAccount(
                    id=member_id,
                    external_subject=f"test:{name}",
                    identity_provider="test",
                    display_name=name,
                    last_seen_at=datetime.now(UTC),
                )
            )
        await session.commit()

    app = FastAPI()
    app.include_router(api.router, prefix="/api/v1")

    async def override_session() -> AsyncIterator[AsyncSession]:
        async with sessions() as session:
            yield session

    members = {"a": MEMBER_A, "b": MEMBER_B}

    async def override_member(request: Request) -> UserAccount:
        who = request.headers.get("X-Test-Member")
        if who not in members:
            raise HTTPException(status_code=401, detail="Sign in is required")
        async with sessions() as session:
            member = await session.get(UserAccount, members[who])
            assert member is not None
            return member

    app.dependency_overrides[get_session] = override_session
    app.dependency_overrides[api.get_member] = override_member
    monkeypatch.setattr(api, "require_public_quota", lambda *_a, **_k: None)

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://t"
    ) as client:
        yield World(client, sessions)
    await engine.dispose()


async def test_a_member_with_no_progress_gets_an_empty_document(world: World) -> None:
    response = await world.get()
    assert response.status_code == 200
    assert response.json() == {"songs": [], "updated_at": None, "max_entries": MAX_ENTRIES}
    assert await world.rows() == []  # reading creates nothing


async def test_put_stores_and_get_returns_the_same_entries(world: World) -> None:
    at = now_ms() - 1000
    sent = [entry(7, at=at, listen=True), entry(2, at=at, title="Other")]
    response = await world.put(sent)
    assert response.status_code == 200, response.text
    body = response.json()
    assert [s["song_id"] for s in body["songs"]] == ["ps-2", "ps-7"]  # ordered by song number
    assert body["updated_at"] is not None

    again = (await world.get()).json()
    assert again["songs"] == body["songs"]
    by_id = {s["song_id"]: s for s in again["songs"]}
    assert by_id["ps-7"]["path"] == {
        "listen": True,
        "words": False,
        "meaning": False,
        "chords": False,
    }
    assert by_id["ps-2"]["title"] == "Other"
    assert by_id["ps-7"]["updated_at"] == at


async def test_the_newest_write_per_song_wins_across_phones(world: World) -> None:
    base = now_ms() - 10_000
    await world.put([entry(1, at=base, listen=True), entry(2, at=base)])
    # a second phone, older than ps-1's stored copy, newer than ps-2's
    response = await world.put(
        [entry(1, at=base - 5, words=True), entry(2, at=base + 5, words=True), entry(3, at=base)]
    )
    songs = {s["song_id"]: s for s in response.json()["songs"]}
    assert songs["ps-1"]["path"]["listen"] is True and songs["ps-1"]["path"]["words"] is False
    assert songs["ps-2"]["path"]["words"] is True
    assert "ps-3" in songs


async def test_a_put_is_a_merge_so_missing_songs_are_not_deleted(world: World) -> None:
    at = now_ms() - 1000
    await world.put([entry(1, at=at), entry(2, at=at)])
    response = await world.put([entry(3, at=at)])
    assert [s["song_id"] for s in response.json()["songs"]] == ["ps-1", "ps-2", "ps-3"]
    # an empty put is a plain read
    assert len((await world.put([])).json()["songs"]) == 3


async def test_taking_a_song_off_travels_as_a_marker_and_keeps_the_progress(world: World) -> None:
    at = now_ms() - 5000
    await world.put([entry(5, at=at, listen=True, words=True)])
    removed = entry(5, at=at + 1000, removed=True, listen=True, words=True)
    songs = (await world.put([removed])).json()["songs"]
    assert songs[0]["removed"] is True
    assert songs[0]["path"]["words"] is True
    # adding it again later wins over the marker
    again = entry(5, at=at + 2000, listen=True, words=True)
    assert (await world.put([again])).json()["songs"][0]["removed"] is False


async def test_a_future_timestamp_is_cut_back(world: World) -> None:
    far_future = now_ms() + 30 * DAY
    songs = (await world.put([entry(9, at=far_future)])).json()["songs"]
    assert songs[0]["updated_at"] <= now_ms()


async def test_members_never_see_each_others_progress(world: World) -> None:
    at = now_ms() - 1000
    await world.put([entry(1, at=at, listen=True)], who="a")
    assert (await world.get("b")).json()["songs"] == []
    await world.put([entry(2, at=at)], who="b")
    assert [s["song_id"] for s in (await world.get("a")).json()["songs"]] == ["ps-1"]
    assert len(await world.rows()) == 2


async def test_a_guest_cannot_read_or_write(world: World) -> None:
    assert (await world.get(None)).status_code == 401
    assert (await world.put([entry(1, at=1)], who=None)).status_code == 401
    assert await world.rows() == []


@pytest.mark.parametrize(
    "bad",
    [
        {**entry(1, at=5), "song_id": "ps-2"},  # id does not match the number
        {**entry(1, at=5), "song_id": "song-1"},
        entry(5019, at=5),  # no such song
        entry(0, at=5),
        {**entry(1, at=5), "title": "   "},
        {**entry(1, at=5), "title": "x" * 201},
        {**entry(1, at=5), "updated_at": 0},
        {**entry(1, at=5), "extra": 1},
        {**entry(1, at=5), "path": {"listen": True, "dance": True}},
    ],
)
async def test_invalid_entries_are_refused_and_nothing_is_stored(
    world: World, bad: dict[str, Any]
) -> None:
    response = await world.put([entry(3, at=now_ms() - 1000), bad])
    assert response.status_code == 422
    assert await world.rows() == []


async def test_the_same_song_twice_in_one_put_is_refused(world: World) -> None:
    response = await world.put([entry(1, at=5), entry(1, at=6)])
    assert response.status_code == 422


async def test_a_body_with_too_many_songs_is_refused(world: World) -> None:
    songs = [entry(n, at=5) for n in range(1, MAX_ENTRIES + 2)]
    assert (await world.put(songs)).status_code == 422


async def test_going_over_the_limit_over_several_writes_is_a_413_and_changes_nothing(
    world: World,
) -> None:
    at = now_ms() - 1000
    full = [entry(n, at=at) for n in range(1, MAX_ENTRIES + 1)]
    assert (await world.put(full)).status_code == 200
    refused = await world.put([entry(MAX_ENTRIES + 1, at=at)])
    assert refused.status_code == 413
    assert refused.headers["x-error-code"] == "learn_progress_too_large"
    assert len((await world.get()).json()["songs"]) == MAX_ENTRIES
    # an update of an existing song still works when the document is full
    assert (await world.put([entry(1, at=at + 1, listen=True)])).status_code == 200


# --------------------------------------------------------------------------- real member auth


async def test_the_real_member_auth_is_what_guards_the_endpoint(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.services import members as members_module

    settings = Settings.model_validate({"MEMBER_PROXY_KEY": "unit-key", "_env_file": None})
    monkeypatch.setattr(members_module, "get_settings", lambda: settings)
    monkeypatch.setattr(api, "require_public_quota", lambda *_a, **_k: None)

    engine = create_async_engine(
        "sqlite+aiosqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False}
    )
    tables = [cast(Table, m.__table__) for m in (UserAccount, MemberLearnProgress)]
    async with engine.begin() as conn:
        await conn.run_sync(lambda c: Base.metadata.create_all(c, tables=tables))
    sessions = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    app = FastAPI()
    app.include_router(api.router, prefix="/api/v1")

    async def override_session() -> AsyncIterator[AsyncSession]:
        async with sessions() as session:
            yield session

    app.dependency_overrides[get_session] = override_session

    principal = base64.b64encode(
        json.dumps(
            {
                "auth_typ": "google",
                "claims": [
                    {"typ": "oid", "val": "sub-123"},
                    {"typ": "name", "val": "Ananda"},
                ],
            }
        ).encode()
    ).decode()
    good = {"X-MS-CLIENT-PRINCIPAL": principal, "X-Member-Proxy-Key": "unit-key"}

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://t"
    ) as client:
        assert (await client.get(URL)).status_code == 401
        no_key = await client.get(URL, headers={"X-MS-CLIENT-PRINCIPAL": principal})
        assert no_key.status_code == 401
        wrong = {**good, "X-Member-Proxy-Key": "not-the-key"}
        assert (await client.get(URL, headers=wrong)).status_code == 401
        ok = await client.put(URL, json={"songs": [entry(4, at=now_ms() - 1000)]}, headers=good)
        assert ok.status_code == 200, ok.text
        assert (await client.get(URL, headers=good)).json()["songs"][0]["song_id"] == "ps-4"
    await engine.dispose()


# --------------------------------------------------------------------------- migration 0028


def _script():
    from alembic.config import Config
    from alembic.script import ScriptDirectory

    config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    return ScriptDirectory.from_config(config)


def test_the_migration_follows_0027_and_the_model_is_registered() -> None:
    revision = _script().get_revision("0028_learn_progress")
    assert revision is not None
    assert revision.down_revision == "0027_recordings"
    assert "member_learn_progress" in Base.metadata.tables


def test_the_migration_creates_and_drops_the_table_on_sqlite_without_a_real_database() -> None:
    """Runs upgrade() and downgrade() against a throw-away in-memory SQLite, never a real server."""
    from alembic.migration import MigrationContext
    from alembic.operations import Operations

    revision = _script().get_revision("0028_learn_progress")
    assert revision is not None
    migration = revision.module

    engine = sa.create_engine("sqlite://")
    with engine.begin() as conn:
        cast(Table, UserAccount.__table__).create(conn)  # the table the foreign key points to
        context = MigrationContext.configure(conn)
        with Operations.context(context):
            migration.upgrade()
            inspector = sa.inspect(conn)
            assert inspector.has_table("member_learn_progress")
            columns = {c["name"] for c in inspector.get_columns("member_learn_progress")}
            model_columns = {c.name for c in cast(Table, MemberLearnProgress.__table__).columns}
            assert columns == model_columns  # the migration and the model agree
            foreign_keys = inspector.get_foreign_keys("member_learn_progress")
            assert foreign_keys[0]["referred_table"] == "user_accounts"
            assert foreign_keys[0]["options"].get("ondelete") == "CASCADE"
            migration.upgrade()  # safe to run again
            migration.downgrade()
            assert not sa.inspect(conn).has_table("member_learn_progress")
            migration.downgrade()  # and to roll back again
    engine.dispose()
