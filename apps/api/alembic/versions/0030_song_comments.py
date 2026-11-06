"""Comments of members on Prabhat Samgiita songs, and their reports.

Revision ID: 0030_song_comments
Revises: 0029_recording_duplicates

Two new tables, written out by hand (not from the models) so the revision keeps meaning the same
after the models change. Safe to run twice or on a database where the tables already exist: the
app also runs `Base.metadata.create_all` at start, so on a new database they may be there already.
Each table is looked for first; an existing one is left alone.

Never run it against a real database without a backup.
"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0030_song_comments"
down_revision = "0029_recording_duplicates"
branch_labels = None
depends_on = None

COMMENTS = "song_comments"
REPORTS = "song_comment_reports"


def _uuid() -> sa.types.TypeEngine:
    return postgresql.UUID(as_uuid=True)


def _stamps() -> list[sa.Column]:
    return [
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    ]


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table(COMMENTS):
        op.create_table(
            COMMENTS,
            sa.Column("id", _uuid(), primary_key=True),
            sa.Column("song_id", sa.Integer(), nullable=False),
            sa.Column(
                "member_id",
                _uuid(),
                sa.ForeignKey("user_accounts.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("body", sa.Text(), nullable=False),
            sa.Column("is_anonymous", sa.Boolean(), server_default=sa.false(), nullable=False),
            sa.Column("status", sa.String(16), server_default="published", nullable=False),
            sa.Column("reports_count", sa.Integer(), server_default="0", nullable=False),
            sa.Column("removed_reason", sa.Text()),
            sa.Column("removed_at", sa.DateTime(timezone=True)),
            sa.Column("removed_by", sa.String(255)),
            *_stamps(),
            sa.CheckConstraint("song_id >= 1 AND song_id <= 5018", name="ck_song_comments_song"),
            sa.CheckConstraint(
                "status IN ('published', 'removed')", name="ck_song_comments_status"
            ),
            sa.CheckConstraint(
                "length(body) >= 1 AND length(body) <= 2000", name="ck_song_comments_body"
            ),
        )
        op.create_index("ix_song_comments_member_id", COMMENTS, ["member_id"])
        op.create_index(
            "ix_song_comments_song_status_created", COMMENTS, ["song_id", "status", "created_at"]
        )
    if not inspector.has_table(REPORTS):
        op.create_table(
            REPORTS,
            sa.Column("id", _uuid(), primary_key=True),
            sa.Column(
                "comment_id",
                _uuid(),
                sa.ForeignKey(f"{COMMENTS}.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("reporter_key", sa.String(80), nullable=False),
            sa.Column(
                "reporter_id",
                _uuid(),
                sa.ForeignKey("user_accounts.id", ondelete="SET NULL"),
            ),
            sa.Column("reason", sa.String(16), nullable=False),
            sa.Column("note", sa.Text()),
            *_stamps(),
            sa.UniqueConstraint("comment_id", "reporter_key", name="uq_song_comment_reports_once"),
            sa.CheckConstraint(
                "reason IN ('offensive', 'spam', 'private', 'other')",
                name="ck_song_comment_reports_reason",
            ),
        )
        op.create_index("ix_song_comment_reports_comment_id", REPORTS, ["comment_id"])


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if inspector.has_table(REPORTS):
        op.drop_table(REPORTS)
    if inspector.has_table(COMMENTS):
        op.drop_table(COMMENTS)
