"""Migration 0042 (counted plays of catalogue songs): run on SQLite with Alembic's own operations.

What a real PostgreSQL does is NOT covered here: check it on a copy of the database before the
deploy."""

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

from app.models.song_plays import SongPlayDaily, SongPlayEvent

NEW = ("song_play_events", "song_play_daily")


@pytest.fixture
def m42() -> ModuleType:
    return load("0042_song_plays")


@pytest.fixture
def engine() -> Iterator[sa.Engine]:
    engine = sa.create_engine("sqlite://", poolclass=sa.pool.StaticPool)
    yield engine
    engine.dispose()


def test_0042_follows_0041_and_is_the_only_head(m42: ModuleType) -> None:
    script = ScriptDirectory.from_config(Config(str(VERSIONS.parents[1] / "alembic.ini")))
    assert len(script.get_heads()) == 1
    revision = script.get_revision("0042_song_plays")
    assert revision is not None and revision.down_revision == "0041_set_event_month_cover"


def test_upgrade_adds_two_tables_and_they_match_the_models(
    engine: sa.Engine, m42: ModuleType
) -> None:
    run(engine, m42.upgrade)
    inspector = sa.inspect(engine)
    for model in (SongPlayEvent, SongPlayDaily):
        table = model.__table__
        assert inspector.has_table(table.name)
        assert {c["name"] for c in inspector.get_columns(table.name)} == {
            c.name for c in table.columns
        }
        made = {i["name"] for i in inspector.get_indexes(table.name)}
        assert {i.name for i in table.indexes} <= made
    uniques = {u["name"] for u in inspector.get_unique_constraints("song_play_events")}
    assert "uq_song_play_events_once_a_day" in uniques


def test_running_it_twice_changes_nothing_and_downgrade_drops_only_its_tables(
    engine: sa.Engine, m42: ModuleType
) -> None:
    with engine.begin() as connection:
        connection.execute(sa.text("CREATE TABLE play_daily (x INTEGER)"))
    run(engine, m42.upgrade)
    run(engine, m42.upgrade)
    run(engine, m42.downgrade)
    inspector = sa.inspect(engine)
    assert not any(inspector.has_table(name) for name in NEW)
    assert inspector.has_table("play_daily")  # not touched
