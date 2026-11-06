"""Migration 0029 (four categories, new fields, unique file hash, remembered confirmations).

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

VERSIONS = Path(__file__).resolve().parents[1] / "alembic" / "versions"

OLD_SCHEMA = [
    "CREATE TABLE user_accounts (id CHAR(32) PRIMARY KEY)",
    """CREATE TABLE recordings (
        id CHAR(32) PRIMARY KEY,
        kind VARCHAR(16) NOT NULL DEFAULT 'kiirtan',
        type VARCHAR(16) NOT NULL DEFAULT 'other',
        title VARCHAR(200) NOT NULL,
        status VARCHAR(16) NOT NULL DEFAULT 'published',
        audio_sha256 VARCHAR(64) NOT NULL,
        duplicate_of CHAR(32) REFERENCES recordings (id) ON DELETE SET NULL,
        CONSTRAINT ck_recordings_kind CHECK (kind IN ('kiirtan', 'bhajan')),
        CONSTRAINT ck_recordings_type_for_kind CHECK (
            (kind = 'kiirtan' AND type IN ('bnk', 'lila', 'festival', 'other')) OR
            (kind = 'bhajan' AND type IN ('morning', 'evening', 'devotional', 'other'))
        )
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


DRAFT_MANTRAS = [
    "CREATE TABLE mantra_groups (id CHAR(32) PRIMARY KEY, kind VARCHAR(16), key VARCHAR(200))",
    "ALTER TABLE recordings ADD COLUMN mantra_title VARCHAR(200)",
    "ALTER TABLE recordings ADD COLUMN mantra_group_id CHAR(32) REFERENCES mantra_groups (id)",
    "CREATE INDEX ix_recordings_mantra_group_id ON recordings (mantra_group_id)",
]


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


def insert_kind(engine: sa.Engine, kind: str, **extra: object) -> None:
    values = {
        "id": uuid4().hex,
        "kind": kind,
        "type": "other",
        "title": "T",
        "audio_sha256": uuid4().hex + uuid4().hex,
    } | extra
    columns = ", ".join(values)
    marks = ", ".join(f":{name}" for name in values)
    with engine.begin() as connection:
        connection.execute(sa.text(f"INSERT INTO recordings ({columns}) VALUES ({marks})"), values)


def test_upgrade_adds_the_new_columns_index_and_tables(
    engine: sa.Engine, migration: ModuleType
) -> None:
    old_database(engine)
    kept = add(engine, "Baba Nam Kevalam")
    run(engine, migration.upgrade)

    inspector = sa.inspect(engine)
    columns = {c["name"] for c in inspector.get_columns("recordings")}
    assert {
        "year",
        "language",
        "credits",
        "notes",
        "ps_song_number",
        "removed_duplicate_of",
    } <= columns
    assert not columns & {"mantra_title", "mantra_group_id"}
    assert not inspector.has_table("mantra_groups")
    assert inspector.has_table("recording_similar_confirms")
    indexes = {i["name"]: bool(i["unique"]) for i in inspector.get_indexes("recordings")}
    assert indexes["ix_recordings_audio_sha256"] is True
    assert "ix_recordings_ps_song_number" in indexes
    with engine.connect() as connection:  # the old row is untouched
        row = connection.execute(
            sa.text("SELECT title, kind, language, ps_song_number FROM recordings WHERE id = :i"),
            {"i": kept},
        ).one()
    assert tuple(row) == ("Baba Nam Kevalam", "kiirtan", None, None)


def test_the_check_constraints_now_know_the_four_categories(
    engine: sa.Engine, migration: ModuleType
) -> None:
    old_database(engine)
    with pytest.raises(sa.exc.IntegrityError):  # before: not allowed
        insert_kind(engine, "devotional_song")
    run(engine, migration.upgrade)
    insert_kind(engine, "kiirtan")
    insert_kind(engine, "bhajan", type="morning")
    insert_kind(engine, "devotional_song")
    insert_kind(engine, "prabhat_samgiita", ps_song_number=5018)
    with pytest.raises(sa.exc.IntegrityError):
        insert_kind(engine, "mantra")
    with pytest.raises(sa.exc.IntegrityError):  # a new category has only the type "other"
        insert_kind(engine, "devotional_song", type="morning")


def test_a_prabhat_samgiita_recording_must_name_a_song_from_1_to_5018(
    engine: sa.Engine, migration: ModuleType
) -> None:
    old_database(engine)
    run(engine, migration.upgrade)
    for song in (None, 0, 5019, -1):
        with pytest.raises(sa.exc.IntegrityError):
            insert_kind(engine, "prabhat_samgiita", ps_song_number=song)
    insert_kind(engine, "prabhat_samgiita", ps_song_number=1)
    with pytest.raises(sa.exc.IntegrityError):  # the other categories carry no song
        insert_kind(engine, "kiirtan", ps_song_number=3)


def test_the_language_is_one_of_five(engine: sa.Engine, migration: ModuleType) -> None:
    old_database(engine)
    run(engine, migration.upgrade)
    for language in (None, "bengali", "sanskrit", "hindi", "english", "other"):
        insert_kind(engine, "kiirtan", language=language)
    with pytest.raises(sa.exc.IntegrityError):
        insert_kind(engine, "kiirtan", language="klingon")


def test_a_development_database_that_ran_the_draft_is_tidied(
    engine: sa.Engine, migration: ModuleType
) -> None:
    old_database(engine)
    with engine.begin() as connection:
        for statement in DRAFT_MANTRAS:
            connection.execute(sa.text(statement))
    add(engine, "Baba Nam Kevalam")
    run(engine, migration.upgrade)
    inspector = sa.inspect(engine)
    assert not inspector.has_table("mantra_groups")
    columns = {c["name"] for c in inspector.get_columns("recordings")}
    assert not columns & {"mantra_title", "mantra_group_id"}
    assert "ix_recordings_mantra_group_id" not in {
        i["name"] for i in inspector.get_indexes("recordings")
    }
    with engine.connect() as connection:
        assert connection.execute(sa.text("SELECT COUNT(*) FROM recordings")).scalar() == 1


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
    run(engine, migration.upgrade)
    run(engine, migration.upgrade)
    inspector = sa.inspect(engine)
    names = [c["name"] for c in inspector.get_columns("recordings")]
    assert len(names) == len(set(names))
    with engine.connect() as connection:
        assert connection.execute(sa.text("SELECT COUNT(*) FROM recordings")).scalar() == 1
    insert_kind(engine, "prabhat_samgiita", ps_song_number=7)


def test_on_a_database_that_the_app_already_built_it_is_a_no_op(
    engine: sa.Engine, migration: ModuleType
) -> None:
    """0027 and `create_all` build the tables from the CURRENT models, new columns included."""
    tables = [
        Base.metadata.tables[name]
        for name in (
            "user_accounts",
            "recordings",
            "recording_reports",
            "recording_similar_confirms",
        )
    ]
    Base.metadata.create_all(engine, tables=tables)
    assert "mantra_groups" not in Base.metadata.tables
    run(engine, migration.upgrade)
    run(engine, migration.upgrade)
    inspector = sa.inspect(engine)
    assert {i["name"]: bool(i["unique"]) for i in inspector.get_indexes("recordings")}[
        "ix_recordings_audio_sha256"
    ] is True


def test_migration_0027_no_longer_creates_a_groups_table(
    engine: sa.Engine, migration: ModuleType
) -> None:
    first = load("0027_recordings")
    assert [table.__tablename__ for table in first.TABLES] == [
        "recordings",
        "recording_reports",
        "recording_author_blocks",
        "member_notices",
    ]
    run(engine, first.upgrade)
    inspector = sa.inspect(engine)
    assert inspector.has_table("recordings") and not inspector.has_table("mantra_groups")
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
    assert not inspector.has_table("recording_similar_confirms")
    columns = {c["name"] for c in inspector.get_columns("recordings")}
    assert not columns & {
        "year",
        "language",
        "credits",
        "notes",
        "ps_song_number",
        "removed_duplicate_of",
    }
    assert {i["name"]: bool(i["unique"]) for i in inspector.get_indexes("recordings")}[
        "ix_recordings_audio_sha256"
    ] is False
    with pytest.raises(sa.exc.IntegrityError):  # the old two-kind rule is back
        insert_kind(engine, "devotional_song")
    with engine.connect() as connection:
        reasons = (
            connection.execute(sa.text("SELECT reason FROM recording_reports")).scalars().all()
        )
    assert reasons == ["other"]


def test_downgrade_refuses_when_recordings_of_the_new_categories_exist(
    engine: sa.Engine, migration: ModuleType
) -> None:
    old_database(engine)
    run(engine, migration.upgrade)
    insert_kind(engine, "devotional_song")
    with pytest.raises(RuntimeError, match="Cannot go back"):
        run(engine, migration.downgrade)
