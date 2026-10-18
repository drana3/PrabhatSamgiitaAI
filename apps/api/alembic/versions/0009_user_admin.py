"""add member admin flag

Revision ID: 0009_user_admin
Revises: 0008_quiz
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0009_user_admin"
down_revision: str | None = "0008_quiz"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Idempotent: safe if create_all / startup DDL already added the column.
    op.execute(
        sa.text(
            "ALTER TABLE user_accounts "
            "ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false"
        )
    )
    op.execute(
        sa.text(
            "CREATE INDEX IF NOT EXISTS ix_user_accounts_is_admin "
            "ON user_accounts (is_admin)"
        )
    )


def downgrade() -> None:
    op.drop_index("ix_user_accounts_is_admin", table_name="user_accounts")
    op.drop_column("user_accounts", "is_admin")
