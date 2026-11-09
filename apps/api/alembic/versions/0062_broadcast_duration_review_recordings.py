"""Broadcasts: several days, the YouTube Data API look, "Keep" that is remembered, the team's
history and the recording of a broadcast.

Revision ID: 0062_broadcast_duration_review_recordings
Revises: 0061_broadcasts

broadcasts (new columns, all empty for old rows)
    declared_ends_at                         the end the organizer announced
    yt_state, yt_started_at, yt_ended_at,
    yt_checked_at                            what the last look of the YouTube Data API said
    reviewed_at, reviewed_by,
    reviewed_reports                         "Keep": the team looked at the reports that were there
    hidden_at, hidden_by, hidden_reason      "Hide": off the public lists, still read by the author
broadcast_reports (new columns)
    weight, cleared_at, cleared_by           what a report added, and the team's verdict on it
    The unique key (broadcast, reporter) becomes (broadcast, reporter, reason): a person may send
    a second report with ANOTHER reason (it still counts once); the same reason never twice, also
    after the team kept the broadcast. Old rows keep weight 0 (they were never hidden by weight
    before 0061's fix) and are not cleared.
broadcast_decisions (new)    the team's verdicts, one row each
broadcast_recordings (new)   a link to the recording, or a library recording, of an ended broadcast

Nothing is guessed for old data: a broadcast that was live under the old six-hour guess is simply
read by the new rule (it lasts up to 14 days unless it was ended or has an announced end). That is
the intended change, no data is rewritten.

Safe to run twice, and on a database where the app already ran `Base.metadata.create_all`.
Works on PostgreSQL and SQLite. Downgrade drops what this revision added; the old one-report-per-
person key is restored only when no person has two reports on one broadcast.

Never run it against a real database without a backup.
"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0062_broadcast_duration_review_recordings"
down_revision = "0061_broadcasts"
branch_labels = None
depends_on = None

OLD_KEY = "uq_broadcast_reports_reporter"
NEW_KEY = "uq_broadcast_reports_reporter_reason"

BROADCAST_COLUMNS = (
    ("declared_ends_at", sa.DateTime(timezone=True)),
    ("yt_state", sa.String(10)),
    ("yt_started_at", sa.DateTime(timezone=True)),
    ("yt_ended_at", sa.DateTime(timezone=True)),
    ("yt_checked_at", sa.DateTime(timezone=True)),
    ("reviewed_at", sa.DateTime(timezone=True)),
    ("reviewed_by", sa.String(255)),
    ("hidden_at", sa.DateTime(timezone=True)),
    ("hidden_by", sa.String(255)),
    ("hidden_reason", sa.Text()),
)
REPORT_COLUMNS = (
    ("cleared_at", sa.DateTime(timezone=True)),
    ("cleared_by", sa.String(255)),
)


def _uuid() -> postgresql.UUID:
    return postgresql.UUID(as_uuid=True)


def _have(table: str) -> set[str]:
    return {c["name"] for c in sa.inspect(op.get_bind()).get_columns(table)}


def _unique_names(table: str) -> set[str]:
    inspector = sa.inspect(op.get_bind())
    return {u["name"] for u in inspector.get_unique_constraints(table) if u.get("name")}


def upgrade() -> None:
    tables = set(sa.inspect(op.get_bind()).get_table_names())
    if "broadcasts" in tables:
        have = _have("broadcasts")
        for name, kind in BROADCAST_COLUMNS:
            if name not in have:
                op.add_column("broadcasts", sa.Column(name, kind, nullable=True))
        if "reviewed_reports" not in have:
            op.add_column(
                "broadcasts",
                sa.Column("reviewed_reports", sa.Integer(), nullable=False, server_default="0"),
            )
    if "broadcast_reports" in tables:
        have = _have("broadcast_reports")
        for name, kind in REPORT_COLUMNS:
            if name not in have:
                op.add_column("broadcast_reports", sa.Column(name, kind, nullable=True))
        if "weight" not in have:
            op.add_column(
                "broadcast_reports",
                sa.Column("weight", sa.Integer(), nullable=False, server_default="0"),
            )
        names = _unique_names("broadcast_reports")
        if OLD_KEY in names or NEW_KEY not in names:
            with op.batch_alter_table("broadcast_reports") as batch:
                if OLD_KEY in names:
                    batch.drop_constraint(OLD_KEY, type_="unique")
                if NEW_KEY not in names:
                    batch.create_unique_constraint(
                        NEW_KEY, ["broadcast_id", "reporter_key", "reason"]
                    )
    tables = set(sa.inspect(op.get_bind()).get_table_names())
    if "broadcast_decisions" not in tables:
        op.create_table(
            "broadcast_decisions",
            sa.Column("id", _uuid(), primary_key=True),
            sa.Column(
                "broadcast_id",
                _uuid(),
                sa.ForeignKey("broadcasts.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("action", sa.String(8), nullable=False),
            sa.Column("reason", sa.Text()),
            sa.Column("decided_by", sa.String(255), nullable=False),
            sa.Column("reports_total", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("reports_counted", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.CheckConstraint(
                "action IN ('keep', 'hide', 'remove')", name="ck_broadcast_decisions_action"
            ),
        )
        op.create_index(
            "ix_broadcast_decisions_broadcast_id", "broadcast_decisions", ["broadcast_id"]
        )
        op.create_index("ix_broadcast_decisions_created", "broadcast_decisions", ["created_at"])
    if "broadcast_recordings" not in tables:
        op.create_table(
            "broadcast_recordings",
            sa.Column("id", _uuid(), primary_key=True),
            sa.Column(
                "broadcast_id",
                _uuid(),
                sa.ForeignKey("broadcasts.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("member_id", _uuid(), sa.ForeignKey("user_accounts.id", ondelete="SET NULL")),
            sa.Column("kind", sa.String(8), nullable=False),
            sa.Column("provider", sa.String(12)),
            sa.Column("url", sa.String(500)),
            sa.Column("host", sa.String(100)),
            sa.Column("recording_id", _uuid(), sa.ForeignKey("recordings.id", ondelete="CASCADE")),
            sa.Column("status", sa.String(10), nullable=False, server_default="accepted"),
            sa.Column("source", sa.String(8), nullable=False),
            sa.Column("decided_by", sa.String(255)),
            sa.Column("decided_at", sa.DateTime(timezone=True)),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.CheckConstraint("kind IN ('link', 'file')", name="ck_broadcast_recordings_kind"),
            sa.CheckConstraint(
                "status IN ('accepted', 'pending', 'rejected')",
                name="ck_broadcast_recordings_status",
            ),
            sa.CheckConstraint(
                "source IN ('author', 'team', 'member', 'youtube')",
                name="ck_broadcast_recordings_source",
            ),
        )
        op.create_index(
            "ix_broadcast_recordings_broadcast_id", "broadcast_recordings", ["broadcast_id"]
        )
        op.create_index(
            "ix_broadcast_recordings_recording_id", "broadcast_recordings", ["recording_id"]
        )
        op.create_index(
            "ix_broadcast_recordings_status", "broadcast_recordings", ["status", "created_at"]
        )


def downgrade() -> None:
    tables = set(sa.inspect(op.get_bind()).get_table_names())
    for name in ("broadcast_recordings", "broadcast_decisions"):
        if name in tables:
            op.drop_table(name)
    if "broadcast_reports" in tables:
        have = _have("broadcast_reports")
        names = _unique_names("broadcast_reports")
        with op.batch_alter_table("broadcast_reports") as batch:
            if NEW_KEY in names:
                batch.drop_constraint(NEW_KEY, type_="unique")
            if OLD_KEY not in names:
                # a person with two reports on one broadcast cannot go back to one: keep the oldest
                op.get_bind().execute(
                    sa.text(
                        "DELETE FROM broadcast_reports WHERE id IN (SELECT r.id FROM "
                        "broadcast_reports r WHERE EXISTS (SELECT 1 FROM broadcast_reports o "
                        "WHERE o.broadcast_id = r.broadcast_id AND o.reporter_key = r.reporter_key "
                        "AND (o.created_at < r.created_at OR "
                        "(o.created_at = r.created_at AND o.id < r.id))))"
                    )
                )
                batch.create_unique_constraint(OLD_KEY, ["broadcast_id", "reporter_key"])
            for name in ("weight", "cleared_at", "cleared_by"):
                if name in have:
                    batch.drop_column(name)
    if "broadcasts" in tables:
        have = _have("broadcasts")
        with op.batch_alter_table("broadcasts") as batch:
            for name in [n for n, _ in BROADCAST_COLUMNS] + ["reviewed_reports"]:
                if name in have:
                    batch.drop_column(name)
