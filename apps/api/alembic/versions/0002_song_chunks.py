"""add song chunks

Revision ID: 0002_song_chunks
Revises: 0001_initial
Create Date: 2026-07-31 00:00:01
"""

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

from alembic import op

try:
    from pgvector.sqlalchemy import Vector
except ImportError:  # pragma: no cover - migration fallback in lightweight envs
    from sqlalchemy.types import JSON, TypeDecorator

    class Vector(TypeDecorator):
        impl = JSON
        cache_ok = True

        def __init__(self, dimension: int) -> None:
            super().__init__()
            self.dimension = dimension


from app.core.vector import VECTOR_DIMENSION

revision = "0002_song_chunks"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "song_chunks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("song_number", sa.Integer(), nullable=False),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("chunk_type", sa.String(length=64), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("source_url", sa.String(length=512)),
        sa.Column("embeddings", Vector(VECTOR_DIMENSION)),
        sa.Column("metadata_json", JSONB(), server_default=sa.text("'{}'::jsonb")),
    )
    op.create_index("ix_song_chunks_song_number", "song_chunks", ["song_number"], unique=False)
    op.create_index(
        "ix_song_chunks_song_number_chunk_index",
        "song_chunks",
        ["song_number", "chunk_index"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ix_song_chunks_song_number_chunk_index", table_name="song_chunks")
    op.drop_index("ix_song_chunks_song_number", table_name="song_chunks")
    op.drop_table("song_chunks")
