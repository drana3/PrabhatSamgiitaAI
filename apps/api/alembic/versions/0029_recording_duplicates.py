"""Kiirtan duplicates and the four upload categories: unique file hash, new recording fields.

Revision ID: 0029_recording_duplicates
Revises: 0028_learn_progress

Written out by hand (not from the models) so it keeps meaning the same after the models change,
and safe to run twice or on a database where some of it already exists: migration 0027 builds
`recordings` from the CURRENT model, and the app also runs `create_all` at start, so on a new
database every table and column below may be there already. Each step looks first.

This revision was never deployed. An earlier draft of it also added mantra groups; there is only
ONE mantra in the library (Baba Nam Kevalam), so that was dropped before release (step 3 only
tidies a development database that ran the draft).

What it does:

1. `recordings`: new columns `year` (recorded), `removed_duplicate_of`, `language`, `credits`,
   `notes`, `ps_song_number`; the index on `audio_sha256` becomes UNIQUE (the same file cannot be
   stored twice, even by two uploads at the same moment). If duplicates are already there it stops
   with a clear message.
2. `recordings.kind` may be `kiirtan`, `bhajan`, `devotional_song` or `prabhat_samgiita` (the check
   constraints are replaced), a Prabhat Samgiita recording must name its song (1..5018), the
   language is one of five.
3. Tidy: drops `mantra_title`, `mantra_group_id` and the table `mantra_groups`, if the draft
   made them.
4. `recording_similar_confirms`: "this file is a different performance" answers.
5. `recording_reports`: the reason "duplicate" is allowed (the check constraint is replaced).

Never run it against a real database without a backup (docs/kiirtan-publishing.md, "Duplicates").
"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0029_recording_duplicates"
down_revision = "0028_learn_progress"
branch_labels = None
depends_on = None

DRAFT_GROUPS = "mantra_groups"
CONFIRMS = "recording_similar_confirms"
RECORDINGS = "recordings"
REPORTS = "recording_reports"
SHA_INDEX = "ix_recordings_audio_sha256"
SONG_INDEX = "ix_recordings_ps_song_number"
REASON_CHECK = "ck_recording_reports_reason"
OLD_REASONS = "reason IN ('copyright', 'offensive', 'wrong_info', 'other')"
NEW_REASONS = "reason IN ('copyright', 'offensive', 'wrong_info', 'duplicate', 'other')"

KIND_CHECK = "ck_recordings_kind"
TYPE_CHECK = "ck_recordings_type_for_kind"
SONG_CHECK = "ck_recordings_ps_song"
LANGUAGE_CHECK = "ck_recordings_language"
OLD_KIND = "kind IN ('kiirtan', 'bhajan')"
NEW_KIND = "kind IN ('kiirtan', 'bhajan', 'devotional_song', 'prabhat_samgiita')"
OLD_TYPE = (
    "(kind = 'kiirtan' AND type IN ('bnk', 'lila', 'festival', 'other')) OR "
    "(kind = 'bhajan' AND type IN ('morning', 'evening', 'devotional', 'other'))"
)
NEW_TYPE = OLD_TYPE + " OR (kind IN ('devotional_song', 'prabhat_samgiita') AND type = 'other')"
SONG_RULE = (
    "(kind = 'prabhat_samgiita' AND ps_song_number IS NOT NULL "
    "AND ps_song_number >= 1 AND ps_song_number <= 5018) OR "
    "(kind <> 'prabhat_samgiita' AND ps_song_number IS NULL)"
)
LANGUAGE_RULE = (
    "language IS NULL OR language IN ('bengali', 'sanskrit', 'hindi', 'english', 'other')"
)


def _uuid() -> sa.types.TypeEngine[object]:
    return postgresql.UUID(as_uuid=True)


def _columns(inspector: sa.Inspector, table: str) -> set[str]:
    return {column["name"] for column in inspector.get_columns(table)}


def _indexes(inspector: sa.Inspector, table: str) -> dict[str, bool]:
    return {index["name"]: bool(index.get("unique")) for index in inspector.get_indexes(table)}


def _checks(inspector: sa.Inspector, table: str) -> dict[str, str]:
    return {c["name"]: str(c.get("sqltext") or "") for c in inspector.get_check_constraints(table)}


def _create_confirms() -> None:
    op.create_table(
        CONFIRMS,
        sa.Column("id", _uuid(), primary_key=True),
        sa.Column("audio_sha256", sa.String(64), nullable=False),
        sa.Column(
            "other_id",
            _uuid(),
            sa.ForeignKey(f"{RECORDINGS}.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "member_id",
            _uuid(),
            sa.ForeignKey("user_accounts.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.UniqueConstraint("audio_sha256", "other_id", name="uq_recording_similar_confirms_pair"),
    )
    op.create_index("ix_recording_similar_confirms_audio_sha256", CONFIRMS, ["audio_sha256"])
    op.create_index("ix_recording_similar_confirms_other_id", CONFIRMS, ["other_id"])


def _add_recording_columns(inspector: sa.Inspector) -> None:
    have = _columns(inspector, RECORDINGS)
    wanted: list[sa.Column[object]] = []
    if "year" not in have:
        wanted.append(sa.Column("year", sa.Integer(), nullable=True))
    if "language" not in have:
        wanted.append(sa.Column("language", sa.String(16), nullable=True))
    if "credits" not in have:
        wanted.append(sa.Column("credits", sa.String(300), nullable=True))
    if "notes" not in have:
        wanted.append(sa.Column("notes", sa.String(500), nullable=True))
    if "ps_song_number" not in have:
        wanted.append(sa.Column("ps_song_number", sa.Integer(), nullable=True))
    if "removed_duplicate_of" not in have:
        wanted.append(
            sa.Column(
                "removed_duplicate_of",
                _uuid(),
                sa.ForeignKey(
                    f"{RECORDINGS}.id",
                    ondelete="SET NULL",
                    name="fk_recordings_removed_duplicate_of",
                ),
                nullable=True,
            )
        )
    if wanted:
        # Batch mode: plain ALTER TABLE on PostgreSQL, copy-and-move on SQLite (the tests).
        with op.batch_alter_table(RECORDINGS) as batch:
            for column in wanted:
                batch.add_column(column)
    if SONG_INDEX not in _indexes(sa.inspect(op.get_bind()), RECORDINGS):
        op.create_index(SONG_INDEX, RECORDINGS, ["ps_song_number"])


def _drop_draft_mantras() -> None:
    """Tidy a development database that ran the earlier draft (mantra groups). Nothing else."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "mantra_group_id" in _columns(inspector, RECORDINGS):
        if "ix_recordings_mantra_group_id" in _indexes(inspector, RECORDINGS):
            op.drop_index("ix_recordings_mantra_group_id", table_name=RECORDINGS)
        with op.batch_alter_table(RECORDINGS) as batch:
            batch.drop_column("mantra_group_id")
    if "mantra_title" in _columns(sa.inspect(bind), RECORDINGS):
        with op.batch_alter_table(RECORDINGS) as batch:
            batch.drop_column("mantra_title")
    if sa.inspect(bind).has_table(DRAFT_GROUPS):
        op.drop_table(DRAFT_GROUPS)


