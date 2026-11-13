"""Migration 0032 (spiritual and dance songs, any language, playlists from an event).

Run on SQLite with Alembic's own operations, starting from the schema 0029 leaves. What a real
PostgreSQL does is NOT covered here: check it on a copy of the database before the deploy
(docs/kiirtan-publishing.md).
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
from test_recording_duplicates_migration import (
    VERSIONS,
    add,
    insert_kind,
    load,
    old_database,
    run,
)

from app.models import Base


@pytest.fixture
def m29() -> ModuleType:
    return load("0029_recording_duplicates")


@pytest.fixture
def m32() -> ModuleType:
    return load("0032_recording_sets_and_categories")


@pytest.fixture
def engine() -> Iterator[sa.Engine]:
    engine = sa.create_engine("sqlite://", poolclass=sa.pool.StaticPool)
    yield engine
    engine.dispose()


def at_0029(engine: sa.Engine, m29: ModuleType) -> None:
    old_database(engine)
    run(engine, m29.upgrade)


def test_0032_follows_the_real_head_of_the_chain(m32: ModuleType) -> None:
    script = ScriptDirectory.from_config(Config(str(VERSIONS.parents[1] / "alembic.ini")))
    assert len(script.get_heads()) == 1
    revision = script.get_revision("0032_recording_sets_and_categories")
    assert revision is not None and revision.down_revision == "0031_song_chord_proposals"
    assert m32.revision == "0032_recording_sets_and_categories"


def test_upgrade_adds_columns_table_and_index(
    engine: sa.Engine, m29: ModuleType, m32: ModuleType
) -> None:
    at_0029(engine, m29)
    kept = add(engine, "Baba Nam Kevalam")
    run(engine, m32.upgrade)
    inspector = sa.inspect(engine)
    columns = {c["name"] for c in inspector.get_columns("recordings")}
    assert {"language_other", "dance", "recorded_on", "collection_id", "position"} <= columns
    assert inspector.has_table("recording_collections")
    assert "ix_recordings_collection_id" in {i["name"] for i in inspector.get_indexes("recordings")}
    with engine.connect() as connection:
        row = connection.execute(
            sa.text("SELECT title, collection_id, dance FROM recordings WHERE id = :i"), {"i": kept}
        ).one()
    assert tuple(row) == ("Baba Nam Kevalam", None, None)


def test_the_five_categories_and_their_rules_in_the_database(
    engine: sa.Engine, m29: ModuleType, m32: ModuleType
) -> None:
    at_0029(engine, m29)
    with pytest.raises(sa.exc.IntegrityError):
        insert_kind(engine, "dance_song")  # the kind is not allowed before
    run(engine, m32.upgrade)
    insert_kind(engine, "kiirtan")
    insert_kind(engine, "bhajan", type="morning", language="bn")
    insert_kind(engine, "devotional_song")  # the legacy id still reads
    insert_kind(engine, "prabhat_samgiita", ps_song_number=7)
    insert_kind(engine, "spiritual_song", language="ru")
    insert_kind(engine, "spiritual_song", language="other", language_other="Old Church Slavonic")
    insert_kind(engine, "dance_song", dance="tandava")
    insert_kind(engine, "dance_song", dance="kaoshiki", language="sa")
    with pytest.raises(sa.exc.IntegrityError):  # spiritual song without a language
        insert_kind(engine, "spiritual_song")
    with pytest.raises(sa.exc.IntegrityError):  # dance song without a dance
        insert_kind(engine, "dance_song")
    with pytest.raises(sa.exc.IntegrityError):  # a dance on another category
        insert_kind(engine, "kiirtan", dance="tandava")
    with pytest.raises(sa.exc.IntegrityError):  # the new categories carry only the type "other"
        insert_kind(engine, "spiritual_song", type="morning", language="en")
    with pytest.raises(sa.exc.IntegrityError):  # unknown kind
        insert_kind(engine, "mantra")
    with pytest.raises(sa.exc.IntegrityError):  # a language code must be 2 to 8 characters
        insert_kind(engine, "bhajan", type="other", language="x")


def test_old_language_words_become_codes(
    engine: sa.Engine, m29: ModuleType, m32: ModuleType
) -> None:
    at_0029(engine, m29)
    for word in ("bengali", "sanskrit", "hindi", "english", "other", None):
        insert_kind(engine, "kiirtan", language=word)
    run(engine, m32.upgrade)
    with engine.connect() as connection:
        found = {r[0] for r in connection.execute(sa.text("SELECT language FROM recordings"))}
    assert found == {"bn", "sa", "hi", "en", "other", None}


def test_running_it_twice_changes_nothing(
    engine: sa.Engine, m29: ModuleType, m32: ModuleType
) -> None:
    at_0029(engine, m29)
    insert_kind(engine, "kiirtan", language="hindi")
    run(engine, m32.upgrade)
    insert_kind(engine, "dance_song", dance="tandava")
    run(engine, m32.upgrade)
    inspector = sa.inspect(engine)
    names = [c["name"] for c in inspector.get_columns("recordings")]
    assert len(names) == len(set(names))
    checks = [c["name"] for c in inspector.get_check_constraints("recordings")]
    assert len(checks) == len(set(checks))
    with engine.connect() as connection:
        total = connection.execute(sa.text("SELECT COUNT(*) FROM recordings")).scalar()
    assert total == 2


def test_it_is_a_no_op_on_a_database_made_from_the_current_models(
    engine: sa.Engine, m32: ModuleType
) -> None:
    """The app runs create_all at start: a fresh database already has everything."""
    from app.models import UserAccount
    from app.models.recording_collections import RecordingCollection
    from app.models.recordings import Recording

    tables = [m.__table__ for m in (UserAccount, RecordingCollection, Recording)]
    Base.metadata.create_all(engine, tables=tables)  # type: ignore[arg-type]
    run(engine, m32.upgrade)
    run(engine, m32.upgrade)
    full = {
        "author": "A",
        "added_by": "A",
        "audio_key": "k",
        "audio_url": "u",
        "status": "published",
        "published_at": "2026-01-01 00:00:00",
    }
    insert_kind(engine, "dance_song", dance="kaoshiki", **full)
    with pytest.raises(sa.exc.IntegrityError):
        insert_kind(engine, "dance_song", **full)


def test_downgrade_goes_back_but_refuses_to_lose_the_new_categories(
    engine: sa.Engine, m29: ModuleType, m32: ModuleType
) -> None:
    at_0029(engine, m29)
    insert_kind(engine, "kiirtan", language="hindi")
    run(engine, m32.upgrade)
    insert_kind(engine, "bhajan", type="other", language="pt")
    insert_kind(engine, "dance_song", dance="tandava")
    with pytest.raises(RuntimeError, match="Cannot go back"):
        run(engine, m32.downgrade)
    with engine.begin() as connection:
        connection.execute(sa.text("DELETE FROM recordings WHERE kind = 'dance_song'"))
    run(engine, m32.downgrade)
    inspector = sa.inspect(engine)
    assert not inspector.has_table("recording_collections")
    assert not {"dance", "collection_id", "position", "recorded_on", "language_other"} & {
        c["name"] for c in inspector.get_columns("recordings")
    }
    with engine.connect() as connection:
        found = sorted(r[0] for r in connection.execute(sa.text("SELECT language FROM recordings")))
    assert found == ["hindi", "other"]  # known code back to the word, unknown code to "other"
    with pytest.raises(sa.exc.IntegrityError):
        insert_kind(engine, "spiritual_song", language="en")
    run(engine, m32.upgrade)  # and forward again
    insert_kind(engine, "spiritual_song", language="en")
