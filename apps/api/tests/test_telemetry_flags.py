"""Product events and feature flags (docs/analytics-flags.md): what is accepted, what is dropped,
how a person is placed in a group, the team API, and the migration."""

from __future__ import annotations

import importlib.util
import os
from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta
from pathlib import Path
from uuid import uuid4

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://test:test@localhost/test")

import httpx
import pytest
import pytest_asyncio
import sqlalchemy as sa
from fastapi import FastAPI
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.api.v1 import telemetry as api
from app.config import get_settings
from app.core.db import get_session
from app.core.security import require_admin
from app.models.app_telemetry import AppEvent, FeatureFlag
from app.models.base import Base
from app.services import feature_flags as ff
from app.services import telemetry as tm

VERSIONS = Path(__file__).resolve().parents[1] / "alembic" / "versions"


def flag(**over) -> FeatureFlag:
    base = {
        "key": "new_player",
        "description": "",
        "enabled": True,
        "rollout_percent": 100,
        "min_app_version": None,
        "max_app_version": None,
        "platforms": None,
        "variants": None,
        "include_ids": [],
        "exclude_ids": [],
        "updated_at": datetime.now(UTC),
    }
    base.update(over)
    return FeatureFlag(**base)


# ------------------------------------------------------------------ versions


def test_version_parsing_and_window() -> None:
    assert ff.parse_version("1.12.3") == (1, 12, 3)
    assert ff.parse_version("2.0.0-beta.1") == (2, 0, 0)
    assert ff.parse_version("garbage") is None and ff.parse_version(None) is None
    assert ff.version_in_window("1.10.0", "1.9.0", None)  # numbers, not strings: 10 > 9
    assert not ff.version_in_window("1.9.0", "1.10.0", None)
    assert ff.version_in_window("2.0", "2.0.0", "2.0.0")  # trailing zeros are equal
    assert not ff.version_in_window("2.0.1", None, "2.0.0")
    assert ff.version_in_window(None, None, None)
    assert not ff.version_in_window(None, "1.0.0", None)  # unknown app: not let in


# ------------------------------------------------------------------ evaluate


def test_kill_switch_beats_everything() -> None:
    f = flag(enabled=False, include_ids=["install-0001"])
    assert not ff.evaluate(f, ff.Context(install_id="install-0001")).enabled


def test_platform_and_version_gate() -> None:
    f = flag(platforms=["ios"], min_app_version="2.1.0")
    assert ff.evaluate(f, ff.Context("i-1234567", "2.1.0", "ios")).enabled
    assert ff.evaluate(f, ff.Context("i-1234567", "2.1.0", "android")).reason == "platform"
    assert ff.evaluate(f, ff.Context("i-1234567", "2.0.9", "ios")).reason == "version"


def test_overrides_exclude_first() -> None:
    f = flag(rollout_percent=0, include_ids=["a-include1"], exclude_ids=["b-exclude1"])
    assert ff.evaluate(f, ff.Context("a-include1")).reason == "included"
    f2 = flag(include_ids=["same-id-001"], exclude_ids=["same-id-001"])
    assert ff.evaluate(f2, ff.Context("same-id-001")).reason == "excluded"


def test_rollout_is_stable_monotonic_and_roughly_even() -> None:
    ids = [f"install-{i:06d}" for i in range(4000)]

    def on(percent: int) -> set[str]:
        f = flag(rollout_percent=percent)
        return {i for i in ids if ff.evaluate(f, ff.Context(i)).enabled}

    ten, fifty, hundred = on(10), on(50), on(100)
    assert ten <= fifty <= hundred, "raising the percent only adds people"
    assert len(hundred) == 4000 and on(0) == set()
    assert 0.07 < len(ten) / 4000 < 0.13 and 0.46 < len(fifty) / 4000 < 0.54
    assert on(10) == ten, "same answer every time"


