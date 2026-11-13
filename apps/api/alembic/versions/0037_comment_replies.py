"""Replies under comments, and the song comments' author-delete marker.

Revision ID: 0037_comment_replies
Revises: 0036_author_delete_marker

song_comments and recording_comments get two nullable columns:

  parent_id     the top-level comment a reply hangs under (null for a top-level comment); a reply
                is deleted with its parent row (`ON DELETE CASCADE`)
  reply_to_id   the reply this reply answers, when it answers a reply rather than the top-level
                comment (`ON DELETE SET NULL`); the app shows it as "to Name"

plus an index on `parent_id`. Existing rows stay top-level comments.

song_comments.removed_by held the plain word `author` for an author's own delete, and a team
removal stores the member's display name, so a team member named "author" made a team removal look
like an author's delete (QA-059, the same fix as 0036 made for recordings). The marker is now the
control-character-prefixed value no name can equal; existing rows that say `author` are rewritten.

Safe to run twice (every column and index is looked for first). Works on PostgreSQL and SQLite.
"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0037_comment_replies"
down_revision = "0036_author_delete_marker"
branch_labels = None
depends_on = None

TABLES = ("song_comments", "recording_comments")
OLD = "author"
NEW = "\x1fauthor"


def _columns(inspector: sa.Inspector, table: str) -> set[str]:
    return {c["name"] for c in inspector.get_columns(table)}


def _swap_marker(old: str, new: str) -> None:
    op.execute(
        sa.text(
            "UPDATE song_comments SET removed_by = :new "
            "WHERE status = 'removed' AND removed_by = :old"
        ).bindparams(new=new, old=old)
    )


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    for table in TABLES:
        if not inspector.has_table(table):
            continue
        have = _columns(inspector, table)
        # batch mode: PostgreSQL alters the table directly, SQLite copies it (it cannot add a
        # foreign key with ALTER)
        with op.batch_alter_table(table) as batch:
            if "parent_id" not in have:
                batch.add_column(
                    sa.Column(
                        "parent_id",
                        postgresql.UUID(as_uuid=True),
                        sa.ForeignKey(f"{table}.id", name=f"fk_{table}_parent", ondelete="CASCADE"),
                        nullable=True,
                    )
                )
            if "reply_to_id" not in have:
                batch.add_column(
                    sa.Column(
                        "reply_to_id",
                        postgresql.UUID(as_uuid=True),
                        sa.ForeignKey(
                            f"{table}.id", name=f"fk_{table}_reply_to", ondelete="SET NULL"
                        ),
                        nullable=True,
                    )
                )
        name = f"ix_{table}_parent_id"
        if not any(ix["name"] == name for ix in sa.inspect(op.get_bind()).get_indexes(table)):
            op.create_index(name, table, ["parent_id"])
    if inspector.has_table("song_comments"):
        _swap_marker(OLD, NEW)


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if inspector.has_table("song_comments"):
        _swap_marker(NEW, OLD)
    for table in TABLES:
        if not inspector.has_table(table):
            continue
        name = f"ix_{table}_parent_id"
        if any(ix["name"] == name for ix in inspector.get_indexes(table)):
            op.drop_index(name, table_name=table)
        have = _columns(inspector, table)
        with op.batch_alter_table(table) as batch:
            for column in ("reply_to_id", "parent_id"):
                if column in have:
                    batch.drop_column(column)
