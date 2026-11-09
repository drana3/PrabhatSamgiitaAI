"""Migration 0061 (broadcasts): runs on SQLite with Alembic's own operations. A real PostgreSQL is
NOT covered here: check it on a copy of the database before the deploy."""

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

from app.models.broadcasts import Broadcast, BroadcastReport


@pytest.fixture
def m61() -> ModuleType:
    return load("0061_broadcasts")


@pytest.fixture
def engine() -> Iterator[sa.Engine]:
    engine = sa.create_engine("sqlite://", poolclass=sa.pool.StaticPool)
    yield engine
    engine.dispose()


def columns(engine: sa.Engine, table: str) -> set[str]:
    return {c["name"] for c in sa.inspect(engine).get_columns(table)}


def test_0061_follows_0060_and_the_chain_has_one_head() -> None:
    script = ScriptDirectory.from_config(Config(str(VERSIONS.parents[1] / "alembic.ini")))
    revision = script.get_revision("0061_broadcasts")
    assert revision is not None and revision.down_revision == "0060_language_word_suggestions"
    assert len(script.get_heads()) == 1


def test_upgrade_creates_the_tables_the_models_describe(engine: sa.Engine, m61: ModuleType) -> None:
    run(engine, m61.upgrade)
    assert columns(engine, "broadcasts") == {c.name for c in Broadcast.__table__.columns}
    assert columns(engine, "broadcast_reports") == {
        c.name for c in BroadcastReport.__table__.columns
    }


def test_upgrade_twice_changes_nothing_and_the_checks_hold(
    engine: sa.Engine, m61: ModuleType
) -> None:
    run(engine, m61.upgrade)
    run(engine, m61.upgrade)

    def row(provider: str, status: str = "published") -> None:
        with engine.begin() as conn:
            conn.execute(
                sa.text(
                    "INSERT INTO broadcasts (id, member_id, provider, url, host, title, "
                    "status, created_at, updated_at) VALUES ('b', 'm', :p, 'https://x.org/a', "
                    "'x.org', 'T', :s, '2026-11-09', '2026-11-09')"
                ),
                {"p": provider, "s": status},
            )

    row("zoom")
    with engine.begin() as conn:
        conn.execute(sa.text("DELETE FROM broadcasts"))
    with pytest.raises(sa.exc.IntegrityError):
        row("telegram")
    with pytest.raises(sa.exc.IntegrityError):
        row("zoom", "hidden")


def test_downgrade_drops_only_its_tables(engine: sa.Engine, m61: ModuleType) -> None:
    with engine.begin() as conn:
        conn.execute(sa.text("CREATE TABLE keep_me (id INTEGER PRIMARY KEY)"))
    run(engine, m61.upgrade)
    run(engine, m61.downgrade)
    tables = set(sa.inspect(engine).get_table_names())
    assert tables == {"keep_me"}