def test_no_install_id_is_never_in_a_partial_rollout() -> None:
    assert not ff.evaluate(flag(rollout_percent=50), ff.Context()).enabled
    assert ff.evaluate(flag(rollout_percent=100), ff.Context()).enabled


def test_variants_are_stable_weighted_and_independent_of_rollout() -> None:
    variants = [{"name": "control", "weight": 50}, {"name": "b", "weight": 50}]
    f = flag(variants=variants, rollout_percent=100)
    ids = [f"install-{i:06d}" for i in range(4000)]
    first = {i: ff.evaluate(f, ff.Context(i)).variant for i in ids}
    assert set(first.values()) == {"control", "b"}
    assert 0.46 < sum(v == "b" for v in first.values()) / 4000 < 0.54
    narrower = flag(variants=variants, rollout_percent=30)
    for i in ids[:500]:
        result = ff.evaluate(narrower, ff.Context(i))
        if result.enabled:
            assert result.variant == first[i], "group does not change when the rollout changes"
    other = flag(key="other_test", variants=variants)
    same = sum(ff.evaluate(other, ff.Context(i)).variant == first[i] for i in ids)
    assert 0.4 < same / 4000 < 0.6, "two tests are not the same split"
    skewed = flag(variants=[{"name": "a", "weight": 90}, {"name": "b", "weight": 10}])
    share = sum(ff.evaluate(skewed, ff.Context(i)).variant == "b" for i in ids) / 4000
    assert 0.07 < share < 0.13


def test_validation_of_what_the_team_sends() -> None:
    ok = ff.validate_flag_fields(
        {
            "enabled": True,
            "rollout_percent": 25,
            "min_app_version": "2.0.0",
            "platforms": ["ios", "android", "ios"],
            "variants": [{"name": "control", "weight": 1}, {"name": "b", "weight": 1}],
            "include_ids": ["install-00001"],
        }
    )
    assert ok["platforms"] == ["android", "ios"] and ok["rollout_percent"] == 25
    for bad in (
        {"rollout_percent": 101},
        {"rollout_percent": True},
        {"rollout_percent": 1.5},
        {"min_app_version": "latest"},
        {"platforms": ["windows"]},
        {"variants": [{"name": "only", "weight": 1}]},
        {"variants": [{"name": "off", "weight": 1}, {"name": "b", "weight": 1}]},
        {"variants": [{"name": "a", "weight": 0}, {"name": "b", "weight": 0}]},
        {"variants": [{"name": "a", "weight": 1}, {"name": "a", "weight": 1}]},
        {"include_ids": ["short"]},
        {"include_ids": "nope"},
    ):
        with pytest.raises(ff.FlagError):
            ff.validate_flag_fields(bad)


# ------------------------------------------------------------------ events: what is allowed


def test_only_listed_events_and_tokens_pass() -> None:
    assert tm.clean_props("nonsense", {}) is None
    assert tm.clean_props("search", {"mode": "voice", "has_results": True, "results": 12}) == {
        "mode": "voice",
        "has_results": True,
        "results": 12,
    }
    # free text, e-mail, upper case, long strings, and unknown keys are all dropped
    dropped = tm.clean_props(
        "search",
        {
            "mode": "Hello World",
            "query": "what is karma",
            "results": "12",
            "has_results": "kurtaew@gmail.com",
        },
    )
    assert dropped == {"results": "12"}  # a digit string is a harmless token; the rest is dropped
    assert tm.clean_props("screen_view", {"screen": "x" * 41}) == {}
    assert tm.clean_props("screen_view", {"screen": "song_page"}) == {"screen": "song_page"}
    assert tm.clean_props("app_open", "not a dict") == {}
    assert tm.clean_props("search", {"results": 10**9}) == {}


# ------------------------------------------------------------------ API


