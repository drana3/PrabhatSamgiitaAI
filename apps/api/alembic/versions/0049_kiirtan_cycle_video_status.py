"""Kiirtan chord cycles, and the "is this video link still alive" status.

Revision ID: 0049_kiirtan_cycle_video_status
Revises: 0048_recording_loudness

Two small additions, both optional columns, so every row that exists keeps working as it is:

`recording_chord_sheets.cycle` (JSON, null for a plain sheet or a chart): the chord cycle of a
Kiirtan, one entry per way the Kiirtan is played in the recording ("form"): `{"forms": [{"name":
"Slow", "chords": ["Em", "C", "G", "D"], "start": 0, "times": 4}]}`. A cycle is a chord sheet like
the others (same review queue, versions, daily allowance, notices), so it lives on the same table
and needs no new moderation code; `body` is filled with the same cycle written as text, so old
readers show something.

`video_links.link_status`, `checked_at`, `check_fails`: what the last automatic look at the link
found. `unknown` (not looked at yet), `ok` (exists and may be shown inside the app), `no_embed`
(exists, but its owner does not let other apps show it: the app offers Open instead),
`unavailable` (gone or private, seen twice in a row). A soft hint for the screen: nothing is
hidden or blocked because of it.

Written by hand and safe to run twice: each column is looked for first. Nothing is changed or
deleted in existing rows. Works on PostgreSQL and SQLite. Downgrade drops only the columns this
revision added.

Never run it against a real database without a backup.
"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0049_kiirtan_cycle_video_status"
down_revision = "0048_recording_loudness"
branch_labels = None
depends_on = None

SHEETS = "recording_chord_sheets"
VIDEOS = "video_links"


def _columns(inspector: sa.Inspector, table: str) -> set[str]:
    return {column["name"] for column in inspector.get_columns(table)}


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if inspector.has_table(SHEETS) and "cycle" not in _columns(inspector, SHEETS):
        json_type = sa.JSON().with_variant(postgresql.JSONB(), "postgresql")
        op.add_column(SHEETS, sa.Column("cycle", json_type, nullable=True))
    if inspector.has_table(VIDEOS):
        have = _columns(inspector, VIDEOS)
        if "link_status" not in have:
            op.add_column(
                VIDEOS,
                sa.Column("link_status", sa.String(16), server_default="unknown", nullable=False),
            )
        if "checked_at" not in have:
            op.add_column(VIDEOS, sa.Column("checked_at", sa.DateTime(timezone=True)))
        if "check_fails" not in have:
            op.add_column(
                VIDEOS, sa.Column("check_fails", sa.Integer(), server_default="0", nullable=False)
            )


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if inspector.has_table(VIDEOS):
        have = _columns(inspector, VIDEOS)
        for name in ("check_fails", "checked_at", "link_status"):
            if name in have:
                op.drop_column(VIDEOS, name)
    if inspector.has_table(SHEETS) and "cycle" in _columns(inspector, SHEETS):
        op.drop_column(SHEETS, "cycle")
