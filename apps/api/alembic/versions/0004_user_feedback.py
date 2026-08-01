"""add user feedback

Revision ID: 0004_user_feedback
Revises: 0003_domain_governance
Create Date: 2026-08-01 00:00:00
"""

from alembic import op
from app.models import UserFeedback

revision = "0004_user_feedback"
down_revision = "0003_domain_governance"
branch_labels = None
depends_on = None


def upgrade() -> None:
    UserFeedback.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    UserFeedback.__table__.drop(bind=op.get_bind(), checkfirst=True)
