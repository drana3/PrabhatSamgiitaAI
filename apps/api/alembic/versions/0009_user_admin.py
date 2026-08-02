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
    op.add_column(
        "user_accounts",
        sa.Column("is_admin", sa.Boolean(), server_default="false", nullable=False),
    )
    op.create_index("ix_user_accounts_is_admin", "user_accounts", ["is_admin"])


def downgrade() -> None:
    op.drop_index("ix_user_accounts_is_admin", table_name="user_accounts")
    op.drop_column("user_accounts", "is_admin")
