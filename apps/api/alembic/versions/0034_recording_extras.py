"""Comments, chord sheets and video links around recordings (and videos of songs).

Revision ID: 0034_recording_extras
Revises: 0033_author_profiles

Six new tables, written out by hand (not from the models) so the revision keeps meaning the same
after the models change. Nothing existing is changed. Safe to run twice, and on a database where the
app already ran `Base.metadata.create_all`: every table and every index is looked for first and an
existing one is left alone. Works on PostgreSQL and SQLite.

  recording_comments          comments of members on a recording
  recording_comment_reports   reports of a comment
  recording_chord_sheets      plain-text chord charts of a recording (guitar or harmonium)
  recording_chord_reports     reports of a chart
  video_links                 links to videos, on a recording or on a Prabhat Samgiita song
  video_link_reports          reports of a link

Downgrade drops the six tables (the data in them is lost). Back up the database before running it
on a real server.
"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0034_recording_extras"
down_revision = "0033_author_profiles"
branch_labels = None
depends_on = None

TABLES = (
    "video_link_reports",
    "video_links",
    "recording_chord_reports",
    "recording_chord_sheets",
    "recording_comment_reports",
    "recording_comments",
)


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


def _fk(target: str, *, ondelete: str, nullable: bool = False) -> sa.ForeignKey:
    return sa.ForeignKey(target, ondelete=ondelete)


def _index(
    name: str, table: str, columns: list[str], *, unique: bool = False, **kw: object
) -> None:
    """Create an index unless the table already has one with that name."""
    existing = {i["name"] for i in sa.inspect(op.get_bind()).get_indexes(table)}
    if name not in existing:
        op.create_index(name, table, columns, unique=unique, **kw)


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())

    if not inspector.has_table("recording_comments"):
        op.create_table(
            "recording_comments",
            sa.Column("id", _uuid(), primary_key=True),
            sa.Column(
                "recording_id", _uuid(), _fk("recordings.id", ondelete="CASCADE"), nullable=False
            ),
            sa.Column(
                "member_id", _uuid(), _fk("user_accounts.id", ondelete="CASCADE"), nullable=False
            ),
            sa.Column("body", sa.Text(), nullable=False),
            sa.Column("is_anonymous", sa.Boolean(), server_default=sa.false(), nullable=False),
            sa.Column("status", sa.String(16), server_default="published", nullable=False),
            sa.Column("reports_count", sa.Integer(), server_default="0", nullable=False),
            sa.Column("removed_reason", sa.Text()),
            sa.Column("removed_at", sa.DateTime(timezone=True)),
            sa.Column("removed_by", sa.String(255)),
            *_stamps(),
            sa.CheckConstraint(
                "status IN ('published', 'removed')", name="ck_recording_comments_status"
            ),
            sa.CheckConstraint(
                "length(body) >= 1 AND length(body) <= 2000", name="ck_recording_comments_body"
            ),
        )
    _index("ix_recording_comments_member_id", "recording_comments", ["member_id"])
    _index(
        "ix_recording_comments_recording_status_created",
        "recording_comments",
        ["recording_id", "status", "created_at"],
    )

    if not inspector.has_table("recording_comment_reports"):
        op.create_table(
            "recording_comment_reports",
            sa.Column("id", _uuid(), primary_key=True),
            sa.Column(
                "comment_id",
                _uuid(),
                _fk("recording_comments.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("reporter_key", sa.String(80), nullable=False),
            sa.Column("reporter_id", _uuid(), _fk("user_accounts.id", ondelete="SET NULL")),
            sa.Column("reason", sa.String(16), nullable=False),
            sa.Column("note", sa.Text()),
            *_stamps(),
            sa.UniqueConstraint(
                "comment_id", "reporter_key", name="uq_recording_comment_reports_once"
            ),
            sa.CheckConstraint(
                "reason IN ('offensive', 'spam', 'private', 'other')",
                name="ck_recording_comment_reports_reason",
            ),
        )
    _index("ix_recording_comment_reports_comment_id", "recording_comment_reports", ["comment_id"])

    if not inspector.has_table("recording_chord_sheets"):
        op.create_table(
            "recording_chord_sheets",
            sa.Column("id", _uuid(), primary_key=True),
            sa.Column(
                "recording_id", _uuid(), _fk("recordings.id", ondelete="CASCADE"), nullable=False
            ),
            sa.Column(
                "member_id", _uuid(), _fk("user_accounts.id", ondelete="CASCADE"), nullable=False
            ),
            sa.Column("instrument", sa.String(12), nullable=False),
            sa.Column("chart_key", sa.String(3)),
            sa.Column("body", sa.Text(), nullable=False),
            sa.Column("chords_count", sa.Integer(), server_default="0", nullable=False),
            sa.Column("played_it", sa.Boolean(), server_default=sa.true(), nullable=False),
            sa.Column("note", sa.String(300)),
            sa.Column("is_anonymous", sa.Boolean(), server_default=sa.false(), nullable=False),
            sa.Column("status", sa.String(12), server_default="pending", nullable=False),
            sa.Column("reports_count", sa.Integer(), server_default="0", nullable=False),
            sa.Column("published_at", sa.DateTime(timezone=True)),
            sa.Column("reviewed_at", sa.DateTime(timezone=True)),
            sa.Column("reviewed_by", sa.String(255)),
            sa.Column("rejected_reason", sa.Text()),
            *_stamps(),
            sa.CheckConstraint(
                "instrument IN ('guitar', 'harmonium')",
                name="ck_recording_chord_sheets_instrument",
            ),
            sa.CheckConstraint(
                "status IN ('pending', 'published', 'rejected')",
                name="ck_recording_chord_sheets_status",
            ),
            sa.CheckConstraint(
                "length(body) >= 1 AND length(body) <= 8000",
                name="ck_recording_chord_sheets_body",
            ),
        )
    _index("ix_recording_chord_sheets_member_id", "recording_chord_sheets", ["member_id"])
    _index(
        "ix_recording_chord_sheets_recording_status",
        "recording_chord_sheets",
        ["recording_id", "status", "created_at"],
    )
    _index(
        "ix_recording_chord_sheets_status_created",
        "recording_chord_sheets",
        ["status", "created_at"],
    )

    if not inspector.has_table("recording_chord_reports"):
        op.create_table(
            "recording_chord_reports",
            sa.Column("id", _uuid(), primary_key=True),
            sa.Column(
                "sheet_id",
                _uuid(),
                _fk("recording_chord_sheets.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("reporter_key", sa.String(80), nullable=False),
            sa.Column("reporter_id", _uuid(), _fk("user_accounts.id", ondelete="SET NULL")),
            sa.Column("reason", sa.String(16), nullable=False),
            sa.Column("note", sa.Text()),
            *_stamps(),
            sa.UniqueConstraint("sheet_id", "reporter_key", name="uq_recording_chord_reports_once"),
            sa.CheckConstraint(
                "reason IN ('wrong_chords', 'offensive', 'spam', 'other')",
                name="ck_recording_chord_reports_reason",
            ),
        )
    _index("ix_recording_chord_reports_sheet_id", "recording_chord_reports", ["sheet_id"])

    if not inspector.has_table("video_links"):
        op.create_table(
            "video_links",
            sa.Column("id", _uuid(), primary_key=True),
            sa.Column("recording_id", _uuid(), _fk("recordings.id", ondelete="CASCADE")),
            sa.Column("song_id", sa.Integer()),
            sa.Column("target_key", sa.String(60), nullable=False),
            sa.Column(
                "member_id", _uuid(), _fk("user_accounts.id", ondelete="CASCADE"), nullable=False
            ),
            sa.Column("provider", sa.String(16), nullable=False),
            sa.Column("external_id", sa.String(120), nullable=False),
            sa.Column("url", sa.String(300), nullable=False),
            sa.Column("title", sa.String(80)),
            sa.Column("is_anonymous", sa.Boolean(), server_default=sa.false(), nullable=False),
            sa.Column("status", sa.String(16), server_default="published", nullable=False),
            sa.Column("reports_count", sa.Integer(), server_default="0", nullable=False),
            sa.Column("removed_reason", sa.Text()),
            sa.Column("removed_at", sa.DateTime(timezone=True)),
            sa.Column("removed_by", sa.String(255)),
            *_stamps(),
            sa.CheckConstraint(
                "(recording_id IS NOT NULL AND song_id IS NULL) OR "
                "(recording_id IS NULL AND song_id IS NOT NULL AND song_id >= 1 "
                "AND song_id <= 5018)",
                name="ck_video_links_one_target",
            ),
            sa.CheckConstraint("status IN ('published', 'removed')", name="ck_video_links_status"),
        )
    _index("ix_video_links_member_id", "video_links", ["member_id"])
    _index("ix_video_links_target_status", "video_links", ["target_key", "status", "created_at"])
    _index(
        "uq_video_links_live",
        "video_links",
        ["target_key", "provider", "external_id"],
        unique=True,
        postgresql_where=sa.text("status = 'published'"),
        sqlite_where=sa.text("status = 'published'"),
    )

    if not inspector.has_table("video_link_reports"):
        op.create_table(
            "video_link_reports",
            sa.Column("id", _uuid(), primary_key=True),
            sa.Column(
                "video_id", _uuid(), _fk("video_links.id", ondelete="CASCADE"), nullable=False
            ),
            sa.Column("reporter_key", sa.String(80), nullable=False),
            sa.Column("reporter_id", _uuid(), _fk("user_accounts.id", ondelete="SET NULL")),
            sa.Column("reason", sa.String(16), nullable=False),
            sa.Column("note", sa.Text()),
            *_stamps(),
            sa.UniqueConstraint("video_id", "reporter_key", name="uq_video_link_reports_once"),
            sa.CheckConstraint(
                "reason IN ('broken', 'not_about_this', 'offensive', 'spam', 'other')",
                name="ck_video_link_reports_reason",
            ),
        )
    _index("ix_video_link_reports_video_id", "video_link_reports", ["video_id"])


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    for table in TABLES:
        if inspector.has_table(table):
            op.drop_table(table)
