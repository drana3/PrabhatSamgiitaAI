"""Own style and mood words are shown to others only once the team accepted them.

Revision ID: 0066_own_words_checked
Revises: 0065_comments_survive_account_deletion

recordings.styles_other_ok, moods_other_ok
    Two JSON columns, nullable: the own words of `styles_other` / `moods_other` that the team
    accepted. A free word from a member is shown to its writer at once and to everybody else only
    once it is listed here (the same rule as `lead_instrument_checked` for the main instrument).
    Nothing is rewritten: a row with no list shows no own word to strangers, a row from before
    the lists (no `styles_other` either) shows its one old word as before.

Safe to run twice. Works on PostgreSQL and SQLite. Downgrade drops the two columns.
Never run it against a real database without a backup.
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "0066_own_words_checked"
down_revision = "0065_comments_survive_account_deletion"
branch_labels = None
depends_on = None

TABLE = "recordings"
COLUMNS = ("styles_other_ok", "moods_other_ok")


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table(TABLE):
        return
    have = {c["name"] for c in inspector.get_columns(TABLE)}
    for column in COLUMNS:
        if column not in have:
            op.add_column(TABLE, sa.Column(column, sa.JSON(), nullable=True))


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table(TABLE):
        return
    have = {c["name"] for c in inspector.get_columns(TABLE)}
    with op.batch_alter_table(TABLE) as batch:
        for column in reversed(COLUMNS):
            if column in have:
                batch.drop_column(column)
