"""Migration 0040 (Baba's Audio Discourses: a new kind, with a place and a discourse name).

SQLite with Alembic's own operations, starting from the schema 0032 leaves. A real PostgreSQL is
NOT covered here: check it on a copy of the database before the deploy.
"""

from __future__ import annotations

import os
from collections.abc import Iterator
from types import ModuleType

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://test:test@localhost/test")

import pytest
import sqlalchemy as sa
from alembic.config import Config
from alembic.script import ScriptDirectory
from test_recording_duplicates_migration import VERSIONS, insert_kind, load, run
from test_recording_sets_migration import at_0029

from app.models import Base


@pytest.fixture
def m29() -> ModuleType:
    return load("0029_recording_duplicates")


@pytest.fixture
def m32() -> ModuleType:
    return load("0032_recording_sets_and_categories")


@pytest.fixture
def m40() -> ModuleType:
    return load("0040_baba_audio_kind")


@pytest.fixture
def engine() -> Iterator[sa.Engine]:
    engine = sa.create_engine("sqlite://", poolclass=sa.pool.StaticPool)
    yield engine
    engine.dispose()


def at_0032(engine: sa.Engine, m29: ModuleType, m32: ModuleType) -> None:
    at_0029(engine, m29)
    run(engine, m32.upgrade)


def test_0040_is_in_the_one_chain(m40: ModuleType) -> None:
    script = ScriptDirectory.from_config(Config(str(VERSIONS.parents[1] / "alembic.ini")))
    assert len(script.get_heads()) == 1
    revision = script.get_revision("0040_baba_audio_kind")
    assert revision is not None and revision.down_revision == "0039_kiirtan_style_and_menu_pins"
    assert m40.revision == "0040_baba_audio_kind"


def test_upgrade_adds_the_kind_the_columns_and_the_language_rule(
    engine: sa.Engine, m29: ModuleType, m32: ModuleType, m40: ModuleType
) -> None:
    at_0032(engine, m29, m32)
    with pytest.raises(sa.exc.IntegrityError):
        insert_kind(engine, "baba_audio", language="en")  # not allowed before
    insert_kind(engine, "spiritual_song", language="en", title="kept")
    run(engine, m40.upgrade)
    columns = {c["name"] for c in sa.inspect(engine).get_columns("recordings")}
    assert {"place", "discourse"} <= columns
    insert_kind(engine, "baba_audio", language="en", place="Ranchi", discourse="12")
    insert_kind(engine, "baba_audio", language="other", language_other="Old Church Slavonic")
    with pytest.raises(sa.exc.IntegrityError):  # an audio discourse always names its language
        insert_kind(engine, "baba_audio")
    with pytest.raises(sa.exc.IntegrityError):  # and carries only the type "other"
        insert_kind(engine, "baba_audio", type="morning", language="en")
    with pytest.raises(sa.exc.IntegrityError):  # a dance belongs to dance music only
        insert_kind(engine, "baba_audio", language="en", dance="tandava")
    with pytest.raises(sa.exc.IntegrityError):  # the older rule still holds
        insert_kind(engine, "spiritual_song")
    with engine.connect() as connection:
        titles = [r[0] for r in connection.execute(sa.text("SELECT title FROM recordings"))]
    assert "kept" in titles


def test_running_it_twice_and_on_a_current_database_changes_nothing(
    engine: sa.Engine, m29: ModuleType, m32: ModuleType, m40: ModuleType
) -> None:
    at_0032(engine, m29, m32)
    run(engine, m40.upgrade)
    run(engine, m40.upgrade)
    insert_kind(engine, "baba_audio", language="ru")

    fresh = sa.create_engine("sqlite://", poolclass=sa.pool.StaticPool)
    from app.models import UserAccount
    from app.models.recording_collections import RecordingCollection
    from app.models.recordings import Recording

    tables = [m.__table__ for m in (UserAccount, RecordingCollection, Recording)]
    Base.metadata.create_all(fresh, tables=tables)  # type: ignore[arg-type]
    run(fresh, m40.upgrade)
    full = {
        "author": "A",
        "added_by": "A",
        "audio_key": "k",
        "audio_url": "u",
        "status": "published",
        "published_at": "2026-01-01 00:00:00",
    }
    insert_kind(fresh, "baba_audio", language="es", **full)
    with pytest.raises(sa.exc.IntegrityError):
        insert_kind(fresh, "baba_audio", **full)
    fresh.dispose()


def test_downgrade_refuses_to_lose_audio_discourses_then_goes_back(
    engine: sa.Engine, m29: ModuleType, m32: ModuleType, m40: ModuleType
) -> None:
    at_0032(engine, m29, m32)
    run(engine, m40.upgrade)
    insert_kind(engine, "baba_audio", language="en", place="Ranchi")
    insert_kind(engine, "kiirtan")
    with pytest.raises(RuntimeError, match="Cannot go back"):
        run(engine, m40.downgrade)
    with engine.begin() as connection:
        connection.execute(sa.text("DELETE FROM recordings WHERE kind = 'baba_audio'"))
    run(engine, m40.downgrade)
    assert not {"place", "discourse"} & {
        c["name"] for c in sa.inspect(engine).get_columns("recordings")
    }
    with pytest.raises(sa.exc.IntegrityError):
        insert_kind(engine, "baba_audio", language="en")
    run(engine, m40.upgrade)  # and forward again
    insert_kind(engine, "baba_audio", language="en")
