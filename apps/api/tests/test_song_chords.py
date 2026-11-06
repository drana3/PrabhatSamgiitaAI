"""Chord proposals: offering, review, anonymity, reports, deletion, limits, migration 0031.

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
from pydantic import ValidationError
from sqlalchemy import Select, Table, select, update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.api.v1 import song_chords as api
from app.config import Settings, get_settings
from app.core.db import get_session
from app.core.security import require_admin
from app.models import Base, MemberNotice, UserAccount
from app.models.song_chords import SongChordProposal, SongChordReport
from app.schemas.song_chords import ChordProposalCreate
from app.services import song_chords as service

MEMBER_A = UUID("00000000-0000-0000-0000-0000000000a1")
MEMBER_B = UUID("00000000-0000-0000-0000-0000000000b2")
TEAM = UUID("00000000-0000-0000-0000-0000000000c3")
NAMES = {MEMBER_A: "Ananda", MEMBER_B: "Bhakti", TEAM: "Carya"}
URL = "/api/v1/song-chords"


def chart_body(**overrides: Any) -> dict[str, Any]:
    base: dict[str, Any] = {
        "song_id": 19,
        "instrument": "guitar",
        "base_key": "D",
        "capo": 2,
        "strum": "D D U U D U",
        "lines": [
            {"placements": [{"word": 0, "chord": "D"}, {"word": 3, "chord": "Bm"}]},
            {"placements": []},
            {"placements": [{"word": 1, "chord": "G"}, {"word": 2, "chord": "A7"}]},
        ],
        "played_it": True,
        "note": "Plays well with a slow strum.",
        "is_anonymous": False,
    }
    base.update(overrides)
    return base


class World:
    def __init__(self, client: httpx.AsyncClient, sessions: async_sessionmaker[AsyncSession]):
        self.client = client
        self.sessions = sessions

    async def offer(self, who: str | None, **overrides: Any) -> httpx.Response:
        return await self.client.post(
            URL, headers={"X-Test-Member": who} if who else {}, json=chart_body(**overrides)
        )

    async def listing(self, who: str | None = None, song: int = 19, **params: Any) -> Any:
        response = await self.client.get(
            f"{URL}/songs/{song}", headers={"X-Test-Member": who} if who else {}, params=params
        )
        assert response.status_code == 200, response.text
        return response

    async def scalar(self, statement: Select[Any]) -> Any:
        async with self.sessions() as session:
            return await session.scalar(statement)


@pytest_asyncio.fixture
async def world() -> AsyncIterator[World]:
    engine = create_async_engine(
        "sqlite+aiosqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False}
    )
    tables = [
        cast(Table, m.__table__)
        for m in (UserAccount, MemberNotice, SongChordProposal, SongChordReport)
    ]
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
                    is_admin=member_id == TEAM,
                    last_seen_at=datetime.now(UTC),
                )
            )
        await session.commit()

    settings = Settings.model_validate({"_env_file": None, "NEXT_PUBLIC_API_BASE_URL": "http://t"})
    app = FastAPI()
    app.include_router(api.router, prefix="/api/v1")
    app.include_router(api.admin_router, prefix="/api/v1")
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

    async def override_admin() -> str:
        return "api-key-admin"

    app.dependency_overrides[get_session] = override_session
    app.dependency_overrides[api.get_member] = override_member
    app.dependency_overrides[api.get_optional_member] = lookup
    app.dependency_overrides[get_settings] = lambda: settings
    app.dependency_overrides[require_admin] = override_admin
    service.limiter.reset()
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://t"
    ) as client:
        yield World(client, sessions)
    await engine.dispose()


# --------------------------------------------------------------------------- shapes


def test_the_create_shape_accepts_a_good_chart_and_refuses_bad_ones() -> None:
    assert ChordProposalCreate.model_validate(chart_body()).base_key == "D"
    bad: list[dict[str, Any]] = [
        chart_body(played_it=False),
        chart_body(song_id=0),
        chart_body(song_id=5019),
        chart_body(base_key="H"),
        chart_body(base_key="C#m"),
        chart_body(capo=8),
        chart_body(instrument="harmonium", capo=2),
        chart_body(instrument="harmonium", capo=0, strum="D U"),
        chart_body(instrument="piano"),
        chart_body(lines=[]),
        chart_body(lines=[{"placements": []}]),
        chart_body(lines=[{"placements": [{"word": 0, "chord": "H7"}]}]),
        chart_body(lines=[{"placements": [{"word": 0, "chord": "Am; DROP TABLE"}]}]),
        chart_body(lines=[{"placements": [{"word": -1, "chord": "Am"}]}]),
        chart_body(lines=[{"placements": [{"word": 200, "chord": "Am"}]}]),
        chart_body(strum="<script>"),
        chart_body(note="x" * 301),
    ]
    for body in bad:
        with pytest.raises(ValidationError):
            ChordProposalCreate.model_validate(body)


def test_real_chord_names_pass() -> None:
    for chord in ("C", "F#m", "Bbmaj7", "Dsus4", "Em7", "G/B", "Abdim", "A7", "Cadd9", "D/F#"):
        body = chart_body(lines=[{"placements": [{"word": 0, "chord": chord}]}])
        assert ChordProposalCreate.model_validate(body).lines[0].placements[0].chord == chord


def test_normalise_chart_keeps_the_first_chord_per_word_and_drops_trailing_empty_lines() -> None:
    payload = ChordProposalCreate.model_validate(
        chart_body(
            lines=[
                {
                    "placements": [
                        {"word": 2, "chord": "G"},
                        {"word": 0, "chord": "D"},
                        {"word": 2, "chord": "A"},
                    ]
                },
                {"placements": []},
                {"placements": [{"word": 1, "chord": "Em"}]},
                {"placements": []},
                {"placements": []},
            ]
        )
    )
    chart, kept = service.normalise_chart(payload)
    assert kept == 3
    assert chart["lines"][0]["placements"] == [
        {"word": 0, "chord": "D"},
        {"word": 2, "chord": "G"},
    ]
    assert chart["lines"][1] == {"placements": []}
    assert len(chart["lines"]) == 3


# --------------------------------------------------------------------------- offering and review


async def test_a_member_offers_a_chart_and_it_waits_for_review(world: World) -> None:
    response = await world.offer("a")
    assert response.status_code == 201, response.text
    item = response.json()
    assert item["status"] == "pending" and item["mine"] is True
    assert item["instrument"] == "guitar" and item["base_key"] == "D" and item["capo"] == 2
    assert item["author"] == {"name": "Ananda"}
    row = await world.scalar(select(SongChordProposal))
    assert row is not None and row.published_at is None and row.placements_count == 4

    public = (await world.listing()).json()
    assert public == {"items": [], "total": 0}  # not live yet
    other = (await world.listing("b")).json()
    assert other["total"] == 0
    own = (await world.listing("a")).json()
    assert [(i["id"], i["status"], i["mine"]) for i in own["items"]] == [
        (item["id"], "pending", True)
    ]


async def test_a_team_member_publishes_at_once(world: World) -> None:
    response = await world.offer("team", instrument="harmonium", capo=0, strum=None)
    assert response.status_code == 201, response.text
    assert response.json()["status"] == "published"
    row = await world.scalar(select(SongChordProposal))
    assert row is not None and row.published_at is not None and row.reviewed_by == "team"
    public = (await world.listing()).json()
    assert [i["instrument"] for i in public["items"]] == ["harmonium"]
    assert public["items"][0]["author"] == {"name": "Carya"}


async def test_sign_in_is_required_and_the_chart_must_be_valid(world: World) -> None:
    assert (await world.offer(None)).status_code == 401
    assert (await world.offer("a", played_it=False)).status_code == 422
    assert (await world.offer("a", lines=[{"placements": []}])).status_code == 422
    assert (await world.offer("a", song_id=5019)).status_code == 422
    unknown = await world.client.get(f"{URL}/songs/5019")
    assert unknown.status_code == 422


async def test_the_team_approves_and_the_author_is_told(world: World) -> None:
    item = (await world.offer("a")).json()
    queue = (await world.client.get("/api/v1/admin/song-chords")).json()
    assert queue["total"] == 1
    assert queue["items"][0]["author_name"] == "Ananda" and queue["items"][0]["status"] == "pending"
    done = await world.client.post(f"/api/v1/admin/song-chords/{item['id']}/approve", json={})
    assert done.status_code == 200, done.text
    assert done.json()["status"] == "published"
    live = (await world.listing()).json()
    assert [i["id"] for i in live["items"]] == [item["id"]]
    assert live["items"][0]["status"] == "published" and live["items"][0]["mine"] is False
    notice = await world.scalar(select(MemberNotice).where(MemberNotice.user_id == MEMBER_A))
    assert notice is not None and notice.kind == "chords_published"
    assert notice.payload["song_id"] == 19
    # approving twice changes nothing
    again = await world.client.post(f"/api/v1/admin/song-chords/{item['id']}/approve", json={})
    assert again.status_code == 200


async def test_reject_needs_a_reason_the_author_reads_it_and_the_team_can_restore(
    world: World,
) -> None:
    item = (await world.offer("a")).json()
    base = f"/api/v1/admin/song-chords/{item['id']}"
    assert (await world.client.post(f"{base}/reject", json={})).status_code == 422
    rejected = await world.client.post(
        f"{base}/reject", json={"reason": "The chords do not fit the tune."}
    )
    assert rejected.status_code == 200, rejected.text
    assert rejected.json()["status"] == "rejected"
    assert (
        await world.client.post(f"{base}/reject", json={"reason": "again please"})
    ).status_code == 409
    mine = (await world.client.get(f"{URL}/mine", headers={"X-Test-Member": "a"})).json()
    assert mine["items"][0]["status"] == "rejected"
    assert mine["items"][0]["rejected_reason"] == "The chords do not fit the tune."
    # other readers never see the reason or the chart
    assert (await world.listing("b")).json()["total"] == 0
    notice = await world.scalar(select(MemberNotice).where(MemberNotice.kind == "chords_rejected"))
    assert notice is not None and "do not fit" in notice.body
    assert notice.payload["actions"] == ["offer_again", "contact"]
    # a rejected chart cannot be approved straight away
    assert (await world.client.post(f"{base}/approve", json={})).status_code == 409
    restored = await world.client.post(f"{base}/restore", json={})
    assert restored.status_code == 200 and restored.json()["status"] == "published"
    assert (await world.client.post(f"{base}/restore", json={})).status_code == 409
    assert (await world.listing()).json()["total"] == 1


async def test_a_published_chart_can_be_taken_down(world: World) -> None:
    item = (await world.offer("team")).json()
    taken = await world.client.post(
        f"/api/v1/admin/song-chords/{item['id']}/reject", json={"reason": "Wrong song."}
    )
    assert taken.status_code == 200
    assert (await world.listing()).json()["total"] == 0


async def test_team_members_review_inside_the_app(world: World) -> None:
    item = (await world.offer("a")).json()
    denied = await world.client.get(f"{URL}/review/queue", headers={"X-Test-Member": "b"})
    assert denied.status_code == 403
    queue = await world.client.get(f"{URL}/review/queue", headers={"X-Test-Member": "team"})
    assert queue.status_code == 200 and queue.json()["items"][0]["id"] == item["id"]
    ok = await world.client.post(
        f"{URL}/review/{item['id']}/approve", headers={"X-Test-Member": "team"}
    )
    assert ok.status_code == 200 and ok.json()["reviewed_by"] == "Carya"
    assert (
        await world.client.post(
            f"{URL}/review/{item['id']}/approve", headers={"X-Test-Member": "a"}
        )
    ).status_code == 403
    after = await world.client.get(
        f"{URL}/review/queue", params={"filter": "pending"}, headers={"X-Test-Member": "team"}
    )
    assert after.json()["total"] == 0


async def test_several_charts_per_song_and_instrument_are_allowed_with_a_cap(world: World) -> None:
    first = await world.offer("a", base_key="D")
    second = await world.offer("a", base_key="E")
    third = await world.offer("a", base_key="F")
    assert [r.status_code for r in (first, second, third)] == [201, 201, 201]
    fourth = await world.offer("a", base_key="G")
    assert fourth.status_code == 409
    assert fourth.headers["X-Error-Code"] == service.OPEN_LIMIT_CODE
    # another instrument and another song are separate
    assert (await world.offer("a", instrument="harmonium", capo=0, strum=None)).status_code == 201
    assert (await world.offer("a", song_id=20)).status_code == 201
    # the team has no cap
    for key in "CDEF":
        assert (await world.offer("team", base_key=key)).status_code == 201


async def test_the_same_chart_twice_is_refused(world: World) -> None:
    assert (await world.offer("a")).status_code == 201
    twin = await world.offer("a")
    assert twin.status_code == 409
    assert "already" in twin.json()["detail"]
    assert twin.headers["X-Error-Code"] == service.DUPLICATE_CODE
    # another member may offer the same chords: it is a different voice
    assert (await world.offer("b")).status_code == 201


async def test_a_daily_limit_stops_members_but_not_the_team(world: World) -> None:
    for song in range(1, service.DAILY_PROPOSALS + 1):
        service.limiter.reset()  # the hourly brake is tested on its own
        assert (await world.offer("a", song_id=song)).status_code == 201
    service.limiter.reset()
    blocked = await world.offer("a", song_id=500)
    assert blocked.status_code == 429
    assert blocked.headers["X-Error-Code"] == service.DAILY_LIMIT_CODE
    # a day later the allowance is back
    async with world.sessions() as session:
        await session.execute(
            update(SongChordProposal).values(created_at=datetime.now(UTC) - timedelta(hours=25))
        )
        await session.commit()
    service.limiter.reset()
    assert (await world.offer("a", song_id=501)).status_code == 201
    for song in range(600, 600 + service.DAILY_PROPOSALS + 3):
        assert (await world.offer("team", song_id=song)).status_code == 201


async def test_the_hourly_brake_stops_a_script(world: World) -> None:
    codes = []
    for song in range(1, service.HOURLY_PROPOSALS + 3):
        codes.append((await world.offer("a", song_id=song, note=str(song))).status_code)
    assert codes[: service.HOURLY_PROPOSALS] == [201] * service.HOURLY_PROPOSALS
    assert codes[-1] == 429


async def test_the_list_filters_by_instrument_and_orders_oldest_first(world: World) -> None:
    await world.offer("team", base_key="D")
    await world.offer("team", instrument="harmonium", capo=0, strum=None, base_key="C")
    await world.offer("team", base_key="E")
    async with world.sessions() as session:  # SQLite stamps whole seconds: spread them out
        for index, key in enumerate("DCE"):
            await session.execute(
                update(SongChordProposal)
                .where(SongChordProposal.base_key == key)
                .values(created_at=datetime.now(UTC) - timedelta(minutes=30 - index))
            )
        await session.commit()
    both = (await world.listing()).json()
    assert [i["base_key"] for i in both["items"]] == ["D", "C", "E"]
    only = (await world.listing(instrument="guitar")).json()
    assert [i["base_key"] for i in only["items"]] == ["D", "E"]
    bad = await world.client.get(f"{URL}/songs/19", params={"instrument": "oud"})
    assert bad.status_code == 422
    other_song = (await world.listing(song=20)).json()
    assert other_song["total"] == 0


async def test_the_answer_is_never_cached_between_viewers(world: World) -> None:
    response = await world.listing("a")
    assert response.headers["cache-control"] == "private, no-store"


# --------------------------------------------------------------------------- anonymity


async def test_an_anonymous_chart_has_no_trace_of_its_author_for_anyone_else(world: World) -> None:
    mine = (await world.offer("a", is_anonymous=True)).json()
    await world.client.post(f"/api/v1/admin/song-chords/{mine['id']}/approve", json={})
    for viewer in (None, "b"):
        text = (await world.listing(viewer)).text
        assert json.loads(text)["items"][0]["author"] is None
        for secret in ("Ananda", "ananda@example.org", str(MEMBER_A)):
            assert secret not in text
    # the author still sees it as theirs; the team knows who it is
    own = (await world.listing("a")).json()["items"][0]
    assert own["mine"] is True and own["is_anonymous"] is True
    queue = (await world.client.get("/api/v1/admin/song-chords", params={"filter": "all"})).json()
    assert queue["items"][0]["author_name"] == "Ananda"
    assert queue["items"][0]["author_id"] == str(MEMBER_A)


async def test_a_named_chart_never_shows_an_email_as_a_name(world: World) -> None:
    async with world.sessions() as session:
        await session.execute(
            update(UserAccount).where(UserAccount.id == MEMBER_A).values(display_name="a@b.org")
        )
        await session.commit()
    item = (await world.offer("a")).json()
    assert item["author"] == {"name": service.FALLBACK_NAME}
    assert "a@b.org" not in json.dumps(item)


# --------------------------------------------------------------------------- reports and deletion


async def test_reports_count_once_per_person_and_show_in_the_reported_queue(world: World) -> None:
    item = (await world.offer("team")).json()
    url = f"{URL}/{item['id']}/report"
    first = await world.client.post(
        url, json={"reason": "wrong_chords"}, headers={"X-Test-Member": "b"}
    )
    assert first.status_code == 201 and first.json()["status"] == "received"
    again = await world.client.post(url, json={"reason": "spam"}, headers={"X-Test-Member": "b"})
    assert again.json()["status"] == "already_reported"
    guest = await world.client.post(url, json={"reason": "other"})
    assert guest.json()["status"] == "received"
    assert await world.scalar(select(SongChordProposal.reports_count)) == 2
    queue = (
        await world.client.get("/api/v1/admin/song-chords", params={"filter": "reported"})
    ).json()
    assert queue["total"] == 1 and queue["items"][0]["reports_count"] == 2
    mine = await world.client.post(url, json={"reason": "other"}, headers={"X-Test-Member": "team"})
    assert mine.status_code == 422
    assert (await world.client.post(url, json={"reason": "nonsense"})).status_code == 422
    missing = await world.client.post(f"{URL}/{uuid4()}/report", json={"reason": "spam"})
    assert missing.status_code == 404


async def test_a_pending_chart_cannot_gather_reports(world: World) -> None:
    item = (await world.offer("a")).json()
    response = await world.client.post(f"{URL}/{item['id']}/report", json={"reason": "spam"})
    assert response.status_code == 201
    assert await world.scalar(select(SongChordProposal.reports_count)) == 0


async def test_the_author_deletes_their_chart_for_good_in_any_state(world: World) -> None:
    item = (await world.offer("team")).json()
    await world.client.post(f"{URL}/{item['id']}/report", json={"reason": "other"})
    stranger = await world.client.delete(f"{URL}/{item['id']}", headers={"X-Test-Member": "b"})
    assert stranger.status_code == 403
    assert (await world.client.delete(f"{URL}/{item['id']}")).status_code == 401
    gone = await world.client.delete(f"{URL}/{item['id']}", headers={"X-Test-Member": "team"})
    assert gone.status_code == 204
    assert await world.scalar(select(sa.func.count()).select_from(SongChordProposal)) == 0
    assert await world.scalar(select(sa.func.count()).select_from(SongChordReport)) == 0
    assert (
        await world.client.delete(f"{URL}/{item['id']}", headers={"X-Test-Member": "team"})
    ).status_code == 404


# --------------------------------------------------------------------------- migration 0031

VERSIONS = Path(__file__).resolve().parents[1] / "alembic" / "versions"


def load_migration() -> ModuleType:
    spec = importlib.util.spec_from_file_location(
        "m0031", VERSIONS / "0031_song_chord_proposals.py"
    )
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def run(engine: sa.Engine, step: Any) -> None:
    with engine.begin() as connection:
        with Operations.context(MigrationContext.configure(connection)):
            step()


def test_the_chain_has_one_head_and_0031_follows_0030() -> None:
    script = ScriptDirectory.from_config(Config(str(VERSIONS.parents[1] / "alembic.ini")))
    assert len(script.get_heads()) == 1
    revision = script.get_revision("0031_song_chord_proposals")
    assert revision is not None and revision.down_revision == "0030_song_comments"
    assert "0031_song_chord_proposals" in {r.revision for r in script.walk_revisions()}


def test_the_migration_builds_the_tables_runs_twice_and_matches_the_model() -> None:
    migration = load_migration()
    engine = sa.create_engine("sqlite://", poolclass=sa.pool.StaticPool)
    with engine.begin() as connection:
        connection.execute(sa.text("CREATE TABLE user_accounts (id CHAR(32) PRIMARY KEY)"))
    run(engine, migration.upgrade)
    run(engine, migration.upgrade)  # again: nothing breaks
    inspector = sa.inspect(engine)
    for model in (SongChordProposal, SongChordReport):
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
            "INSERT INTO song_chord_proposals (id, song_id, member_id, instrument, base_key, capo, "
            "chart, status) VALUES (:i, :s, :m, :n, 'D', :c, '{}', :t)"
        )
        good = {"s": 19, "m": user, "n": "guitar", "c": 0, "t": "pending"}
        connection.execute(insert, {"i": uuid4().hex, **good})
        for override in (
            {"s": 0},
            {"s": 5019},
            {"n": "piano"},
            {"c": 8},
            {"t": "removed"},
        ):
            with pytest.raises(sa.exc.IntegrityError):
                with connection.begin_nested():
                    connection.execute(insert, {"i": uuid4().hex, **good, **override})
    run(engine, migration.downgrade)
    run(engine, migration.downgrade)
    assert not sa.inspect(engine).has_table("song_chord_proposals")
    assert not sa.inspect(engine).has_table("song_chord_reports")
    engine.dispose()


def test_the_migration_leaves_tables_that_create_all_made_alone() -> None:
    migration = load_migration()
    engine = sa.create_engine("sqlite://", poolclass=sa.pool.StaticPool)
    Base.metadata.create_all(
        engine,
        tables=[
            cast(Table, m.__table__) for m in (UserAccount, SongChordProposal, SongChordReport)
        ],
    )
    run(engine, migration.upgrade)
    assert sa.inspect(engine).has_table("song_chord_reports")
    engine.dispose()


def test_the_router_serves_the_chord_routes() -> None:
    from app.api.v1.router import router

    app = FastAPI()
    app.include_router(router)
    paths = set(app.openapi()["paths"])
    assert "/api/v1/song-chords/songs/{song_id}" in paths
    assert "/api/v1/admin/song-chords" in paths
