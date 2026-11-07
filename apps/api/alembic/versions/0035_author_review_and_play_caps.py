"""Author profiles: a report hold of its own, and the caps on new listeners.

Revision ID: 0035_author_review_and_play_caps
Revises: 0034_recording_extras

author_profiles.report_reason
    A hold raised by reports is stored apart from the name-check hold (`review_needed`,
    `review_reason`), so one can never overwrite or clear the other. Rows that already carry
    `reported:<reason>` in `review_reason` are moved: `report_reason` gets the reason,
    `review_needed` and `review_reason` are cleared.

play_events.client_key, play_events.counts_listener
    A short keyed hash of the client address (never the address) and a flag: a signed-out client
    that adds more new device ids than its daily cap still has its plays counted, but those devices
    are not counted as new listeners. Existing rows are listeners (`counts_listener` true).

Safe to run twice, and on a database where the app already ran `Base.metadata.create_all` (the
columns and indexes are looked for first). Works on PostgreSQL and SQLite. Downgrade puts the report
holds back into `review_reason` and drops the three columns (the client keys are lost).
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "0035_author_review_and_play_caps"
down_revision = "0034_recording_extras"
branch_labels = None
depends_on = None


def _columns(inspector: sa.Inspector, table: str) -> set[str]:
    return {c["name"] for c in inspector.get_columns(table)}


def _index(inspector: sa.Inspector, name: str, table: str, columns: list[str]) -> None:
    if any(ix["name"] == name for ix in inspector.get_indexes(table)):
        return
    op.create_index(name, table, columns)


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())

    if inspector.has_table("author_profiles"):
        if "report_reason" not in _columns(inspector, "author_profiles"):
            op.add_column("author_profiles", sa.Column("report_reason", sa.String(40)))
        _index(
            sa.inspect(op.get_bind()),
            "ix_author_profiles_report_reason",
            "author_profiles",
            ["report_reason"],
        )
        # the holds that reports raised move to their own column
        op.execute(
            sa.text(
                "UPDATE author_profiles SET report_reason = substr(review_reason, 10), "
                "review_needed = :no, review_reason = NULL "
                "WHERE review_reason LIKE 'reported:%'"
            ).bindparams(no=False)
        )

    if inspector.has_table("play_events"):
        have = _columns(inspector, "play_events")
        if "client_key" not in have:
            op.add_column("play_events", sa.Column("client_key", sa.String(16)))
        if "counts_listener" not in have:
            op.add_column(
                "play_events",
                sa.Column(
                    "counts_listener", sa.Boolean(), server_default=sa.true(), nullable=False
                ),
            )
        _index(
            sa.inspect(op.get_bind()),
            "ix_play_events_client_day",
            "play_events",
            ["client_key", "day"],
        )


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())

    if inspector.has_table("play_events"):
        have = _columns(inspector, "play_events")
        if any(
            ix["name"] == "ix_play_events_client_day" for ix in inspector.get_indexes("play_events")
        ):
            op.drop_index("ix_play_events_client_day", table_name="play_events")
        with op.batch_alter_table("play_events") as batch:
            for column in ("counts_listener", "client_key"):
                if column in have:
                    batch.drop_column(column)

    if inspector.has_table("author_profiles") and "report_reason" in _columns(
        inspector, "author_profiles"
    ):
        # the report holds go back where 0033 kept them (a name-check hold, if any, wins)
        op.execute(
            sa.text(
                "UPDATE author_profiles SET review_reason = 'reported:' || report_reason, "
                "review_needed = :yes "
                "WHERE report_reason IS NOT NULL AND review_reason IS NULL"
            ).bindparams(yes=True)
        )
        if any(
            ix["name"] == "ix_author_profiles_report_reason"
            for ix in inspector.get_indexes("author_profiles")
        ):
            op.drop_index("ix_author_profiles_report_reason", table_name="author_profiles")
        with op.batch_alter_table("author_profiles") as batch:
            batch.drop_column("report_reason")
