"""Kiirtan duplicates: mantra groups, unique file hash, remembered confirmations.

Revision ID: 0029_recording_duplicates
Revises: 0028_learn_progress

Written out by hand (not from the models) so it keeps meaning the same after the models change,
and safe to run twice or on a database where some of it already exists: migration 0027 builds
`recordings` from the CURRENT model, and the app also runs `create_all` at start, so on a new
database every table and column below may be there already. Each step looks first.

What it does:

* `mantra_groups`: one row per mantra (kind + normalised key), with `merged_into_id` for aliases.
* `recordings`: new columns `mantra_title`, `mantra_group_id`, `year`, `removed_duplicate_of`;
  the index on `audio_sha256` becomes UNIQUE (the same file cannot be stored twice, even by two
  uploads at the same moment). If duplicates are already there it stops with a clear message.
* `recording_similar_confirms`: "this file is a different performance" answers.
* `recording_reports`: the reason "duplicate" is allowed (the check constraint is replaced).
* Backfill: every recording without a mantra gets `mantra_title = title` and a group.

Never run it against a real database without a backup (docs/kiirtan-publishing.md, "Duplicates").
"""

from __future__ import annotations

import unicodedata
from uuid import uuid4

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0029_recording_duplicates"
down_revision = "0028_learn_progress"
branch_labels = None
depends_on = None

GROUPS = "mantra_groups"
CONFIRMS = "recording_similar_confirms"
RECORDINGS = "recordings"
REPORTS = "recording_reports"
SHA_INDEX = "ix_recordings_audio_sha256"
REASON_CHECK = "ck_recording_reports_reason"
OLD_REASONS = "reason IN ('copyright', 'offensive', 'wrong_info', 'other')"
NEW_REASONS = "reason IN ('copyright', 'offensive', 'wrong_info', 'duplicate', 'other')"


def _key(text: str | None) -> str:
    """The same rule as `app.services.mantras.mantra_key`, frozen here (a test compares them)."""
    if not text:
        return ""
    kept: list[str] = []
    for char in unicodedata.normalize("NFKD", text).casefold():
        category = unicodedata.category(char)
        if category == "Mn" and kept and ord(kept[-1]) < 0x250 and kept[-1].isalpha():
            continue
        if category[0] in ("L", "N", "M"):
            kept.append(char)
    return unicodedata.normalize("NFC", "".join(kept))[:200]


def _uuid() -> sa.types.TypeEngine[object]:
    return postgresql.UUID(as_uuid=True)


def _columns(inspector: sa.Inspector, table: str) -> set[str]:
    return {column["name"] for column in inspector.get_columns(table)}


def _indexes(inspector: sa.Inspector, table: str) -> dict[str, bool]:
    return {index["name"]: bool(index.get("unique")) for index in inspector.get_indexes(table)}


def _create_groups() -> None:
    op.create_table(
        GROUPS,
        sa.Column("id", _uuid(), primary_key=True),
        sa.Column("kind", sa.String(16), nullable=False, server_default="kiirtan"),
        sa.Column("key", sa.String(200), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column(
            "merged_into_id",
            _uuid(),
            sa.ForeignKey(f"{GROUPS}.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.UniqueConstraint("kind", "key", name="uq_mantra_groups_kind_key"),
        sa.CheckConstraint("kind IN ('kiirtan', 'bhajan')", name="ck_mantra_groups_kind"),
    )
    op.create_index("ix_mantra_groups_merged_into_id", GROUPS, ["merged_into_id"])


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
    if "mantra_title" not in have:
        wanted.append(sa.Column("mantra_title", sa.String(200), nullable=True))
    if "mantra_group_id" not in have:
        wanted.append(
            sa.Column(
                "mantra_group_id",
                _uuid(),
                sa.ForeignKey(
                    f"{GROUPS}.id", ondelete="SET NULL", name="fk_recordings_mantra_group_id"
                ),
                nullable=True,
            )
        )
    if "year" not in have:
        wanted.append(sa.Column("year", sa.Integer(), nullable=True))
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
    if "ix_recordings_mantra_group_id" not in _indexes(sa.inspect(op.get_bind()), RECORDINGS):
        op.create_index("ix_recordings_mantra_group_id", RECORDINGS, ["mantra_group_id"])


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
    constraints = {
        c["name"]: (c.get("sqltext") or "") for c in inspector.get_check_constraints(REPORTS)
    }
    if REASON_CHECK in constraints and "duplicate" in str(constraints[REASON_CHECK]):
        return
    with op.batch_alter_table(REPORTS) as batch:
        if REASON_CHECK in constraints:
            batch.drop_constraint(REASON_CHECK, type_="check")
        batch.create_check_constraint(REASON_CHECK, NEW_REASONS)


def _backfill() -> None:
    bind = op.get_bind()
    recordings = sa.table(
        RECORDINGS,
        sa.column("id", _uuid()),
        sa.column("kind", sa.String),
        sa.column("title", sa.String),
        sa.column("mantra_title", sa.String),
        sa.column("mantra_group_id", _uuid()),
    )
    groups = sa.table(
        GROUPS,
        sa.column("id", _uuid()),
        sa.column("kind", sa.String),
        sa.column("key", sa.String),
        sa.column("title", sa.String),
    )
    ids: dict[tuple[str, str], object] = {
        (row.kind, row.key): row.id
        for row in bind.execute(sa.select(groups.c.id, groups.c.kind, groups.c.key))
    }
    pending = bind.execute(
        sa.select(recordings.c.id, recordings.c.kind, recordings.c.title)
        .where(recordings.c.mantra_group_id.is_(None))
        .order_by(recordings.c.id)
    ).fetchall()
    for row in pending:
        shown = " ".join((row.title or "").split())[:200]
        key = _key(shown)
        if not key:
            continue
        group_id = ids.get((row.kind, key))
        if group_id is None:
            group_id = uuid4()
            bind.execute(sa.insert(groups).values(id=group_id, kind=row.kind, key=key, title=shown))
            ids[(row.kind, key)] = group_id
        bind.execute(
            sa.update(recordings)
            .where(recordings.c.id == row.id)
            .values(mantra_group_id=group_id, mantra_title=shown)
        )


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table(GROUPS):
        _create_groups()
    if not inspector.has_table(RECORDINGS):
        return  # nothing to extend (0027 has not made the table); create_all will build it whole
    _add_recording_columns(sa.inspect(bind))
    if not sa.inspect(bind).has_table(CONFIRMS):
        _create_confirms()
    _make_sha_unique()
    if sa.inspect(bind).has_table(REPORTS):
        _allow_duplicate_reason(sa.inspect(bind))
    _backfill()


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if inspector.has_table(REPORTS):
        bind.execute(
            sa.text("UPDATE recording_reports SET reason = 'other' WHERE reason = 'duplicate'")
        )
        constraints = {
            c["name"]: (c.get("sqltext") or "") for c in inspector.get_check_constraints(REPORTS)
        }
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
        if "ix_recordings_mantra_group_id" in present:
            op.drop_index("ix_recordings_mantra_group_id", table_name=RECORDINGS)
        have = _columns(sa.inspect(bind), RECORDINGS)
        with op.batch_alter_table(RECORDINGS) as batch:
            for column in ("removed_duplicate_of", "year", "mantra_group_id", "mantra_title"):
                if column in have:
                    batch.drop_column(column)
    if sa.inspect(bind).has_table(GROUPS):
        op.drop_table(GROUPS)
