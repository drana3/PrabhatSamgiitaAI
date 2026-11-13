"""Migration 0060 (a written language goes to the same team queue): runs on SQLite with Alembic's
own operations. A real PostgreSQL is NOT covered here: check it on a copy of the database before
the deploy."""

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

OLD_TABLE = """CREATE TABLE value_suggestions (
    id CHAR(32) PRIMARY KEY,
    field VARCHAR(16) NOT NULL,
    key VARCHAR(80) NOT NULL,
    label VARCHAR(80) NOT NULL,
    status VARCHAR(12) NOT NULL DEFAULT 'pending',
    CONSTRAINT uq_value_suggestions_word UNIQUE (field, key),
    CONSTRAINT ck_value_suggestions_field CHECK (field IN ('instrument', 'style')),
    CONSTRAINT ck_value_suggestions_status CHECK (
        status IN ('pending', 'accepted', 'merged', 'rejected'))
)"""


@pytest.fixture
def m60() -> ModuleType:
    return load("0060_language_word_suggestions")


@pytest.fixture
def engine() -> Iterator[sa.Engine]:
    engine = sa.create_engine("sqlite://", poolclass=sa.pool.StaticPool)
    with engine.begin() as conn:
        conn.execute(sa.text(OLD_TABLE))
    yield engine
    engine.dispose()


def add(engine: sa.Engine, field: str, key: str = "pali") -> None:
    with engine.begin() as conn:
        conn.execute(
            sa.text(
                "INSERT INTO value_suggestions (id, field, key, label) "
                "VALUES (:id, :field, :key, :key)"
            ),
            {"id": f"{field}-{key}", "field": field, "key": key},
        )


def test_0060_is_the_single_head_and_follows_0059() -> None:
    script = ScriptDirectory.from_config(Config(str(VERSIONS.parents[1] / "alembic.ini")))
    revision = script.get_revision("0060_language_word_suggestions")
    assert revision is not None and revision.down_revision == "0059_recording_moods"
    assert len(script.get_heads()) == 1


def test_a_language_word_is_refused_before_and_accepted_after(
    engine: sa.Engine, m60: ModuleType
) -> None:
    with pytest.raises(sa.exc.IntegrityError):
        add(engine, "language")
    run(engine, m60.upgrade)
    add(engine, "language")
    add(engine, "style", "baul")  # the others still work
    with pytest.raises(sa.exc.IntegrityError):
        add(engine, "colour")


def test_upgrade_twice_is_harmless(engine: sa.Engine, m60: ModuleType) -> None:
    run(engine, m60.upgrade)
    run(engine, m60.upgrade)
    add(engine, "language")


def test_downgrade_refuses_while_a_language_word_waits(engine: sa.Engine, m60: ModuleType) -> None:
    run(engine, m60.upgrade)
    add(engine, "language")
    with pytest.raises(RuntimeError, match="language word"):
        run(engine, m60.downgrade)
    with engine.begin() as conn:
        conn.execute(sa.text("DELETE FROM value_suggestions WHERE field = 'language'"))
    run(engine, m60.downgrade)
    with pytest.raises(sa.exc.IntegrityError):
        add(engine, "language")
