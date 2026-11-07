"""Author profiles and listening statistics.

Revision ID: 0033_author_profiles
Revises: 0032_recording_sets_and_categories

Nine new tables, written out by hand (not from the models) so the revision keeps meaning the same
after the models change. Safe to run twice, and on a database where the app already ran
`Base.metadata.create_all` (a fresh database has the tables before this revision runs): every table
and every index is looked for first and an existing one is left alone. Works on PostgreSQL and
SQLite.

  author_profiles            one public page per member
  author_profile_photos      the picture, apart so listings never load image bytes
  author_slug_history        old addresses (301) and deleted addresses (410, held back)
  author_recording_links     exceptions to "show my uploads"
  author_reports             reports of a page
  play_events                counted listens, no member id, a short keyed hash, pruned after ~13
  months
  play_daily                 counted listens per recording and day, no listener data
  author_stats_snapshots     the numbers of a page, worked out every few minutes
  author_suspensions         a suspension that belongs to the member (survives deleting the page)

Nothing existing is changed. Downgrade drops the nine tables (the data in them is lost).
Back up the database before running it on a real server.
"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0033_author_profiles"
down_revision = "0032_recording_sets_and_categories"
branch_labels = None
depends_on = None

TABLES = (
    "author_suspensions",
    "author_stats_snapshots",
    "play_daily",
    "play_events",
    "author_reports",
    "author_recording_links",
    "author_slug_history",
    "author_profile_photos",
    "author_profiles",
)


def _uuid() -> sa.types.TypeEngine:
    return postgresql.UUID(as_uuid=True)


def _json() -> sa.types.TypeEngine:
    return sa.JSON().with_variant(postgresql.JSONB(), "postgresql")


def _bigint_pk() -> sa.types.TypeEngine:
    return sa.BigInteger().with_variant(sa.Integer(), "sqlite")


def _stamps() -> list[sa.Column]:
    return [
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    ]


def _index(
    inspector: sa.Inspector, name: str, table: str, columns: list[str], unique: bool = False
) -> None:
    if any(ix["name"] == name for ix in inspector.get_indexes(table)):
        return
    op.create_index(name, table, columns, unique=unique)


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())

    if not inspector.has_table("author_profiles"):
        op.create_table(
            "author_profiles",
            sa.Column("id", _uuid(), primary_key=True),
            sa.Column(
                "member_id",
                _uuid(),
                sa.ForeignKey("user_accounts.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("slug", sa.String(30), nullable=False),
            sa.Column("display_name", sa.String(60), nullable=False),
            sa.Column("author_type", sa.String(8), server_default="solo", nullable=False),
            sa.Column("bio", sa.String(280), server_default="", nullable=False),
            sa.Column("about", sa.Text(), server_default="", nullable=False),
            sa.Column("country", sa.String(80)),
            sa.Column("city", sa.String(80)),
            sa.Column("languages", _json(), nullable=False),
            sa.Column("links", _json(), nullable=False),
            sa.Column("claimed_name", sa.String(120)),
            sa.Column("status", sa.String(12), server_default="draft", nullable=False),
            sa.Column("review_needed", sa.Boolean(), server_default=sa.false(), nullable=False),
            sa.Column("review_reason", sa.String(200)),
            sa.Column("verified", sa.Boolean(), server_default=sa.false(), nullable=False),
            sa.Column("verified_at", sa.DateTime(timezone=True)),
            sa.Column("verified_by", sa.String(255)),
            sa.Column("suspended_reason", sa.Text()),
            sa.Column("suspended_at", sa.DateTime(timezone=True)),
            sa.Column("suspended_by", sa.String(255)),
            sa.Column("include_uploads", sa.String(8), server_default="all", nullable=False),
            sa.Column("show_stats", sa.Boolean(), server_default=sa.true(), nullable=False),
            sa.Column("reports_count", sa.Integer(), server_default="0", nullable=False),
            sa.Column("photo_version", sa.String(16)),
            sa.Column("published_at", sa.DateTime(timezone=True)),
            sa.Column("slug_changed_at", sa.DateTime(timezone=True)),
            *_stamps(),
            sa.CheckConstraint(
                "status IN ('draft', 'published', 'suspended')", name="ck_author_profiles_status"
            ),
            sa.CheckConstraint("author_type IN ('solo', 'group')", name="ck_author_profiles_type"),
            sa.CheckConstraint(
                "include_uploads IN ('all', 'chosen')", name="ck_author_profiles_include_uploads"
            ),
        )
    inspector = sa.inspect(op.get_bind())
    _index(inspector, "ix_author_profiles_member_id", "author_profiles", ["member_id"], unique=True)
    _index(inspector, "ix_author_profiles_slug", "author_profiles", ["slug"], unique=True)
    _index(inspector, "ix_author_profiles_status", "author_profiles", ["status"])
    _index(inspector, "ix_author_profiles_review_needed", "author_profiles", ["review_needed"])
    _index(inspector, "ix_author_profiles_published_at", "author_profiles", ["published_at"])

    if not inspector.has_table("author_profile_photos"):
        op.create_table(
            "author_profile_photos",
            sa.Column(
                "profile_id",
                _uuid(),
                sa.ForeignKey("author_profiles.id", ondelete="CASCADE"),
                primary_key=True,
            ),
            sa.Column("mime", sa.String(32), nullable=False),
            sa.Column("data", sa.LargeBinary(), nullable=False),
            sa.Column("sha256", sa.String(64), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        )

    if not inspector.has_table("author_slug_history"):
        op.create_table(
            "author_slug_history",
            sa.Column("id", _uuid(), primary_key=True),
            sa.Column("slug", sa.String(30), nullable=False),
            sa.Column(
                "profile_id", _uuid(), sa.ForeignKey("author_profiles.id", ondelete="SET NULL")
            ),
            sa.Column("kind", sa.String(8), nullable=False),
            sa.Column("quarantine_until", sa.DateTime(timezone=True)),
            *_stamps(),
            sa.CheckConstraint(
                "kind IN ('renamed', 'deleted')", name="ck_author_slug_history_kind"
            ),
        )
    inspector = sa.inspect(op.get_bind())
    _index(inspector, "ix_author_slug_history_slug", "author_slug_history", ["slug"], unique=True)
    _index(inspector, "ix_author_slug_history_profile_id", "author_slug_history", ["profile_id"])

    if not inspector.has_table("author_recording_links"):
        op.create_table(
            "author_recording_links",
            sa.Column("id", _uuid(), primary_key=True),
            sa.Column(
                "profile_id",
                _uuid(),
                sa.ForeignKey("author_profiles.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "recording_id",
                _uuid(),
                sa.ForeignKey("recordings.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("mode", sa.String(8), nullable=False),
            *_stamps(),
            sa.UniqueConstraint(
                "profile_id", "recording_id", name="uq_author_recording_links_pair"
            ),
            sa.CheckConstraint(
                "mode IN ('include', 'exclude')", name="ck_author_recording_links_mode"
            ),
        )
    inspector = sa.inspect(op.get_bind())
    _index(
        inspector, "ix_author_recording_links_profile_id", "author_recording_links", ["profile_id"]
    )
    _index(
        inspector,
        "ix_author_recording_links_recording_id",
        "author_recording_links",
        ["recording_id"],
    )

    if not inspector.has_table("author_reports"):
        op.create_table(
            "author_reports",
            sa.Column("id", _uuid(), primary_key=True),
            sa.Column(
                "profile_id",
                _uuid(),
                sa.ForeignKey("author_profiles.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("reporter_key", sa.String(80), nullable=False),
            sa.Column(
                "reporter_id", _uuid(), sa.ForeignKey("user_accounts.id", ondelete="SET NULL")
            ),
            sa.Column("reason", sa.String(16), nullable=False),
            sa.Column("comment", sa.Text()),
            sa.Column("status", sa.String(16), server_default="new", nullable=False),
            *_stamps(),
            sa.UniqueConstraint("profile_id", "reporter_key", name="uq_author_reports_once"),
            sa.CheckConstraint(
                "reason IN ('impersonation', 'offensive', 'spam', 'copyright', "
                "'wrong_info', 'other')",
                name="ck_author_reports_reason",
            ),
        )
    inspector = sa.inspect(op.get_bind())
    _index(inspector, "ix_author_reports_profile_id", "author_reports", ["profile_id"])

    if not inspector.has_table("play_events"):
        op.create_table(
            "play_events",
            sa.Column("id", _bigint_pk(), primary_key=True, autoincrement=True),
            sa.Column(
                "recording_id",
                _uuid(),
                sa.ForeignKey("recordings.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("day", sa.Date(), nullable=False),
            sa.Column("listener_key", sa.String(16), nullable=False),
            sa.Column("country", sa.String(2)),
            sa.Column("listened_sec", sa.Integer(), server_default="0", nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.UniqueConstraint(
                "recording_id", "listener_key", "day", name="uq_play_events_once_a_day"
            ),
        )
    inspector = sa.inspect(op.get_bind())
    _index(inspector, "ix_play_events_recording_id", "play_events", ["recording_id"])
    _index(inspector, "ix_play_events_day", "play_events", ["day"])
    _index(inspector, "ix_play_events_listener_key", "play_events", ["listener_key"])
    _index(inspector, "ix_play_events_day_recording", "play_events", ["day", "recording_id"])

    if not inspector.has_table("play_daily"):
        op.create_table(
            "play_daily",
            sa.Column(
                "recording_id",
                _uuid(),
                sa.ForeignKey("recordings.id", ondelete="CASCADE"),
                primary_key=True,
            ),
            sa.Column("day", sa.Date(), primary_key=True),
            sa.Column("plays", sa.Integer(), server_default="0", nullable=False),
        )

    if not inspector.has_table("author_stats_snapshots"):
        op.create_table(
            "author_stats_snapshots",
            sa.Column(
                "profile_id",
                _uuid(),
                sa.ForeignKey("author_profiles.id", ondelete="CASCADE"),
                primary_key=True,
            ),
            sa.Column("monthly_listeners", sa.Integer(), server_default="0", nullable=False),
            sa.Column("total_plays", sa.Integer(), server_default="0", nullable=False),
            sa.Column("recordings_count", sa.Integer(), server_default="0", nullable=False),
            sa.Column("computed_at", sa.DateTime(timezone=True), nullable=False),
        )
    _suspensions(sa.inspect(op.get_bind()))


def _suspensions(inspector: sa.Inspector) -> None:
    if inspector.has_table("author_suspensions"):
        return
    op.create_table(
        "author_suspensions",
        sa.Column(
            "member_id",
            _uuid(),
            sa.ForeignKey("user_accounts.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("suspended_by", sa.String(255)),
        sa.Column("evidence", _json(), nullable=False),
        *_stamps(),
    )


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    for table in TABLES:
        if inspector.has_table(table):
            op.drop_table(table)
