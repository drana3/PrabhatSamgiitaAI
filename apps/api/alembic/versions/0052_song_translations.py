"""Translations of a song (official, poetic, literal): their source and who checked them.

Revision ID: 0052_song_translations
Revises: 0051_push_replies

One new table, `song_translations` (design: docs/ps-translations.md, model:
apps/api/app/models/song_translations.py). Nothing in `songs` changes: the official texts are read
from `songs.english_meaning` by the import (`POST /admin/song-translations/import`), which is a
separate, deliberate step and is NOT run by this migration.

The table refuses what must never exist:
- a machine literal translation (`ck_song_translations_no_machine_literal`);
- a machine text that is not poetic, so a machine text can never be the official one or be called
  checked (`ck_song_translations_machine_poetic`);
- a "checked" (`verified`) text without the name of the checker and the time
  (`ck_song_translations_checked_has_checker`);
- the "official" label on anything but the official import (`ck_song_translations_official_author`).

Written out by hand and safe to run twice (the table is looked for first). Works on PostgreSQL and
SQLite. Downgrade drops the table (and with it every translation: take a backup first).

Never run it against a real database without a backup.
"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0052_song_translations"
down_revision = "0051_push_replies"
branch_labels = None
depends_on = None

TABLE = "song_translations"
SONG_COUNT = 5018


def _json() -> sa.types.TypeEngine:
    return sa.JSON().with_variant(postgresql.JSONB(), "postgresql")


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if inspector.has_table(TABLE):
        return
    uuid = sa.Uuid(as_uuid=True)
    op.create_table(
        TABLE,
        sa.Column("id", uuid, primary_key=True),
        sa.Column("song_id", sa.Integer(), nullable=False),
        sa.Column("language", sa.String(12), nullable=False, server_default="en"),
        sa.Column("kind", sa.String(10), nullable=False),
        sa.Column("position", sa.SmallInteger(), nullable=False, server_default="0"),
        sa.Column("segments", _json(), nullable=False),
        sa.Column("alignment", sa.String(8), nullable=False, server_default="whole"),
        sa.Column("plain_text", sa.Text(), nullable=False),
        sa.Column("text_hash", sa.String(64), nullable=False),
        sa.Column("author_kind", sa.String(10), nullable=False),
        sa.Column("author_label", sa.String(120)),
        sa.Column("source_key", sa.String(40), nullable=False),
        sa.Column("source_ref", sa.String(512), nullable=False, server_default=""),
        sa.Column("credit_line", sa.String(200)),
        sa.Column("license_note", sa.Text()),
        sa.Column("trust", sa.String(10), nullable=False, server_default="unchecked"),
        sa.Column("status", sa.String(10), nullable=False, server_default="draft"),
        sa.Column("commentary", sa.Text()),
        sa.Column("doubts", _json()),
        sa.Column("reviewed_by", sa.String(255)),
        sa.Column("reviewed_at", sa.DateTime(timezone=True)),
        sa.Column("verified_by", sa.String(255)),
        sa.Column("verified_at", sa.DateTime(timezone=True)),
        sa.Column("verified_note", sa.Text()),
        sa.Column("rejected_reason", sa.Text()),
        sa.Column("replaces_id", uuid, sa.ForeignKey(f"{TABLE}.id", ondelete="SET NULL")),
        sa.Column("based_on_id", uuid, sa.ForeignKey(f"{TABLE}.id", ondelete="SET NULL")),
        sa.Column("published_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint(
            f"song_id >= 1 AND song_id <= {SONG_COUNT}", name="ck_song_translations_song"
        ),
        sa.CheckConstraint(
            "kind IN ('official', 'poetic', 'literal')", name="ck_song_translations_kind"
        ),
        sa.CheckConstraint(
            "alignment IN ('whole', 'stanza', 'line')", name="ck_song_translations_alignment"
        ),
        sa.CheckConstraint(
            "trust IN ('unchecked', 'reviewed', 'verified', 'official', 'machine')",
            name="ck_song_translations_trust",
        ),
        sa.CheckConstraint(
            "status IN ('draft', 'pending', 'published', 'rejected', 'archived')",
            name="ck_song_translations_status",
        ),
        sa.CheckConstraint(
            "author_kind IN ('official', 'team', 'member', 'import')",
            name="ck_song_translations_author_kind",
        ),
        sa.CheckConstraint(
            "NOT (kind = 'literal' AND trust = 'machine')",
            name="ck_song_translations_no_machine_literal",
        ),
        sa.CheckConstraint(
            "trust <> 'machine' OR kind = 'poetic'", name="ck_song_translations_machine_poetic"
        ),
        sa.CheckConstraint(
            "trust <> 'verified' OR (verified_by IS NOT NULL AND verified_at IS NOT NULL)",
            name="ck_song_translations_checked_has_checker",
        ),
        sa.CheckConstraint(
            "trust <> 'official' OR author_kind = 'official'",
            name="ck_song_translations_official_author",
        ),
        sa.UniqueConstraint(
            "song_id",
            "language",
            "kind",
            "source_key",
            "source_ref",
            "position",
            name="uq_song_translations_import_key",
        ),
    )
    op.create_index(
        "ix_song_translations_song",
        TABLE,
        ["song_id", "language", "kind", "status", "position"],
    )


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table(TABLE):
        return
    op.drop_index("ix_song_translations_song", table_name=TABLE)
    op.drop_table(TABLE)
