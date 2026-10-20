"""Add songs.central_idea for official Central idea / Purport prose.

Revision ID: 0024_song_central_idea
Revises: 0023_merge_youtube_number_source
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "0024_song_central_idea"
down_revision = "0023_merge_youtube_number_source"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("songs", sa.Column("central_idea", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("songs", "central_idea")
