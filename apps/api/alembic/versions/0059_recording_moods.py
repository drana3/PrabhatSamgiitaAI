"""Moods of recordings: the uploader suggests, listeners confirm, the team decides.

Revision ID: 0059_recording_moods
Revises: 0058_play_flags

recording_moods
    One row per recording and mood (joyful, longing, calm, ecstatic, devotion, sad), with the
    status (suggested, confirmed, rejected), where it came from (uploader, listeners, team), the
    vote counters and whether the team locked it.
recording_mood_votes
    One row per member, recording and mood: +1 "this fits", -1 "it does not". Removed with the
    account (cascade).

Nothing is guessed for old recordings: they simply have no mood rows.

Safe to run twice, and on a database where the app already ran `Base.metadata.create_all`.
Works on PostgreSQL and SQLite. Downgrade drops only the two tables of this revision.

Never run it against a real database without a backup.
"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0059_recording_moods"
down_revision = "0058_play_flags"
branch_labels = None
depends_on = None


def _uuid() -> postgresql.UUID:
    return postgresql.UUID(as_uuid=True)


def upgrade() -> None:
    tables = set(sa.inspect(op.get_bind()).get_table_names())
    if "recording_moods" not in tables:
        op.create_table(
            "recording_moods",
            sa.Column(
                "recording_id",
                _uuid(),
                sa.ForeignKey("recordings.id", ondelete="CASCADE"),
                primary_key=True,
            ),
            sa.Column("mood", sa.String(24), primary_key=True),
            sa.Column("status", sa.String(12), nullable=False, server_default="suggested"),
            sa.Column("source", sa.String(12), nullable=False, server_default="listeners"),
            sa.Column("locked", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("yes_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("no_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("suggested_by", _uuid()),
            sa.Column("decided_by", sa.String(255)),
            sa.Column("confirmed_at", sa.DateTime(timezone=True)),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.CheckConstraint(
                "status IN ('suggested', 'confirmed', 'rejected')",
                name="ck_recording_mood_status",
            ),
            sa.CheckConstraint(
                "source IN ('uploader', 'listeners', 'team')", name="ck_recording_mood_source"
            ),
        )
        op.create_index("ix_recording_moods_mood_status", "recording_moods", ["mood", "status"])
    if "recording_mood_votes" not in tables:
        op.create_table(
            "recording_mood_votes",
            sa.Column(
                "recording_id",
                _uuid(),
                sa.ForeignKey("recordings.id", ondelete="CASCADE"),
                primary_key=True,
            ),
            sa.Column("mood", sa.String(24), primary_key=True),
            sa.Column(
                "member_id",
                _uuid(),
                sa.ForeignKey("user_accounts.id", ondelete="CASCADE"),
                primary_key=True,
            ),
            sa.Column("vote", sa.SmallInteger(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.CheckConstraint("vote IN (-1, 1)", name="ck_recording_mood_vote"),
        )
        op.create_index(
            "ix_recording_mood_votes_member_day",
            "recording_mood_votes",
            ["member_id", "created_at"],
        )


def downgrade() -> None:
    tables = set(sa.inspect(op.get_bind()).get_table_names())
    if "recording_mood_votes" in tables:
        op.drop_table("recording_mood_votes")
    if "recording_moods" in tables:
        op.drop_table("recording_moods")
