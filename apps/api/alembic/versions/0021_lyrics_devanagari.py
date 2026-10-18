"""Add Devanagari lyrics + review status on songs.

Revision ID: 0021_lyrics_devanagari
Revises: 0020_notation_captures
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "0021_lyrics_devanagari"
down_revision = "0020_notation_captures"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("songs", sa.Column("lyrics_devanagari", sa.Text(), nullable=True))
    op.add_column(
        "songs",
        sa.Column(
            "devanagari_status",
            sa.String(length=32),
            nullable=False,
            server_default="none",
        ),
    )
    op.create_index(
        "ix_songs_devanagari_status", "songs", ["devanagari_status"], unique=False
    )


def downgrade() -> None:
    op.drop_index("ix_songs_devanagari_status", table_name="songs")
    op.drop_column("songs", "devanagari_status")
    op.drop_column("songs", "lyrics_devanagari")
