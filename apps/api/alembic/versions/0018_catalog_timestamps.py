"""Add created_at/updated_at to legacy catalog tables.

Revision ID: 0018_catalog_timestamps
Revises: 0017_drop_pgvector_embeddings
"""

from __future__ import annotations

from alembic import op

revision = "0018_catalog_timestamps"
down_revision = "0017_drop_pgvector_embeddings"
branch_labels = None
depends_on = None

_CATALOG_TABLES = ("songs", "media", "notations", "inventory_items", "song_chunks")


def upgrade() -> None:
    for table in _CATALOG_TABLES:
        op.execute(
            f"""
            ALTER TABLE {table}
            ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            """
        )
        op.execute(
            f"""
            ALTER TABLE {table}
            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
            """
        )


def downgrade() -> None:
    for table in _CATALOG_TABLES:
        op.execute(f"ALTER TABLE {table} DROP COLUMN IF EXISTS updated_at")
        op.execute(f"ALTER TABLE {table} DROP COLUMN IF EXISTS created_at")
