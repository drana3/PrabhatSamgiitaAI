"""add inspiration stories with full in-app content

Revision ID: 0007_inspiration_stories
Revises: 0006_members_reflections
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0007_inspiration_stories"
down_revision: str | None = "0006_members_reflections"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "inspiration_stories",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("slug", sa.String(120), nullable=False, unique=True),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("author", sa.String(255), nullable=False),
        sa.Column("teaser", sa.Text(), nullable=False),
        sa.Column("source_url", sa.Text(), nullable=False),
        sa.Column(
            "body_paragraphs",
            postgresql.JSONB(),
            nullable=False,
            server_default="[]",
        ),
        sa.Column(
            "themes",
            postgresql.JSONB(),
            nullable=False,
            server_default="[]",
        ),
        sa.Column(
            "song_numbers",
            postgresql.JSONB(),
            nullable=False,
            server_default="[]",
        ),
        sa.Column(
            "verification_status",
            sa.String(32),
            nullable=False,
            server_default="source_verified",
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_inspiration_stories_slug", "inspiration_stories", ["slug"])
    op.create_index(
        "ix_inspiration_stories_verification_status",
        "inspiration_stories",
        ["verification_status"],
    )


def downgrade() -> None:
    op.drop_table("inspiration_stories")
