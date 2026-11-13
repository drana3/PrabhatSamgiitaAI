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

from app.models.broadcasts import (
    Broadcast,
    BroadcastDecision,
    BroadcastRecording,
    BroadcastReport,
)


@pytest.fixture
def m61() -> ModuleType:
    return load("0061_broadcasts")


@pytest.fixture
def parents(engine: sa.Engine) -> None:
    """The two tables a broadcast points at. SQLite must find them when 0062 rebuilds a table
    (PostgreSQL has them already)."""
    with engine.begin() as conn:
        conn.execute(sa.text("CREATE TABLE user_accounts (id CHAR(32) PRIMARY KEY)"))
        conn.execute(sa.text("CREATE TABLE recordings (id CHAR(32) PRIMARY KEY)"))


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


def test_upgrade_creates_the_tables_the_models_describe(
    engine: sa.Engine, m61: ModuleType, m62: ModuleType, parents: None
) -> None:
    run(engine, m61.upgrade)
    run(engine, m62.upgrade)
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


# --------------------------------------------------------------------------- 0062

NEW = "0062_broadcast_duration_review_recordings"


@pytest.fixture
def m62() -> ModuleType:
    return load(NEW)


def test_0062_follows_0061_and_the_chain_has_one_head() -> None:
    script = ScriptDirectory.from_config(Config(str(VERSIONS.parents[1] / "alembic.ini")))
    revision = script.get_revision(NEW)
    assert revision is not None and revision.down_revision == "0061_broadcasts"
    # later migrations follow it: the chain must still be a single line
    assert len(script.get_heads()) == 1


def test_0062_adds_what_the_models_describe_to_a_0061_database(
    engine: sa.Engine, m61: ModuleType, m62: ModuleType, parents: None
) -> None:
    run(engine, m61.upgrade)
    old = columns(engine, "broadcasts")
    assert "declared_ends_at" not in old and "hidden_at" not in old
    run(engine, m62.upgrade)
    assert columns(engine, "broadcasts") == {c.name for c in Broadcast.__table__.columns}
    assert columns(engine, "broadcast_reports") == {
        c.name for c in BroadcastReport.__table__.columns
    }
    assert columns(engine, "broadcast_decisions") == {
        c.name for c in BroadcastDecision.__table__.columns
    }
    assert columns(engine, "broadcast_recordings") == {
        c.name for c in BroadcastRecording.__table__.columns
    }


def test_0062_twice_changes_nothing_and_old_rows_keep_their_data(
    engine: sa.Engine, m61: ModuleType, m62: ModuleType, parents: None
) -> None:
    run(engine, m61.upgrade)
    with engine.begin() as conn:
        conn.execute(
            sa.text(
                "INSERT INTO broadcasts (id, member_id, provider, url, host, title, created_at, "
                "updated_at) VALUES ('b', 'm', 'zoom', 'https://x.org/a', 'x.org', 'T', "
                "'2026-11-09', '2026-11-09')"
            )
        )
        conn.execute(
            sa.text(
                "INSERT INTO broadcast_reports (id, broadcast_id, reporter_key, reason, "
                "created_at, updated_at) VALUES ('r', 'b', 'member:1', 'spam', '2026-11-09', "
                "'2026-11-09')"
            )
        )
    run(engine, m62.upgrade)
    run(engine, m62.upgrade)
    with engine.connect() as conn:
        row = conn.execute(
            sa.text("SELECT title, reviewed_reports, declared_ends_at, hidden_at FROM broadcasts")
        ).one()
        report = conn.execute(sa.text("SELECT weight, cleared_at FROM broadcast_reports")).one()
    assert tuple(row) == ("T", 0, None, None)
    assert tuple(report) == (0, None)


def test_0062_lets_one_person_report_with_another_reason_but_not_the_same_twice(
    engine: sa.Engine, m61: ModuleType, m62: ModuleType, parents: None
) -> None:
    run(engine, m61.upgrade)
    run(engine, m62.upgrade)

    def report(reason: str, rid: str) -> None:
        with engine.begin() as conn:
            conn.execute(
                sa.text(
                    "INSERT INTO broadcast_reports (id, broadcast_id, reporter_key, reason, "
                    "created_at, updated_at) VALUES (:i, 'b', 'member:1', :r, '2026-11-09', "
                    "'2026-11-09')"
                ),
                {"i": rid, "r": reason},
            )

    report("spam", "1")
    report("broken", "2")
    with pytest.raises(sa.exc.IntegrityError):
        report("spam", "3")
    unique = {u["name"] for u in sa.inspect(engine).get_unique_constraints("broadcast_reports")}
    assert unique == {"uq_broadcast_reports_reporter_reason"}


def test_0062_downgrade_goes_back_to_0061_and_keeps_the_oldest_report(
    engine: sa.Engine, m61: ModuleType, m62: ModuleType, parents: None
) -> None:
    run(engine, m61.upgrade)
    run(engine, m62.upgrade)
    with engine.begin() as conn:
        for rid, reason, stamp in (("1", "spam", "2026-11-09"), ("2", "broken", "2026-11-10")):
            conn.execute(
                sa.text(
                    "INSERT INTO broadcast_reports (id, broadcast_id, reporter_key, reason, "
                    "created_at, updated_at) VALUES (:i, 'b', 'member:1', :r, :s, :s)"
                ),
                {"i": rid, "r": reason, "s": stamp},
            )
    run(engine, m62.downgrade)
    assert "hidden_at" not in columns(engine, "broadcasts")
    assert "weight" not in columns(engine, "broadcast_reports")
    assert "broadcast_decisions" not in set(sa.inspect(engine).get_table_names())
    with engine.connect() as conn:
        assert [str(r[0]) for r in conn.execute(sa.text("SELECT id FROM broadcast_reports"))] == [
            "1"
        ]
    unique = {u["name"] for u in sa.inspect(engine).get_unique_constraints("broadcast_reports")}
    assert unique == {"uq_broadcast_reports_reporter"}
