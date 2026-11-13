"""The Apple refresh token of a member, kept only to revoke it when the account is deleted.

Revision ID: 0069_apple_refresh_tokens
Revises: 0068_video_thumbnail

apple_refresh_tokens
    One row per member who signed in with Apple and whose phone sent the one-time authorization
    code (user_id is the key; refresh_token is Apple's). Used once, by account deletion, for
    Apple's revoke call (App Store rule 5.1.1(v), docs/apple-token-revocation.md). The row is
    deleted with the account (ON DELETE CASCADE).

One new table, nothing existing is touched. Safe to run twice, and on a database where the app
already ran `Base.metadata.create_all`. Works on PostgreSQL and SQLite. Downgrade drops the table.
Never run it against a real database without a backup.
"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0069_apple_refresh_tokens"
down_revision = "0068_video_thumbnail"
branch_labels = None
depends_on = None

TABLE = "apple_refresh_tokens"


def _has_table(name: str) -> bool:
    return name in sa.inspect(op.get_bind()).get_table_names()


def upgrade() -> None:
    if _has_table(TABLE):
        return
    op.create_table(
        TABLE,
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("user_accounts.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("refresh_token", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    if _has_table(TABLE):
        op.drop_table(TABLE)
