"""The main (lead) instrument of a recording, and the team's queue of words authors add.

Revision ID: 0054_lead_instrument_values
Revises: 0053_app_events_and_flags

recordings.lead_instrument
    A listed instrument code (guitar, harmonium, piano ...), "other", or null. Optional. Indexed:
    the search menu builds "Kiirtans for piano" from it.
recordings.lead_instrument_other
    The word an author wrote under "Add your own" (only with lead_instrument = "other").
recordings.lead_instrument_checked
    True once the team accepted that word; until then only its author sees it.
value_suggestions
    One row per field (instrument or style) and normalized word, with who wrote it first, the
    counters and the team's decision (pending, accepted, merged, rejected).
value_suggestion_uses
    One row per recording that used a suggested word.

Nothing is guessed for old rows: all three new columns stay empty for them.

Safe to run twice, and on a database where the app already ran `Base.metadata.create_all`.
Works on PostgreSQL and SQLite. Downgrade drops only what this revision added.

Never run it against a real database without a backup.
"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0054_lead_instrument_values"
down_revision = "0053_app_events_and_flags"
branch_labels = None
depends_on = None

COLUMNS = (
    ("lead_instrument", sa.String(length=32)),
    ("lead_instrument_other", sa.String(length=80)),
)


def _uuid() -> postgresql.UUID:
    return postgresql.UUID(as_uuid=True)


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if inspector.has_table("recordings"):
        have = {c["name"] for c in inspector.get_columns("recordings")}
        for name, kind in COLUMNS:
            if name not in have:
                op.add_column("recordings", sa.Column(name, kind, nullable=True))
        if "lead_instrument_checked" not in have:
            op.add_column(
                "recordings",
                sa.Column(
                    "lead_instrument_checked",
                    sa.Boolean(),
                    nullable=False,
                    server_default=sa.false(),
                ),
            )
        indexes = {i["name"] for i in inspector.get_indexes("recordings")}
        if "ix_recordings_lead_instrument" not in indexes:
            op.create_index("ix_recordings_lead_instrument", "recordings", ["lead_instrument"])
    inspector = sa.inspect(bind)
    if not inspector.has_table("value_suggestions"):
        op.create_table(
            "value_suggestions",
            sa.Column("id", _uuid(), primary_key=True),
            sa.Column("field", sa.String(16), nullable=False),
            sa.Column("key", sa.String(80), nullable=False),
            sa.Column("label", sa.String(80), nullable=False),
            sa.Column("status", sa.String(12), nullable=False, server_default="pending"),
            sa.Column("similar_to", sa.String(32)),
            sa.Column("merged_into", sa.String(32)),
            sa.Column(
                "first_user_id", _uuid(), sa.ForeignKey("user_accounts.id", ondelete="SET NULL")
            ),
            sa.Column("recordings_count", sa.Integer(), nullable=False, server_default="1"),
            sa.Column("people_count", sa.Integer(), nullable=False, server_default="1"),
            sa.Column("decided_by", sa.String(255)),
            sa.Column("decided_at", sa.DateTime(timezone=True)),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.UniqueConstraint("field", "key", name="uq_value_suggestions_word"),
            sa.CheckConstraint(
                "field IN ('instrument', 'style')", name="ck_value_suggestions_field"
            ),
            sa.CheckConstraint(
                "status IN ('pending', 'accepted', 'merged', 'rejected')",
                name="ck_value_suggestions_status",
            ),
        )
        op.create_index("ix_value_suggestions_status", "value_suggestions", ["status"])
        op.create_index(
            "ix_value_suggestions_first_user_id", "value_suggestions", ["first_user_id"]
        )
    if not inspector.has_table("value_suggestion_uses"):
        op.create_table(
            "value_suggestion_uses",
            sa.Column("id", _uuid(), primary_key=True),
            sa.Column(
                "suggestion_id",
                _uuid(),
                sa.ForeignKey("value_suggestions.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "user_id",
                _uuid(),
                sa.ForeignKey("user_accounts.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("recording_id", _uuid(), sa.ForeignKey("recordings.id", ondelete="SET NULL")),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.UniqueConstraint(
                "suggestion_id", "recording_id", name="uq_value_suggestion_uses_once"
            ),
        )
        op.create_index(
            "ix_value_suggestion_uses_suggestion_id", "value_suggestion_uses", ["suggestion_id"]
        )
        op.create_index("ix_value_suggestion_uses_user_id", "value_suggestion_uses", ["user_id"])


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if inspector.has_table("value_suggestion_uses"):
        op.drop_table("value_suggestion_uses")
    if inspector.has_table("value_suggestions"):
        op.drop_table("value_suggestions")
    if inspector.has_table("recordings"):
        have = {c["name"] for c in inspector.get_columns("recordings")}
        indexes = {i["name"] for i in inspector.get_indexes("recordings")}
        if "ix_recordings_lead_instrument" in indexes:
            op.drop_index("ix_recordings_lead_instrument", table_name="recordings")
        names = ("lead_instrument", "lead_instrument_other", "lead_instrument_checked")
        drop = [n for n in names if n in have]
        if drop:
            with op.batch_alter_table("recordings") as batch:
                for name in drop:
                    batch.drop_column(name)
