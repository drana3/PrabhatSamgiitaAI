"""Baba's Audio Discourses: a new recording kind, with an optional place and discourse name.

Revision ID: 0040_baba_audio_kind
Revises: 0039_kiirtan_style_and_menu_pins

recordings.place / recordings.discourse
    Where the discourse was given, and its name or number. Both optional, filled for the
    `baba_audio` kind only (the service drops them for every other kind).

The check constraints
    `kind` (and the type-for-kind rule) also allow `baba_audio`, and the "language is required"
    rule now covers `baba_audio` as well as `spiritual_song`.

Safe to run twice, and on a database where the app already ran `Base.metadata.create_all`.
Works on PostgreSQL and SQLite. Downgrade refuses while a Baba's Audio row exists.
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "0040_baba_audio_kind"
down_revision = "0039_kiirtan_style_and_menu_pins"
branch_labels = None
depends_on = None

RECORDINGS = "recordings"
KIND_CHECK = "ck_recordings_kind"
TYPE_CHECK = "ck_recordings_type_for_kind"
SPIRITUAL_CHECK = "ck_recordings_spiritual_language"

_KINDS = (
    "'kiirtan', 'bhajan', 'devotional_song', 'prabhat_samgiita', 'spiritual_song', 'dance_song'"
)
OLD_KIND = f"kind IN ({_KINDS})"
NEW_KIND = f"kind IN ({_KINDS}, 'baba_audio')"
_TYPE_HEAD = (
    "(kind = 'kiirtan' AND type IN ('bnk', 'lila', 'festival', 'other')) OR "
    "(kind = 'bhajan' AND type IN ('morning', 'evening', 'devotional', 'other')) OR "
)
OLD_TYPE = (
    _TYPE_HEAD + "(kind IN ('devotional_song', 'prabhat_samgiita', 'spiritual_song', "
    "'dance_song') AND type = 'other')"
)
NEW_TYPE = (
    _TYPE_HEAD + "(kind IN ('devotional_song', 'prabhat_samgiita', 'spiritual_song', "
    "'dance_song', 'baba_audio') AND type = 'other')"
)
OLD_SPIRITUAL = "kind <> 'spiritual_song' OR language IS NOT NULL"
NEW_SPIRITUAL = "kind NOT IN ('spiritual_song', 'baba_audio') OR language IS NOT NULL"


def _checks(inspector: sa.Inspector) -> dict[str, str]:
    return {
        c["name"]: str(c.get("sqltext") or "") for c in inspector.get_check_constraints(RECORDINGS)
    }


def _swap(pairs: list[tuple[str, str]]) -> None:
    if not pairs:
        return
    with op.batch_alter_table(RECORDINGS) as batch:
        for name, rule in pairs:
            batch.drop_constraint(name, type_="check")
            batch.create_check_constraint(name, rule)


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table(RECORDINGS):
        return  # create_all will build it whole
    have = {c["name"] for c in inspector.get_columns(RECORDINGS)}
    if "place" not in have:
        op.add_column(RECORDINGS, sa.Column("place", sa.String(200), nullable=True))
    if "discourse" not in have:
        op.add_column(RECORDINGS, sa.Column("discourse", sa.String(200), nullable=True))
    checks = _checks(sa.inspect(op.get_bind()))
    swap: list[tuple[str, str]] = []
    if KIND_CHECK in checks and "baba_audio" not in checks[KIND_CHECK]:
        swap.append((KIND_CHECK, NEW_KIND))
    if TYPE_CHECK in checks and "baba_audio" not in checks[TYPE_CHECK]:
        swap.append((TYPE_CHECK, NEW_TYPE))
    if SPIRITUAL_CHECK in checks and "baba_audio" not in checks[SPIRITUAL_CHECK]:
        swap.append((SPIRITUAL_CHECK, NEW_SPIRITUAL))
    _swap(swap)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table(RECORDINGS):
        return
    newer = bind.execute(
        sa.text("SELECT COUNT(*) FROM recordings WHERE kind = 'baba_audio'")
    ).scalar()
    if newer:
        raise RuntimeError(
            f"Cannot go back: {newer} recording(s) of Baba's Audio Discourses exist, and the "
            "older schema has no place for them."
        )
    checks = _checks(inspector)
    _swap(
        [
            (name, rule)
            for name, rule in (
                (KIND_CHECK, OLD_KIND),
                (TYPE_CHECK, OLD_TYPE),
                (SPIRITUAL_CHECK, OLD_SPIRITUAL),
            )
            if name in checks
        ]
    )
    have = {c["name"] for c in sa.inspect(bind).get_columns(RECORDINGS)}
    with op.batch_alter_table(RECORDINGS) as batch:
        for column in ("discourse", "place"):
            if column in have:
                batch.drop_column(column)
