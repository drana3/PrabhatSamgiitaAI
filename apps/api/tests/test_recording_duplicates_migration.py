"""Migration 0029 (mantra groups, unique file hash, remembered confirmations).

Run on SQLite with Alembic's own operations. What a real PostgreSQL does is NOT covered here:
that has to be checked on a copy of the database before the deploy (docs/kiirtan-publishing.md).
"""

from __future__ import annotations

import importlib.util
import os
from collections.abc import Iterator
from pathlib import Path
from types import ModuleType
from uuid import uuid4

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://test:test@localhost/test")

import pytest
import sqlalchemy as sa
from alembic.config import Config
from alembic.migration import MigrationContext
from alembic.operations import Operations
from alembic.script import ScriptDirectory

from app.models import Base
from app.services.mantras import mantra_key

VERSIONS = Path(__file__).resolve().parents[1] / "alembic" / "versions"

OLD_SCHEMA = [
    "CREATE TABLE user_accounts (id CHAR(32) PRIMARY KEY)",
    """CREATE TABLE recordings (
        id CHAR(32) PRIMARY KEY,
        kind VARCHAR(16) NOT NULL DEFAULT 'kiirtan',
        title VARCHAR(200) NOT NULL,
        status VARCHAR(16) NOT NULL DEFAULT 'published',
        audio_sha256 VARCHAR(64) NOT NULL,
        duplicate_of CHAR(32) REFERENCES recordings (id) ON DELETE SET NULL
    )""",
    "CREATE INDEX ix_recordings_audio_sha256 ON recordings (audio_sha256)",
    """CREATE TABLE recording_reports (
        id CHAR(32) PRIMARY KEY,
        recording_id CHAR(32) NOT NULL REFERENCES recordings (id) ON DELETE CASCADE,
        reporter_key VARCHAR(80) NOT NULL,
        reason VARCHAR(16) NOT NULL,
        CONSTRAINT ck_recording_reports_reason
            CHECK (reason IN ('copyright', 'offensive', 'wrong_info', 'other'))
    )""",
]


def load(name: str) -> ModuleType:
    spec = importlib.util.spec_from_file_location(name, VERSIONS / f"{name}.py")
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture
def migration() -> ModuleType:
    return load("0029_recording_duplicates")


@pytest.fixture
def engine() -> Iterator[sa.Engine]:
    engine = sa.create_engine("sqlite://", poolclass=sa.pool.StaticPool)
    yield engine
    engine.dispose()


def run(engine: sa.Engine, step: object) -> None:
    with engine.begin() as connection:
        with Operations.context(MigrationContext.configure(connection)):
            step()  # type: ignore[operator]


def old_database(engine: sa.Engine) -> None:
    with engine.begin() as connection:
        for statement in OLD_SCHEMA:
            connection.execute(sa.text(statement))


def add(engine: sa.Engine, title: str, *, kind: str = "kiirtan", sha: str | None = None) -> str:
    ident = uuid4().hex
    with engine.begin() as connection:
        connection.execute(
            sa.text(
                "INSERT INTO recordings (id, kind, title, audio_sha256) VALUES (:i, :k, :t, :s)"
            ),
            {"i": ident, "k": kind, "t": title, "s": sha or uuid4().hex + uuid4().hex},
        )
    return ident


def test_the_chain_ends_in_0029_after_0028(migration: ModuleType) -> None:
    script = ScriptDirectory.from_config(Config(str(VERSIONS.parents[1] / "alembic.ini")))
    assert script.get_heads() == ["0029_recording_duplicates"]
    revision = script.get_revision("0029_recording_duplicates")
    assert revision is not None and revision.down_revision == "0028_learn_progress"
    assert migration.revision == "0029_recording_duplicates"


def test_the_frozen_key_rule_equals_the_service_rule(migration: ModuleType) -> None:
    for text in [
        "Baba Nam Kevalam",
        "Bábá Nám Kevalam",
        "baba-nam-kevalam",
        "Śrī Kṛṣṇa",
        "बाबा नाम केवलम्",
        "Баба Нам Кевалам",
        "  !!  ",
        "x" * 300,
        "",
    ]:
        assert migration._key(text) == mantra_key(text)


def test_upgrade_adds_everything_and_fills_the_groups(
    engine: sa.Engine, migration: ModuleType
) -> None:
    old_database(engine)
    a = add(engine, "Baba Nam Kevalam")
    b = add(engine, "Bábá Nám Kevalam")
    c = add(engine, "baba-nam-kevalam")
    d = add(engine, "Baba Nam Kevalam", kind="bhajan")
    e = add(engine, "Hari Om")
    f = add(engine, "  ...  ")
    run(engine, migration.upgrade)

    inspector = sa.inspect(engine)
    columns = {c["name"] for c in inspector.get_columns("recordings")}
    assert {"mantra_title", "mantra_group_id", "year", "removed_duplicate_of"} <= columns
    assert inspector.has_table("mantra_groups") and inspector.has_table(
        "recording_similar_confirms"
    )
    indexes = {i["name"]: bool(i["unique"]) for i in inspector.get_indexes("recordings")}
    assert indexes["ix_recordings_audio_sha256"] is True
    assert "ix_recordings_mantra_group_id" in indexes

    with engine.connect() as connection:
        groups = connection.execute(
            sa.text("SELECT kind, key, title FROM mantra_groups ORDER BY key, kind")
        ).all()
        assert [(g.kind, g.key) for g in groups] == [
            ("bhajan", "babanamkevalam"),
            ("kiirtan", "babanamkevalam"),
            ("kiirtan", "hariom"),
        ]
        rows = {
            r.id: (r.mantra_group_id, r.mantra_title)
            for r in connection.execute(
                sa.text("SELECT id, mantra_group_id, mantra_title FROM recordings")
            )
        }
    assert rows[a][0] == rows[b][0] == rows[c][0] is not None
    assert rows[d][0] not in (None, rows[a][0]) and rows[e][0] not in (None, rows[a][0])
    assert rows[f] == (None, None)
    assert rows[a][1] == "Baba Nam Kevalam" and rows[b][1] == "Bábá Nám Kevalam"


