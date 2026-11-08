"""Migration 0049 (chord cycle on chord sheets, link status on video links).

Runs on SQLite with Alembic's own operations. A real PostgreSQL is NOT covered here: check it on a
copy of the database before the deploy."""

from __future__ import annotations

import os
from collections.abc import Iterator
from types import ModuleType

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://test:test@localhost/test")

import pytest
import sqlalchemy as sa
from alembic.config import Config
from alembic.script import ScriptDirectory
from test_recording_duplicates_migration import VERSIONS, load, run

SHEET_NEW = {"cycle"}
VIDEO_NEW = {"link_status", "checked_at", "check_fails"}

OLD = [
    """CREATE TABLE recording_chord_sheets (
        id CHAR(32) PRIMARY KEY, instrument VARCHAR(12) NOT NULL, body TEXT NOT NULL)""",
    """CREATE TABLE video_links (
        id CHAR(32) PRIMARY KEY, provider VARCHAR(16) NOT NULL, url VARCHAR(300) NOT NULL)""",
    "INSERT INTO recording_chord_sheets (id, instrument, body) VALUES ('a', 'guitar', 'Am G')",
    "INSERT INTO video_links (id, provider, url) VALUES ('v', 'youtube', 'https://www.youtube.com/watch?v=aaaaaaaaaaa')",
]


@pytest.fixture
def m49() -> ModuleType:
    return load("0049_kiirtan_cycle_video_status")


@pytest.fixture
def engine() -> Iterator[sa.Engine]:
    engine = sa.create_engine("sqlite://", poolclass=sa.pool.StaticPool)
    with engine.begin() as connection:
        for statement in OLD:
            connection.execute(sa.text(statement))
    yield engine
    engine.dispose()


def columns(engine: sa.Engine, table: str) -> set[str]:
    return {c["name"] for c in sa.inspect(engine).get_columns(table)}


def test_0049_follows_0048_and_the_chain_has_one_head() -> None:
    script = ScriptDirectory.from_config(Config(str(VERSIONS.parents[1] / "alembic.ini")))
    assert len(script.get_heads()) == 1
    revision = script.get_revision("0049_kiirtan_cycle_video_status")
    assert revision is not None
    assert revision.down_revision == "0048_recording_loudness"


def test_upgrade_adds_the_columns_and_keeps_the_old_rows(
    engine: sa.Engine, m49: ModuleType
) -> None:
    run(engine, m49.upgrade)
    assert SHEET_NEW <= columns(engine, "recording_chord_sheets")
    assert VIDEO_NEW <= columns(engine, "video_links")
    with engine.connect() as connection:
        sheet = connection.execute(sa.text("SELECT body, cycle FROM recording_chord_sheets")).one()
        video = connection.execute(
            sa.text("SELECT url, link_status, checked_at, check_fails FROM video_links")
        ).one()
    assert tuple(sheet) == ("Am G", None)
    assert tuple(video) == ("https://www.youtube.com/watch?v=aaaaaaaaaaa", "unknown", None, 0)


def test_upgrade_twice_is_harmless(engine: sa.Engine, m49: ModuleType) -> None:
    run(engine, m49.upgrade)
    run(engine, m49.upgrade)
    assert VIDEO_NEW <= columns(engine, "video_links")


def test_downgrade_drops_only_its_columns(engine: sa.Engine, m49: ModuleType) -> None:
    run(engine, m49.upgrade)
    run(engine, m49.downgrade)
    assert not SHEET_NEW & columns(engine, "recording_chord_sheets")
    assert not VIDEO_NEW & columns(engine, "video_links")
    assert {"id", "body"} <= columns(engine, "recording_chord_sheets")
    assert {"id", "url"} <= columns(engine, "video_links")
