"""Add member phone fields and verification codes.

Revision ID: 0016_member_phone
Revises: 0015_youtube_scan_channels
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "0016_member_phone"
down_revision = "0015_youtube_scan_channels"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("user_accounts", sa.Column("phone_e164", sa.String(length=20), nullable=True))
    op.add_column(
        "user_accounts", sa.Column("phone_country_code", sa.String(length=2), nullable=True)
    )
    op.add_column(
        "user_accounts",
        sa.Column("phone_verified_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_user_accounts_phone_e164", "user_accounts", ["phone_e164"], unique=True)

    op.create_table(
        "phone_verification_codes",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("phone_e164", sa.String(length=20), nullable=False),
        sa.Column("code_hash", sa.Text(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
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
        sa.ForeignKeyConstraint(["user_id"], ["user_accounts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_phone_verification_codes_user_id", "phone_verification_codes", ["user_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_phone_verification_codes_user_id", table_name="phone_verification_codes")
    op.drop_table("phone_verification_codes")
    op.drop_index("ix_user_accounts_phone_e164", table_name="user_accounts")
    op.drop_column("user_accounts", "phone_verified_at")
    op.drop_column("user_accounts", "phone_country_code")
    op.drop_column("user_accounts", "phone_e164")
