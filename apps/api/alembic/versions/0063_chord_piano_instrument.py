"""Piano as a third instrument of a chord chart (Harmonium, Piano, Guitar).

Revision ID: 0063_chord_piano_instrument
Revises: 0062_broadcast_duration_review_recordings

recording_chord_sheets.instrument, song_chord_proposals.instrument
    The CHECK allowed 'guitar' and 'harmonium'; it now also allows 'piano'. The columns stay
    String(12) (the longest word is 'harmonium'). Nothing is rewritten: old rows keep their
    instrument.

Safe to run twice, and on a database where the app already ran `Base.metadata.create_all`.
Works on PostgreSQL and SQLite. Downgrade refuses while a piano chart exists (the older schema has
no place for it), and puts the old rule back otherwise.

Never run it against a real database without a backup.
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "0063_chord_piano_instrument"
down_revision = "0062_broadcast_duration_review_recordings"
branch_labels = None
depends_on = None

OLD_RULE = "instrument IN ('guitar', 'harmonium')"
NEW_RULE = "instrument IN ('guitar', 'harmonium', 'piano')"
TABLES = (
    ("recording_chord_sheets", "ck_recording_chord_sheets_instrument"),
    ("song_chord_proposals", "ck_song_chord_proposals_instrument"),
)


def _checks(inspector: sa.Inspector, table: str) -> dict[str, str]:
    return {c["name"]: str(c.get("sqltext") or "") for c in inspector.get_check_constraints(table)}


def _swap(table: str, name: str, rule: str) -> None:
    with op.batch_alter_table(table) as batch:
        batch.drop_constraint(name, type_="check")
        batch.create_check_constraint(name, rule)


def upgrade() -> None:
    for table, name in TABLES:
        inspector = sa.inspect(op.get_bind())
        if not inspector.has_table(table):
            continue  # create_all will build it whole
        found = _checks(inspector, table)
        if name in found and "piano" not in found[name]:
            _swap(table, name, NEW_RULE)


def downgrade() -> None:
    bind = op.get_bind()
    for table, _name in TABLES:
        inspector = sa.inspect(bind)
        if not inspector.has_table(table):
            continue
        newer = bind.execute(
            sa.text(f"SELECT COUNT(*) FROM {table} WHERE instrument = 'piano'")  # noqa: S608
        ).scalar()
        if newer:
            raise RuntimeError(
                f"Cannot go back: {newer} piano chart(s) exist in {table}, and the older schema "
                "has no place for them."
            )
    for table, name in TABLES:
        inspector = sa.inspect(bind)
        if inspector.has_table(table) and name in _checks(inspector, table):
            _swap(table, name, OLD_RULE)
