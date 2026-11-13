"""A comment stays when its author deletes the account (shown under the name it had).

Revision ID: 0065_comments_survive_account_deletion
Revises: 0064_mantras_styles_moods

song_comments and recording_comments

  member_id    was NOT NULL with ON DELETE CASCADE: deleting an account deleted every comment it
               wrote (and the replies hanging under them). It becomes nullable with ON DELETE
               SET NULL: the comment stays, the link to the account goes.
  author_name  new, nullable, up to 80 characters. When an account is deleted the API copies the
               display name into it for every NAMED comment (an anonymous comment stays anonymous
               and gets no name). Recordings do the same with `recordings.author`.

Decision of Dada, 9 November 2026 (docs/account-deletion.md). Rows that exist now are not touched.

Safe to run twice (the column and the key are looked for first). Works on PostgreSQL and SQLite.
`downgrade` removes the comments that lost their account first (the old schema cannot hold them),
so run it only knowing that.

Never run it against a real database without a backup.
"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0065_comments_survive_account_deletion"
down_revision = "0064_mantras_styles_moods"
branch_labels = None
depends_on = None

TABLES = ("song_comments", "recording_comments")
AUTHOR_NAME_LENGTH = 80


def _member_fk(inspector: sa.Inspector, table: str) -> dict | None:
    for fk in inspector.get_foreign_keys(table):
        if fk.get("constrained_columns") == ["member_id"] and fk.get("referred_table") == (
            "user_accounts"
        ):
            return fk
    return None


def _on_delete(fk: dict | None) -> str | None:
    value = ((fk or {}).get("options") or {}).get("ondelete")
    return str(value).upper() if value else None


def _set_key(table: str, *, ondelete: str, nullable: bool) -> None:
    """Replace the member_id key (and its NOT NULL) in one table, on either database."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    uuid_type = postgresql.UUID(as_uuid=True)
    name = f"fk_{table}_member_id"
    if bind.dialect.name == "sqlite":
        # SQLite copies the table; its keys have no name, so give the reflected ones one
        # (naming convention) and replace it.
        # The copy forgets the ON DELETE rule of the reply keys, so they are written out again:
        # a reply goes with its parent, a reply that answered a reply only loses the pointer.
        own = {c["name"] for c in inspector.get_columns(table)}
        keyed = {
            fk["constrained_columns"][0]: fk.get("name")
            for fk in inspector.get_foreign_keys(table)
            if len(fk.get("constrained_columns", [])) == 1
        }
        replies = {"parent_id": "CASCADE", "reply_to_id": "SET NULL"}
        with op.batch_alter_table(
            table, naming_convention={"fk": "fk_%(table_name)s_%(column_0_name)s"}
        ) as batch:
            batch.drop_constraint(keyed.get("member_id") or name, type_="foreignkey")
            batch.alter_column("member_id", existing_type=uuid_type, nullable=nullable)
            batch.create_foreign_key(
                name, "user_accounts", ["member_id"], ["id"], ondelete=ondelete
            )
            for column, rule in replies.items():
                if column not in own:
                    continue
                key = f"fk_{table}_{column}"
                if column in keyed:
                    batch.drop_constraint(keyed[column] or key, type_="foreignkey")
                batch.create_foreign_key(key, table, [column], ["id"], ondelete=rule)
        return
    current = _member_fk(inspector, table)
    if current and current.get("name"):
        op.drop_constraint(str(current["name"]), table, type_="foreignkey")
    op.alter_column(table, "member_id", existing_type=uuid_type, nullable=nullable)
    op.create_foreign_key(name, table, "user_accounts", ["member_id"], ["id"], ondelete=ondelete)


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    for table in TABLES:
        if not inspector.has_table(table):
            continue
        columns = {c["name"] for c in inspector.get_columns(table)}
        if "author_name" not in columns:
            op.add_column(table, sa.Column("author_name", sa.String(AUTHOR_NAME_LENGTH)))
        if _on_delete(_member_fk(inspector, table)) != "SET NULL":
            _set_key(table, ondelete="SET NULL", nullable=True)


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    for table in TABLES:
        if not inspector.has_table(table):
            continue
        # a comment without an account cannot exist in the old schema
        op.execute(sa.text(f"DELETE FROM {table} WHERE member_id IS NULL"))
        if _on_delete(_member_fk(inspector, table)) != "CASCADE":
            _set_key(table, ondelete="CASCADE", nullable=False)
        columns = {c["name"] for c in sa.inspect(op.get_bind()).get_columns(table)}
        if "author_name" in columns:
            with op.batch_alter_table(table) as batch:
                batch.drop_column("author_name")
