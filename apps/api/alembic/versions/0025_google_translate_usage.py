"""Add google_translate_usage for free-tier character budget.

Revision ID: 0025_google_translate_usage
Revises: 0024_song_central_idea
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "0025_google_translate_usage"
down_revision = "0024_song_central_idea"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "google_translate_usage",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("month_key", sa.String(length=7), nullable=False),
        sa.Column("characters", sa.Integer(), nullable=False, server_default="0"),
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
        sa.UniqueConstraint("month_key", name="uq_google_translate_usage_month"),
    )
    op.create_index(
        "ix_google_translate_usage_month_key",
        "google_translate_usage",
        ["month_key"],
    )


def downgrade() -> None:
    op.drop_index("ix_google_translate_usage_month_key", table_name="google_translate_usage")
    op.drop_table("google_translate_usage")
