"""Add monthly chat archive summaries to interest profiles.

Revision ID: 0011_chat_archives
Revises: 0010_user_credentials
Create Date: 2026-08-08
"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0011_chat_archives"
down_revision = "0010_user_credentials"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "user_interest_profiles",
        sa.Column(
            "monthly_summaries",
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )


def downgrade() -> None:
    op.drop_column("user_interest_profiles", "monthly_summaries")
