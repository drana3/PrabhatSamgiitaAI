"""Kiirtan and Bhajan recordings, reports, author blocks and member notices.

Revision ID: 0027_recordings
Revises: 0026_google_translate_quota_alert
"""

from __future__ import annotations

from alembic import op
from app.models import AuthorBlock, MemberNotice, Recording, RecordingReport

revision = "0027_recordings"
down_revision = "0026_google_translate_quota_alert"
branch_labels = None
depends_on = None

TABLES = (Recording, RecordingReport, AuthorBlock, MemberNotice)


def upgrade() -> None:
    bind = op.get_bind()
    for model in TABLES:
        model.__table__.create(bind=bind, checkfirst=True)


def downgrade() -> None:
    bind = op.get_bind()
    for model in reversed(TABLES):
        model.__table__.drop(bind=bind, checkfirst=True)
