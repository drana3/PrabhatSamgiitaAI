"""add members, personalization, testimonials, and reflection quotes

Revision ID: 0006_members_reflections
Revises: 0005_analytics_daily
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0006_members_reflections"
down_revision: str | None = "0005_analytics_daily"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def timestamps() -> list[sa.Column[object]]:
    return [
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    ]


def upgrade() -> None:
    op.create_table(
        "user_accounts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("external_subject", sa.String(255), nullable=False, unique=True),
        sa.Column("identity_provider", sa.String(64), nullable=False),
        sa.Column("email", sa.String(320)),
        sa.Column("display_name", sa.String(255), nullable=False),
        sa.Column("avatar_url", sa.Text()),
        sa.Column("preferred_language", sa.String(32)),
        sa.Column("country", sa.String(128)),
        sa.Column("personalization_enabled", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
        *timestamps(),
    )
    op.create_index("ix_user_accounts_external_subject", "user_accounts", ["external_subject"])
    op.create_index("ix_user_accounts_email", "user_accounts", ["email"])

    op.create_table(
        "user_favorites",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("user_accounts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("song_number", sa.Integer(), nullable=False),
        *timestamps(),
        sa.UniqueConstraint("user_id", "song_number", name="uq_user_favorite"),
    )
    op.create_index("ix_user_favorites_user_id", "user_favorites", ["user_id"])
    op.create_index("ix_user_favorites_song_number", "user_favorites", ["song_number"])

    op.create_table(
        "user_playlists",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("user_accounts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("description", sa.Text()),
        *timestamps(),
    )
    op.create_index("ix_user_playlists_user_id", "user_playlists", ["user_id"])

    op.create_table(
        "user_playlist_songs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "playlist_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("user_playlists.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("song_number", sa.Integer(), nullable=False),
        sa.Column("position", sa.Integer(), server_default="0"),
        *timestamps(),
        sa.UniqueConstraint("playlist_id", "song_number", name="uq_user_playlist_song"),
    )
    op.create_index(
        "ix_user_playlist_songs_playlist_id", "user_playlist_songs", ["playlist_id"]
    )
    op.create_index(
        "ix_user_playlist_songs_song_number", "user_playlist_songs", ["song_number"]
    )

    op.create_table(
        "user_chat_messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("user_accounts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("song_number", sa.Integer()),
        sa.Column("role", sa.String(16), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        *timestamps(),
    )
    op.create_index("ix_user_chat_messages_user_id", "user_chat_messages", ["user_id"])
    op.create_index(
        "ix_user_chat_messages_song_number", "user_chat_messages", ["song_number"]
    )
    op.create_index("ix_user_chat_messages_expires_at", "user_chat_messages", ["expires_at"])

    op.create_table(
        "user_interest_profiles",
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("user_accounts.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("summary_text", sa.Text(), server_default=""),
        sa.Column("topic_counts", postgresql.JSONB(), server_default="{}"),
        sa.Column("song_counts", postgresql.JSONB(), server_default="{}"),
        sa.Column("language_counts", postgresql.JSONB(), server_default="{}"),
        *timestamps(),
    )

    op.create_table(
        "community_testimonials",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("user_accounts.id", ondelete="SET NULL"),
        ),
        sa.Column("quote_text", sa.Text(), nullable=False),
        sa.Column("display_name", sa.String(120), nullable=False),
        sa.Column("display_location", sa.String(160)),
        sa.Column("avatar_url", sa.Text()),
        sa.Column("consented_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("approved_at", sa.DateTime(timezone=True)),
        sa.Column("status", sa.String(32), server_default="pending"),
        *timestamps(),
    )
    op.create_index(
        "ix_community_testimonials_user_id", "community_testimonials", ["user_id"]
    )
    op.create_index("ix_community_testimonials_status", "community_testimonials", ["status"])

    op.create_table(
        "reflection_quotes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("quote_text", sa.Text(), nullable=False),
        sa.Column("attribution", sa.String(255), nullable=False),
        sa.Column("source_title", sa.String(500), nullable=False),
        sa.Column("source_url", sa.Text(), nullable=False),
        sa.Column("source_date", sa.String(64)),
        sa.Column("themes", postgresql.JSONB(), server_default="{}"),
        sa.Column("observances", postgresql.JSONB(), server_default="{}"),
        sa.Column("verification_status", sa.String(32), server_default="pending"),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        *timestamps(),
    )
    op.create_index(
        "ix_reflection_quotes_verification_status",
        "reflection_quotes",
        ["verification_status"],
    )


def downgrade() -> None:
    op.drop_table("reflection_quotes")
    op.drop_table("community_testimonials")
    op.drop_table("user_interest_profiles")
    op.drop_table("user_chat_messages")
    op.drop_table("user_playlist_songs")
    op.drop_table("user_playlists")
    op.drop_table("user_favorites")
    op.drop_table("user_accounts")
