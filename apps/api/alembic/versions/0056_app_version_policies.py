"""The oldest app version still allowed, per platform (forced update).

Revision ID: 0056_app_version_policies
Revises: 0055_member_sessions_rate_limits

app_version_policies
    One row per platform: minimum version (below it the app asks to update and stops),
    recommended version (below it a dismissible banner), the store link. No row means every
    version is allowed.

One new table, nothing existing is touched. Safe to run twice. Works on PostgreSQL and SQLite.
Downgrade drops the table.
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "0056_app_version_policies"
down_revision = "0055_member_sessions_rate_limits"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if "app_version_policies" in sa.inspect(op.get_bind()).get_table_names():
        return
    op.create_table(
        "app_version_policies",
        sa.Column("platform", sa.String(10), primary_key=True),
        sa.Column("minimum_version", sa.String(20)),
        sa.Column("recommended_version", sa.String(20)),
        sa.Column("store_url", sa.String(300)),
        sa.Column("note", sa.String(300)),
        sa.Column("updated_by", sa.String(255)),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    if "app_version_policies" in sa.inspect(op.get_bind()).get_table_names():
        op.drop_table("app_version_policies")