def test_the_file_hash_is_unique_afterwards_and_duplicate_is_a_report_reason(
    engine: sa.Engine, migration: ModuleType
) -> None:
    old_database(engine)
    ident = add(engine, "One", sha="a" * 64)
    run(engine, migration.upgrade)
    with pytest.raises(sa.exc.IntegrityError), engine.begin() as connection:
        connection.execute(
            sa.text("INSERT INTO recordings (id, title, audio_sha256) VALUES (:i, 'Two', :s)"),
            {"i": uuid4().hex, "s": "a" * 64},
        )

    def report(reason: str) -> None:
        with engine.begin() as connection:
            connection.execute(
                sa.text(
                    "INSERT INTO recording_reports (id, recording_id, reporter_key, reason) "
                    "VALUES (:i, :r, :k, :x)"
                ),
                {"i": uuid4().hex, "r": ident, "k": uuid4().hex[:20], "x": reason},
            )

    report("duplicate")
    report("copyright")
    with pytest.raises(sa.exc.IntegrityError):
        report("spam")


def test_running_twice_changes_nothing(engine: sa.Engine, migration: ModuleType) -> None:
    old_database(engine)
    add(engine, "Baba Nam Kevalam")
    add(engine, "Hari Om")
    run(engine, migration.upgrade)
    with engine.connect() as connection:
        before = connection.execute(sa.text("SELECT id, key FROM mantra_groups ORDER BY id")).all()
    run(engine, migration.upgrade)
    with engine.connect() as connection:
        after = connection.execute(sa.text("SELECT id, key FROM mantra_groups ORDER BY id")).all()
    assert before == after and len(after) == 2


def test_on_a_database_that_the_app_already_built_it_is_a_no_op(
    engine: sa.Engine, migration: ModuleType
) -> None:
    """0027 and `create_all` build the tables from the CURRENT models, new columns included."""
    tables = [
        Base.metadata.tables[name]
        for name in (
            "user_accounts",
            "mantra_groups",
            "recordings",
            "recording_reports",
            "recording_similar_confirms",
        )
    ]
    Base.metadata.create_all(engine, tables=tables)
    run(engine, migration.upgrade)
    run(engine, migration.upgrade)
    inspector = sa.inspect(engine)
    assert {i["name"]: bool(i["unique"]) for i in inspector.get_indexes("recordings")}[
        "ix_recordings_audio_sha256"
    ] is True


def test_migration_0027_now_creates_the_groups_table_first(
    engine: sa.Engine, migration: ModuleType
) -> None:
    first = load("0027_recordings")
    assert first.TABLES[0].__tablename__ == "mantra_groups"
    run(engine, first.upgrade)
    inspector = sa.inspect(engine)
    assert inspector.has_table("mantra_groups") and inspector.has_table("recordings")
    run(engine, migration.upgrade)  # nothing left to do, and no error
    assert sa.inspect(engine).has_table("recording_similar_confirms")


def test_it_stops_with_a_clear_message_when_the_same_file_is_stored_twice(
    engine: sa.Engine, migration: ModuleType
) -> None:
    old_database(engine)
    add(engine, "One", sha="b" * 64)
    add(engine, "Two", sha="b" * 64)
    with pytest.raises(RuntimeError, match="stored more than once"):
        run(engine, migration.upgrade)


def test_downgrade_puts_the_old_shape_back(engine: sa.Engine, migration: ModuleType) -> None:
    old_database(engine)
    ident = add(engine, "One")
    run(engine, migration.upgrade)
    with engine.begin() as connection:
        connection.execute(
            sa.text(
                "INSERT INTO recording_reports (id, recording_id, reporter_key, reason) "
                "VALUES (:i, :r, 'k', 'duplicate')"
            ),
            {"i": uuid4().hex, "r": ident},
        )
    run(engine, migration.downgrade)
    inspector = sa.inspect(engine)
    assert not inspector.has_table("mantra_groups")
    assert not inspector.has_table("recording_similar_confirms")
    columns = {c["name"] for c in inspector.get_columns("recordings")}
    assert not columns & {"mantra_title", "mantra_group_id", "year", "removed_duplicate_of"}
    assert {i["name"]: bool(i["unique"]) for i in inspector.get_indexes("recordings")}[
        "ix_recordings_audio_sha256"
    ] is False
    with engine.connect() as connection:
        reasons = (
            connection.execute(sa.text("SELECT reason FROM recording_reports")).scalars().all()
        )
    assert reasons == ["other"]
