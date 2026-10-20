"""Track Google Translate free-tier exhaustion email per month.

Revision ID: 0026_google_translate_quota_alert
Revises: 0025_google_translate_usage
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "0026_google_translate_quota_alert"
down_revision = "0025_google_translate_usage"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "google_translate_usage",
        sa.Column("quota_alert_sent_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("google_translate_usage", "quota_alert_sent_at")
