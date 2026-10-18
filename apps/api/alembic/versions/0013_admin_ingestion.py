"""Admin ingestion workflow: super-admin, youtube review, song submissions.

Revision ID: 0013_admin_ingestion
Revises: 0012_quiz_events
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0013_admin_ingestion"
down_revision: str | None = "0012_quiz_events"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "user_accounts",
        sa.Column("is_super_admin", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.create_index("ix_user_accounts_is_super_admin", "user_accounts", ["is_super_admin"])

    op.create_table(
        "youtube_review_queue",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("external_id", sa.String(64), nullable=False, unique=True),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("url", sa.String(1024), nullable=False),
        sa.Column("channel_id", sa.String(128), nullable=True),
        sa.Column("channel_name", sa.String(255), nullable=True),
        sa.Column("source_url", sa.String(1024), nullable=True),
        sa.Column("candidate_song_number", sa.Integer(), nullable=True),
        sa.Column("title_similarity", sa.Float(), nullable=True),
        sa.Column("review_reason", sa.String(128), nullable=False, server_default="pending_review"),
        sa.Column("status", sa.String(32), nullable=False, server_default="pending_review"),
        sa.Column("review_note", sa.Text(), nullable=True),
        sa.Column("reviewed_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
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
    op.create_index("ix_youtube_review_queue_status", "youtube_review_queue", ["status"])

    op.create_table(
        "song_ingestion_submissions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "submitted_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("user_accounts.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("song_number", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default="pending_super_admin"),
        sa.Column(
            "payload_json",
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column(
            "language_warnings",
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column("review_note", sa.Text(), nullable=True),
        sa.Column(
            "reviewed_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("user_accounts.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
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
    op.create_index(
        "ix_song_ingestion_submissions_status",
        "song_ingestion_submissions",
        ["status"],
    )
    op.create_index(
        "ix_song_ingestion_submissions_song_number",
        "song_ingestion_submissions",
        ["song_number"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_song_ingestion_submissions_song_number",
        table_name="song_ingestion_submissions",
    )
    op.drop_index("ix_song_ingestion_submissions_status", table_name="song_ingestion_submissions")
    op.drop_table("song_ingestion_submissions")
    op.drop_index("ix_youtube_review_queue_status", table_name="youtube_review_queue")
    op.drop_table("youtube_review_queue")
    op.drop_index("ix_user_accounts_is_super_admin", table_name="user_accounts")
    op.drop_column("user_accounts", "is_super_admin")
