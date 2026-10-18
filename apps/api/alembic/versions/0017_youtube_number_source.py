"""Add per-channel song-number source for YouTube scanning.

Revision ID: 0017_youtube_number_source
Revises: 0016_member_phone
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "0017_youtube_number_source"
down_revision = "0016_member_phone"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "youtube_scan_channels",
        sa.Column(
            "number_source",
            sa.String(length=32),
            nullable=False,
            server_default="title",
        ),
    )


def downgrade() -> None:
    op.drop_column("youtube_scan_channels", "number_source")
