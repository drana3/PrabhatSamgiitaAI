"""Migration 0036: the author-delete marker leaves the name space (QA-056). SQLite only."""

from __future__ import annotations

import os

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://test:test@localhost/test")

import sqlalchemy as sa
from alembic.config import Config
from alembic.script import ScriptDirectory
from test_recording_duplicates_migration import VERSIONS, load, run

from app.services.extras_common import AUTHOR_DELETED_BY


def _engine() -> sa.Engine:
    engine = sa.create_engine("sqlite://", poolclass=sa.pool.StaticPool)
    with engine.begin() as c:
        for table in ("recording_comments", "video_links"):
            c.execute(sa.text(f"CREATE TABLE {table} (id INTEGER, status TEXT, removed_by TEXT)"))
            c.execute(
                sa.text(
                    f"INSERT INTO {table} VALUES (1, 'removed', 'author'), "
                    "(2, 'removed', 'Carya'), (3, 'published', NULL)"
                )
            )
    return engine


def _values(engine: sa.Engine, table: str) -> list[str | None]:
    with engine.connect() as c:
        return [r[0] for r in c.execute(sa.text(f"SELECT removed_by FROM {table} ORDER BY id"))]


def test_upgrade_moves_the_marker_and_downgrade_puts_it_back() -> None:
    module = load("0036_author_delete_marker")
    assert module.NEW == AUTHOR_DELETED_BY
    engine = _engine()
    run(engine, module.upgrade)
    for table in ("recording_comments", "video_links"):
        assert _values(engine, table) == [AUTHOR_DELETED_BY, "Carya", None]
    run(engine, module.downgrade)
    for table in ("recording_comments", "video_links"):
        assert _values(engine, table) == ["author", "Carya", None]


def test_0036_is_the_single_head_after_0035() -> None:
    script = ScriptDirectory.from_config(Config(str(VERSIONS.parents[1] / "alembic.ini")))
    assert len(script.get_heads()) == 1  # a later migration (0037) may follow it
    revision = script.get_revision("0036_author_delete_marker")
    assert revision is not None and revision.down_revision == "0035_author_review_and_play_caps"
