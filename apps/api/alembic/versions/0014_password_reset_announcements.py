"""Password reset tokens and site announcements.

Revision ID: 0014_password_reset_announcements
Revises: 0013_admin_ingestion
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0014_password_reset_announcements"
down_revision: str | None = "0013_admin_ingestion"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "password_reset_tokens",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("user_accounts.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("token_hash", sa.String(128), nullable=False, unique=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True)),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_password_reset_tokens_expires_at",
        "password_reset_tokens",
        ["expires_at"],
    )

    op.create_table(
        "site_announcements",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("kind", sa.String(32), nullable=False, server_default="general"),
        sa.Column("priority", sa.String(16), nullable=False, server_default="normal"),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("notify_by_email", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("email_sent_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("user_accounts.id", ondelete="SET NULL"),
            nullable=True,
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
    )
    op.create_index("ix_site_announcements_ends_at", "site_announcements", ["ends_at"])
    op.create_index("ix_site_announcements_is_active", "site_announcements", ["is_active"])


def downgrade() -> None:
    op.drop_table("site_announcements")
    op.drop_table("password_reset_tokens")
