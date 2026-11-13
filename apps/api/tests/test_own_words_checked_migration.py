"""Migration 0066 (own style and mood words shown to others only once accepted): runs on SQLite
with Alembic's own operations on a small hand-made table. A real PostgreSQL is NOT covered here:
check it on a copy of the database before the deploy."""

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


@pytest.fixture
def m66() -> ModuleType:
    return load("0066_own_words_checked")


@pytest.fixture
def engine() -> Iterator[sa.Engine]:
    engine = sa.create_engine("sqlite://", poolclass=sa.pool.StaticPool)
    with engine.begin() as conn:
        conn.execute(
            sa.text(
                "CREATE TABLE recordings (id CHAR(32) PRIMARY KEY, styles JSON, styles_other JSON)"
            )
        )
        conn.execute(sa.text("""INSERT INTO recordings VALUES ('r1', '["indian"]', '["Mine"]')"""))
    yield engine
    engine.dispose()


def columns(engine: sa.Engine) -> set[str]:
    return {c["name"] for c in sa.inspect(engine).get_columns("recordings")}


def test_0066_is_in_the_one_chain() -> None:
    script = ScriptDirectory.from_config(Config(str(VERSIONS.parents[1] / "alembic.ini")))
    assert len(script.get_heads()) == 1
    revision = script.get_revision("0066_own_words_checked")
    assert (
        revision is not None and revision.down_revision == "0065_comments_survive_account_deletion"
    )


def test_upgrade_adds_the_two_columns_and_keeps_the_rows(
    engine: sa.Engine, m66: ModuleType
) -> None:
    run(engine, m66.upgrade)
    assert set(m66.COLUMNS) <= columns(engine)
    with engine.begin() as conn:
        row = conn.execute(
            sa.text("SELECT styles_other, styles_other_ok, moods_other_ok FROM recordings")
        ).one()
    assert "Mine" in str(row[0])
    assert row[1] is None and row[2] is None  # nothing is public until the team accepts it


def test_upgrade_twice_is_harmless(engine: sa.Engine, m66: ModuleType) -> None:
    run(engine, m66.upgrade)
    run(engine, m66.upgrade)
    assert set(m66.COLUMNS) <= columns(engine)


def test_downgrade_drops_the_columns_and_nothing_else(engine: sa.Engine, m66: ModuleType) -> None:
    run(engine, m66.upgrade)
    run(engine, m66.downgrade)
    assert not set(m66.COLUMNS) & columns(engine)
    assert {"id", "styles", "styles_other"} <= columns(engine)
    run(engine, m66.downgrade)  # twice is harmless too
