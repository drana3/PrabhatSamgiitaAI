"""Migration 0069 (the Apple refresh token kept for revocation): runs on SQLite with Alembic's own
operations. A real PostgreSQL is NOT covered here: check it on a copy of the database before the
deploy."""

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

from app.models import AppleRefreshToken, Base, UserAccount

TABLE = "apple_refresh_tokens"


@pytest.fixture
def m69() -> ModuleType:
    return load("0069_apple_refresh_tokens")


@pytest.fixture
def engine() -> Iterator[sa.Engine]:
    """The database as it was before 0069: the accounts table only."""
    engine = sa.create_engine("sqlite://", poolclass=sa.pool.StaticPool)
    Base.metadata.create_all(engine, tables=[cast(sa.Table, UserAccount.__table__)])
    yield engine
    engine.dispose()


def test_0069_follows_0068_and_the_chain_has_a_single_head() -> None:
    script = ScriptDirectory.from_config(Config(str(VERSIONS.parents[1] / "alembic.ini")))
    assert len(script.get_heads()) == 1
    revision = script.get_revision("0069_apple_refresh_tokens")
    assert revision is not None and revision.down_revision == "0068_video_thumbnail"


def test_upgrade_creates_the_table_like_the_model(engine: sa.Engine, m69: ModuleType) -> None:
    run(engine, m69.upgrade)
    inspector = sa.inspect(engine)
    assert TABLE in inspector.get_table_names()
    built = {c["name"]: c for c in inspector.get_columns(TABLE)}
    model = cast(sa.Table, AppleRefreshToken.__table__)
    assert set(built) == {c.name for c in model.columns}
    assert built["refresh_token"]["nullable"] is False
    assert inspector.get_pk_constraint(TABLE)["constrained_columns"] == ["user_id"]
    [fk] = inspector.get_foreign_keys(TABLE)
    assert fk["referred_table"] == "user_accounts"
    assert fk["options"].get("ondelete") == "CASCADE"


def test_upgrade_twice_is_harmless(engine: sa.Engine, m69: ModuleType) -> None:
    run(engine, m69.upgrade)
    run(engine, m69.upgrade)
    assert TABLE in sa.inspect(engine).get_table_names()


def test_upgrade_on_a_database_the_app_already_filled_with_create_all(m69: ModuleType) -> None:
    engine = sa.create_engine("sqlite://", poolclass=sa.pool.StaticPool)
    Base.metadata.create_all(
        engine,
        tables=[cast(sa.Table, m.__table__) for m in (UserAccount, AppleRefreshToken)],
    )
    run(engine, m69.upgrade)
    assert TABLE in sa.inspect(engine).get_table_names()
    engine.dispose()


def test_downgrade_drops_only_the_new_table(engine: sa.Engine, m69: ModuleType) -> None:
    run(engine, m69.upgrade)
    run(engine, m69.downgrade)
    names = set(sa.inspect(engine).get_table_names())
    assert TABLE not in names and "user_accounts" in names
    run(engine, m69.downgrade)  # twice is harmless too
