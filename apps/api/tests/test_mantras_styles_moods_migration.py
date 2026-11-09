"""Migration 0064 (Other mantras, lists of styles and moods, three types of recording): runs on
SQLite with Alembic's own operations on small hand-made tables that carry the old rules. A real
PostgreSQL is NOT covered here: check it on a copy of the database before the deploy."""

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
def m64() -> ModuleType:
    return load("0064_mantras_styles_moods")


@pytest.fixture
def engine(m64: ModuleType) -> Iterator[sa.Engine]:
    engine = sa.create_engine("sqlite://", poolclass=sa.pool.StaticPool)
    with engine.begin() as conn:
        conn.execute(
            sa.text(
                f"""CREATE TABLE recordings (
    id CHAR(32) PRIMARY KEY,
    kind VARCHAR(24) NOT NULL,
    type VARCHAR(16) NOT NULL,
    recording_type VARCHAR(16),
    style VARCHAR(40),
    CONSTRAINT {m64.KIND_CHECK} CHECK ({m64.OLD_KIND}),
    CONSTRAINT {m64.TYPE_CHECK} CHECK ({m64.OLD_TYPE})
)"""
            )
        )
        conn.execute(
            sa.text(
                f"""CREATE TABLE value_suggestions (
    id CHAR(32) PRIMARY KEY,
    field VARCHAR(16) NOT NULL,
    key VARCHAR(80) NOT NULL,
    CONSTRAINT {m64.FIELD_CHECK} CHECK ({m64.OLD_FIELD})
)"""
            )
        )
    yield engine
    engine.dispose()


def add(engine: sa.Engine, kind: str, type_: str, recording_type: str | None = None) -> None:
    with engine.begin() as conn:
        conn.execute(
            sa.text(
                "INSERT INTO recordings (id, kind, type, recording_type, style) "
                "VALUES (:id, :kind, :type, :rt, 'folk')"
            ),
            {
                "id": f"{kind}-{type_}-{recording_type}",
                "kind": kind,
                "type": type_,
                "rt": recording_type,
            },
        )


def suggest(engine: sa.Engine, field: str) -> None:
    with engine.begin() as conn:
        conn.execute(
            sa.text("INSERT INTO value_suggestions (id, field, key) VALUES (:id, :f, 'x')"),
            {"id": field, "f": field},
        )


def columns(engine: sa.Engine) -> set[str]:
    return {c["name"] for c in sa.inspect(engine).get_columns("recordings")}


def test_0064_is_in_the_one_chain(m64: ModuleType) -> None:
    script = ScriptDirectory.from_config(Config(str(VERSIONS.parents[1] / "alembic.ini")))
    assert len(script.get_heads()) == 1
    revision = script.get_revision("0064_mantras_styles_moods")
    assert revision is not None and revision.down_revision == "0063_chord_piano_instrument"


def test_upgrade_adds_columns_kind_types_mood_word_and_maps_home(
    engine: sa.Engine, m64: ModuleType
) -> None:
    with pytest.raises(sa.exc.IntegrityError):
        add(engine, "other_mantra", "guru_puja")
    add(engine, "kiirtan", "bnk", "home")
    add(engine, "kiirtan", "other", "live")
    run(engine, m64.upgrade)
    assert set(m64.NEW_COLUMNS) <= columns(engine)
    add(engine, "other_mantra", "guru_puja")
    add(engine, "other_mantra", "pitriyajina")
    add(engine, "other_mantra", "other")
    with pytest.raises(sa.exc.IntegrityError):
        add(engine, "other_mantra", "bnk")
    suggest(engine, "mood")
    with engine.begin() as conn:
        rows = dict(conn.execute(sa.text("SELECT id, recording_type FROM recordings")).all())
        old_style = conn.execute(sa.text("SELECT style FROM recordings LIMIT 1")).scalar()
    assert rows["kiirtan-bnk-home"] == "studio"
    assert "home" not in rows.values()
    assert rows["kiirtan-other-live"] == "live"
    assert old_style == "folk"  # an old style stays on its row


def test_upgrade_twice_is_harmless(engine: sa.Engine, m64: ModuleType) -> None:
    run(engine, m64.upgrade)
    run(engine, m64.upgrade)
    add(engine, "other_mantra", "guru_puja")


def test_downgrade_refuses_while_a_mantra_or_a_mood_word_exists(
    engine: sa.Engine, m64: ModuleType
) -> None:
    run(engine, m64.upgrade)
    add(engine, "other_mantra", "guru_puja")
    with pytest.raises(RuntimeError, match="Other mantras"):
        run(engine, m64.downgrade)
    with engine.begin() as conn:
        conn.execute(sa.text("DELETE FROM recordings"))
    suggest(engine, "mood")
    with pytest.raises(RuntimeError, match="mood word"):
        run(engine, m64.downgrade)
    with engine.begin() as conn:
        conn.execute(sa.text("DELETE FROM value_suggestions"))
    run(engine, m64.downgrade)
    assert not set(m64.NEW_COLUMNS) & columns(engine)
    with pytest.raises(sa.exc.IntegrityError):
        add(engine, "other_mantra", "guru_puja")
    with pytest.raises(sa.exc.IntegrityError):
        suggest(engine, "mood")
