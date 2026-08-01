"""initial

Revision ID: 0001_initial
Revises:
Create Date: 2026-07-31 00:00:00
"""

from typing import Any

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

from alembic import op

try:
    from pgvector.sqlalchemy import Vector
except ImportError:  # pragma: no cover - migration fallback in lightweight envs
    from sqlalchemy.types import JSON, TypeDecorator

    class Vector(TypeDecorator[Any]):  # type: ignore[no-redef]
        impl = JSON
        cache_ok = True

        def __init__(self, dimension: int) -> None:
            super().__init__()
            self.dimension = dimension


from app.core.vector import VECTOR_DIMENSION

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    op.create_table(
        "songs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("number", sa.Integer(), nullable=False, unique=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("first_line", sa.String(length=512)),
        sa.Column("lyrics_original", sa.Text()),
        sa.Column("transliteration", sa.Text()),
        sa.Column("hindi_meaning", sa.Text()),
        sa.Column("english_meaning", sa.Text()),
        sa.Column("theme", sa.String(length=255)),
        sa.Column("occasion", sa.String(length=255)),
        sa.Column("festival", sa.String(length=255)),
        sa.Column("season", sa.String(length=255)),
        sa.Column("mood", sa.String(length=255)),
        sa.Column("language", sa.String(length=64)),
        sa.Column("difficulty", sa.String(length=64)),
        sa.Column("meditation_context", sa.String(length=255)),
        sa.Column("raga", sa.String(length=255)),
        sa.Column("tala", sa.String(length=255)),
        sa.Column("harmonium_notation", sa.Text()),
        sa.Column("canonical_source_url", sa.String(length=512)),
        sa.Column(
            "canonical_source_status",
            sa.String(length=32),
            server_default="pending",
            nullable=False,
        ),
        sa.Column("is_verified", sa.Boolean(), server_default="false"),
        sa.Column("embeddings", Vector(VECTOR_DIMENSION)),
        sa.Column("metadata_json", JSONB(), server_default=sa.text("'{}'::jsonb")),
    )
    op.create_index("ix_songs_number", "songs", ["number"], unique=True)
    op.create_table(
        "media",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("song_number", sa.Integer(), index=True),
        sa.Column("kind", sa.String(length=32), nullable=False),
        sa.Column("provider", sa.String(length=64), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("url", sa.String(length=1024), nullable=False),
        sa.Column("embed_url", sa.String(length=1024)),
        sa.Column(
            "verification_status",
            sa.String(length=32),
            server_default="unverified",
            nullable=False,
        ),
        sa.Column("source_url", sa.String(length=1024)),
        sa.Column("notes", sa.Text()),
        sa.Column("metadata_json", JSONB(), server_default=sa.text("'{}'::jsonb")),
    )
    op.create_table(
        "notations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("song_number", sa.Integer(), index=True, nullable=False),
        sa.Column("source_url", sa.String(length=1024)),
        sa.Column("notation_text", sa.Text()),
        sa.Column("scale", sa.String(length=64)),
        sa.Column(
            "verification_status",
            sa.String(length=32),
            server_default="verified",
            nullable=False,
        ),
        sa.Column("metadata_json", JSONB(), server_default=sa.text("'{}'::jsonb")),
    )
    op.create_table(
        "inventory_items",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("source_kind", sa.String(length=64), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("url", sa.String(length=1024), nullable=False, unique=True),
        sa.Column("status", sa.String(length=32), server_default="active", nullable=False),
        sa.Column("metadata_json", JSONB(), server_default=sa.text("'{}'::jsonb")),
        sa.Column("notes", sa.Text()),
    )


def downgrade() -> None:
    op.drop_table("inventory_items")
    op.drop_table("notations")
    op.drop_table("media")
    op.drop_index("ix_songs_number", table_name="songs")
    op.drop_table("songs")