def _make_sha_unique() -> None:
    bind = op.get_bind()
    present = _indexes(sa.inspect(bind), RECORDINGS)
    if present.get(SHA_INDEX):
        return
    clashes = bind.execute(
        sa.text(
            "SELECT audio_sha256, COUNT(*) AS n FROM recordings "
            "GROUP BY audio_sha256 HAVING COUNT(*) > 1 LIMIT 5"
        )
    ).fetchall()
    if clashes:
        shown = ", ".join(f"{row[0][:12]}... x{row[1]}" for row in clashes)
        raise RuntimeError(
            "Cannot make recordings.audio_sha256 unique: the same file is stored more than once "
            f"({shown}). Remove the extra recordings first, then run the migration again."
        )
    if SHA_INDEX in present:
        op.drop_index(SHA_INDEX, table_name=RECORDINGS)
    op.create_index(SHA_INDEX, RECORDINGS, ["audio_sha256"], unique=True)


def _allow_duplicate_reason(inspector: sa.Inspector) -> None:
    constraints = _checks(inspector, REPORTS)
    if REASON_CHECK in constraints and "duplicate" in constraints[REASON_CHECK]:
        return
    with op.batch_alter_table(REPORTS) as batch:
        if REASON_CHECK in constraints:
            batch.drop_constraint(REASON_CHECK, type_="check")
        batch.create_check_constraint(REASON_CHECK, NEW_REASONS)


