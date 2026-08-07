"""Add email/password credentials for local sign-up.

Revision ID: 0010_user_credentials
Revises: 0009_user_admin
Create Date: 2026-08-07
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0010_user_credentials"
down_revision = "0009_user_admin"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_credentials",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("user_accounts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("password_hash", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("email", name="uq_user_credentials_email"),
        sa.UniqueConstraint("user_id", name="uq_user_credentials_user_id"),
    )
    op.create_index("ix_user_credentials_email", "user_credentials", ["email"], unique=False)
    op.create_index("ix_user_credentials_user_id", "user_credentials", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_user_credentials_user_id", table_name="user_credentials")
    op.drop_index("ix_user_credentials_email", table_name="user_credentials")
    op.drop_table("user_credentials")
