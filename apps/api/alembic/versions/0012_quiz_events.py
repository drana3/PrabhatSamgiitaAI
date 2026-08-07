"""add quiz events for live admin-hosted quizzes

Revision ID: 0012_quiz_events
Revises: 0011_chat_archives
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0012_quiz_events"
down_revision: str | None = "0011_chat_archives"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "quiz_events" not in tables:
        op.create_table(
            "quiz_events",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("slug", sa.String(32), nullable=False, unique=True),
            sa.Column("title", sa.String(200), nullable=False),
            sa.Column("description", sa.Text()),
            sa.Column("deadline", sa.DateTime(timezone=True), nullable=False),
            sa.Column("tags", postgresql.JSONB(), nullable=False, server_default="[]"),
            sa.Column("status", sa.String(32), nullable=False, server_default="draft"),
            sa.Column(
                "created_by",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("user_accounts.id", ondelete="SET NULL"),
            ),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )
    inspector = sa.inspect(bind)
    if "quiz_events" in set(inspector.get_table_names()):
        event_indexes = {idx["name"] for idx in inspector.get_indexes("quiz_events")}
        for name, cols in (
            ("ix_quiz_events_slug", ["slug"]),
            ("ix_quiz_events_deadline", ["deadline"]),
            ("ix_quiz_events_status", ["status"]),
            ("ix_quiz_events_created_by", ["created_by"]),
        ):
            if name not in event_indexes:
                op.create_index(name, "quiz_events", cols)

    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())
    if "quiz_event_questions" not in tables:
        op.create_table(
            "quiz_event_questions",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column(
                "event_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("quiz_events.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("position", sa.Integer(), nullable=False),
            sa.Column("prompt", sa.Text(), nullable=False),
            sa.Column("options", postgresql.JSONB(), nullable=False, server_default="[]"),
            sa.Column("correct_option_id", sa.String(8), nullable=False),
            sa.Column("explanation", sa.Text()),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.UniqueConstraint("event_id", "position", name="uq_quiz_event_question_position"),
        )
    inspector = sa.inspect(bind)
    if "quiz_event_questions" in set(inspector.get_table_names()):
        q_indexes = {idx["name"] for idx in inspector.get_indexes("quiz_event_questions")}
        if "ix_quiz_event_questions_event_id" not in q_indexes:
            op.create_index(
                "ix_quiz_event_questions_event_id",
                "quiz_event_questions",
                ["event_id"],
            )

    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())
    if "quiz_event_submissions" not in tables:
        op.create_table(
            "quiz_event_submissions",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column(
                "event_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("quiz_events.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "user_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("user_accounts.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("answers", postgresql.JSONB(), nullable=False, server_default="[]"),
            sa.Column("score", sa.Integer()),
            sa.Column("status", sa.String(32), nullable=False, server_default="in_progress"),
            sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("submitted_at", sa.DateTime(timezone=True)),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.UniqueConstraint("event_id", "user_id", name="uq_quiz_event_submission_user"),
        )
    inspector = sa.inspect(bind)
    if "quiz_event_submissions" in set(inspector.get_table_names()):
        s_indexes = {idx["name"] for idx in inspector.get_indexes("quiz_event_submissions")}
        for name, cols in (
            ("ix_quiz_event_submissions_event_id", ["event_id"]),
            ("ix_quiz_event_submissions_user_id", ["user_id"]),
        ):
            if name not in s_indexes:
                op.create_index(name, "quiz_event_submissions", cols)


def downgrade() -> None:
    op.drop_table("quiz_event_submissions")
    op.drop_table("quiz_event_questions")
    op.drop_table("quiz_events")
