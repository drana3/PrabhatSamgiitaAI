"""Add ai_daily_usage for persisted AI companion quotas.

Revision ID: 0019_ai_daily_usage
Revises: 0018_catalog_timestamps
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "0019_ai_daily_usage"
down_revision = "0018_catalog_timestamps"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ai_daily_usage",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("identity_key", sa.String(length=320), nullable=False),
        sa.Column("usage_date", sa.Date(), nullable=False),
        sa.Column("question_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_member", sa.Boolean(), nullable=False, server_default="false"),
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
        sa.UniqueConstraint("identity_key", "usage_date", name="uq_ai_daily_usage_identity_date"),
    )
    op.create_index("ix_ai_daily_usage_identity_key", "ai_daily_usage", ["identity_key"])
    op.create_index("ix_ai_daily_usage_usage_date", "ai_daily_usage", ["usage_date"])


def downgrade() -> None:
    op.drop_index("ix_ai_daily_usage_usage_date", table_name="ai_daily_usage")
    op.drop_index("ix_ai_daily_usage_identity_key", table_name="ai_daily_usage")
    op.drop_table("ai_daily_usage")
