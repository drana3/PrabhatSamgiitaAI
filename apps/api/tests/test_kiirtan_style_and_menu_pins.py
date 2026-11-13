"""Kiirtan style (optional pick list + "other") and the team's search-menu pins."""

# ruff: noqa: F811
from __future__ import annotations

import os
from collections.abc import AsyncIterator
from pathlib import Path
from uuid import UUID

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
from app.models.recordings import Recording
from app.models.search_menu import SearchMenuPin
from app.schemas.recordings import RecordingCreate
from app.services.recording_styles import (
    LEGACY_STYLES,
    STYLES,
    clean_styles_other,
    normalize_style,
    normalize_styles,
)

AS_A = {"X-Test-Member": "a"}


def test_the_style_list_is_dadas_and_ids_are_normalised() -> None:
    assert STYLES == ("indian", "electronic", "acoustic_guitar", "african", "western")
    # the first list stays readable on old rows, but is never accepted again
    assert LEGACY_STYLES == ("bengali", "hindi", "brajabuli", "dhrupad", "folk")
    assert normalize_style(" Indian ") == "indian"
    assert normalize_style("other") == "other"
    assert normalize_style("") is None
    assert normalize_style(None) is None
    for refused in ("klingon", "folk", "bengali"):
        with pytest.raises(ValueError, match="Choose a style"):
            normalize_style(refused)
    assert normalize_styles([" Indian", "African", "indian", "other"]) == ["indian", "african"]
    assert clean_styles_other(["  Baul   folk ", "baul FOLK", ""]) == ["Baul folk"]


def _body(**extra: object) -> dict[str, object]:
    base: dict[str, object] = {
        "key": "recordings-some-member-file.mp3",
        "kind": "kiirtan",
        "recording_type": "studio",
        "performance": "solo",
        "title": "Baba Nam Kevalam",
        "author": "Sample group",
        "by_author": True,
        "terms_accepted": True,
        "terms_version": "x",
    }
    base.update(extra)
    return base


def test_own_words_are_cleaned_and_a_kiirtan_needs_one_style() -> None:
    with pytest.raises(ValidationError, match="style"):
        RecordingCreate(**_body())
    with pytest.raises(ValidationError, match="style"):
        RecordingCreate(**_body(style="other"))  # "other" alone names nothing
    ok = RecordingCreate(**_body(styles=["indian", "african"], styles_other=["  Baul   folk "]))
    assert ok.styles == ["indian", "african"] and ok.styles_other == ["Baul folk"]
    # the old single fields mirror the first choice, for an older phone and the search shelves
    assert (ok.style, ok.style_other) == ("indian", None)
    own = RecordingCreate(**_body(styles_other=["Baul"]))
    assert (own.style, own.style_other) == ("other", "Baul")
    # an old phone still sends one style (and "other" with its name): it reads as a list of one
    old = RecordingCreate(**_body(style="other", style_other="  Baul   folk "))
    assert old.styles == [] and old.styles_other == ["Baul folk"]
    assert RecordingCreate(**_body(style="western")).styles == ["western"]


def test_the_number_of_choices_is_limited() -> None:
    with pytest.raises(ValidationError, match="at most 5"):
        RecordingCreate(
            **_body(
                styles=["indian", "electronic", "acoustic_guitar", "african", "western"],
                styles_other=["Aa"],
            )
        )
    with pytest.raises(ValidationError, match="at most 2"):
        RecordingCreate(**_body(styles=["indian"], styles_other=["Aa", "Bb", "Cc"]))
    with pytest.raises(ValidationError, match="mood"):
        RecordingCreate(**_body(styles=["indian"], moods=["furious"]))
    ok = RecordingCreate(
        **_body(styles=["indian"], moods=["joyful", "mix"], moods_other=["Tender"])
    )
    assert ok.moods == ["joyful", "mix"] and ok.moods_other == ["Tender"]


def test_baba_audio_carries_no_style_and_no_mood_and_the_others_may() -> None:
    talk = RecordingCreate(
        **_body(kind="baba_audio", language="en", styles=["indian"], moods=["joyful"])
    )
    assert talk.styles == [] and talk.moods == [] and talk.style is None
    bhajan = RecordingCreate(**_body(kind="bhajan", language="bn", styles=["western"]))
    assert bhajan.styles == ["western"]


async def test_styles_and_moods_are_stored_returned_and_old_rows_read_as_a_list(
    world: World,
) -> None:
    several = await world.publish(
        "a",
        mp3(7001),
        kind="kiirtan",
        styles=["indian", "acoustic_guitar"],
        moods=["joyful", "longing"],
        style=None,
    )
    assert several.status_code == 201, several.text
    body = several.json()
    assert body["styles"] == ["indian", "acoustic_guitar"] and body["style"] == "indian"
    assert body["moods"] == ["joyful", "longing"]
    # a row from before the lists: only the single fields exist, and they read as a list of one
    async with world.sessions() as session:
        row = await session.get(Recording, UUID(body["id"]))
        assert row is not None
        row.styles = row.styles_other = row.moods = row.moods_other = None
        row.style, row.style_other = "other", "Baul"
        await session.commit()
    again = (await world.client.get(f"/api/v1/recordings/{body['id']}", headers=AS_A)).json()
    assert again["styles"] == [] and again["styles_other"] == ["Baul"]
    assert again["style"] == "other" and again["moods"] == []
    plain = await world.publish("a", mp3(7003), kind="kiirtan", style=None)
    assert plain.status_code == 422  # a Kiirtan must say how it sounds
    for old in ("folk", "bengali", "klingon"):
        bad = await world.publish("a", mp3(7005), kind="kiirtan", style=old)
        assert bad.status_code == 422, old
    talk = await world.publish(
        "a", mp3(7006), kind="baba_audio", language="en", style=None, styles=["indian"]
    )
    assert talk.status_code == 201, talk.text
    assert talk.json()["styles"] == [] and talk.json()["style"] is None


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
