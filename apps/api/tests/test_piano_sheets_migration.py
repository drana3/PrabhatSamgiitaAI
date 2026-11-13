"""Migration 0050 (piano sheets): runs on SQLite with Alembic's own operations. A real PostgreSQL
is NOT covered here: check it on a copy of the database before the deploy."""

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

BEFORE = [
    "CREATE TABLE user_accounts (id CHAR(32) PRIMARY KEY)",
    "CREATE TABLE recordings (id CHAR(32) PRIMARY KEY)",
]
TABLES = {"piano_sheets", "piano_sheet_reports"}


@pytest.fixture
def m50() -> ModuleType:
    return load("0050_piano_sheets")


@pytest.fixture
def engine() -> Iterator[sa.Engine]:
    engine = sa.create_engine("sqlite://", poolclass=sa.pool.StaticPool)
    with engine.begin() as connection:
        for statement in BEFORE:
            connection.execute(sa.text(statement))
    yield engine
    engine.dispose()


def tables(engine: sa.Engine) -> set[str]:
    return set(sa.inspect(engine).get_table_names())


def test_0050_follows_0049_and_the_chain_has_one_head() -> None:
    script = ScriptDirectory.from_config(Config(str(VERSIONS.parents[1] / "alembic.ini")))
    assert len(script.get_heads()) == 1
    revision = script.get_revision("0050_piano_sheets")
    assert revision is not None
    assert revision.down_revision == "0049_kiirtan_cycle_video_status"


def test_upgrade_creates_the_tables_with_their_indexes(engine: sa.Engine, m50: ModuleType) -> None:
    run(engine, m50.upgrade)
    assert TABLES <= tables(engine)
    inspector = sa.inspect(engine)
    names = {i["name"] for i in inspector.get_indexes("piano_sheets")}
    assert {"ix_piano_sheets_target_status", "ix_piano_sheets_status_created"} <= names
    columns = {c["name"] for c in inspector.get_columns("piano_sheets")}
    assert {"target_key", "score", "sa_key", "level", "replaces_id", "based_on_id"} <= columns


def test_the_tables_take_rows_and_keep_their_rules(engine: sa.Engine, m50: ModuleType) -> None:
    run(engine, m50.upgrade)
    with engine.begin() as connection:
        connection.execute(sa.text("INSERT INTO user_accounts (id) VALUES ('m')"))
        connection.execute(
            sa.text(
                "INSERT INTO piano_sheets (id, song_id, target_key, member_id, score)"
                " VALUES ('s', 7, 'song:7', 'm', '{}')"
            )
        )
        row = connection.execute(
            sa.text("SELECT status, level, sa_key, steps_count FROM piano_sheets")
        ).one()
    assert tuple(row) == ("pending", "one_finger", "C", 0)
    with pytest.raises(sa.exc.IntegrityError), engine.begin() as connection:
        connection.execute(
            sa.text(
                "INSERT INTO piano_sheets (id, target_key, member_id, score)"
                " VALUES ('t', 'x', 'm', '{}')"
            )
        )


def test_upgrade_twice_is_harmless(engine: sa.Engine, m50: ModuleType) -> None:
    run(engine, m50.upgrade)
    run(engine, m50.upgrade)
    assert TABLES <= tables(engine)


def test_downgrade_drops_only_its_tables(engine: sa.Engine, m50: ModuleType) -> None:
    run(engine, m50.upgrade)
    run(engine, m50.downgrade)
    assert not TABLES & tables(engine)
    assert {"user_accounts", "recordings"} <= tables(engine)
