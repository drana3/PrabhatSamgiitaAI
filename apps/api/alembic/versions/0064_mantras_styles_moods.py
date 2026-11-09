"""Other mantras, several styles and moods, one place for all, three types of recording.

Revision ID: 0064_mantras_styles_moods
Revises: 0063_chord_piano_instrument

recordings.styles, styles_other, moods, moods_other
    Four JSON columns, all nullable. A style and a mood are now SEVERAL choices from a short list
    plus the person's own words (Dada, 9 Nov 2026). A row from before keeps its single
    `style` / `style_other` and reads as a list of one (nothing is copied or lost); a new row
    writes the lists and mirrors the first of them into `style` / `style_other`.

The check constraints of recordings
    `kind` also allows `other_mantra` (Other mantras: Guru Puja, Pitriyajina and the other
    mantras of Ananda Marga), and the type-for-kind rule gives that kind the types guru_puja,
    pitriyajina and other.

ck_value_suggestions_field
    The team's queue of own words also takes `mood`.

recordings.recording_type
    The type of recording is now exactly studio, live or ai. The removed `home` ("at home or on a
    phone") is rewritten to `studio`. This one step cannot be undone by `downgrade`: the older
    schema would read `studio`, which it also knows.

Nothing else is rewritten: a Kiirtan row stored with a tempo keeps it (the API no longer shows it),
an old style id (bengali, hindi, brajabuli, dhrupad, folk) stays on its row and reads as it did.

Safe to run twice, and on a database where the app already ran `Base.metadata.create_all`.
Works on PostgreSQL and SQLite. Downgrade refuses while an Other-mantra row or a mood word exists.

Never run it against a real database without a backup.
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "0064_mantras_styles_moods"
down_revision = "0063_chord_piano_instrument"
branch_labels = None
depends_on = None

RECORDINGS = "recordings"
SUGGESTIONS = "value_suggestions"
KIND_CHECK = "ck_recordings_kind"
TYPE_CHECK = "ck_recordings_type_for_kind"
FIELD_CHECK = "ck_value_suggestions_field"
NEW_COLUMNS = ("styles", "styles_other", "moods", "moods_other")

_KINDS = (
    "'kiirtan', 'bhajan', 'devotional_song', 'prabhat_samgiita', 'spiritual_song', 'dance_song', "
    "'baba_audio'"
)
OLD_KIND = f"kind IN ({_KINDS})"
NEW_KIND = f"kind IN ({_KINDS}, 'other_mantra')"
_TYPE_HEAD = (
    "(kind = 'kiirtan' AND type IN ('bnk', 'lila', 'festival', 'other')) OR "
    "(kind = 'bhajan' AND type IN ('morning', 'evening', 'devotional', 'other')) OR "
)
OLD_TYPE = (
    _TYPE_HEAD + "(kind IN ('devotional_song', 'prabhat_samgiita', 'spiritual_song', "
    "'dance_song', 'baba_audio') AND type = 'other')"
)
NEW_TYPE = (
    _TYPE_HEAD + "(kind = 'other_mantra' AND type IN ('guru_puja', 'pitriyajina', 'other')) OR "
    "(kind IN ('devotional_song', 'prabhat_samgiita', 'spiritual_song', "
    "'dance_song', 'baba_audio') AND type = 'other')"
)
OLD_FIELD = "field IN ('instrument', 'style', 'language')"
NEW_FIELD = "field IN ('instrument', 'style', 'language', 'mood')"


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
        for column in NEW_COLUMNS:
            if column not in have:
                op.add_column(RECORDINGS, sa.Column(column, sa.JSON(), nullable=True))
        checks = _checks(sa.inspect(bind), RECORDINGS)
        swap: list[tuple[str, str]] = []
        if KIND_CHECK in checks and "other_mantra" not in checks[KIND_CHECK]:
            swap.append((KIND_CHECK, NEW_KIND))
        if TYPE_CHECK in checks and "other_mantra" not in checks[TYPE_CHECK]:
            swap.append((TYPE_CHECK, NEW_TYPE))
        _swap(RECORDINGS, swap)
        # three types of recording: the removed "home" is a studio recording from now on
        op.execute(
            sa.text("UPDATE recordings SET recording_type = 'studio' WHERE recording_type = 'home'")
        )
    if inspector.has_table(SUGGESTIONS):
        field = _checks(inspector, SUGGESTIONS).get(FIELD_CHECK)
        if field is not None and "mood" not in field:
            _swap(SUGGESTIONS, [(FIELD_CHECK, NEW_FIELD)])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if inspector.has_table(RECORDINGS):
        mantras = bind.execute(
            sa.text("SELECT COUNT(*) FROM recordings WHERE kind = 'other_mantra'")
        ).scalar()
        if mantras:
            raise RuntimeError(
                f"Cannot go back: {mantras} recording(s) of Other mantras exist, and the older "
                "schema has no place for them."
            )
    if inspector.has_table(SUGGESTIONS):
        words = bind.execute(
            sa.text("SELECT COUNT(*) FROM value_suggestions WHERE field = 'mood'")
        ).scalar()
        if words:
            raise RuntimeError(
                f"Cannot go back: {words} mood word(s) are in the team's queue. Decide or delete "
                "them first."
            )
    if inspector.has_table(RECORDINGS):
        checks = _checks(inspector, RECORDINGS)
        _swap(
            RECORDINGS,
            [
                (name, rule)
                for name, rule in ((KIND_CHECK, OLD_KIND), (TYPE_CHECK, OLD_TYPE))
                if name in checks
            ],
        )
        have = {c["name"] for c in sa.inspect(bind).get_columns(RECORDINGS)}
        with op.batch_alter_table(RECORDINGS) as batch:
            for column in reversed(NEW_COLUMNS):
                if column in have:
                    batch.drop_column(column)
    if inspector.has_table(SUGGESTIONS):
        field = _checks(sa.inspect(bind), SUGGESTIONS).get(FIELD_CHECK)
        if field is not None and "mood" in field:
            _swap(SUGGESTIONS, [(FIELD_CHECK, OLD_FIELD)])
