"""Add admin replies on user feedback (multi-reply + email delivery).

Revision ID: 0022_user_feedback_replies
Revises: 0021_lyrics_devanagari
"""

from __future__ import annotations

from alembic import op
from app.models import UserFeedbackReply

revision = "0022_user_feedback_replies"
down_revision = "0021_lyrics_devanagari"
branch_labels = None
depends_on = None


def upgrade() -> None:
    UserFeedbackReply.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    UserFeedbackReply.__table__.drop(bind=op.get_bind(), checkfirst=True)
