"""Several performers on one recording (docs/co-performers.md).

Revision ID: 0071_recording_credits
Revises: 0070_claim_proofs

recording_credits
    One row per person on a recording: a plain name, or an author page that was asked and said yes.
recording_credit_events
    The log of those rows.
author_credit_blocks
    A page refusing credits from one member.
author_profiles.credit_invites
    "everyone" (default) or "nobody": who may add the page to a recording.

Three new tables and one new column with a default; nothing existing is changed. Safe to run twice,
and on a database where the app already ran `Base.metadata.create_all`. Works on PostgreSQL and
SQLite. Downgrade drops only what this revision added. Never run it against a real database
without a backup.
"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0071_recording_credits"
down_revision = "0070_claim_proofs"
branch_labels = None
depends_on = None

CREDITS = "recording_credits"
EVENTS = "recording_credit_events"
BLOCKS = "author_credit_blocks"
PROFILES = "author_profiles"


def _uuid() -> postgresql.UUID:
    return postgresql.UUID(as_uuid=True)


def _stamps() -> list[sa.Column]:
    return [
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    ]


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table(CREDITS):
        op.create_table(
            CREDITS,
            sa.Column("id", _uuid(), primary_key=True),
            sa.Column(
                "recording_id",
                _uuid(),
                sa.ForeignKey("recordings.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("name", sa.String(120), nullable=False),
            sa.Column(
                "profile_id",
                _uuid(),
                sa.ForeignKey("author_profiles.id", ondelete="SET NULL"),
                nullable=True,
            ),
            sa.Column("role", sa.String(10), nullable=False, server_default="performer"),
            sa.Column("status", sa.String(10), nullable=False, server_default="text"),
            sa.Column("source", sa.String(10), nullable=False, server_default="uploader"),
            sa.Column(
                "invited_by",
                _uuid(),
                sa.ForeignKey("user_accounts.id", ondelete="SET NULL"),
                nullable=True,
            ),
            sa.Column("invite_token_hash", sa.String(64)),
            sa.Column("decided_at", sa.DateTime(timezone=True)),
            sa.Column("expires_at", sa.DateTime(timezone=True)),
            *_stamps(),
            sa.UniqueConstraint("recording_id", "profile_id", name="uq_recording_credits_pair"),
            sa.CheckConstraint("role IN ('performer', 'author')", name="ck_recording_credits_role"),
            sa.CheckConstraint(
                "status IN ('text', 'invited', 'accepted', 'declined', 'removed', 'expired')",
                name="ck_recording_credits_status",
            ),
            sa.CheckConstraint(
                "source IN ('uploader', 'self', 'team')", name="ck_recording_credits_source"
            ),
        )
        op.create_index("ix_recording_credits_recording_id", CREDITS, ["recording_id"])
        op.create_index("ix_recording_credits_status", CREDITS, ["status"])
        op.create_index("ix_recording_credits_profile_status", CREDITS, ["profile_id", "status"])
        op.create_index(
            "ix_recording_credits_invite_token_hash", CREDITS, ["invite_token_hash"], unique=True
        )
        op.create_index("ix_recording_credits_expires_at", CREDITS, ["expires_at"])
    if not inspector.has_table(EVENTS):
        op.create_table(
            EVENTS,
            sa.Column("id", sa.BigInteger().with_variant(sa.Integer(), "sqlite"), primary_key=True),
            sa.Column(
                "credit_id",
                _uuid(),
                sa.ForeignKey(f"{CREDITS}.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("actor", sa.String(255), nullable=False),
            sa.Column("action", sa.String(16), nullable=False),
            sa.Column("note", sa.Text()),
        )
        op.create_index("ix_recording_credit_events_credit_id", EVENTS, ["credit_id"])
    if not inspector.has_table(BLOCKS):
        op.create_table(
            BLOCKS,
            sa.Column("id", _uuid(), primary_key=True),
            sa.Column(
                "profile_id",
                _uuid(),
                sa.ForeignKey(f"{PROFILES}.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "blocked_member_id",
                _uuid(),
                sa.ForeignKey("user_accounts.id", ondelete="CASCADE"),
                nullable=False,
            ),
            *_stamps(),
            sa.UniqueConstraint(
                "profile_id", "blocked_member_id", name="uq_author_credit_blocks_pair"
            ),
        )
        op.create_index("ix_author_credit_blocks_profile_id", BLOCKS, ["profile_id"])
    columns = {c["name"] for c in sa.inspect(op.get_bind()).get_columns(PROFILES)}
    if "credit_invites" not in columns:
        op.add_column(
            PROFILES,
            sa.Column("credit_invites", sa.String(8), nullable=False, server_default="everyone"),
        )


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    columns = {c["name"] for c in inspector.get_columns(PROFILES)}
    if "credit_invites" in columns:
        with op.batch_alter_table(PROFILES) as batch:
            batch.drop_column("credit_invites")
    for table in (BLOCKS, EVENTS, CREDITS):
        if sa.inspect(op.get_bind()).has_table(table):
            op.drop_table(table)