@pytest_asyncio.fixture
async def world() -> AsyncIterator[tuple[httpx.AsyncClient, async_sessionmaker[AsyncSession]]]:
    engine = create_async_engine(
        "sqlite+aiosqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False}
    )
    async with engine.begin() as conn:
        tables = [AppEvent.__table__, FeatureFlag.__table__]
        await conn.run_sync(lambda c: Base.metadata.create_all(c, tables=tables))  # type: ignore[arg-type]
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    app = FastAPI()
    app.include_router(api.router, prefix="/api/v1")
    app.include_router(api.admin_router, prefix="/api/v1")

    async def _session() -> AsyncIterator[AsyncSession]:
        async with sessions() as s:
            yield s

    async def _admin() -> str:
        return "tester"

    app.dependency_overrides[get_session] = _session
    app.dependency_overrides[require_admin] = _admin
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        yield client, sessions
    await engine.dispose()


async def test_events_are_stored_without_a_person(world) -> None:
    client, sessions = world
    sid = str(uuid4())
    response = await client.post(
        "/api/v1/events",
        json={
            "session_id": sid,
            "app_version": "2.0.0",
            "platform": "ios",
            "language": "en",
            "install_id": "must-not-be-kept-when-anonymous",
            "events": [
                {"name": "app_open", "props": {"cold": True}},
                {"name": "search", "props": {"mode": "text", "query": "secret words"}},
                {"name": "made_up_event"},
            ],
        },
    )
    assert response.status_code == 200 and response.json() == {"accepted": 2, "rejected": 1}
    async with sessions() as s:
        rows = (await s.scalars(select(AppEvent).order_by(AppEvent.id))).all()
    assert [r.name for r in rows] == ["app_open", "search"]
    assert rows[1].props == {"mode": "text"}, "the query text never reaches the table"
    assert all(r.install_key is None for r in rows), "anonymous mode keeps no install hash"
    assert rows[0].session_id == sid and rows[0].platform == "ios"
    assert "secret words" not in repr([r.props for r in rows])


async def test_shared_mode_keeps_only_a_short_hash(world) -> None:
    client, sessions = world
    await client.post(
        "/api/v1/events",
        json={
            "mode": "shared",
            "install_id": "install-abcdef123456",
            "events": [{"name": "app_open"}],
        },
    )
    async with sessions() as s:
        row = (await s.scalars(select(AppEvent))).one()
    assert row.install_key and len(row.install_key) <= 16
    assert "install-abcdef" not in row.install_key


async def test_bad_metadata_is_dropped_not_stored(world) -> None:
    client, sessions = world
    await client.post(
        "/api/v1/events",
        json={
            "session_id": "<script>",
            "app_version": "alpha; drop table",
            "platform": "windows",
            "language": "x y z",
            "events": [{"name": "app_open"}],
        },
    )
    async with sessions() as s:
        row = (await s.scalars(select(AppEvent))).one()
    assert (row.session_id, row.app_version, row.platform, row.language) == (None,) * 4


async def test_batch_over_the_limit_is_refused(world) -> None:
    client, _ = world
    response = await client.post(
        "/api/v1/events", json={"events": [{"name": "app_open"}] * (tm.MAX_BATCH + 1)}
    )
    assert response.status_code == 422


async def test_team_creates_a_flag_and_the_app_reads_it(world) -> None:
    client, _ = world
    created = await client.put(
        "/api/v1/admin/flags/new_player",
        json={"enabled": True, "rollout_percent": 100, "description": "New player screen"},
    )
    assert created.status_code == 200 and created.json()["updated_by"] == "tester"
    got = await client.get(
        "/api/v1/flags",
        headers={"X-Install-Id": "install-0000001", "X-App-Version": "2.0.0", "X-Platform": "iOS"},
    )
    assert got.status_code == 200
    assert got.json()["flags"]["new_player"] == {"enabled": True, "variant": "on"}
    assert got.headers["cache-control"].startswith("private")
    # a new flag starts OFF
    fresh = await client.put("/api/v1/admin/flags/other_flag", json={})
    assert fresh.json()["enabled"] is False and fresh.json()["rollout_percent"] == 0
    got = await client.get("/api/v1/flags")
    assert got.json()["flags"]["other_flag"]["enabled"] is False
    # delete
    assert (await client.delete("/api/v1/admin/flags/other_flag")).status_code == 204
    assert (await client.delete("/api/v1/admin/flags/other_flag")).status_code == 404
    listed = await client.get("/api/v1/admin/flags")
    assert [f["key"] for f in listed.json()] == ["new_player"]


