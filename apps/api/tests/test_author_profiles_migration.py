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


def test_the_tables_match_the_models(engine: sa.Engine, m33: ModuleType) -> None:
    run(engine, m33.upgrade)
    inspector = sa.inspect(engine)
    for model in MODELS:
        table = cast(sa.Table, model.__table__)
        built = {c["name"] for c in inspector.get_columns(table.name)}
        assert built == {c.name for c in table.columns}, table.name


def test_downgrade_drops_only_the_new_tables(engine: sa.Engine, m33: ModuleType) -> None:
    run(engine, m33.upgrade)
    run(engine, m33.downgrade)
    names = set(sa.inspect(engine).get_table_names())
    assert not names & NEW_TABLES
    assert {"user_accounts", "recordings"} <= names
