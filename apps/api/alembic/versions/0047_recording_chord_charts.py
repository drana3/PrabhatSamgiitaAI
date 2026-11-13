"""Chord charts of Bhajans and Spiritual songs: the chart, the capo, versions and credit.

Revision ID: 0047_recording_chord_charts
Revises: 0046_recording_info

Six columns on `recording_chord_sheets`, all optional, so every sheet that exists keeps working as
the plain text it is:
- `chart`: the chart in the shape the Prabhat Samgiita charts use, with the text of each line kept
  beside its chords (a recording has no lyrics of its own): `{"lines": [{"text": "...",
  "placements": [{"word": 0, "chord": "Am"}]}]}`. Null for a plain-text sheet. `body` stays filled
  for both kinds (for a chart it is the same chart written as `[Am]word` text).
- `capo`, `strum`: what the guitar player played with (hints for the display), like a PS chart.
- `replaces_id`, `archived_at`: a new version of the author's own live sheet; when the new one goes
  live the old one is archived (kept, hidden), never deleted.
- `based_on_id`: the sheet "Start from this chart" copied the chords from; the credit name is
  worked out when it is shown.

Written out by hand and safe to run twice: each column is looked for first, an existing one is left
alone. Nothing is changed or deleted in existing rows. Works on PostgreSQL and SQLite. Downgrade
drops only the columns this revision added.

Never run it against a real database without a backup.
"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0047_recording_chord_charts"
down_revision = "0046_recording_info"
branch_labels = None
depends_on = None

TABLE = "recording_chord_sheets"


def _columns(inspector: sa.Inspector, table: str) -> set[str]:
    return {column["name"] for column in inspector.get_columns(table)}


def _link() -> sa.ForeignKey:
    return sa.ForeignKey(f"{TABLE}.id", ondelete="SET NULL")


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table(TABLE):
        return
    have = _columns(inspector, TABLE)
    # SQLite cannot add a foreign key to an existing table; there the link is a plain column (the
    # service clears it when a sheet is deleted). PostgreSQL gets the real constraint.
    keyed = bind.dialect.name != "sqlite"
    uuid = postgresql.UUID(as_uuid=True)
    json_type = sa.JSON().with_variant(postgresql.JSONB(), "postgresql")
    if "chart" not in have:
        op.add_column(TABLE, sa.Column("chart", json_type, nullable=True))
    if "capo" not in have:
        op.add_column(TABLE, sa.Column("capo", sa.Integer(), server_default="0", nullable=False))
    if "strum" not in have:
        op.add_column(TABLE, sa.Column("strum", sa.String(40), nullable=True))
    if "replaces_id" not in have:
        op.add_column(
            TABLE, sa.Column("replaces_id", uuid, *([_link()] if keyed else []), nullable=True)
        )
    if "archived_at" not in have:
        op.add_column(TABLE, sa.Column("archived_at", sa.DateTime(timezone=True)))
    if "based_on_id" not in have:
        op.add_column(
            TABLE, sa.Column("based_on_id", uuid, *([_link()] if keyed else []), nullable=True)
        )


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table(TABLE):
        return
    have = _columns(inspector, TABLE)
    for name in ("based_on_id", "archived_at", "replaces_id", "strum", "capo", "chart"):
        if name in have:
            op.drop_column(TABLE, name)
