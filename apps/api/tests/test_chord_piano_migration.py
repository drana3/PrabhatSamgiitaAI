"""Migration 0063 (piano as a third instrument of a chord chart): SQLite with Alembic's own
operations. A real PostgreSQL is NOT covered here: check it on a copy of the database before the
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

OLD = [
    """CREATE TABLE recording_chord_sheets (
        id CHAR(32) PRIMARY KEY, instrument VARCHAR(12) NOT NULL,
        CONSTRAINT ck_recording_chord_sheets_instrument
            CHECK (instrument IN ('guitar', 'harmonium')))""",
    """CREATE TABLE song_chord_proposals (
        id CHAR(32) PRIMARY KEY, instrument VARCHAR(12) NOT NULL,
        CONSTRAINT ck_song_chord_proposals_instrument
            CHECK (instrument IN ('guitar', 'harmonium')))""",
    "INSERT INTO recording_chord_sheets (id, instrument) VALUES ('a', 'guitar')",
    "INSERT INTO song_chord_proposals (id, instrument) VALUES ('b', 'harmonium')",
]


@pytest.fixture
def m63() -> ModuleType:
    return load("0063_chord_piano_instrument")


@pytest.fixture
def engine() -> Iterator[sa.Engine]:
    engine = sa.create_engine("sqlite://", poolclass=sa.pool.StaticPool)
    with engine.begin() as connection:
        for statement in OLD:
            connection.execute(sa.text(statement))
    yield engine
    engine.dispose()


def add(engine: sa.Engine, table: str, instrument: str) -> None:
    with engine.begin() as connection:
        connection.execute(
            sa.text(f"INSERT INTO {table} (id, instrument) VALUES (:i, :n)"),  # noqa: S608
            {"i": instrument, "n": instrument},
        )


def test_0063_follows_0062_and_the_chain_has_one_head() -> None:
    script = ScriptDirectory.from_config(Config(str(VERSIONS.parents[1] / "alembic.ini")))
    assert len(script.get_heads()) == 1
    revision = script.get_revision("0063_chord_piano_instrument")
    assert revision is not None
    assert revision.down_revision == "0062_broadcast_duration_review_recordings"


def test_before_the_upgrade_a_piano_row_is_refused(engine: sa.Engine) -> None:
    with pytest.raises(sa.exc.IntegrityError):
        add(engine, "recording_chord_sheets", "piano")


def test_upgrade_lets_a_piano_in_and_keeps_old_rows(engine: sa.Engine, m63: ModuleType) -> None:
    run(engine, m63.upgrade)
    add(engine, "recording_chord_sheets", "piano")
    add(engine, "song_chord_proposals", "piano")
    with engine.connect() as connection:
        sheets = connection.execute(sa.text("SELECT instrument FROM recording_chord_sheets"))
        songs = connection.execute(sa.text("SELECT instrument FROM song_chord_proposals"))
        assert sorted(r[0] for r in sheets) == ["guitar", "piano"]
        assert sorted(r[0] for r in songs) == ["harmonium", "piano"]
    with pytest.raises(sa.exc.IntegrityError):
        add(engine, "recording_chord_sheets", "sitar")


def test_upgrade_twice_is_harmless(engine: sa.Engine, m63: ModuleType) -> None:
    run(engine, m63.upgrade)
    run(engine, m63.upgrade)
    add(engine, "song_chord_proposals", "piano")


def test_downgrade_refuses_while_a_piano_chart_exists(engine: sa.Engine, m63: ModuleType) -> None:
    run(engine, m63.upgrade)
    add(engine, "recording_chord_sheets", "piano")
    with pytest.raises(RuntimeError, match="piano"):
        run(engine, m63.downgrade)


def test_downgrade_puts_the_old_rule_back(engine: sa.Engine, m63: ModuleType) -> None:
    run(engine, m63.upgrade)
    run(engine, m63.downgrade)
    with pytest.raises(sa.exc.IntegrityError):
        add(engine, "song_chord_proposals", "piano")
