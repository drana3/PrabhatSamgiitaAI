"""Kiirtan style, and the team's pins for the search menu.

Revision ID: 0039_kiirtan_style_and_menu_pins
Revises: 0038_author_snapshot_kinds

recordings.style / recordings.style_other
    How a Kiirtan is sung (bengali, hindi, brajabuli, dhrupad, folk, or "other" + its name).
    Optional, Kiirtan only, so no check constraint and no backfill.

search_menu_pins
    The shelves the team chose to put at the top of the phone's search menu, in order
    (docs/search-menu.md). A tiny table: one row per pinned shelf id.

Safe to run twice, and on a database where the app already ran `Base.metadata.create_all`.
Works on PostgreSQL and SQLite. Downgrade drops both.
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "0039_kiirtan_style_and_menu_pins"
down_revision = "0038_author_snapshot_kinds"
branch_labels = None
depends_on = None

PINS = "search_menu_pins"


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if inspector.has_table("recordings"):
        have = {c["name"] for c in inspector.get_columns("recordings")}
        if "style" not in have:
            op.add_column("recordings", sa.Column("style", sa.String(16), nullable=True))
        if "style_other" not in have:
            op.add_column("recordings", sa.Column("style_other", sa.String(80), nullable=True))
    if not inspector.has_table(PINS):
        op.create_table(
            PINS,
            sa.Column("shelf_id", sa.String(80), primary_key=True),
            sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("pinned_by", sa.String(120), nullable=True),
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
        )


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if inspector.has_table(PINS):
        op.drop_table(PINS)
    if inspector.has_table("recordings"):
        have = {c["name"] for c in inspector.get_columns("recordings")}
        with op.batch_alter_table("recordings") as batch:
            if "style_other" in have:
                batch.drop_column("style_other")
            if "style" in have:
                batch.drop_column("style")
