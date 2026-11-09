"""Broadcasts: a link to a live or announced Zoom, YouTube Live, Facebook or Instagram Live.

Revision ID: 0061_broadcasts
Revises: 0060_language_word_suggestions

broadcasts
    One row per posted broadcast: the link as stored, its provider (youtube, zoom, facebook,
    instagram, other), the title, the optional start (UTC) and the zone the organizer meant,
    description, organizer, what a look at a YouTube link found (title, thumbnail, link status),
    reports count and the moderation state. Removed with the account (cascade).
broadcast_reports
    One row per person and broadcast. Removed with the broadcast.

Nothing is guessed for old data: there is none. The state (upcoming, now, ended) is worked out
when it is read, so no job is needed.

Safe to run twice, and on a database where the app already ran `Base.metadata.create_all`.
Works on PostgreSQL and SQLite. Downgrade drops only the two tables of this revision.

Never run it against a real database without a backup.
"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0061_broadcasts"
down_revision = "0060_language_word_suggestions"
branch_labels = None
depends_on = None


def _uuid() -> postgresql.UUID:
    return postgresql.UUID(as_uuid=True)


def upgrade() -> None:
    tables = set(sa.inspect(op.get_bind()).get_table_names())
    if "broadcasts" not in tables:
        op.create_table(
            "broadcasts",
            sa.Column("id", _uuid(), primary_key=True),
            sa.Column(
                "member_id",
                _uuid(),
                sa.ForeignKey("user_accounts.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("provider", sa.String(12), nullable=False),
            sa.Column("external_id", sa.String(32), nullable=False, server_default=""),
            sa.Column("url", sa.String(500), nullable=False),
            sa.Column("host", sa.String(100), nullable=False),
            sa.Column("title", sa.String(120), nullable=False),
            sa.Column("description", sa.Text()),
            sa.Column("organizer", sa.String(120)),
            sa.Column("starts_at", sa.DateTime(timezone=True)),
            sa.Column("timezone", sa.String(64)),
            sa.Column("ended_at", sa.DateTime(timezone=True)),
            sa.Column("thumbnail_url", sa.String(300)),
            sa.Column("fetched_title", sa.String(200)),
            sa.Column("link_status", sa.String(12), nullable=False, server_default="unknown"),
            sa.Column("check_fails", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("checked_at", sa.DateTime(timezone=True)),
            sa.Column("status", sa.String(12), nullable=False, server_default="published"),
            sa.Column("reports_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("removed_reason", sa.Text()),
            sa.Column("removed_at", sa.DateTime(timezone=True)),
            sa.Column("removed_by", sa.String(255)),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.CheckConstraint(
                "provider IN ('youtube', 'zoom', 'facebook', 'instagram', 'other')",
                name="ck_broadcasts_provider",
            ),
            sa.CheckConstraint("status IN ('published', 'removed')", name="ck_broadcasts_status"),
            sa.CheckConstraint(
                "link_status IN ('unknown', 'ok', 'no_embed', 'unavailable')",
                name="ck_broadcasts_link_status",
            ),
        )
        op.create_index("ix_broadcasts_status_start", "broadcasts", ["status", "starts_at"])
        op.create_index("ix_broadcasts_member_created", "broadcasts", ["member_id", "created_at"])
    if "broadcast_reports" not in tables:
        op.create_table(
            "broadcast_reports",
            sa.Column("id", _uuid(), primary_key=True),
            sa.Column(
                "broadcast_id",
                _uuid(),
                sa.ForeignKey("broadcasts.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("reporter_key", sa.String(80), nullable=False),
            sa.Column(
                "reporter_id",
                _uuid(),
                sa.ForeignKey("user_accounts.id", ondelete="SET NULL"),
            ),
            sa.Column("reason", sa.String(20), nullable=False),
            sa.Column("note", sa.String(1000)),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.UniqueConstraint(
                "broadcast_id", "reporter_key", name="uq_broadcast_reports_reporter"
            ),
            sa.CheckConstraint(
                "reason IN ('broken', 'not_a_broadcast', 'offensive', 'spam', 'other')",
                name="ck_broadcast_reports_reason",
            ),
        )
        op.create_index("ix_broadcast_reports_broadcast_id", "broadcast_reports", ["broadcast_id"])


def downgrade() -> None:
    tables = set(sa.inspect(op.get_bind()).get_table_names())
    if "broadcast_reports" in tables:
        op.drop_table("broadcast_reports")
    if "broadcasts" in tables:
        op.drop_table("broadcasts")
