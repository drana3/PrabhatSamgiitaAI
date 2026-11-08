"""Kiirtan style (optional pick list + "other") and the team's search-menu pins."""

# ruff: noqa: F811
from __future__ import annotations

import os
from collections.abc import AsyncIterator
from pathlib import Path

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://test:test@localhost/test")

import httpx
import pytest
import pytest_asyncio
from fastapi import FastAPI
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool
from test_recordings import (  # noqa: F401  (fixtures are used by name)
    World,
    file_world,
    mp3,
    world,
)

from app.api.v1 import search_menu as menu_api
from app.core.db import get_session
from app.core.security import require_admin
from app.models import Base
from app.models.search_menu import SearchMenuPin
from app.schemas.recordings import RecordingCreate
from app.services.recording_styles import STYLES, normalize_style

AS_A = {"X-Test-Member": "a"}


def test_the_style_list_is_dadas_and_ids_are_normalised() -> None:
    assert STYLES == ("bengali", "hindi", "brajabuli", "dhrupad", "folk")
    assert normalize_style(" Folk ") == "folk"
    assert normalize_style("other") == "other"
    assert normalize_style("") is None
    assert normalize_style(None) is None
    with pytest.raises(ValueError, match="Choose a style"):
        normalize_style("klingon")


def _body(**extra: object) -> dict[str, object]:
    base: dict[str, object] = {
        "key": "recordings-some-member-file.mp3",
        "kind": "kiirtan",
        "title": "Baba Nam Kevalam",
        "author": "Sample group",
        "by_author": True,
        "terms_accepted": True,
        "terms_version": "x",
    }
    base.update(extra)
    return base


def test_other_needs_its_name_and_the_name_is_cleaned() -> None:
    with pytest.raises(ValidationError, match="name of the style"):
        RecordingCreate(**_body(style="other"))
    ok = RecordingCreate(**_body(style="other", style_other="  Baul   folk "))
    assert ok.style == "other"
    assert ok.style_other == "Baul folk"
    # the name is dropped when the style is a listed one
    listed = RecordingCreate(**_body(style="folk", style_other="ignored"))
    assert listed.style_other is None


def test_a_style_belongs_to_a_kiirtan_only() -> None:
    bhajan = RecordingCreate(**_body(kind="bhajan", language="bn", style="folk"))
    assert bhajan.style is None


async def test_a_kiirtan_keeps_its_style_and_the_others_drop_it(world: World) -> None:
    kiirtan = await world.publish("a", mp3(7001), kind="kiirtan", style="dhrupad")
    assert kiirtan.status_code == 201, kiirtan.text
    assert kiirtan.json()["style"] == "dhrupad"
    assert kiirtan.json()["style_other"] is None
    other = await world.publish("a", mp3(7002), kind="kiirtan", style="other", style_other="Baul")
    assert other.json()["style"] == "other"
    assert other.json()["style_other"] == "Baul"
    plain = await world.publish("a", mp3(7003), kind="kiirtan", style=None)
    assert plain.status_code == 422  # a Kiirtan must say how it is sung
    bhajan = await world.publish("a", mp3(7004), kind="bhajan", language="bn", style="folk")
    assert bhajan.status_code == 201, bhajan.text
    assert bhajan.json()["style"] is None
    bad = await world.publish("a", mp3(7005), kind="kiirtan", style="klingon")
    assert bad.status_code == 422


# ----------------------------------------------------------------------------- menu pins


@pytest_asyncio.fixture
async def pins_app(tmp_path: Path) -> AsyncIterator[tuple[httpx.AsyncClient, FastAPI]]:
    engine = create_async_engine(
        "sqlite+aiosqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False}
    )
    async with engine.begin() as conn:
        await conn.run_sync(
            lambda c: Base.metadata.create_all(c, tables=[SearchMenuPin.__table__])  # type: ignore[list-item]
        )
    sessions = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    app = FastAPI()
    app.include_router(menu_api.router, prefix="/api/v1")
    app.include_router(menu_api.admin_router, prefix="/api/v1")

    async def override_session() -> AsyncIterator[AsyncSession]:
        async with sessions() as session:
            yield session

    app.dependency_overrides[get_session] = override_session
    app.dependency_overrides[require_admin] = lambda: "team-member"
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://t"
    ) as client:
        yield client, app
    await engine.dispose()


async def test_pins_start_empty_and_the_team_replaces_them_in_order(
    pins_app: tuple[httpx.AsyncClient, FastAPI],
) -> None:
    client, _ = pins_app
    assert (await client.get("/api/v1/search-menu/pins")).json() == {"pins": []}
    put = await client.put(
        "/api/v1/admin/search-menu/pins",
        json={"pins": ["baba_audio", " Kiirtan:Folk ", "baba_audio"]},
    )
    assert put.status_code == 200, put.text
    assert put.json() == {"pins": ["baba_audio", "kiirtan:folk"]}  # cleaned, de-duplicated, ordered
    assert (await client.get("/api/v1/search-menu/pins")).json()["pins"] == [
        "baba_audio",
        "kiirtan:folk",
    ]
    cleared = await client.put("/api/v1/admin/search-menu/pins", json={"pins": []})
    assert cleared.json() == {"pins": []}


async def test_pins_refuse_bad_ids_and_more_than_three(
    pins_app: tuple[httpx.AsyncClient, FastAPI],
) -> None:
    client, _ = pins_app
    assert (
        await client.put("/api/v1/admin/search-menu/pins", json={"pins": ["has space"]})
    ).status_code == 422
    four = {"pins": ["a", "b", "c", "d"]}
    assert (await client.put("/api/v1/admin/search-menu/pins", json=four)).status_code == 422


async def test_only_the_team_can_write_pins(
    pins_app: tuple[httpx.AsyncClient, FastAPI],
) -> None:
    client, app = pins_app
    app.dependency_overrides.pop(require_admin)
    denied = await client.put("/api/v1/admin/search-menu/pins", json={"pins": ["ps"]})
    assert denied.status_code in (401, 403, 503)
    # reading stays public
    assert (await client.get("/api/v1/search-menu/pins")).status_code == 200


def test_the_migration_follows_the_last_one() -> None:
    from alembic.config import Config
    from alembic.script import ScriptDirectory

    config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    script = ScriptDirectory.from_config(config)
    revision = script.get_revision("0039_kiirtan_style_and_menu_pins")
    assert revision is not None
    assert revision.down_revision == "0038_author_snapshot_kinds"
    assert "search_menu_pins" in Base.metadata.tables
