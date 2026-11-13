"""Author claims: a performer asks to have recordings that somebody else added shown on their page.

Revision ID: 0045_author_claims
Revises: 0044_practice_and_optional_set_date

author_claims
    One row per (page, recording): who decides (`route`), the state, why it went to the team, the
    decision. Only an APPROVED row puts a recording on a page. The recording is not changed.
author_claim_events
    The log of each claim; nothing is erased.
author_aliases
    "Also known as" names of a page, used to find recordings (never to approve them).

Only NEW tables. Pages the team verified keep showing library recordings credited to their claimed
name exactly as before (that rule is in code, not in these tables), so no data is backfilled.
Safe to run twice, and on a database where the app already ran `Base.metadata.create_all`. Works on
PostgreSQL and SQLite. Downgrade drops only what this revision added.
"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0045_author_claims"
down_revision = "0044_practice_and_optional_set_date"
branch_labels = None
depends_on = None

CLAIMS = "author_claims"
EVENTS = "author_claim_events"
ALIASES = "author_aliases"


def _uuid() -> postgresql.UUID:
    return postgresql.UUID(as_uuid=True)


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table(CLAIMS):
        op.create_table(
            CLAIMS,
            sa.Column("id", _uuid(), primary_key=True),
            sa.Column(
                "profile_id",
                _uuid(),
                sa.ForeignKey("author_profiles.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "recording_id",
                _uuid(),
                sa.ForeignKey("recordings.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("matched_text", sa.String(255), nullable=False, server_default=""),
            sa.Column("match_level", sa.String(8), nullable=False),
            sa.Column("route", sa.String(8), nullable=False),
            sa.Column("status", sa.String(10), nullable=False, server_default="pending"),
            sa.Column("team_reason", sa.String(24), nullable=True),
            sa.Column("decided_by", sa.String(255), nullable=True),
            sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("decision_note", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.UniqueConstraint("profile_id", "recording_id", name="uq_author_claims_pair"),
            sa.CheckConstraint(
                "status IN ('pending', 'approved', 'rejected', 'withdrawn', 'revoked')",
                name="ck_author_claims_status",
            ),
            sa.CheckConstraint("route IN ('self', 'team')", name="ck_author_claims_route"),
            sa.CheckConstraint(
                "match_level IN ('same', 'alike', 'title', 'manual')",
                name="ck_author_claims_level",
            ),
        )
        op.create_index("ix_author_claims_profile_id", CLAIMS, ["profile_id"])
        op.create_index("ix_author_claims_recording_id", CLAIMS, ["recording_id"])
        op.create_index("ix_author_claims_status_route", CLAIMS, ["status", "route"])
    if not inspector.has_table(EVENTS):
        op.create_table(
            EVENTS,
            sa.Column(
                "id",
                sa.BigInteger().with_variant(sa.Integer(), "sqlite"),
                primary_key=True,
                autoincrement=True,
            ),
            sa.Column(
                "claim_id",
                _uuid(),
                sa.ForeignKey("author_claims.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("actor", sa.String(255), nullable=False),
            sa.Column("action", sa.String(16), nullable=False),
            sa.Column("note", sa.Text(), nullable=True),
        )
        op.create_index("ix_author_claim_events_claim_id", EVENTS, ["claim_id"])
    if not inspector.has_table(ALIASES):
        op.create_table(
            ALIASES,
            sa.Column("id", _uuid(), primary_key=True),
            sa.Column(
                "profile_id",
                _uuid(),
                sa.ForeignKey("author_profiles.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("alias", sa.String(120), nullable=False),
            sa.Column("alias_key", sa.String(120), nullable=False),
            sa.Column("added_at", sa.DateTime(timezone=True), nullable=False),
            sa.UniqueConstraint("profile_id", "alias_key", name="uq_author_aliases_key"),
        )
        op.create_index("ix_author_aliases_profile_id", ALIASES, ["profile_id"])


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    for table in (ALIASES, EVENTS, CLAIMS):
        if inspector.has_table(table):
            op.drop_table(table)
