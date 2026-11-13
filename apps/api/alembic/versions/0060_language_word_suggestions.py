"""A language an author writes ("Add a language") goes to the same team queue as an instrument.

Revision ID: 0060_language_word_suggestions
Revises: 0059_recording_moods

value_suggestions.field
    The check constraint now allows `language` next to `instrument` and `style`. No new column:
    a recording keeps its written language in `language_other`, as before.

Safe to run twice, and on a database where the app already ran `Base.metadata.create_all`.
Works on PostgreSQL and SQLite. Downgrade refuses while a language word is in the queue.
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "0060_language_word_suggestions"
down_revision = "0059_recording_moods"
branch_labels = None
depends_on = None

TABLE = "value_suggestions"
CHECK = "ck_value_suggestions_field"
OLD = "field IN ('instrument', 'style')"
NEW = "field IN ('instrument', 'style', 'language')"


def _rule(inspector: sa.Inspector) -> str | None:
    for check in inspector.get_check_constraints(TABLE):
        if check.get("name") == CHECK:
            return str(check.get("sqltext") or "")
    return None


def _swap(rule: str) -> None:
    with op.batch_alter_table(TABLE) as batch:
        batch.drop_constraint(CHECK, type_="check")
        batch.create_check_constraint(CHECK, rule)


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table(TABLE):
        return  # create_all will build it whole
    current = _rule(inspector)
    if current is not None and "language" not in current:
        _swap(NEW)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table(TABLE):
        return
    waiting = bind.execute(
        sa.text("SELECT COUNT(*) FROM value_suggestions WHERE field = 'language'")
    ).scalar()
    if waiting:
        raise RuntimeError(
            f"Cannot go back: {waiting} language word(s) are in the team's queue. Decide or delete "
            "them first."
        )
    current = _rule(inspector)
    if current is not None and "language" in current:
        _swap(OLD)
