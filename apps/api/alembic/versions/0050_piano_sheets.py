"""Piano notes: two new tables, `piano_sheets` and `piano_sheet_reports`.

Revision ID: 0050_piano_sheets
Revises: 0049_kiirtan_cycle_video_status

A piano sheet is the keys of a melody for ONE recording or ONE Prabhat Samgiita song: rows of steps,
a step being the semitones above Sa pressed together and the beats they last, so one sheet fits any
key. Status (pending / published / rejected), versions (`replaces_id`), "start from this sheet"
(`based_on_id`) and reports work like the chord sheets. Nothing existing is changed.

Written out by hand and safe to run twice: a table that exists is left alone. Works on PostgreSQL
and SQLite. Downgrade drops only the two tables this revision created.

Never run it against a real database without a backup.
"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0050_piano_sheets"
down_revision = "0049_kiirtan_cycle_video_status"
branch_labels = None
depends_on = None

SHEETS = "piano_sheets"
REPORTS = "piano_sheet_reports"
PS_SONG_COUNT = 5018


def _uuid() -> sa.types.TypeEngine:
    return postgresql.UUID(as_uuid=True)


def _json() -> sa.types.TypeEngine:
    return sa.JSON().with_variant(postgresql.JSONB(), "postgresql")


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table(SHEETS):
        op.create_table(
            SHEETS,
            sa.Column("id", _uuid(), primary_key=True),
            sa.Column("recording_id", _uuid(), sa.ForeignKey("recordings.id", ondelete="CASCADE")),
            sa.Column("song_id", sa.Integer()),
            sa.Column("target_key", sa.String(60), nullable=False),
            sa.Column(
                "member_id",
                _uuid(),
                sa.ForeignKey("user_accounts.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("sa_key", sa.String(3), server_default="C", nullable=False),
            sa.Column("level", sa.String(12), server_default="one_finger", nullable=False),
            sa.Column("score", _json(), nullable=False),
            sa.Column("steps_count", sa.Integer(), server_default="0", nullable=False),
            sa.Column("link_url", sa.String(300)),
            sa.Column("note", sa.String(300)),
            sa.Column("is_anonymous", sa.Boolean(), server_default=sa.false(), nullable=False),
            sa.Column(
                "by_recording_author", sa.Boolean(), server_default=sa.false(), nullable=False
            ),
            sa.Column("status", sa.String(12), server_default="pending", nullable=False),
            sa.Column("reports_count", sa.Integer(), server_default="0", nullable=False),
            sa.Column("published_at", sa.DateTime(timezone=True)),
            sa.Column("reviewed_at", sa.DateTime(timezone=True)),
            sa.Column("reviewed_by", sa.String(255)),
            sa.Column("rejected_reason", sa.String(500)),
            sa.Column("replaces_id", _uuid(), sa.ForeignKey(f"{SHEETS}.id", ondelete="SET NULL")),
            sa.Column("archived_at", sa.DateTime(timezone=True)),
            sa.Column("based_on_id", _uuid(), sa.ForeignKey(f"{SHEETS}.id", ondelete="SET NULL")),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.func.now(),
                nullable=False,
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                server_default=sa.func.now(),
                nullable=False,
            ),
            sa.CheckConstraint(
                "(recording_id IS NOT NULL AND song_id IS NULL) OR "
                "(recording_id IS NULL AND song_id IS NOT NULL AND song_id >= 1 "
                f"AND song_id <= {PS_SONG_COUNT})",
                name="ck_piano_sheets_one_target",
            ),
            sa.CheckConstraint(
                "status IN ('pending', 'published', 'rejected')", name="ck_piano_sheets_status"
            ),
            sa.CheckConstraint(
                "level IN ('one_finger', 'two_hands')", name="ck_piano_sheets_level"
            ),
        )
        op.create_index("ix_piano_sheets_member_id", SHEETS, ["member_id"])
        op.create_index(
            "ix_piano_sheets_target_status", SHEETS, ["target_key", "status", "created_at"]
        )
        op.create_index("ix_piano_sheets_status_created", SHEETS, ["status", "created_at"])
    if not inspector.has_table(REPORTS):
        op.create_table(
            REPORTS,
            sa.Column("id", _uuid(), primary_key=True),
            sa.Column(
                "sheet_id",
                _uuid(),
                sa.ForeignKey(f"{SHEETS}.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("reporter_key", sa.String(80), nullable=False),
            sa.Column(
                "reporter_id", _uuid(), sa.ForeignKey("user_accounts.id", ondelete="SET NULL")
            ),
            sa.Column("reason", sa.String(16), nullable=False),
            sa.Column("note", sa.String(1000)),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.func.now(),
                nullable=False,
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                server_default=sa.func.now(),
                nullable=False,
            ),
            sa.UniqueConstraint("sheet_id", "reporter_key", name="uq_piano_sheet_reports_once"),
            sa.CheckConstraint(
                "reason IN ('wrong_notes', 'offensive', 'spam', 'other')",
                name="ck_piano_sheet_reports_reason",
            ),
        )
        op.create_index("ix_piano_sheet_reports_sheet_id", REPORTS, ["sheet_id"])


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    for table in (REPORTS, SHEETS):
        if inspector.has_table(table):
            op.drop_table(table)