def _widen_categories(inspector: sa.Inspector) -> None:
    """New kinds in the check constraints, the song rule and the language list.

    An existing constraint with the old text is replaced; one that is not there is not invented
    (a table made by hand may have no `type` column), except the two new rules, which only use
    columns this migration has just added.
    """
    have = _checks(inspector, RECORDINGS)
    replace = [
        (name, rule)
        for name, rule in ((KIND_CHECK, NEW_KIND), (TYPE_CHECK, NEW_TYPE))
        if name in have and "prabhat_samgiita" not in have[name]
    ]
    add = [
        (name, rule)
        for name, rule in ((SONG_CHECK, SONG_RULE), (LANGUAGE_CHECK, LANGUAGE_RULE))
        if name not in have
    ]
    if not replace and not add:
        return
    with op.batch_alter_table(RECORDINGS) as batch:
        for name, rule in replace:
            batch.drop_constraint(name, type_="check")
            batch.create_check_constraint(name, rule)
        for name, rule in add:
            batch.create_check_constraint(name, rule)


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table(RECORDINGS):
        return  # nothing to extend (0027 has not made the table); create_all will build it whole
    _add_recording_columns(inspector)
    _drop_draft_mantras()
    _widen_categories(sa.inspect(bind))
    if not sa.inspect(bind).has_table(CONFIRMS):
        _create_confirms()
    _make_sha_unique()
    if sa.inspect(bind).has_table(REPORTS):
        _allow_duplicate_reason(sa.inspect(bind))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if inspector.has_table(RECORDINGS):
        newer = bind.execute(
            sa.text(
                "SELECT COUNT(*) FROM recordings "
                "WHERE kind IN ('devotional_song', 'prabhat_samgiita')"
            )
        ).scalar()
        if newer:
            raise RuntimeError(
                f"Cannot go back: {newer} recording(s) of the Devotional song or Prabhat Samgiita "
                "category exist, and the older schema has no place for them."
            )
    if inspector.has_table(REPORTS):
        bind.execute(
            sa.text("UPDATE recording_reports SET reason = 'other' WHERE reason = 'duplicate'")
        )
        constraints = _checks(inspector, REPORTS)
        with op.batch_alter_table(REPORTS) as batch:
            if REASON_CHECK in constraints:
                batch.drop_constraint(REASON_CHECK, type_="check")
            batch.create_check_constraint(REASON_CHECK, OLD_REASONS)
    if inspector.has_table(CONFIRMS):
        op.drop_table(CONFIRMS)
    if inspector.has_table(RECORDINGS):
        present = _indexes(sa.inspect(bind), RECORDINGS)
        if present.get(SHA_INDEX):
            op.drop_index(SHA_INDEX, table_name=RECORDINGS)
            op.create_index(SHA_INDEX, RECORDINGS, ["audio_sha256"])
        if SONG_INDEX in present:
            op.drop_index(SONG_INDEX, table_name=RECORDINGS)
        have = _columns(sa.inspect(bind), RECORDINGS)
        checks = _checks(sa.inspect(bind), RECORDINGS)
        with op.batch_alter_table(RECORDINGS) as batch:
            for name in (SONG_CHECK, LANGUAGE_CHECK):
                if name in checks:
                    batch.drop_constraint(name, type_="check")
            for name, rule in ((KIND_CHECK, OLD_KIND), (TYPE_CHECK, OLD_TYPE)):
                if name in checks:
                    batch.drop_constraint(name, type_="check")
                    batch.create_check_constraint(name, rule)
            for column in (
                "removed_duplicate_of",
                "ps_song_number",
                "notes",
                "credits",
                "language",
                "year",
            ):
                if column in have:
                    batch.drop_column(column)
