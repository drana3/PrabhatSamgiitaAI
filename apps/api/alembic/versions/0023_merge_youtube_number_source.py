"""Merge youtube number_source branch into main lineage.

Revision ID: 0023_merge_youtube_number_source
Revises: 0022_user_feedback_replies, 0017_youtube_number_source
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0023_merge_youtube_number_source"
down_revision = ("0022_user_feedback_replies", "0017_youtube_number_source")
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 0017_youtube_number_source may not have been applied on DBs that followed
    # the drop_pgvector branch; ensure the column exists after merge.
    bind = op.get_bind()
    cols = {
        row[0]
        for row in bind.execute(
            sa.text(
                "select column_name from information_schema.columns "
                "where table_schema='public' and table_name='youtube_scan_channels'"
            )
        )
    }
    if "number_source" not in cols:
        op.add_column(
            "youtube_scan_channels",
            sa.Column(
                "number_source",
                sa.String(length=32),
                nullable=False,
                server_default="title",
            ),
        )


def downgrade() -> None:
    pass
