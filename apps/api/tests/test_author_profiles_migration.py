"""Migration 0033 (author profiles and listening statistics): runs on SQLite with Alembic's own
operations. What a real PostgreSQL does is NOT covered here: check it on a copy of the database
before the deploy (docs/author-profiles.md)."""

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
from app.models.author_profiles import (
    AuthorProfile,
    AuthorProfilePhoto,
    AuthorRecordingLink,
    AuthorReport,
    AuthorSlugHistory,
    AuthorStatsSnapshot,
    AuthorSuspension,
    PlayDaily,
    PlayEvent,
)

NEW_TABLES = {
    "author_profiles",
    "author_profile_photos",
    "author_slug_history",
    "author_recording_links",
    "author_reports",
    "author_suspensions",
    "play_events",
    "play_daily",
    "author_stats_snapshots",
}
MODELS = (
    AuthorProfile,
    AuthorProfilePhoto,
    AuthorSlugHistory,
    AuthorRecordingLink,
    AuthorReport,
    AuthorSuspension,
    PlayEvent,
    PlayDaily,
    AuthorStatsSnapshot,
)


@pytest.fixture
def m33() -> ModuleType:
    return load("0033_author_profiles")


@pytest.fixture
def m35() -> ModuleType:
    return load("0035_author_review_and_play_caps")


@pytest.fixture
def m38() -> ModuleType:
    return load("0038_author_snapshot_kinds")


@pytest.fixture
def m58() -> ModuleType:
    return load("0058_play_flags")


@pytest.fixture
def engine() -> Iterator[sa.Engine]:
    engine = sa.create_engine("sqlite://", poolclass=sa.pool.StaticPool)
    # what 0032 leaves: the account and recording tables, none of the new ones
    base = [cast(sa.Table, m.__table__) for m in (UserAccount, RecordingCollection, Recording)]
    Base.metadata.create_all(engine, tables=base)
    yield engine
    engine.dispose()


def test_0033_follows_the_real_head_of_the_chain(m33: ModuleType) -> None:
    script = ScriptDirectory.from_config(Config(str(VERSIONS.parents[1] / "alembic.ini")))
    assert len(script.get_heads()) == 1
    revision = script.get_revision("0033_author_profiles")
    assert revision is not None
    assert revision.down_revision == "0032_recording_sets_and_categories"
    assert m33.revision == "0033_author_profiles"


def test_upgrade_creates_the_tables_and_the_unique_keys(engine: sa.Engine, m33: ModuleType) -> None:
    run(engine, m33.upgrade)
    inspector = sa.inspect(engine)
    assert NEW_TABLES <= set(inspector.get_table_names())
    profile_indexes = {i["name"]: i["unique"] for i in inspector.get_indexes("author_profiles")}
    assert profile_indexes["ix_author_profiles_slug"]
    assert profile_indexes["ix_author_profiles_member_id"]
    uniques = {u["name"] for u in inspector.get_unique_constraints("play_events")}
    assert "uq_play_events_once_a_day" in uniques


def test_upgrade_twice_is_harmless(engine: sa.Engine, m33: ModuleType) -> None:
    run(engine, m33.upgrade)
    run(engine, m33.upgrade)
    assert NEW_TABLES <= set(sa.inspect(engine).get_table_names())


def test_upgrade_on_a_database_the_app_already_filled_with_create_all(
    engine: sa.Engine, m33: ModuleType
) -> None:
    Base.metadata.create_all(engine, tables=[cast(sa.Table, m.__table__) for m in MODELS])
    run(engine, m33.upgrade)  # every table and index is looked for first
    assert NEW_TABLES <= set(sa.inspect(engine).get_table_names())


def test_the_tables_match_the_models(
    engine: sa.Engine, m33: ModuleType, m35: ModuleType, m38: ModuleType, m58: ModuleType
) -> None:
    run(engine, m33.upgrade)
    run(engine, m35.upgrade)
    run(engine, m38.upgrade)
    run(engine, m58.upgrade)  # adds play_events.counted
    inspector = sa.inspect(engine)
    for model in MODELS:
        table = cast(sa.Table, model.__table__)
        built = {c["name"] for c in inspector.get_columns(table.name)}
        assert built == {c.name for c in table.columns}, table.name


def test_0033_is_the_form_that_was_committed_before_the_review_columns(m33: ModuleType) -> None:
    # 0033 never learns about the later columns: they belong to 0035
    source = (VERSIONS / "0033_author_profiles.py").read_text()
    assert "report_reason" not in source and "client_key" not in source
    assert m33.down_revision == "0032_recording_sets_and_categories"


def test_0035_is_the_single_head_after_0034(m35: ModuleType) -> None:
    script = ScriptDirectory.from_config(Config(str(VERSIONS.parents[1] / "alembic.ini")))
    revision = script.get_revision("0035_author_review_and_play_caps")
    assert revision is not None
    assert revision.down_revision == "0034_recording_extras"
    assert m35.revision == "0035_author_review_and_play_caps"
    assert len(script.get_heads()) == 1  # a later migration (0036) may follow it


