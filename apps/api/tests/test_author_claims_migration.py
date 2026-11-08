"""Migration 0045 (author claims, their log and "also known as" names): runs on SQLite with
Alembic's own operations. A real PostgreSQL is NOT covered here: check it on a copy of the
database before the deploy (docs/author-profiles.md)."""

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
    AuthorAlias,
    AuthorClaim,
    AuthorClaimEvent,
    AuthorProfile,
)

NEW_TABLES = {"author_claims", "author_claim_events", "author_aliases"}
MODELS = (AuthorClaim, AuthorClaimEvent, AuthorAlias)


@pytest.fixture
def m45() -> ModuleType:
    return load("0045_author_claims")


@pytest.fixture
def engine() -> Iterator[sa.Engine]:
    engine = sa.create_engine("sqlite://", poolclass=sa.pool.StaticPool)
    base = [
        cast(sa.Table, m.__table__)
        for m in (UserAccount, RecordingCollection, Recording, AuthorProfile)
    ]
    Base.metadata.create_all(engine, tables=base)
    yield engine
    engine.dispose()


def test_0045_is_the_single_head_after_0044(m45: ModuleType) -> None:
    script = ScriptDirectory.from_config(Config(str(VERSIONS.parents[1] / "alembic.ini")))
    assert len(script.get_heads()) == 1
    revision = script.get_revision("0045_author_claims")
    assert revision is not None
    assert revision.down_revision == "0044_practice_and_optional_set_date"


def test_upgrade_creates_the_tables_and_the_unique_keys(engine: sa.Engine, m45: ModuleType) -> None:
    run(engine, m45.upgrade)
    inspector = sa.inspect(engine)
    assert NEW_TABLES <= set(inspector.get_table_names())
    assert "uq_author_claims_pair" in {
        u["name"] for u in inspector.get_unique_constraints("author_claims")
    }
    assert "uq_author_aliases_key" in {
        u["name"] for u in inspector.get_unique_constraints("author_aliases")
    }


def test_upgrade_twice_is_harmless(engine: sa.Engine, m45: ModuleType) -> None:
    run(engine, m45.upgrade)
    run(engine, m45.upgrade)
    assert NEW_TABLES <= set(sa.inspect(engine).get_table_names())


def test_upgrade_on_a_database_the_app_already_filled_with_create_all(
    engine: sa.Engine, m45: ModuleType
) -> None:
    Base.metadata.create_all(engine, tables=[cast(sa.Table, m.__table__) for m in MODELS])
    run(engine, m45.upgrade)
    assert NEW_TABLES <= set(sa.inspect(engine).get_table_names())


def test_the_tables_match_the_models(engine: sa.Engine, m45: ModuleType) -> None:
    run(engine, m45.upgrade)
    inspector = sa.inspect(engine)
    for model in MODELS:
        table = cast(sa.Table, model.__table__)
        built = {c["name"] for c in inspector.get_columns(table.name)}
        assert built == {c.name for c in table.columns}, table.name


def test_downgrade_drops_only_the_new_tables(engine: sa.Engine, m45: ModuleType) -> None:
    run(engine, m45.upgrade)
    run(engine, m45.downgrade)
    tables = set(sa.inspect(engine).get_table_names())
    assert not (NEW_TABLES & tables)
    assert {"author_profiles", "recordings"} <= tables
