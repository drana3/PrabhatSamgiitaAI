"""Kiirtan and Bhajan recordings, reports, author blocks and member notices.

Revision ID: 0027_recordings
Revises: 0026_google_translate_quota_alert
"""

from __future__ import annotations

from alembic import op
from app.models import (
    AuthorBlock,
    MemberNotice,
    Recording,
    RecordingCollection,
    RecordingReport,
)

revision = "0027_recordings"
down_revision = "0026_google_translate_quota_alert"
branch_labels = None
depends_on = None

# `recordings` is built from the CURRENT model, and the model points at `recording_collections`
# (a table 0032 adds later). On an empty database (a Postgres rehearsal, a new server) that
# table must exist first or the foreign key fails. On a real server it is already there and
# checkfirst skips it.
TABLES = (RecordingCollection, Recording, RecordingReport, AuthorBlock, MemberNotice)


def upgrade() -> None:
    bind = op.get_bind()
    for model in TABLES:
        model.__table__.create(bind=bind, checkfirst=True)


def downgrade() -> None:
    bind = op.get_bind()
    for model in reversed(TABLES):
        model.__table__.drop(bind=bind, checkfirst=True)
