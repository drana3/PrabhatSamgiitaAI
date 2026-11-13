"""Signed member sessions and the request limiter's counters.

Revision ID: 0055_member_sessions_rate_limits
Revises: 0054_lead_instrument_values

member_sessions
    One row per signed-in device. Holds only the SHA-256 of the refresh token (and of the one
    before it, to notice a stolen copy), when it expires and whether it was revoked. Access
    tokens are not stored.
rate_limit_counters
    Request counters per hashed key and time window, shared by all API instances.

Two new tables, nothing existing is touched. Safe to run twice, and on a database where the app
already ran `Base.metadata.create_all`. Works on PostgreSQL and SQLite. Downgrade drops the two
tables.
"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0055_member_sessions_rate_limits"
down_revision = "0054_lead_instrument_values"
branch_labels = None
depends_on = None


def _has_table(name: str) -> bool:
    return name in sa.inspect(op.get_bind()).get_table_names()


def upgrade() -> None:
    if not _has_table("member_sessions"):
        op.create_table(
            "member_sessions",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column(
                "user_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("user_accounts.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("refresh_hash", sa.String(64), nullable=False),
            sa.Column("previous_refresh_hash", sa.String(64)),
            sa.Column("device_label", sa.String(120)),
            sa.Column("sign_in_provider", sa.String(32)),
            sa.Column("last_used_at", sa.DateTime(timezone=True)),
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("revoked_at", sa.DateTime(timezone=True)),
            sa.Column("revoked_reason", sa.Text()),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )
        op.create_index("ix_member_sessions_user_id", "member_sessions", ["user_id"])
        op.create_index("ix_member_sessions_revoked_at", "member_sessions", ["revoked_at"])
    if not _has_table("rate_limit_counters"):
        op.create_table(
            "rate_limit_counters",
            sa.Column("key", sa.String(120), primary_key=True),
            sa.Column("window_start", sa.BigInteger(), primary_key=True),
            sa.Column("hits", sa.Integer(), nullable=False),
            sa.Column("expires_at", sa.BigInteger(), nullable=False),
        )
        op.create_index("ix_rate_limit_counters_expires_at", "rate_limit_counters", ["expires_at"])


def downgrade() -> None:
    if _has_table("rate_limit_counters"):
        op.drop_table("rate_limit_counters")
    if _has_table("member_sessions"):
        op.drop_table("member_sessions")