async def test_bad_flag_requests_are_422(world) -> None:
    client, _ = world
    assert (await client.put("/api/v1/admin/flags/Bad-Key", json={})).status_code == 422
    assert (
        await client.put("/api/v1/admin/flags/ok_key", json={"rollout_percent": 200})
    ).status_code == 422


async def test_experiment_counts_exposures_and_conversions(world) -> None:
    client, _ = world
    await client.put(
        "/api/v1/admin/flags/new_onboarding",
        json={
            "enabled": True,
            "rollout_percent": 100,
            "variants": [{"name": "control", "weight": 50}, {"name": "b", "weight": 50}],
        },
    )
    async def session(variant: str, converts: bool) -> None:
        events = [
            {"name": "flag_exposure", "props": {"flag": "new_onboarding", "variant": variant}}
        ]
        if converts:
            events.append({"name": "upload_done", "props": {"kind": "kiirtan"}})
        await client.post("/api/v1/events", json={"session_id": str(uuid4()), "events": events})

    for converts in (True, True, False, False):
        await session("control", converts)
    for converts in (True, True, True, False):
        await session("b", converts)
    result = (
        await client.get("/api/v1/admin/experiments/new_onboarding?goal=upload_done")
    ).json()
    by = {v["variant"]: v for v in result["variants"]}
    assert by["control"]["sessions"] == 4 and by["control"]["conversion"] == 0.5
    assert by["b"]["sessions"] == 4 and by["b"]["conversion"] == 0.75
    assert (await client.get("/api/v1/admin/experiments/x?goal=made_up")).status_code == 422
    summary = (await client.get("/api/v1/admin/events/summary?days=7")).json()
    assert {e["name"] for e in summary["events"]} == {"flag_exposure", "upload_done"}


async def test_old_events_are_purged(world) -> None:
    client, sessions = world
    async with sessions() as s:
        old = datetime.now(UTC) - timedelta(days=400)
        s.add(AppEvent(day=old.date(), created_at=old, name="app_open", props={}))
        now = datetime.now(UTC)
        s.add(AppEvent(day=now.date(), created_at=now, name="app_open", props={}))
        await s.commit()
    result = await client.post("/api/v1/admin/events/purge?older_than_days=180")
    assert result.json() == {"deleted": 1}
    async with sessions() as s:
        assert await s.scalar(select(func.count()).select_from(AppEvent)) == 1


def test_admin_routes_demand_the_admin_key() -> None:
    assert any(d.dependency is require_admin for d in api.admin_router.dependencies)
    assert get_settings() is not None


# ------------------------------------------------------------------ migration


def test_migration_creates_and_drops_both_tables_twice() -> None:
    spec = importlib.util.spec_from_file_location(
        "m0053", VERSIONS / "0053_app_events_and_flags.py"
    )
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    from alembic.migration import MigrationContext
    from alembic.operations import Operations

    engine = sa.create_engine("sqlite://")
    with engine.begin() as conn:
        with Operations.context(MigrationContext.configure(conn)):
            module.upgrade()
            module.upgrade()  # twice: no error
            names = set(sa.inspect(conn).get_table_names())
            assert {"app_events", "feature_flags"} <= names
            module.downgrade()
            assert not ({"app_events", "feature_flags"} & set(sa.inspect(conn).get_table_names()))
    assert module.down_revision == "0052_song_translations"
