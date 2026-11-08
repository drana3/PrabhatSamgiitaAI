"""How a recording was made and how it sounds: the type of recording, the tempo, solo or group.

Revision ID: 0046_recording_info
Revises: 0045_author_claims

recordings.recording_type
    studio / live / home / ai (services/recording_info.py). Required for a NEW Kiirtan by the API's
    schema, so the column stays nullable: older rows have none and are read as "not said".
recordings.tempo
    slow / medium / fast. Optional.
recordings.performance
    solo / group. Optional.

No check constraint and no backfill (the values are validated in code, so another one later is a
new id and no migration; nothing is guessed for old rows). Safe to run twice, and on a database
where the app already ran `Base.metadata.create_all`. Works on PostgreSQL and SQLite. Downgrade
drops only the three columns this revision added.
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "0046_recording_info"
down_revision = "0045_author_claims"
branch_labels = None
depends_on = None

COLUMNS = (("recording_type", 16), ("tempo", 8), ("performance", 8))


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table("recordings"):
        return
    have = {c["name"] for c in inspector.get_columns("recordings")}
    for name, size in COLUMNS:
        if name not in have:
            op.add_column("recordings", sa.Column(name, sa.String(size), nullable=True))


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table("recordings"):
        return
    have = {c["name"] for c in inspector.get_columns("recordings")}
    drop = [name for name, _ in COLUMNS if name in have]
    if drop:
        with op.batch_alter_table("recordings") as batch:
            for name in drop:
                batch.drop_column(name)
