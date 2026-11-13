"""Migration 0044 (Avarta Kiirtan flag, an event playlist that needs no date).

SQLite with Alembic's own operations, starting from the schema 0041 leaves. A real PostgreSQL is
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
from test_set_event_cover_migration import insert_set


@pytest.fixture
def engine() -> Iterator[sa.Engine]:
    engine = sa.create_engine("sqlite://", poolclass=sa.pool.StaticPool)
    yield engine
    engine.dispose()


@pytest.fixture
def m44() -> ModuleType:
    return load("0044_practice_and_optional_set_date")


def at_0041(engine: sa.Engine) -> None:
    at_0029(engine, load("0029_recording_duplicates"))
    run(engine, load("0032_recording_sets_and_categories").upgrade)
    run(engine, load("0041_set_event_month_cover").upgrade)


def test_0044_follows_0043_in_the_one_chain(m44: ModuleType) -> None:
    script = ScriptDirectory.from_config(Config(str(VERSIONS.parents[1] / "alembic.ini")))
    assert len(script.get_heads()) == 1
    revision = script.get_revision("0044_practice_and_optional_set_date")
    assert revision is not None and revision.down_revision == "0043_song_chord_versions"


def test_upgrade_adds_the_flag_and_lets_a_set_have_no_date(
    engine: sa.Engine, m44: ModuleType
) -> None:
    at_0041(engine)
    insert_set(engine, "s1", "2024-08-17")
    run(engine, m44.upgrade)
    inspector = sa.inspect(engine)
    assert "practice" in {c["name"] for c in inspector.get_columns("recordings")}
    starts = next(
        c for c in inspector.get_columns("recording_collections") if c["name"] == "starts_on"
    )
    assert starts["nullable"] is True
    insert_set(engine, "s2", "2000-01-01")
    with engine.begin() as connection:
        connection.execute(
            sa.text("UPDATE recording_collections SET starts_on = NULL WHERE id = 's2'")
        )
        kept = connection.execute(
            sa.text("SELECT starts_on FROM recording_collections WHERE id = 's1'")
        ).scalar_one()
    assert str(kept).startswith("2024-08-17")  # an existing date is kept


def test_running_twice_changes_nothing_and_downgrade_restores_the_old_shape(
    engine: sa.Engine, m44: ModuleType
) -> None:
    at_0041(engine)
    run(engine, m44.upgrade)
    run(engine, m44.upgrade)
    insert_set(engine, "s1", "2024-08-17")
    with engine.begin() as connection:
        connection.execute(sa.text("UPDATE recording_collections SET starts_on = NULL"))
    run(engine, m44.downgrade)
    inspector = sa.inspect(engine)
    assert "practice" not in {c["name"] for c in inspector.get_columns("recordings")}
    starts = next(
        c for c in inspector.get_columns("recording_collections") if c["name"] == "starts_on"
    )
    assert starts["nullable"] is False
    with engine.connect() as connection:
        filled = connection.execute(
            sa.text("SELECT starts_on FROM recording_collections")
        ).scalar_one()
    assert filled is not None  # an empty date got the creation day
    run(engine, m44.upgrade)  # and forward again
