"""Migration 0065: a comment stays when its author deletes the account.

Run on SQLite with Alembic's own operations, like the other migration tests. A real PostgreSQL is
NOT covered here: check it on a copy of the database before the deploy (docs/account-deletion.md).
"""

from __future__ import annotations

import os

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://test:test@localhost/test")

import sqlalchemy as sa
from alembic.config import Config
from alembic.script import ScriptDirectory
from test_recording_duplicates_migration import VERSIONS, load, run

TABLES = ("song_comments", "recording_comments")
REVISION = "0065_comments_survive_account_deletion"


def _old_database() -> sa.Engine:
    """The schema before: member_id NOT NULL, ON DELETE CASCADE, a reply hangs under its parent."""
    engine = sa.create_engine("sqlite://", poolclass=sa.pool.StaticPool)
    with engine.begin() as c:
        c.execute(sa.text("CREATE TABLE user_accounts (id CHAR(32) PRIMARY KEY)"))
        for table in TABLES:
            c.execute(
                sa.text(
                    f"""CREATE TABLE {table} (
                        id CHAR(32) PRIMARY KEY,
                        member_id CHAR(32) NOT NULL REFERENCES user_accounts (id) ON DELETE CASCADE,
                        body TEXT NOT NULL,
                        parent_id CHAR(32) REFERENCES {table} (id) ON DELETE CASCADE
                    )"""
                )
            )
            c.execute(sa.text(f"CREATE INDEX ix_{table}_member_id ON {table} (member_id)"))
        c.execute(sa.text("INSERT INTO user_accounts VALUES ('u1'), ('u2')"))
        for table in TABLES:
            c.execute(
                sa.text(
                    f"INSERT INTO {table} (id, member_id, body) VALUES "
                    "('a', 'u1', 'mine'), ('b', 'u2', 'theirs')"
                )
            )
    return engine


def _on(engine: sa.Engine) -> None:
    with engine.begin() as c:
        c.execute(sa.text("PRAGMA foreign_keys=ON"))


def _member_column(engine: sa.Engine, table: str) -> dict:
    return next(c for c in sa.inspect(engine).get_columns(table) if c["name"] == "member_id")


def _member_key(engine: sa.Engine, table: str) -> dict:
    return next(
        fk
        for fk in sa.inspect(engine).get_foreign_keys(table)
        if fk["constrained_columns"] == ["member_id"]
    )


def test_upgrade_keeps_the_comments_and_lets_the_account_go() -> None:
    module = load(REVISION)
    engine = _old_database()

    run(engine, module.upgrade)

    for table in TABLES:
        names = {c["name"] for c in sa.inspect(engine).get_columns(table)}
        assert "author_name" in names
        assert _member_column(engine, table)["nullable"] is True
        assert _member_key(engine, table)["options"].get("ondelete") == "SET NULL"
    # the rows that existed are untouched
    with engine.connect() as c:
        assert c.execute(sa.text("SELECT COUNT(*) FROM song_comments")).scalar() == 2

    # a deleted account no longer takes its comments along
    with engine.begin() as c:
        c.execute(sa.text("PRAGMA foreign_keys=ON"))
        c.execute(sa.text("DELETE FROM user_accounts WHERE id = 'u1'"))
        for table in TABLES:
            rows = c.execute(sa.text(f"SELECT id, member_id FROM {table} ORDER BY id")).all()
            assert [(r[0], r[1]) for r in rows] == [("a", None), ("b", "u2")]


def test_a_reply_still_goes_with_its_parent_after_the_upgrade() -> None:
    module = load(REVISION)
    engine = _old_database()
    with engine.begin() as c:
        for table in TABLES:
            c.execute(
                sa.text(
                    f"INSERT INTO {table} (id, member_id, body, parent_id) "
                    "VALUES ('r', 'u1', 'reply', 'b')"
                )
            )
    run(engine, module.upgrade)

    with engine.begin() as c:
        c.execute(sa.text("PRAGMA foreign_keys=ON"))
        for table in TABLES:
            c.execute(sa.text(f"DELETE FROM {table} WHERE id = 'b'"))
            left = [r[0] for r in c.execute(sa.text(f"SELECT id FROM {table} ORDER BY id"))]
            assert left == ["a"]  # the parent and its reply go, an unrelated comment stays


def test_upgrade_twice_is_harmless_and_downgrade_returns_the_old_rules() -> None:
    module = load(REVISION)
    engine = _old_database()
    run(engine, module.upgrade)
    run(engine, module.upgrade)  # safe to run twice

    with engine.begin() as c:
        c.execute(sa.text("PRAGMA foreign_keys=ON"))
        c.execute(sa.text("DELETE FROM user_accounts WHERE id = 'u1'"))
    run(engine, module.downgrade)

    for table in TABLES:
        assert "author_name" not in {c["name"] for c in sa.inspect(engine).get_columns(table)}
        assert _member_column(engine, table)["nullable"] is False
        assert _member_key(engine, table)["options"].get("ondelete") == "CASCADE"
        with engine.connect() as c:
            # the comment that lost its account cannot live in the old schema: it was removed
            assert [r[0] for r in c.execute(sa.text(f"SELECT id FROM {table}"))] == ["b"]


def test_the_revision_follows_0064() -> None:
    script = ScriptDirectory.from_config(Config(str(VERSIONS.parents[1] / "alembic.ini")))
    revision = script.get_revision(REVISION)
    assert revision is not None and revision.down_revision == "0064_mantras_styles_moods"
