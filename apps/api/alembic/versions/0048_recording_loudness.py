"""How loud a recording is: integrated loudness, true peak and when it was measured.

Revision ID: 0048_recording_loudness
Revises: 0047_recording_chord_charts

recordings.loudness_lufs
    Integrated loudness in LUFS (ITU-R BS.1770 / EBU R128), read with ffmpeg. Null until measured.
recordings.true_peak_db
    True peak in dBTP. The phone needs it to know how far a quiet recording can be raised.
recordings.loudness_measured_at
    When the two numbers were read (the backfill script skips what already has them).

The phone plays every recording at a common level using these numbers (docs/loudness-leveling.md).
All three columns are nullable and nothing is guessed for old rows:
`scripts/measure_recording_loudness.py` fills them in, by hand, never as part of the migration
(it needs the audio files).

Safe to run twice, and on a database where the app already ran `Base.metadata.create_all`.
Works on PostgreSQL and SQLite. Downgrade drops only the three columns this revision added.

Never run it against a real database without a backup.
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "0048_recording_loudness"
down_revision = "0047_recording_chord_charts"
branch_labels = None
depends_on = None

COLUMNS = (
    ("loudness_lufs", sa.Float()),
    ("true_peak_db", sa.Float()),
    ("loudness_measured_at", sa.DateTime(timezone=True)),
)


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table("recordings"):
        return
    have = {c["name"] for c in inspector.get_columns("recordings")}
    for name, kind in COLUMNS:
        if name not in have:
            op.add_column("recordings", sa.Column(name, kind, nullable=True))


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
