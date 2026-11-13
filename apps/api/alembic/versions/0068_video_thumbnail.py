"""A picture for a Vimeo video link.

Revision ID: 0068_video_thumbnail
Revises: 0067_others_choice

video_links.thumbnail_url
    String(300), nullable. YouTube's and the Internet Archive's pictures stand at addresses built
    from the video's
    id, so nothing is stored for them. Vimeo names a picture only in its oEmbed answer; the look at
    the link
    (services/video_checks.py) keeps that address here (https, Vimeo's own image host only).
    Nothing is rewritten:
    a link from before has none until the next look, which a Vimeo link without a picture gets
    within hours.

Safe to run twice, and on a database where the app already ran `Base.metadata.create_all`. Works on
PostgreSQL
and SQLite. Downgrade drops the column.
Never run it against a real database without a backup.
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "0068_video_thumbnail"
down_revision = "0067_others_choice"
branch_labels = None
depends_on = None

TABLE = "video_links"
COLUMN = "thumbnail_url"


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table(TABLE):
        return
    if COLUMN not in {c["name"] for c in inspector.get_columns(TABLE)}:
        op.add_column(TABLE, sa.Column(COLUMN, sa.String(300), nullable=True))


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table(TABLE):
        return
    if COLUMN in {c["name"] for c in inspector.get_columns(TABLE)}:
        with op.batch_alter_table(TABLE) as batch:
            batch.drop_column(COLUMN)
