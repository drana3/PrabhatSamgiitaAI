"""add quiz attempts and certifications

Revision ID: 0008_quiz
Revises: 0007_inspiration_stories
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0008_quiz"
down_revision: str | None = "0007_inspiration_stories"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "quiz_attempts" not in tables:
        op.create_table(
            "quiz_attempts",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column(
                "user_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("user_accounts.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("level", sa.String(32), nullable=False),
            sa.Column("question_ids", postgresql.JSONB(), nullable=False, server_default="[]"),
            sa.Column("answers", postgresql.JSONB(), nullable=False, server_default="[]"),
            sa.Column("score", sa.Integer()),
            sa.Column("passed", sa.Boolean()),
            sa.Column("status", sa.String(32), nullable=False, server_default="in_progress"),
            sa.Column("completed_at", sa.DateTime(timezone=True)),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )
    inspector = sa.inspect(bind)
    existing_indexes = {idx["name"] for idx in inspector.get_indexes("quiz_attempts")}
    if "ix_quiz_attempts_user_id" not in existing_indexes:
        op.create_index("ix_quiz_attempts_user_id", "quiz_attempts", ["user_id"])
    if "ix_quiz_attempts_level" not in existing_indexes:
        op.create_index("ix_quiz_attempts_level", "quiz_attempts", ["level"])

    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())
    if "quiz_certifications" not in tables:
        op.create_table(
            "quiz_certifications",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column(
                "user_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("user_accounts.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("level", sa.String(32), nullable=False),
            sa.Column(
                "attempt_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("quiz_attempts.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("certificate_code", sa.String(32), nullable=False, unique=True),
            sa.Column("earned_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.UniqueConstraint("user_id", "level", name="uq_quiz_certification_user_level"),
        )
    inspector = sa.inspect(bind)
    cert_indexes = {idx["name"] for idx in inspector.get_indexes("quiz_certifications")}
    if "ix_quiz_certifications_user_id" not in cert_indexes:
        op.create_index("ix_quiz_certifications_user_id", "quiz_certifications", ["user_id"])


def downgrade() -> None:
    op.drop_table("quiz_certifications")
    op.drop_table("quiz_attempts")
