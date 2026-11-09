"""Others: the required choice (Guru Puja, Pitr Yajina, Samgacchadhvam, Nityam Shuddham,
Ananda Sutram, Shlokas, Something else) and the team's queue for the "Something else" name.

Revision ID: 0067_others_choice
Revises: 0066_own_words_checked

The category "Other mantras" is called "Others" from 9 Nov 2026. Its stored id stays `other_mantra`
(rows and clients that carry it keep working); only the visible name changed.

The check constraint ck_recordings_type_for_kind
    The type of an `other_mantra` row is one of guru_puja, pitriyajina (the old id stays; it is
    shown as "Pitr Yajina"), samgacchadhvam, nityam_shuddham, ananda_sutram, shlokas or other
    ("Something else"). A row stored before keeps its type and reads as before.

recordings.type_other, type_other_checked
    With the type `other` the name the author wrote under "Something else", and whether the team
    accepted it. The author sees the word at once, everybody else only after the team accepted it
    (the same rule as `lead_instrument_other` / `lead_instrument_checked`). Nullable / false: no row
    is rewritten.

ck_value_suggestions_field
    The team's queue of own words also takes the field `mantra`.

Safe to run twice. Works on PostgreSQL and SQLite. Downgrade refuses while a row with one of the new
types or a `mantra` word exists. Never run it against a real database without a backup.
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "0067_others_choice"
down_revision = "0066_own_words_checked"
branch_labels = None
depends_on = None

RECORDINGS = "recordings"
SUGGESTIONS = "value_suggestions"
TYPE_CHECK = "ck_recordings_type_for_kind"
FIELD_CHECK = "ck_value_suggestions_field"

_HEAD = (
    "(kind = 'kiirtan' AND type IN ('bnk', 'lila', 'festival', 'other')) OR "
    "(kind = 'bhajan' AND type IN ('morning', 'evening', 'devotional', 'other')) OR "
)
_TAIL = (
    "(kind IN ('devotional_song', 'prabhat_samgiita', 'spiritual_song', "
    "'dance_song', 'baba_audio') AND type = 'other')"
)
OLD_TYPE = _HEAD + "(kind = 'other_mantra' AND type IN ('guru_puja', 'pitriyajina', 'other')) OR " + _TAIL
NEW_TYPE = (
    _HEAD
    + "(kind = 'other_mantra' AND type IN ('guru_puja', 'pitriyajina', 'samgacchadhvam', "
    "'nityam_shuddham', 'ananda_sutram', 'shlokas', 'other')) OR "
    + _TAIL
)
NEW_ONLY_TYPES = ("samgacchadhvam", "nityam_shuddham", "ananda_sutram", "shlokas")
OLD_FIELD = "field IN ('instrument', 'style', 'language', 'mood')"
NEW_FIELD = "field IN ('instrument', 'style', 'language', 'mood', 'mantra')"


def _checks(inspector: sa.Inspector, table: str) -> dict[str, str]:
    return {c["name"]: str(c.get("sqltext") or "") for c in inspector.get_check_constraints(table)}


def _swap(table: str, pairs: list[tuple[str, str]]) -> None:
    if not pairs:
        return
    with op.batch_alter_table(table) as batch:
        for name, rule in pairs:
            batch.drop_constraint(name, type_="check")
            batch.create_check_constraint(name, rule)


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if inspector.has_table(RECORDINGS):
        have = {c["name"] for c in inspector.get_columns(RECORDINGS)}
        if "type_other" not in have:
            op.add_column(RECORDINGS, sa.Column("type_other", sa.String(80), nullable=True))
        if "type_other_checked" not in have:
            op.add_column(
                RECORDINGS,
                sa.Column(
                    "type_other_checked",
                    sa.Boolean(),
                    nullable=False,
                    server_default=sa.false(),
                ),
            )
        rule = _checks(sa.inspect(bind), RECORDINGS).get(TYPE_CHECK)
        if rule is not None and "samgacchadhvam" not in rule:
            _swap(RECORDINGS, [(TYPE_CHECK, NEW_TYPE)])
    if inspector.has_table(SUGGESTIONS):
        rule = _checks(inspector, SUGGESTIONS).get(FIELD_CHECK)
        if rule is not None and "mantra" not in rule:
            _swap(SUGGESTIONS, [(FIELD_CHECK, NEW_FIELD)])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if inspector.has_table(RECORDINGS):
        marks = ", ".join(f"'{t}'" for t in NEW_ONLY_TYPES)
        rows = bind.execute(
            sa.text(f"SELECT COUNT(*) FROM recordings WHERE type IN ({marks})")
        ).scalar()
        if rows:
            raise RuntimeError(
                f"Cannot go back: {rows} recording(s) of Others carry a type the older schema "
                "does not know."
            )
    if inspector.has_table(SUGGESTIONS):
        words = bind.execute(
            sa.text("SELECT COUNT(*) FROM value_suggestions WHERE field = 'mantra'")
        ).scalar()
        if words:
            raise RuntimeError(
                f"Cannot go back: {words} word(s) for Others are in the team's queue. Decide or "
                "delete them first."
            )
    if inspector.has_table(RECORDINGS):
        rule = _checks(inspector, RECORDINGS).get(TYPE_CHECK)
        if rule is not None and "samgacchadhvam" in rule:
            _swap(RECORDINGS, [(TYPE_CHECK, OLD_TYPE)])
        have = {c["name"] for c in sa.inspect(bind).get_columns(RECORDINGS)}
        with op.batch_alter_table(RECORDINGS) as batch:
            for column in ("type_other_checked", "type_other"):
                if column in have:
                    batch.drop_column(column)
    if inspector.has_table(SUGGESTIONS):
        rule = _checks(sa.inspect(bind), SUGGESTIONS).get(FIELD_CHECK)
        if rule is not None and "mantra" in rule:
            _swap(SUGGESTIONS, [(FIELD_CHECK, OLD_FIELD)])
