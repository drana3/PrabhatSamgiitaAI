"""add domain catalog and content governance

Revision ID: 0003_domain_governance
Revises: 0002_song_chunks
Create Date: 2026-08-01 00:00:00
"""

from alembic import op
from app.models import Base

revision = "0003_domain_governance"
down_revision = "0002_song_chunks"
branch_labels = None
depends_on = None

DOMAIN_TABLES = {
    "themes",
    "occasions",
    "song_theme_links",
    "song_occasion_links",
    "festivals",
    "festival_song_links",
    "seasons",
    "song_season_links",
    "recommendation_audits",
    "content_reports",
    "content_audits",
}


def upgrade() -> None:
    op.execute("ALTER TABLE songs ALTER COLUMN theme TYPE TEXT")
    op.execute("ALTER TABLE inventory_items ALTER COLUMN title TYPE TEXT")
    bind = op.get_bind()
    for table in Base.metadata.sorted_tables:
        if table.name in DOMAIN_TABLES:
            table.create(bind=bind, checkfirst=True)


def downgrade() -> None:
    bind = op.get_bind()
    for table in reversed(Base.metadata.sorted_tables):
        if table.name in DOMAIN_TABLES:
            table.drop(bind=bind, checkfirst=True)
