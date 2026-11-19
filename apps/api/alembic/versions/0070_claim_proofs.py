"""Proof of identity for claiming recordings.

Revision ID: 0070_claim_proofs
Revises: 0069_apple_refresh_tokens

author_claim_proofs
    One row per proof a page's owner gives (a channel link, an e-mail address and a one-time code,
    a voice note, a team member who knows them). It belongs to the page, not to a recording. The
    team looks at it; enough accepted proofs verify the page. Only a hash of a code is kept.
author_claims.person_note
    For a look-alike name: what the person says the other name is. Read only by the team.

One new table and one new nullable column; nothing existing is changed. Safe to run twice, and on
a database where the app already ran `Base.metadata.create_all`. Works on PostgreSQL and SQLite.
Downgrade drops only what this revision added. Never run it against a real database without a
backup.

Note for whoever adds `0070_recording_credits` (docs/co-performers.md): that file must set its
`down_revision` to this one, or the two become separate heads.
"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0070_claim_proofs"
down_revision = "0069_apple_refresh_tokens"
branch_labels = None
depends_on = None

PROOFS = "author_claim_proofs"
CLAIMS = "author_claims"


def _uuid() -> postgresql.UUID:
    return postgresql.UUID(as_uuid=True)


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table(PROOFS):
        op.create_table(
            PROOFS,
            sa.Column("id", _uuid(), primary_key=True),
            sa.Column(
                "profile_id",
                _uuid(),
                sa.ForeignKey("author_profiles.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("kind", sa.String(8), nullable=False),
            sa.Column("value", sa.String(500), nullable=False, server_default=""),
            sa.Column("note", sa.String(500)),
            sa.Column("status", sa.String(12), nullable=False, server_default="waiting"),
            sa.Column("code_hash", sa.String(64)),
            sa.Column("code_expires_at", sa.DateTime(timezone=True)),
            sa.Column("code_tries", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("code_confirmed", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("team_note", sa.Text()),
            sa.Column("decided_by", sa.String(255)),
            sa.Column("decided_at", sa.DateTime(timezone=True)),
            sa.Column("clock_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("reminded_at", sa.DateTime(timezone=True)),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.CheckConstraint(
                "kind IN ('link', 'email', 'voice', 'team', 'request')",
                name="ck_author_proofs_kind",
            ),
            sa.CheckConstraint(
                "status IN ('waiting', 'code_sent', 'ok', 'declined', 'more_needed', 'withdrawn')",
                name="ck_author_proofs_status",
            ),
        )
        op.create_index("ix_author_claim_proofs_profile_id", PROOFS, ["profile_id"])
        op.create_index("ix_author_claim_proofs_status", PROOFS, ["status"])
    columns = {c["name"] for c in sa.inspect(op.get_bind()).get_columns(CLAIMS)}
    if "person_note" not in columns:
        with op.batch_alter_table(CLAIMS) as batch:
            batch.add_column(sa.Column("person_note", sa.String(300)))


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    columns = {c["name"] for c in inspector.get_columns(CLAIMS)}
    if "person_note" in columns:
        with op.batch_alter_table(CLAIMS) as batch:
            batch.drop_column("person_note")
    if inspector.has_table(PROOFS):
        op.drop_table(PROOFS)
