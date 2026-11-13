"""Push notifications for replies to comments: devices, the member's choice, and what was sent.

Revision ID: 0051_push_replies
Revises: 0050_piano_sheets

push_devices
    One row per phone that may be woken: the Expo push token, the platform, the language of the
    app (the words of the push), the member it belongs to. A token that Expo says is dead is
    deleted. One token belongs to one member at a time (a phone handed over moves with its token).
push_preferences
    The member's switch for "replies". No row means on.
push_deliveries
    What was sent to which token for which notice: the throttle reads it (one push per discussion
    in ten minutes, a few per hour), and the receipt check reads the ticket ids. Old rows go.

Only NEW tables, no data moved. Safe to run twice, and on a database where the app already ran
`Base.metadata.create_all`. Works on PostgreSQL and SQLite. Downgrade drops only what this revision
added. See docs/comment-replies.md ("Push").
"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0051_push_replies"
down_revision = "0050_piano_sheets"
branch_labels = None
depends_on = None

DEVICES = "push_devices"
PREFERENCES = "push_preferences"
DELIVERIES = "push_deliveries"


def _uuid() -> postgresql.UUID:
    return postgresql.UUID(as_uuid=True)


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table(DEVICES):
        op.create_table(
            DEVICES,
            sa.Column("id", _uuid(), primary_key=True),
            sa.Column(
                "member_id",
                _uuid(),
                sa.ForeignKey("user_accounts.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("token", sa.String(255), nullable=False),
            sa.Column("platform", sa.String(8), nullable=False),
            sa.Column("language", sa.String(5), nullable=False, server_default="en"),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.UniqueConstraint("token", name="uq_push_devices_token"),
            sa.CheckConstraint("platform IN ('ios', 'android')", name="ck_push_devices_platform"),
        )
        op.create_index("ix_push_devices_member_id", DEVICES, ["member_id"])
    if not inspector.has_table(PREFERENCES):
        op.create_table(
            PREFERENCES,
            sa.Column(
                "member_id",
                _uuid(),
                sa.ForeignKey("user_accounts.id", ondelete="CASCADE"),
                primary_key=True,
            ),
            sa.Column("replies", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        )
    if not inspector.has_table(DELIVERIES):
        op.create_table(
            DELIVERIES,
            sa.Column("id", _uuid(), primary_key=True),
            sa.Column(
                "member_id",
                _uuid(),
                sa.ForeignKey("user_accounts.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("notice_id", _uuid(), nullable=True),
            sa.Column("group_key", sa.String(64), nullable=False),
            sa.Column("token", sa.String(255), nullable=False),
            sa.Column("ticket_id", sa.String(80), nullable=True),
            sa.Column("status", sa.String(12), nullable=False, server_default="sent"),
            sa.Column("sent_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("checked_at", sa.DateTime(timezone=True), nullable=True),
        )
        op.create_index("ix_push_deliveries_member_sent", DELIVERIES, ["member_id", "sent_at"])
        op.create_index("ix_push_deliveries_status_sent", DELIVERIES, ["status", "sent_at"])


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    for table in (DELIVERIES, PREFERENCES, DEVICES):
        if inspector.has_table(table):
            op.drop_table(table)
