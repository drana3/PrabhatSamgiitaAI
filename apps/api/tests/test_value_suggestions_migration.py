"""Migration 0054 (the main instrument, the queue of words authors add): runs on SQLite with
Alembic's own operations. A real PostgreSQL is NOT covered here: check it on a copy of the
database before the deploy."""

from __future__ import annotations

import os
from collections.abc import Iterator
from types import ModuleType
from typing import cast

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://test:test@localhost/test")

import pytest
import sqlalchemy as sa
from alembic.config import Config
from alembic.script import ScriptDirectory
from test_recording_duplicates_migration import VERSIONS, load, run

from app.models import Base, Recording, RecordingCollection, UserAccount
from app.models.recordings import ValueSuggestion, ValueSuggestionUse

NEW_TABLES = {"value_suggestions", "value_suggestion_uses"}
NEW_COLUMNS = ("lead_instrument", "lead_instrument_other", "lead_instrument_checked")
MODELS = (ValueSuggestion, ValueSuggestionUse)


@pytest.fixture
def m54() -> ModuleType:
    return load("0054_lead_instrument_values")


@pytest.fixture
def engine() -> Iterator[sa.Engine]:
    """The database as it was before 0054: `recordings` without the three new columns."""
    engine = sa.create_engine("sqlite://", poolclass=sa.pool.StaticPool)
    base = [cast(sa.Table, m.__table__) for m in (UserAccount, RecordingCollection, Recording)]
    Base.metadata.create_all(engine, tables=base)
    with engine.begin() as conn:
        conn.execute(sa.text("DROP INDEX ix_recordings_lead_instrument"))
        for name in NEW_COLUMNS:
            conn.execute(sa.text(f"ALTER TABLE recordings DROP COLUMN {name}"))
    yield engine
    engine.dispose()


def columns(engine: sa.Engine) -> dict[str, dict]:
    return {c["name"]: c for c in sa.inspect(engine).get_columns("recordings")}


def test_0054_is_the_single_head_and_follows_0053() -> None:
    script = ScriptDirectory.from_config(Config(str(VERSIONS.parents[1] / "alembic.ini")))
    assert len(script.get_heads()) == 1
    revision = script.get_revision("0054_lead_instrument_values")
    assert revision is not None
    assert revision.down_revision == "0053_app_events_and_flags"


def test_upgrade_adds_the_columns_the_index_and_the_tables(
    engine: sa.Engine, m54: ModuleType
) -> None:
    run(engine, m54.upgrade)
    have = columns(engine)
    for name in NEW_COLUMNS:
        assert name in have
    assert have["lead_instrument"]["nullable"] is True
    assert have["lead_instrument_checked"]["nullable"] is False
    inspector = sa.inspect(engine)
    assert NEW_TABLES <= set(inspector.get_table_names())
    assert "ix_recordings_lead_instrument" in {
        i["name"] for i in inspector.get_indexes("recordings")
    }
    assert "uq_value_suggestions_word" in {
        u["name"] for u in inspector.get_unique_constraints("value_suggestions")
    }


def test_old_rows_stay_valid_and_the_checked_flag_starts_false(
    engine: sa.Engine, m54: ModuleType
) -> None:
    with engine.begin() as conn:
        conn.execute(
            sa.text(
                "INSERT INTO recordings (id, kind, type, title, author, added_by, by_author, "
                "status, audio_key, audio_url, audio_mime, audio_bytes, audio_sha256, plays, "
                "reports_count) VALUES ('00000000000000000000000000000001', 'kiirtan', 'other', "
                "'Old', 'x', 'x', 0, 'published', 'k', 'u', 'audio/mpeg', 1, 's', 0, 0)"
            )
        )
    run(engine, m54.upgrade)
    with engine.connect() as conn:
        row = conn.execute(
            sa.text(
                "SELECT lead_instrument, lead_instrument_other, "
                "lead_instrument_checked FROM recordings"
            )
        ).one()
    assert row[0] is None and row[1] is None and not row[2]


def test_upgrade_twice_is_harmless(engine: sa.Engine, m54: ModuleType) -> None:
    run(engine, m54.upgrade)
    run(engine, m54.upgrade)
    assert NEW_TABLES <= set(sa.inspect(engine).get_table_names())


def test_upgrade_on_a_database_the_app_already_filled_with_create_all(
    m54: ModuleType,
) -> None:
    engine = sa.create_engine("sqlite://", poolclass=sa.pool.StaticPool)
    Base.metadata.create_all(
        engine,
        tables=[
            cast(sa.Table, m.__table__)
            for m in (UserAccount, RecordingCollection, Recording, *MODELS)
        ],
    )
    run(engine, m54.upgrade)
    assert NEW_TABLES <= set(sa.inspect(engine).get_table_names())
    engine.dispose()


def test_the_tables_match_the_models(engine: sa.Engine, m54: ModuleType) -> None:
    run(engine, m54.upgrade)
    inspector = sa.inspect(engine)
    for model in MODELS:
        table = cast(sa.Table, model.__table__)
        built = {c["name"] for c in inspector.get_columns(table.name)}
        assert built == {c.name for c in table.columns}, table.name


def test_downgrade_drops_only_what_the_revision_added(engine: sa.Engine, m54: ModuleType) -> None:
    run(engine, m54.upgrade)
    run(engine, m54.downgrade)
    assert not (NEW_TABLES & set(sa.inspect(engine).get_table_names()))
    have = columns(engine)
    assert not any(name in have for name in NEW_COLUMNS)
    assert {"title", "kind", "style"} <= set(have)
