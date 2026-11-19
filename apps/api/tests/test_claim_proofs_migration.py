"""Migration 0070 (proof of identity for claiming recordings): runs on SQLite with Alembic's own
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

from app.models import (
    AuthorClaim,
    AuthorClaimProof,
    Base,
    Recording,
    RecordingCollection,
    UserAccount,
)
from app.models.author_profiles import AuthorProfile

TABLE = "author_claim_proofs"


@pytest.fixture
def m70() -> ModuleType:
    return load("0070_claim_proofs")


@pytest.fixture
def engine() -> Iterator[sa.Engine]:
    """The database as it was before 0070: pages and claims, no proofs, no `person_note`."""
    engine = sa.create_engine("sqlite://", poolclass=sa.pool.StaticPool)
    base = [
        cast(sa.Table, m.__table__)
        for m in (UserAccount, RecordingCollection, Recording, AuthorProfile, AuthorClaim)
    ]
    Base.metadata.create_all(engine, tables=base)
    with engine.begin() as conn:
        conn.execute(sa.text("ALTER TABLE author_claims DROP COLUMN person_note"))
    yield engine
    engine.dispose()


def test_0070_follows_0069_and_the_chain_has_a_single_head() -> None:
    script = ScriptDirectory.from_config(Config(str(VERSIONS.parents[1] / "alembic.ini")))
    assert len(script.get_heads()) == 1
    revision = script.get_revision("0070_claim_proofs")
    assert revision is not None and revision.down_revision == "0069_apple_refresh_tokens"


def test_upgrade_creates_the_table_like_the_model_and_adds_the_note(
    engine: sa.Engine, m70: ModuleType
) -> None:
    run(engine, m70.upgrade)
    inspector = sa.inspect(engine)
    built = {c["name"] for c in inspector.get_columns(TABLE)}
    assert built == {c.name for c in cast(sa.Table, AuthorClaimProof.__table__).columns}
    assert "person_note" in {c["name"] for c in inspector.get_columns("author_claims")}
    [fk] = inspector.get_foreign_keys(TABLE)
    assert fk["referred_table"] == "author_profiles" and fk["options"].get("ondelete") == "CASCADE"


def test_upgrade_twice_is_harmless(engine: sa.Engine, m70: ModuleType) -> None:
    run(engine, m70.upgrade)
    run(engine, m70.upgrade)
    assert TABLE in sa.inspect(engine).get_table_names()


def test_upgrade_on_a_database_the_app_already_filled_with_create_all(
    engine: sa.Engine, m70: ModuleType
) -> None:
    Base.metadata.create_all(engine, tables=[cast(sa.Table, AuthorClaimProof.__table__)])
    run(engine, m70.upgrade)
    assert TABLE in sa.inspect(engine).get_table_names()


def test_downgrade_drops_only_what_0070_added(engine: sa.Engine, m70: ModuleType) -> None:
    run(engine, m70.upgrade)
    run(engine, m70.downgrade)
    inspector = sa.inspect(engine)
    assert TABLE not in inspector.get_table_names()
    assert "person_note" not in {c["name"] for c in inspector.get_columns("author_claims")}
    assert {"author_profiles", "author_claims", "recordings"} <= set(inspector.get_table_names())
