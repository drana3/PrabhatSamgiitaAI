"""Event playlists: an approximate date (year and month) and an optional cover picture.

Revision ID: 0041_set_event_month_cover
Revises: 0040_baba_audio_kind

recording_collections.event_year / event_month
    What people give now: the year of the event and, when they know it, the month. `starts_on`
    stays NOT NULL and is filled from them (the first of the month, or 1 January). Existing rows
    get the year and month of their `starts_on`; `ends_on` is left as it is (nothing is dropped).
recording_collections.cover_version
    Hash prefix of the uploaded cover picture; null when there is none.
recording_collection_covers
    The picture itself (at most 300 KB, metadata stripped), apart from the playlist rows.

Safe to run twice, and on a database where the app already ran `Base.metadata.create_all`.
Works on PostgreSQL and SQLite. Downgrade drops only what this revision added.
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "0041_set_event_month_cover"
down_revision = "0040_baba_audio_kind"
branch_labels = None
depends_on = None

SETS = "recording_collections"
COVERS = "recording_collection_covers"


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if inspector.has_table(SETS):
        have = {c["name"] for c in inspector.get_columns(SETS)}
        if "event_year" not in have:
            op.add_column(SETS, sa.Column("event_year", sa.Integer(), nullable=True))
        if "event_month" not in have:
            op.add_column(SETS, sa.Column("event_month", sa.Integer(), nullable=True))
        if "cover_version" not in have:
            op.add_column(SETS, sa.Column("cover_version", sa.String(16), nullable=True))
        # Old playlists: the year and the month of the day they already have. Done in Python so it
        # reads the same on PostgreSQL and SQLite.
        bind = op.get_bind()
        table = sa.table(
            SETS,
            sa.column("id"),
            sa.column("starts_on", sa.Date),
            sa.column("event_year", sa.Integer),
            sa.column("event_month", sa.Integer),
        )
        rows = bind.execute(
            sa.select(table.c.id, table.c.starts_on).where(table.c.event_year.is_(None))
        ).all()
        for row in rows:
            starts = row.starts_on
            if isinstance(starts, str):
                year, month = int(starts[:4]), int(starts[5:7])
            else:
                year, month = starts.year, starts.month
            bind.execute(
                table.update()
                .where(table.c.id == row.id)
                .values(event_year=year, event_month=month)
            )
    if not inspector.has_table(COVERS):
        op.create_table(
            COVERS,
            sa.Column(
                "collection_id",
                sa.Uuid(),
                sa.ForeignKey(f"{SETS}.id", ondelete="CASCADE"),
                primary_key=True,
            ),
            sa.Column("mime", sa.String(32), nullable=False),
            sa.Column("data", sa.LargeBinary(), nullable=False),
            sa.Column("sha256", sa.String(64), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        )


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if inspector.has_table(COVERS):
        op.drop_table(COVERS)
    if inspector.has_table(SETS):
        have = {c["name"] for c in inspector.get_columns(SETS)}
        with op.batch_alter_table(SETS) as batch:
            for name in ("cover_version", "event_month", "event_year"):
                if name in have:
                    batch.drop_column(name)
