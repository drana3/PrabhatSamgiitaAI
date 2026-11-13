"""Author directory: which kinds of recording each page holds, so the directory can filter by kind.

Revision ID: 0038_author_snapshot_kinds
Revises: 0037_comment_replies

author_stats_snapshots.kinds
    A comma-fenced list of the public kinds the page holds (",kiirtan,prabhat_samgiita,"), filled
    when the snapshot is worked out. Existing snapshots are marked stale so the next directory
    request fills them in.

Safe to run twice, and on a database where the app already ran `Base.metadata.create_all`.
Works on PostgreSQL and SQLite. Downgrade drops the column.
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "0038_author_snapshot_kinds"
down_revision = "0037_comment_replies"
branch_labels = None
depends_on = None

TABLE = "author_stats_snapshots"


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table(TABLE):
        return
    have = {c["name"] for c in inspector.get_columns(TABLE)}
    if "kinds" not in have:
        op.add_column(TABLE, sa.Column("kinds", sa.String(200), server_default="", nullable=False))
    # every snapshot is worked out again on the next directory request
    op.execute(sa.text(f"UPDATE {TABLE} SET computed_at = '1970-01-01 00:00:00' WHERE kinds = ''"))


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if inspector.has_table(TABLE) and "kinds" in {c["name"] for c in inspector.get_columns(TABLE)}:
        with op.batch_alter_table(TABLE) as batch:
            batch.drop_column("kinds")
