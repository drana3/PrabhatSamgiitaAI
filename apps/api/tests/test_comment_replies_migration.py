"""Migration 0037: reply columns on both comment tables and the song comments' author marker.

SQLite with Alembic's own operations, as the other migration tests. A real PostgreSQL is NOT
covered here: check it on a copy of the database before the deploy.
"""

from __future__ import annotations

import os

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://test:test@localhost/test")

import sqlalchemy as sa
from alembic.config import Config
from alembic.script import ScriptDirectory
from test_recording_duplicates_migration import VERSIONS, load, run

from app.services.song_comments import AUTHOR_DELETED_BY

TABLES = ("song_comments", "recording_comments")


def _engine() -> sa.Engine:
    engine = sa.create_engine("sqlite://", poolclass=sa.pool.StaticPool)
    with engine.begin() as c:
        for table in TABLES:
            c.execute(
                sa.text(
                    f"CREATE TABLE {table} (id CHAR(32) PRIMARY KEY, status TEXT, removed_by TEXT)"
                )
            )
            c.execute(
                sa.text(
                    f"INSERT INTO {table} VALUES ('a', 'removed', 'author'), "
                    "('b', 'removed', 'Carya'), ('c', 'published', NULL)"
                )
            )
    return engine


def _columns(engine: sa.Engine, table: str) -> set[str]:
    return {c["name"] for c in sa.inspect(engine).get_columns(table)}


def _marks(engine: sa.Engine, table: str) -> list[str | None]:
    with engine.connect() as c:
        return [r[0] for r in c.execute(sa.text(f"SELECT removed_by FROM {table} ORDER BY id"))]


def test_upgrade_adds_the_reply_columns_and_moves_the_song_marker_then_downgrades() -> None:
    module = load("0037_comment_replies")
    assert module.NEW == AUTHOR_DELETED_BY
    engine = _engine()
    run(engine, module.upgrade)
    for table in TABLES:
        assert {"parent_id", "reply_to_id"} <= _columns(engine, table)
        names = {ix["name"] for ix in sa.inspect(engine).get_indexes(table)}
        assert f"ix_{table}_parent_id" in names
    assert _marks(engine, "song_comments") == [AUTHOR_DELETED_BY, "Carya", None]
    # recordings were moved by 0036: this migration leaves their rows alone
    assert _marks(engine, "recording_comments") == ["author", "Carya", None]
    run(engine, module.upgrade)  # safe to run twice
    run(engine, module.downgrade)
    for table in TABLES:
        assert not ({"parent_id", "reply_to_id"} & _columns(engine, table))
    assert _marks(engine, "song_comments") == ["author", "Carya", None]


def test_0037_is_the_single_head_after_0036() -> None:
    script = ScriptDirectory.from_config(Config(str(VERSIONS.parents[1] / "alembic.ini")))
    assert len(script.get_heads()) == 1  # later migrations (0038 ...) follow it
    revision = script.get_revision("0037_comment_replies")
    assert revision is not None and revision.down_revision == "0036_author_delete_marker"
