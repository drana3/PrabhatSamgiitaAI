"""Product events (no person in them) and feature flags.

Revision ID: 0053_app_events_and_flags
Revises: 0052_song_translations

app_events
    One row per thing the app did: a name from a fixed list, a few small allow-listed properties,
    app version, platform, language, a random per-launch session id and, only when the person chose
    "Share usage", a short keyed hash of the install id. No account id, no free text, no address.
feature_flags
    The team's switches: kill switch, rollout percent, version window, platforms, A/B variants,
    per-install overrides (docs/analytics-flags.md).

Safe to run twice and on a database where the app already ran `Base.metadata.create_all`.
Works on PostgreSQL and SQLite. Downgrade drops only the two tables this revision added.
Never run it against a real database without a backup.
"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

from alembic import op

revision = "0053_app_events_and_flags"
down_revision = "0052_song_translations"
branch_labels = None
depends_on = None

EVENTS = "app_events"
FLAGS = "feature_flags"
JSON_TYPE = sa.JSON().with_variant(JSONB(), "postgresql")


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table(EVENTS):
        op.create_table(
            EVENTS,
            sa.Column(
                "id",
                sa.BigInteger().with_variant(sa.Integer(), "sqlite"),
                primary_key=True,
                autoincrement=True,
            ),
            sa.Column("day", sa.Date(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("name", sa.String(48), nullable=False),
            sa.Column("props", JSON_TYPE, nullable=False),
            sa.Column("app_version", sa.String(20), nullable=True),
            sa.Column("platform", sa.String(10), nullable=True),
            sa.Column("language", sa.String(8), nullable=True),
            sa.Column("session_id", sa.String(36), nullable=True),
            sa.Column("install_key", sa.String(16), nullable=True),
        )
        op.create_index("ix_app_events_day", EVENTS, ["day"])
        op.create_index("ix_app_events_name_day", EVENTS, ["name", "day"])
        op.create_index("ix_app_events_session", EVENTS, ["session_id"])
        op.create_index("ix_app_events_install_key", EVENTS, ["install_key"])
    if not inspector.has_table(FLAGS):
        op.create_table(
            FLAGS,
            sa.Column("key", sa.String(64), primary_key=True),
            sa.Column("description", sa.Text(), nullable=False, server_default=""),
            sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("rollout_percent", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("min_app_version", sa.String(20), nullable=True),
            sa.Column("max_app_version", sa.String(20), nullable=True),
            sa.Column("platforms", JSON_TYPE, nullable=True),
            sa.Column("variants", JSON_TYPE, nullable=True),
            sa.Column("include_ids", JSON_TYPE, nullable=False),
            sa.Column("exclude_ids", JSON_TYPE, nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_by", sa.String(80), nullable=True),
        )


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if inspector.has_table(FLAGS):
        op.drop_table(FLAGS)
    if inspector.has_table(EVENTS):
        op.drop_table(EVENTS)
