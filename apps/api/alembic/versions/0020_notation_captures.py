"""Admin line-by-line sargam capture drafts.

Revision ID: 0020_notation_captures
Revises: 0019_ai_daily_usage
"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0020_notation_captures"
down_revision = "0019_ai_daily_usage"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "notation_captures",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("song_number", sa.Integer(), nullable=False),
        sa.Column(
            "admin_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("user_accounts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("source_scale", sa.String(length=8), nullable=False, server_default="C"),
        sa.Column("tempo_bpm", sa.Integer(), nullable=False, server_default="100"),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="admin_draft"),
        sa.Column(
            "lines_json",
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.UniqueConstraint("song_number", "admin_id", name="uq_notation_captures_song_admin"),
    )
    op.create_index("ix_notation_captures_song_number", "notation_captures", ["song_number"])
    op.create_index("ix_notation_captures_admin_id", "notation_captures", ["admin_id"])


def downgrade() -> None:
    op.drop_index("ix_notation_captures_admin_id", table_name="notation_captures")
    op.drop_index("ix_notation_captures_song_number", table_name="notation_captures")
    op.drop_table("notation_captures")
