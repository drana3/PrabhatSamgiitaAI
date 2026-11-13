"""Chord charts: a new version replaces the old live chart, and "start from this chart" credit.

Revision ID: 0043_song_chord_versions
Revises: 0042_song_plays

Four columns on `song_chord_proposals`:
- `replaces_id`: the author's own live chart this chart is a new version of. When the new one goes
  live the old one is archived (kept, hidden), never deleted.
- `archived_at`: set on the old chart at that moment.
- `based_on_id`, `based_on_name`: the chart whose chords were copied ("Start from this chart") and
  the name to credit (null when that chart was anonymous).
One column on `song_chord_offers`:
- `proposal_id`: links a ledger row to its chart, so a chart withdrawn while it still waits for the
  review can take its row with it (the daily limit then does not count it).

Written out by hand and safe to run twice, like the revision that created these tables: each column
is looked for first, an existing one is left alone. Nothing is changed or deleted in existing rows.

Never run it against a real database without a backup.
"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0043_song_chord_versions"
down_revision = "0042_song_plays"
branch_labels = None
depends_on = None

PROPOSALS = "song_chord_proposals"
OFFERS = "song_chord_offers"


def _uuid() -> sa.types.TypeEngine:
    return postgresql.UUID(as_uuid=True)


def _columns(inspector: sa.Inspector, table: str) -> set[str]:
    return {column["name"] for column in inspector.get_columns(table)}


def _link() -> sa.ForeignKey:
    return sa.ForeignKey(f"{PROPOSALS}.id", ondelete="SET NULL")


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    # SQLite cannot add a foreign key to an existing table; there the link is a plain column (the
    # service clears it when a chart is deleted). PostgreSQL gets the real constraint.
    keyed = bind.dialect.name != "sqlite"
    if inspector.has_table(PROPOSALS):
        have = _columns(inspector, PROPOSALS)
        if "replaces_id" not in have:
            op.add_column(
                PROPOSALS,
                sa.Column("replaces_id", _uuid(), *([_link()] if keyed else []), nullable=True),
            )
        if "archived_at" not in have:
            op.add_column(PROPOSALS, sa.Column("archived_at", sa.DateTime(timezone=True)))
        if "based_on_id" not in have:
            op.add_column(
                PROPOSALS,
                sa.Column("based_on_id", _uuid(), *([_link()] if keyed else []), nullable=True),
            )
        if "based_on_name" not in have:
            op.add_column(PROPOSALS, sa.Column("based_on_name", sa.String(80)))
    if inspector.has_table(OFFERS) and "proposal_id" not in _columns(inspector, OFFERS):
        op.add_column(OFFERS, sa.Column("proposal_id", _uuid(), nullable=True))


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if inspector.has_table(OFFERS) and "proposal_id" in _columns(inspector, OFFERS):
        op.drop_column(OFFERS, "proposal_id")
    if inspector.has_table(PROPOSALS):
        have = _columns(inspector, PROPOSALS)
        for name in ("based_on_name", "based_on_id", "archived_at", "replaces_id"):
            if name in have:
                op.drop_column(PROPOSALS, name)
