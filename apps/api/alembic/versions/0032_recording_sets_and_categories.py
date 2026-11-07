"""Spiritual songs, dance songs, any language, and playlists from an event.

Revision ID: 0032_recording_sets_and_categories
Revises: 0031_song_chord_proposals

Written out by hand and safe to run twice, like 0029: every step looks first, because 0027 builds
`recordings` from the CURRENT model and the app runs `create_all` at start, so on a fresh database
the table and the columns below may exist already. Additive: nothing is dropped except the old
language check (replaced) and the old kind checks (replaced by wider ones).

1. `recording_collections`: the playlists from an event.
2. `recordings`: `language_other`, `dance`, `recorded_on`, `collection_id` (SET NULL on delete,
   indexed), `position`.
3. The check constraints: `kind` also allows `spiritual_song` and `dance_song`; the type rule gives
   them the type `other`; the language is any 2 to 8 character code (the list of languages lives in
   the application, so it can grow without a migration); a dance song needs its dance and nothing
   else has one; a spiritual song needs a language. `devotional_song` stays allowed: old rows keep
   reading as Bhajan.
4. The five old language words (`bengali`, `sanskrit`, `hindi`, `english`) become the ISO codes
   (`bn`, `sa`, `hi`, `en`); `other` stays.

On PostgreSQL every change is a plain ALTER TABLE; on SQLite (the tests) Alembic copies the table.
Back up the database before running it on a real server.
"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0032_recording_sets_and_categories"
down_revision = "0031_song_chord_proposals"
branch_labels = None
depends_on = None

RECORDINGS = "recordings"
SETS = "recording_collections"
COLLECTION_INDEX = "ix_recordings_collection_id"
COLLECTION_FK = "fk_recordings_collection_id"

KIND_CHECK = "ck_recordings_kind"
TYPE_CHECK = "ck_recordings_type_for_kind"
LANGUAGE_CHECK = "ck_recordings_language"
DANCE_CHECK = "ck_recordings_dance"
SPIRITUAL_CHECK = "ck_recordings_spiritual_language"

OLD_KIND = "kind IN ('kiirtan', 'bhajan', 'devotional_song', 'prabhat_samgiita')"
NEW_KIND = (
    "kind IN ('kiirtan', 'bhajan', 'devotional_song', 'prabhat_samgiita', "
    "'spiritual_song', 'dance_song')"
)
_TYPE_HEAD = (
    "(kind = 'kiirtan' AND type IN ('bnk', 'lila', 'festival', 'other')) OR "
    "(kind = 'bhajan' AND type IN ('morning', 'evening', 'devotional', 'other')) OR "
)
OLD_TYPE = _TYPE_HEAD + "(kind IN ('devotional_song', 'prabhat_samgiita') AND type = 'other')"
NEW_TYPE = (
    _TYPE_HEAD + "(kind IN ('devotional_song', 'prabhat_samgiita', 'spiritual_song', 'dance_song') "
    "AND type = 'other')"
)
OLD_LANGUAGE = (
    "language IS NULL OR language IN ('bengali', 'sanskrit', 'hindi', 'english', 'other')"
)
NEW_LANGUAGE = "language IS NULL OR (length(language) >= 2 AND length(language) <= 8)"
DANCE_RULE = (
    "(kind = 'dance_song' AND dance IS NOT NULL) OR (kind <> 'dance_song' AND dance IS NULL)"
)
SPIRITUAL_RULE = "kind <> 'spiritual_song' OR language IS NOT NULL"

WORD_TO_CODE = {"bengali": "bn", "sanskrit": "sa", "hindi": "hi", "english": "en"}


def _uuid() -> sa.types.TypeEngine[object]:
    return postgresql.UUID(as_uuid=True)


def _columns(inspector: sa.Inspector, table: str) -> set[str]:
    return {column["name"] for column in inspector.get_columns(table)}


def _checks(inspector: sa.Inspector, table: str) -> dict[str, str]:
    return {c["name"]: str(c.get("sqltext") or "") for c in inspector.get_check_constraints(table)}


def _create_sets() -> None:
    op.create_table(
        SETS,
        sa.Column("id", _uuid(), primary_key=True),
        sa.Column("owner_id", _uuid(), sa.ForeignKey("user_accounts.id", ondelete="SET NULL")),
        sa.Column("owner_name", sa.String(255), nullable=False, server_default=""),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.String(1000)),
        sa.Column("place", sa.String(200)),
        sa.Column("starts_on", sa.Date(), nullable=False),
        sa.Column("ends_on", sa.Date()),
        sa.Column("cover_url", sa.Text()),
        sa.Column("default_kind", sa.String(16), nullable=False, server_default="kiirtan"),
        sa.Column("default_language", sa.String(16)),
        sa.Column("default_language_other", sa.String(80)),
        sa.Column("default_dance", sa.String(16)),
        sa.Column("tracks_expected", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("finished_at", sa.DateTime(timezone=True)),
        sa.Column("status", sa.String(16), nullable=False, server_default="active"),
        sa.Column("removed_reason", sa.Text()),
        sa.Column("removed_at", sa.DateTime(timezone=True)),
        sa.Column("removed_by", sa.String(255)),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.CheckConstraint(
            "status IN ('active', 'removed')", name="ck_recording_collections_status"
        ),
        sa.CheckConstraint(
            "ends_on IS NULL OR ends_on >= starts_on", name="ck_recording_collections_dates"
        ),
    )
    op.create_index("ix_recording_collections_owner_id", SETS, ["owner_id"])
    op.create_index("ix_recording_collections_status", SETS, ["status"])


def _add_columns() -> None:
    have = _columns(sa.inspect(op.get_bind()), RECORDINGS)
    wanted: list[sa.Column[object]] = []
    if "language_other" not in have:
        wanted.append(sa.Column("language_other", sa.String(80), nullable=True))
    if "dance" not in have:
        wanted.append(sa.Column("dance", sa.String(16), nullable=True))
    if "recorded_on" not in have:
        wanted.append(sa.Column("recorded_on", sa.Date(), nullable=True))
    if "position" not in have:
        wanted.append(sa.Column("position", sa.Integer(), nullable=True))
    if "collection_id" not in have:
        wanted.append(
            sa.Column(
                "collection_id",
                _uuid(),
                sa.ForeignKey(f"{SETS}.id", ondelete="SET NULL", name=COLLECTION_FK),
                nullable=True,
            )
        )
    if wanted:
        with op.batch_alter_table(RECORDINGS) as batch:
            for column in wanted:
                batch.add_column(column)
    indexes = {i["name"] for i in sa.inspect(op.get_bind()).get_indexes(RECORDINGS)}
    if COLLECTION_INDEX not in indexes:
        op.create_index(COLLECTION_INDEX, RECORDINGS, ["collection_id"])


def _swap_checks() -> None:
    have = _checks(sa.inspect(op.get_bind()), RECORDINGS)
    # The language check goes first: the backfill below writes codes it would refuse.
    replace: list[tuple[str, str]] = []
    if KIND_CHECK in have and "spiritual_song" not in have[KIND_CHECK]:
        replace.append((KIND_CHECK, NEW_KIND))
    if TYPE_CHECK in have and "spiritual_song" not in have[TYPE_CHECK]:
        replace.append((TYPE_CHECK, NEW_TYPE))
    if LANGUAGE_CHECK in have and "length(" not in have[LANGUAGE_CHECK].lower():
        replace.append((LANGUAGE_CHECK, NEW_LANGUAGE))
    add = [
        (name, rule)
        for name, rule in (
            (LANGUAGE_CHECK, NEW_LANGUAGE),
            (DANCE_CHECK, DANCE_RULE),
            (SPIRITUAL_CHECK, SPIRITUAL_RULE),
        )
        if name not in have and name not in {n for n, _ in replace}
    ]
    if not replace and not add:
        return
    with op.batch_alter_table(RECORDINGS) as batch:
        for name, rule in replace:
            batch.drop_constraint(name, type_="check")
            batch.create_check_constraint(name, rule)
        for name, rule in add:
            batch.create_check_constraint(name, rule)


def _backfill_language_codes() -> None:
    bind = op.get_bind()
    for word, code in WORD_TO_CODE.items():
        bind.execute(
            sa.text("UPDATE recordings SET language = :code WHERE language = :word"),
            {"code": code, "word": word},
        )


def upgrade() -> None:
    bind = op.get_bind()
    if not sa.inspect(bind).has_table(RECORDINGS):
        return  # nothing to extend (0027 has not made the table); create_all will build it whole
    if not sa.inspect(bind).has_table(SETS):
        _create_sets()
    _add_columns()
    _swap_checks()
    _backfill_language_codes()


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table(RECORDINGS):
        return
    newer = bind.execute(
        sa.text("SELECT COUNT(*) FROM recordings WHERE kind IN ('spiritual_song', 'dance_song')")
    ).scalar()
    if newer:
        raise RuntimeError(
            f"Cannot go back: {newer} recording(s) of the Spiritual song or Dance song category "
            "exist, and the older schema has no place for them."
        )
    # Codes outside the old list of five become "other" (the name is lost); known ones go back.
    for word, code in WORD_TO_CODE.items():
        bind.execute(
            sa.text("UPDATE recordings SET language = :word WHERE language = :code"),
            {"code": code, "word": word},
        )
    bind.execute(
        sa.text(
            "UPDATE recordings SET language = 'other' WHERE language IS NOT NULL AND language "
            "NOT IN ('bengali', 'sanskrit', 'hindi', 'english', 'other')"
        )
    )
    checks = _checks(sa.inspect(bind), RECORDINGS)
    have = _columns(sa.inspect(bind), RECORDINGS)
    indexes = {i["name"] for i in sa.inspect(bind).get_indexes(RECORDINGS)}
    if COLLECTION_INDEX in indexes:
        op.drop_index(COLLECTION_INDEX, table_name=RECORDINGS)
    with op.batch_alter_table(RECORDINGS) as batch:
        for name in (DANCE_CHECK, SPIRITUAL_CHECK):
            if name in checks:
                batch.drop_constraint(name, type_="check")
        for name, rule in (
            (KIND_CHECK, OLD_KIND),
            (TYPE_CHECK, OLD_TYPE),
            (LANGUAGE_CHECK, OLD_LANGUAGE),
        ):
            if name in checks:
                batch.drop_constraint(name, type_="check")
                batch.create_check_constraint(name, rule)
        for column in ("collection_id", "position", "recorded_on", "dance", "language_other"):
            if column in have:
                batch.drop_column(column)
    if sa.inspect(bind).has_table(SETS):
        op.drop_table(SETS)