def _profile_row(engine: sa.Engine, slug: str, **values: object) -> None:
    """A row as 0033 left it, written with plain SQL (the foreign key to the member is off)."""
    from uuid import uuid4

    columns: dict[str, object] = {
        "id": uuid4().hex,
        "member_id": uuid4().hex,
        "slug": slug,
        "display_name": slug,
        "languages": "[]",
        "links": "[]",
        "created_at": "2026-01-01 00:00:00",
        "updated_at": "2026-01-01 00:00:00",
        **values,
    }
    with engine.begin() as connection:
        connection.execute(
            sa.text(
                f"INSERT INTO author_profiles ({', '.join(columns)}) "
                f"VALUES ({', '.join(':' + c for c in columns)})"
            ),
            columns,
        )


def test_0035_moves_report_holds_to_their_own_column(
    engine: sa.Engine, m33: ModuleType, m35: ModuleType
) -> None:
    run(engine, m33.upgrade)
    _profile_row(engine, "reported-one", review_needed=True, review_reason="reported:impersonation")
    _profile_row(engine, "named-one", review_needed=True, review_reason="protected_name")
    _profile_row(engine, "clean-one", review_needed=False)
    run(engine, m35.upgrade)
    with engine.connect() as connection:
        rows = {
            r.slug: r
            for r in connection.execute(
                sa.text(
                    "SELECT slug, review_needed, review_reason, report_reason FROM author_profiles"
                )
            )
        }
    assert rows["reported-one"].report_reason == "impersonation"
    assert not rows["reported-one"].review_needed and rows["reported-one"].review_reason is None
    assert rows["named-one"].review_reason == "protected_name" and rows["named-one"].review_needed
    assert rows["named-one"].report_reason is None
    assert rows["clean-one"].report_reason is None


def test_0035_twice_and_after_create_all_is_harmless(
    engine: sa.Engine, m33: ModuleType, m35: ModuleType
) -> None:
    run(engine, m33.upgrade)
    run(engine, m35.upgrade)
    run(engine, m35.upgrade)
    inspector = sa.inspect(engine)
    assert "report_reason" in {c["name"] for c in inspector.get_columns("author_profiles")}
    assert {"client_key", "counts_listener"} <= {
        c["name"] for c in inspector.get_columns("play_events")
    }
    # a database the app already built from the models has the columns before the revision runs
    other = sa.create_engine("sqlite://", poolclass=sa.pool.StaticPool)
    Base.metadata.create_all(
        other,
        tables=[cast(sa.Table, m.__table__) for m in (UserAccount, RecordingCollection, Recording)],
    )
    Base.metadata.create_all(other, tables=[cast(sa.Table, m.__table__) for m in MODELS])
    run(other, m35.upgrade)
    other.dispose()


def test_0035_downgrade_puts_the_holds_back(
    engine: sa.Engine, m33: ModuleType, m35: ModuleType
) -> None:
    run(engine, m33.upgrade)
    run(engine, m35.upgrade)
    _profile_row(engine, "held-one", report_reason="spam")
    run(engine, m35.downgrade)
    with engine.connect() as connection:
        back = connection.execute(
            sa.text(
                "SELECT review_needed, review_reason FROM author_profiles WHERE slug = 'held-one'"
            )
        ).one()
    assert back.review_needed and back.review_reason == "reported:spam"
    inspector = sa.inspect(engine)
    assert "report_reason" not in {c["name"] for c in inspector.get_columns("author_profiles")}
    assert not {"client_key", "counts_listener"} & {
        c["name"] for c in inspector.get_columns("play_events")
    }
    run(engine, m35.upgrade)  # and up again


def test_downgrade_drops_only_the_new_tables(engine: sa.Engine, m33: ModuleType) -> None:
    run(engine, m33.upgrade)
    run(engine, m33.downgrade)
    names = set(sa.inspect(engine).get_table_names())
    assert not names & NEW_TABLES
    assert {"user_accounts", "recordings"} <= names


def test_0038_adds_the_kinds_column_twice_harmlessly_and_marks_snapshots_stale(
    engine: sa.Engine, m33: ModuleType, m35: ModuleType, m38: ModuleType
) -> None:
    run(engine, m33.upgrade)
    run(engine, m35.upgrade)
    with engine.begin() as conn:
        conn.execute(sa.text("DROP TABLE author_stats_snapshots"))
        conn.execute(
            sa.text(
                "CREATE TABLE author_stats_snapshots (profile_id CHAR(32) PRIMARY KEY, "
                "monthly_listeners INTEGER, total_plays INTEGER, recordings_count INTEGER, "
                "computed_at DATETIME)"
            )
        )
        conn.execute(
            sa.text(
                "INSERT INTO author_stats_snapshots VALUES ('a', 1, 2, 3, '2026-11-01 10:00:00')"
            )
        )
    run(engine, m38.upgrade)
    run(engine, m38.upgrade)
    with engine.connect() as conn:
        row = conn.execute(sa.text("SELECT kinds, computed_at FROM author_stats_snapshots")).one()
    assert row[0] == "" and str(row[1]).startswith("1970-01-01")
    run(engine, m38.downgrade)
    assert "kinds" not in {
        c["name"] for c in sa.inspect(engine).get_columns("author_stats_snapshots")
    }


def test_0038_follows_0037(m38: ModuleType) -> None:
    assert m38.down_revision == "0037_comment_replies"
    script = ScriptDirectory.from_config(Config(str(VERSIONS.parents[1] / "alembic.ini")))
    assert len(script.get_heads()) == 1
