"""Chord proposals of members for Prabhat Samgiita songs, and their reports.

Revision ID: 0031_song_chord_proposals
Revises: 0030_song_comments

Three new tables, written out by hand (not from the models) so the revision keeps meaning the same
after the models change. Safe to run twice or on a database where the tables already exist: the
app also runs `Base.metadata.create_all` at start, so on a new database they may be there already.
Each table and each index is looked for first; an existing one is left alone.

Never run it against a real database without a backup.
"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0031_song_chord_proposals"
down_revision = "0030_song_comments"
branch_labels = None
depends_on = None

PROPOSALS = "song_chord_proposals"
REPORTS = "song_chord_reports"
OFFERS = "song_chord_offers"


def _uuid() -> sa.types.TypeEngine:
    return postgresql.UUID(as_uuid=True)


def _chart_type() -> sa.types.TypeEngine:
    return sa.JSON().with_variant(postgresql.JSONB(), "postgresql")


def _stamps() -> list[sa.Column]:
    return [
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    ]


def _index(inspector: sa.Inspector, table: str, name: str, columns: list[str]) -> None:
    if name not in {index["name"] for index in inspector.get_indexes(table)}:
        op.create_index(name, table, columns)


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table(PROPOSALS):
        op.create_table(
            PROPOSALS,
            sa.Column("id", _uuid(), primary_key=True),
            sa.Column("song_id", sa.Integer(), nullable=False),
            sa.Column(
                "member_id",
                _uuid(),
                sa.ForeignKey("user_accounts.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("instrument", sa.String(12), nullable=False),
            sa.Column("base_key", sa.String(3), nullable=False),
            sa.Column("capo", sa.Integer(), server_default="0", nullable=False),
            sa.Column("strum", sa.String(40)),
            sa.Column("chart", _chart_type(), nullable=False),
            sa.Column("placements_count", sa.Integer(), server_default="0", nullable=False),
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
                "song_id >= 1 AND song_id <= 5018", name="ck_song_chord_proposals_song"
            ),
            sa.CheckConstraint(
                "instrument IN ('guitar', 'harmonium')",
                name="ck_song_chord_proposals_instrument",
            ),
            sa.CheckConstraint(
                "status IN ('pending', 'published', 'rejected')",
                name="ck_song_chord_proposals_status",
            ),
            sa.CheckConstraint("capo >= 0 AND capo <= 7", name="ck_song_chord_proposals_capo"),
        )
    if not inspector.has_table(REPORTS):
        op.create_table(
            REPORTS,
            sa.Column("id", _uuid(), primary_key=True),
            sa.Column(
                "proposal_id",
                _uuid(),
                sa.ForeignKey(f"{PROPOSALS}.id", ondelete="CASCADE"),
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
            sa.UniqueConstraint("proposal_id", "reporter_key", name="uq_song_chord_reports_once"),
            sa.CheckConstraint(
                "reason IN ('wrong_chords', 'offensive', 'spam', 'other')",
                name="ck_song_chord_reports_reason",
            ),
        )
    if not inspector.has_table(OFFERS):
        op.create_table(
            OFFERS,
            sa.Column("id", _uuid(), primary_key=True),
            sa.Column(
                "member_id",
                _uuid(),
                sa.ForeignKey("user_accounts.id", ondelete="CASCADE"),
                nullable=False,
            ),
            *_stamps(),
        )
    inspector = sa.inspect(op.get_bind())
    _index(inspector, OFFERS, "ix_song_chord_offers_member_created", ["member_id", "created_at"])
    _index(inspector, PROPOSALS, "ix_song_chord_proposals_member_id", ["member_id"])
    _index(
        inspector,
        PROPOSALS,
        "ix_song_chord_proposals_song_status",
        ["song_id", "status", "created_at"],
    )
    _index(inspector, PROPOSALS, "ix_song_chord_proposals_status_created", ["status", "created_at"])
    _index(inspector, REPORTS, "ix_song_chord_reports_proposal_id", ["proposal_id"])


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if inspector.has_table(OFFERS):
        op.drop_table(OFFERS)
    if inspector.has_table(REPORTS):
        op.drop_table(REPORTS)
    if inspector.has_table(PROPOSALS):
        op.drop_table(PROPOSALS)
