"""Avarta Kiirtan practice flag, and an event playlist that needs no date.

Revision ID: 0044_practice_and_optional_set_date
Revises: 0043_song_chord_versions

recordings.practice
    The practice a Kiirtan is for: "avarta" (Avarta Kiirtan) or null. Optional, Kiirtan only, so
    no check constraint and no backfill (docs/kiirtan-practice.md).

recording_collections.starts_on
    Becomes nullable: only the title of an event playlist is required now; year, month, place,
    performer and picture are all optional. Existing rows keep their date.

Safe to run twice, and on a database where the app already ran `Base.metadata.create_all`.
Works on PostgreSQL and SQLite (the column change uses a batch rebuild there). Downgrade fills
an empty date with the creation day, then makes the column required again, then drops the flag.
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "0044_practice_and_optional_set_date"
down_revision = "0043_song_chord_versions"
branch_labels = None
depends_on = None

SETS = "recording_collections"


def _starts_on_nullable(inspector: sa.Inspector) -> bool | None:
    for column in inspector.get_columns(SETS):
        if column["name"] == "starts_on":
            return bool(column["nullable"])
    return None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if inspector.has_table("recordings"):
        have = {c["name"] for c in inspector.get_columns("recordings")}
        if "practice" not in have:
            op.add_column("recordings", sa.Column("practice", sa.String(16), nullable=True))
    if inspector.has_table(SETS) and _starts_on_nullable(inspector) is False:
        with op.batch_alter_table(SETS) as batch:
            batch.alter_column("starts_on", existing_type=sa.Date(), nullable=True)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if inspector.has_table(SETS) and _starts_on_nullable(inspector) is True:
        bind.execute(
            sa.text(f"UPDATE {SETS} SET starts_on = DATE(created_at) WHERE starts_on IS NULL")
        )
        with op.batch_alter_table(SETS) as batch:
            batch.alter_column("starts_on", existing_type=sa.Date(), nullable=False)
    if inspector.has_table("recordings"):
        have = {c["name"] for c in inspector.get_columns("recordings")}
        if "practice" in have:
            with op.batch_alter_table("recordings") as batch:
                batch.drop_column("practice")
