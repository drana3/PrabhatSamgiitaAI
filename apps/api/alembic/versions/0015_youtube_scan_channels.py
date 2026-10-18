"""YouTube scan channel configuration.

Revision ID: 0015_youtube_scan_channels
Revises: 0014_password_reset_announcements
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0015_youtube_scan_channels"
down_revision: str | None = "0014_password_reset_announcements"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "youtube_scan_channels",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("channel_id", sa.String(128), nullable=False, unique=True),
        sa.Column("channel_url", sa.String(1024), nullable=False),
        sa.Column("is_trusted", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("notes", sa.Text()),
        sa.Column("last_scanned_at", sa.DateTime(timezone=True)),
        sa.Column("last_scan_discovered", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_scan_new", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_scan_known", sa.Integer(), nullable=False, server_default="0"),
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
    op.create_index("ix_youtube_scan_channels_is_active", "youtube_scan_channels", ["is_active"])

    op.execute(
        sa.text(
            """
            INSERT INTO youtube_scan_channels (
                id, name, channel_id, channel_url, is_trusted, is_active, notes
            ) VALUES
            (
                gen_random_uuid(),
                'AMPS Spirituality',
                'UCzJy4vdGKx6gzP782-5buOQ',
                'https://www.youtube.com/@AMPS0521spirituality/videos',
                true,
                true,
                'Embedded from the allow-listed AMPS spirituality channel; not re-hosted.'
            ),
            (
                gen_random_uuid(),
                'ANANDA MARGA',
                'UCc3f8g07me5NpqHfAsF8GIA',
                'https://www.youtube.com/@Ananda_Marga/videos',
                true,
                true,
                'Embedded from the allow-listed ANANDA MARGA channel; not re-hosted.'
            )
            ON CONFLICT (channel_id) DO NOTHING
            """
        )
    )


def downgrade() -> None:
    op.drop_table("youtube_scan_channels")
