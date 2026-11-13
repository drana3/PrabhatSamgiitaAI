"""Migration 0047 (charts on recording chord sheets): runs on SQLite with Alembic's own
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

NEW = {"chart", "capo", "strum", "replaces_id", "archived_at", "based_on_id"}

OLD_TABLE = """
CREATE TABLE recording_chord_sheets (
    id CHAR(32) PRIMARY KEY,
    recording_id CHAR(32) NOT NULL,
    member_id CHAR(32) NOT NULL,
    instrument VARCHAR(12) NOT NULL,
    chart_key VARCHAR(3),
    body TEXT NOT NULL,
    chords_count INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(12) NOT NULL DEFAULT 'pending'
)
"""


@pytest.fixture
def m47() -> ModuleType:
    return load("0047_recording_chord_charts")


@pytest.fixture
def engine() -> Iterator[sa.Engine]:
    engine = sa.create_engine("sqlite://", poolclass=sa.pool.StaticPool)
    with engine.begin() as connection:
        connection.execute(sa.text(OLD_TABLE))
        connection.execute(
            sa.text(
                "INSERT INTO recording_chord_sheets (id, recording_id, member_id, instrument, body)"
                " VALUES ('a', 'r', 'm', 'guitar', 'Am G')"
            )
        )
    yield engine
    engine.dispose()


def columns(engine: sa.Engine) -> set[str]:
    return {c["name"] for c in sa.inspect(engine).get_columns("recording_chord_sheets")}


def test_0047_follows_0046_and_the_chain_has_one_head() -> None:
    script = ScriptDirectory.from_config(Config(str(VERSIONS.parents[1] / "alembic.ini")))
    assert len(script.get_heads()) == 1
    revision = script.get_revision("0047_recording_chord_charts")
    assert revision is not None
    assert revision.down_revision == "0046_recording_info"


def test_upgrade_adds_the_columns_and_keeps_the_old_rows(
    engine: sa.Engine, m47: ModuleType
) -> None:
    run(engine, m47.upgrade)
    assert NEW <= columns(engine)
    with engine.connect() as connection:
        row = connection.execute(
            sa.text("SELECT body, chart, capo, strum, archived_at FROM recording_chord_sheets")
        ).one()
    assert tuple(row) == ("Am G", None, 0, None, None)


def test_upgrade_twice_is_harmless(engine: sa.Engine, m47: ModuleType) -> None:
    run(engine, m47.upgrade)
    run(engine, m47.upgrade)
    assert NEW <= columns(engine)


def test_downgrade_drops_only_its_columns(engine: sa.Engine, m47: ModuleType) -> None:
    run(engine, m47.upgrade)
    run(engine, m47.downgrade)
    assert not NEW & columns(engine)
    assert {"id", "body", "chart_key", "status"} <= columns(engine)
