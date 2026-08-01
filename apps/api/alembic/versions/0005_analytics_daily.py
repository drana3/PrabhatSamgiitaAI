"""add privacy preserving daily analytics

Revision ID: 0005_analytics_daily
Revises: 0004_user_feedback
Create Date: 2026-08-01 00:00:00
"""

from alembic import op
from app.models import AnalyticsDaily

revision = "0005_analytics_daily"
down_revision = "0004_user_feedback"
branch_labels = None
depends_on = None


def upgrade() -> None:
    AnalyticsDaily.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    AnalyticsDaily.__table__.drop(bind=op.get_bind(), checkfirst=True)
