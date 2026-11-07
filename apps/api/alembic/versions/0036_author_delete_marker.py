"""Recording comments and videos: the author-delete marker moves out of the name space.

Revision ID: 0036_author_delete_marker
Revises: 0035_author_review_and_play_caps

`removed_by` held the plain word `author` for an author's own delete, and a team removal stores the
member's display name, so a team member named "author" made a team removal look like an author's
delete (QA-056). The marker is now a control-character-prefixed value that no name can equal (team
removals strip control characters). Existing rows that say `author` are rewritten to it.
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "0036_author_delete_marker"
down_revision = "0035_author_review_and_play_caps"
branch_labels = None
depends_on = None

OLD = "author"
NEW = "\x1fauthor"
TABLES = ("recording_comments", "video_links")


def _swap(old: str, new: str) -> None:
    inspector = sa.inspect(op.get_bind())
    for table in TABLES:
        if inspector.has_table(table):
            op.execute(
                sa.text(
                    f"UPDATE {table} SET removed_by = :new "
                    "WHERE status = 'removed' AND removed_by = :old"
                ).bindparams(new=new, old=old)
            )


def upgrade() -> None:
    _swap(OLD, NEW)


def downgrade() -> None:
    _swap(NEW, OLD)
