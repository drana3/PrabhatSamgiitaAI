"""Days with suspicious play counts, held back from the numbers authors see.

Revision ID: 0058_play_flags
Revises: 0057_takedown_requests

play_flags
    One row per recording and day that looked inflated: how many plays were held back, the
    ordinary level it was compared with, the reason, and whether a person cleared or confirmed it.
    No listener or address data.

One new table, nothing existing is touched. Safe to run twice. Works on PostgreSQL and SQLite.
Downgrade drops the table.
"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0058_play_flags"
down_revision = "0057_takedown_requests"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if "play_flags" in sa.inspect(op.get_bind()).get_table_names():
        return
    op.create_table(
        "play_flags",
        sa.Column(
            "recording_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("recordings.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("day", sa.Date(), primary_key=True),
        sa.Column("plays", sa.Integer(), nullable=False),
        sa.Column("held", sa.Integer(), nullable=False),
        sa.Column("baseline", sa.Float(), nullable=False, server_default="0"),
        sa.Column("reason", sa.String(80), nullable=False),
        sa.Column("status", sa.String(12), nullable=False, server_default="open"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("reviewed_by", sa.String(120)),
        sa.Column("reviewed_at", sa.DateTime(timezone=True)),
        sa.CheckConstraint(
            "status IN ('open', 'cleared', 'confirmed')", name="ck_play_flag_status"
        ),
    )
    op.create_index("ix_play_flags_status_day", "play_flags", ["status", "day"])


def downgrade() -> None:
    if "play_flags" in sa.inspect(op.get_bind()).get_table_names():
        op.drop_table("play_flags")
