"""Takedown requests, counter-notices and the blocked file list.

Revision ID: 0057_takedown_requests
Revises: 0056_app_version_policies

takedown_requests
    What a rights holder sent (kind notice) and what the uploader answered (kind counter_notice),
    with the decision, who decided and when. The sender's address is stored (needed to reply);
    the abuse counter stores only a salted hash.
blocked_audio_hashes
    SHA-256 of files that cannot be uploaded again after a take-down. One row per request, so
    lifting one request never lifts another one about the same file.

Two new tables, nothing existing is touched. Safe to run twice. Works on PostgreSQL and SQLite.
Downgrade drops both tables.
"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0057_takedown_requests"
down_revision = "0056_app_version_policies"
branch_labels = None
depends_on = None


def _has_table(name: str) -> bool:
    return name in sa.inspect(op.get_bind()).get_table_names()


def upgrade() -> None:
    if not _has_table("takedown_requests"):
        op.create_table(
            "takedown_requests",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("reference", sa.String(12), nullable=False, unique=True),
            sa.Column("kind", sa.String(16), nullable=False),
            sa.Column("status", sa.String(20), nullable=False),
            sa.Column(
                "related_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("takedown_requests.id", ondelete="SET NULL"),
            ),
            sa.Column("recording_ref", sa.Text(), nullable=False),
            sa.Column(
                "recording_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("recordings.id", ondelete="SET NULL"),
            ),
            sa.Column("recording_title", sa.String(200)),
            sa.Column("audio_sha256", sa.String(64)),
            sa.Column("sender_name", sa.String(200), nullable=False),
            sa.Column("sender_org", sa.String(200)),
            sa.Column("sender_email", sa.String(255), nullable=False),
            sa.Column("sender_phone", sa.String(60)),
            sa.Column("sender_address", sa.String(400)),
            sa.Column(
                "sender_member_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("user_accounts.id", ondelete="SET NULL"),
            ),
            sa.Column("work_description", sa.Text(), nullable=False),
            sa.Column("claim_description", sa.Text()),
            sa.Column("statement_good_faith", sa.Boolean(), nullable=False),
            sa.Column("statement_accuracy", sa.Boolean(), nullable=False),
            sa.Column("signature", sa.String(200), nullable=False),
            sa.Column("source", sa.String(16), nullable=False),
            sa.Column("sender_key", sa.String(40)),
            sa.Column("decision_reason", sa.Text()),
            sa.Column("decided_by", sa.String(255)),
            sa.Column("decided_at", sa.DateTime(timezone=True)),
            sa.Column("author_notified_at", sa.DateTime(timezone=True)),
            sa.Column("forwarded_at", sa.DateTime(timezone=True)),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.CheckConstraint("kind IN ('notice', 'counter_notice')", name="ck_takedown_kind"),
            sa.CheckConstraint(
                "status IN ('new', 'taken_down', 'rejected', 'counter_received', 'forwarded', "
                "'restored', 'closed')",
                name="ck_takedown_status",
            ),
        )
        op.create_index("ix_takedown_requests_status", "takedown_requests", ["status"])
        op.create_index("ix_takedown_requests_related_id", "takedown_requests", ["related_id"])
        op.create_index("ix_takedown_requests_recording_id", "takedown_requests", ["recording_id"])
        op.create_index("ix_takedown_requests_sender_email", "takedown_requests", ["sender_email"])
        op.create_index("ix_takedown_requests_sender_key", "takedown_requests", ["sender_key"])
        op.create_index(
            "ix_takedown_requests_status_created", "takedown_requests", ["status", "created_at"]
        )
    if not _has_table("blocked_audio_hashes"):
        op.create_table(
            "blocked_audio_hashes",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("sha256", sa.String(64), nullable=False),
            sa.Column(
                "takedown_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("takedown_requests.id", ondelete="SET NULL"),
            ),
            sa.Column("reason", sa.Text(), nullable=False),
            sa.Column("blocked_by", sa.String(255)),
            sa.Column("blocked_at", sa.DateTime(timezone=True), nullable=False),
            sa.UniqueConstraint("sha256", "takedown_id", name="uq_blocked_audio_request"),
        )
        op.create_index("ix_blocked_audio_hashes_sha256", "blocked_audio_hashes", ["sha256"])


def downgrade() -> None:
    if _has_table("blocked_audio_hashes"):
        op.drop_table("blocked_audio_hashes")
    if _has_table("takedown_requests"):
        op.drop_table("takedown_requests")
