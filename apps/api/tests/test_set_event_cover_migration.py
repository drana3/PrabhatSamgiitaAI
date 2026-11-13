"""Migration 0041 (event playlists: year and month, cover picture).

SQLite with Alembic's own operations, starting from the schema 0032 leaves. A real PostgreSQL is
NOT covered here: check it on a copy of the database before the deploy.
"""

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
from test_recording_sets_migration import at_0029


@pytest.fixture
def m29() -> ModuleType:
    return load("0029_recording_duplicates")


@pytest.fixture
def m32() -> ModuleType:
    return load("0032_recording_sets_and_categories")


@pytest.fixture
def m41() -> ModuleType:
    return load("0041_set_event_month_cover")


@pytest.fixture
def engine() -> Iterator[sa.Engine]:
    engine = sa.create_engine("sqlite://", poolclass=sa.pool.StaticPool)
    yield engine
    engine.dispose()


def insert_set(engine: sa.Engine, ident: str, starts_on: str, ends_on: str | None = None) -> None:
    with engine.begin() as connection:
        connection.execute(
            sa.text(
                "INSERT INTO recording_collections (id, owner_name, title, starts_on, ends_on, "
                "default_kind, tracks_expected, status, created_at, updated_at) VALUES "
                "(:i, 'A', 'Retreat', :s, :e, 'kiirtan', 0, 'active', "
                "'2026-01-01 00:00:00', '2026-01-01 00:00:00')"
            ),
            {"i": ident, "s": starts_on, "e": ends_on},
        )


def test_0041_is_in_the_one_chain(m41: ModuleType) -> None:
    script = ScriptDirectory.from_config(Config(str(VERSIONS.parents[1] / "alembic.ini")))
    assert len(script.get_heads()) == 1
    revision = script.get_revision("0041_set_event_month_cover")
    assert revision is not None and revision.down_revision == "0040_baba_audio_kind"
    assert m41.revision == "0041_set_event_month_cover"


def test_upgrade_adds_the_columns_the_table_and_fills_year_and_month_from_the_old_day(
    engine: sa.Engine, m29: ModuleType, m32: ModuleType, m41: ModuleType
) -> None:
    at_0029(engine, m29)
    run(engine, m32.upgrade)
    insert_set(engine, "s1", "2024-08-17", "2024-08-19")
    insert_set(engine, "s2", "1999-01-01")
    run(engine, m41.upgrade)
    inspector = sa.inspect(engine)
    columns = {c["name"] for c in inspector.get_columns("recording_collections")}
    assert {"event_year", "event_month", "cover_version", "starts_on", "ends_on"} <= columns
    assert inspector.has_table("recording_collection_covers")
    with engine.connect() as connection:
        rows = {
            r[0]: tuple(r[1:])
            for r in connection.execute(
                sa.text(
                    "SELECT id, event_year, event_month, starts_on, ends_on "
                    "FROM recording_collections"
                )
            )
        }
    # the old day columns are untouched; the year and month follow them
    assert rows["s1"] == (2024, 8, "2024-08-17", "2024-08-19")
    assert rows["s2"] == (1999, 1, "1999-01-01", None)


def test_running_it_twice_changes_nothing_and_downgrade_drops_only_its_own_parts(
    engine: sa.Engine, m29: ModuleType, m32: ModuleType, m41: ModuleType
) -> None:
    at_0029(engine, m29)
    run(engine, m32.upgrade)
    insert_set(engine, "s1", "2024-08-17")
    run(engine, m41.upgrade)
    run(engine, m41.upgrade)
    with engine.begin() as connection:
        connection.execute(
            sa.text("UPDATE recording_collections SET event_month = NULL WHERE id = 's1'")
        )
    run(engine, m41.upgrade)  # a month the person left empty is not filled again
    with engine.connect() as connection:
        month = connection.execute(
            sa.text("SELECT event_month FROM recording_collections")
        ).scalar_one()
    assert month is None
    run(engine, m41.downgrade)
    inspector = sa.inspect(engine)
    columns = {c["name"] for c in inspector.get_columns("recording_collections")}
    assert not {"event_year", "event_month", "cover_version"} & columns
    assert {"starts_on", "ends_on", "title"} <= columns
    assert not inspector.has_table("recording_collection_covers")
    run(engine, m41.upgrade)  # and forward again
    assert sa.inspect(engine).has_table("recording_collection_covers")
