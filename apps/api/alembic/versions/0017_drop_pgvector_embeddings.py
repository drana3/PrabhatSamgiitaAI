"""Drop pgvector columns; semantic search now uses in-memory FAISS.

Revision ID: 0017_drop_pgvector_embeddings
Revises: 0016_member_phone
"""

from __future__ import annotations

from alembic import op

revision = "0017_drop_pgvector_embeddings"
down_revision = "0016_member_phone"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE IF EXISTS songs DROP COLUMN IF EXISTS embeddings")
    op.execute("ALTER TABLE IF EXISTS song_chunks DROP COLUMN IF EXISTS embeddings")
    op.execute("DROP EXTENSION IF EXISTS vector")


def downgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    op.execute("ALTER TABLE songs ADD COLUMN IF NOT EXISTS embeddings vector(1536)")
    op.execute("ALTER TABLE song_chunks ADD COLUMN IF NOT EXISTS embeddings vector(1536)")
