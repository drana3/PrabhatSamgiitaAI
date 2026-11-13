"""Migration 0067 (Others: the required choice and the name under "Something else"): runs on SQLite
with Alembic's own operations on small hand-made tables that carry the old rules. A real PostgreSQL
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


@pytest.fixture
def m67() -> ModuleType:
    return load("0067_others_choice")


@pytest.fixture
def engine(m67: ModuleType) -> Iterator[sa.Engine]:
    engine = sa.create_engine("sqlite://", poolclass=sa.pool.StaticPool)
    with engine.begin() as conn:
        conn.execute(
            sa.text(
                f"""CREATE TABLE recordings (
    id CHAR(32) PRIMARY KEY,
    kind VARCHAR(24) NOT NULL,
    type VARCHAR(16) NOT NULL,
    CONSTRAINT {m67.TYPE_CHECK} CHECK ({m67.OLD_TYPE})
)"""
            )
        )
        conn.execute(
            sa.text(
                f"""CREATE TABLE value_suggestions (
    id CHAR(32) PRIMARY KEY,
    field VARCHAR(16) NOT NULL,
    key VARCHAR(80) NOT NULL,
    CONSTRAINT {m67.FIELD_CHECK} CHECK ({m67.OLD_FIELD})
)"""
            )
        )
    yield engine
    engine.dispose()


def add(engine: sa.Engine, kind: str, type_: str) -> None:
    with engine.begin() as conn:
        conn.execute(
            sa.text("INSERT INTO recordings (id, kind, type) VALUES (:id, :kind, :type)"),
            {"id": f"{kind}-{type_}", "kind": kind, "type": type_},
        )


def suggest(engine: sa.Engine, field: str) -> None:
    with engine.begin() as conn:
        conn.execute(
            sa.text("INSERT INTO value_suggestions (id, field, key) VALUES (:id, :f, 'x')"),
            {"id": field, "f": field},
        )


def columns(engine: sa.Engine) -> set[str]:
    return {c["name"] for c in sa.inspect(engine).get_columns("recordings")}


def test_0067_follows_0066_in_the_one_chain() -> None:
    script = ScriptDirectory.from_config(Config(str(VERSIONS.parents[1] / "alembic.ini")))
    assert len(script.get_heads()) == 1
    revision = script.get_revision("0067_others_choice")
    assert revision is not None and revision.down_revision == "0066_own_words_checked"


def test_upgrade_widens_the_types_adds_the_columns_and_keeps_old_rows(
    engine: sa.Engine, m67: ModuleType
) -> None:
    add(engine, "other_mantra", "guru_puja")
    add(engine, "other_mantra", "pitriyajina")
    add(engine, "other_mantra", "other")
    with pytest.raises(sa.exc.IntegrityError):
        add(engine, "other_mantra", "shlokas")
    with pytest.raises(sa.exc.IntegrityError):
        suggest(engine, "mantra")
    run(engine, m67.upgrade)
    assert {"type_other", "type_other_checked"} <= columns(engine)
    for new in ("samgacchadhvam", "nityam_shuddham", "ananda_sutram", "shlokas"):
        add(engine, "other_mantra", new)
    with pytest.raises(sa.exc.IntegrityError):
        add(engine, "other_mantra", "bnk")
    with pytest.raises(sa.exc.IntegrityError):
        add(engine, "kiirtan", "shlokas")
    suggest(engine, "mantra")
    with engine.begin() as conn:
        old = conn.execute(
            sa.text("SELECT type, type_other, type_other_checked FROM recordings WHERE id = :i"),
            {"i": "other_mantra-pitriyajina"},
        ).one()
    assert tuple(old) == ("pitriyajina", None, 0)  # nothing rewritten, not checked


def test_upgrade_twice_is_harmless(engine: sa.Engine, m67: ModuleType) -> None:
    run(engine, m67.upgrade)
    run(engine, m67.upgrade)
    add(engine, "other_mantra", "shlokas")


def test_downgrade_refuses_while_a_new_type_or_a_word_exists(
    engine: sa.Engine, m67: ModuleType
) -> None:
    run(engine, m67.upgrade)
    add(engine, "other_mantra", "shlokas")
    with pytest.raises(RuntimeError, match="does not know"):
        run(engine, m67.downgrade)
    with engine.begin() as conn:
        conn.execute(sa.text("DELETE FROM recordings"))
    suggest(engine, "mantra")
    with pytest.raises(RuntimeError, match="queue"):
        run(engine, m67.downgrade)
    with engine.begin() as conn:
        conn.execute(sa.text("DELETE FROM value_suggestions"))
    add(engine, "other_mantra", "guru_puja")
    run(engine, m67.downgrade)
    assert not {"type_other", "type_other_checked"} & columns(engine)
    with pytest.raises(sa.exc.IntegrityError):
        add(engine, "other_mantra", "shlokas")
