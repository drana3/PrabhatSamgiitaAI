"""Counted listens of Prabhat Samgiita catalogue songs (Top Played, Radio popularity).

Revision ID: 0042_song_plays
Revises: 0041_set_event_month_cover

song_play_events
    One counted listen of a catalogue song (1..5018): one listener, one song, one day. A short keyed
    hash stands for the listener (never an id or an address), raw rows are pruned with the others.
song_play_daily
    Counted listens per song and day. No listener data; kept.

Only NEW tables: `play_events`, `play_daily` and `recordings` are not touched. Safe to run
twice, and on a database where the app already ran `Base.metadata.create_all`. Works on
PostgreSQL and SQLite.
Downgrade drops only what this revision added.
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "0042_song_plays"
down_revision = "0041_set_event_month_cover"
branch_labels = None
depends_on = None

EVENTS = "song_play_events"
DAILY = "song_play_daily"


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table(EVENTS):
        op.create_table(
            EVENTS,
            sa.Column(
                "id",
                sa.BigInteger().with_variant(sa.Integer(), "sqlite"),
                primary_key=True,
                autoincrement=True,
            ),
            sa.Column("song_number", sa.Integer(), nullable=False),
            sa.Column("day", sa.Date(), nullable=False),
            sa.Column("listener_key", sa.String(16), nullable=False),
            sa.Column("listened_sec", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("client_key", sa.String(16), nullable=True),
            sa.Column("counted", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.UniqueConstraint(
                "song_number", "listener_key", "day", name="uq_song_play_events_once_a_day"
            ),
        )
        op.create_index("ix_song_play_events_day", EVENTS, ["day"])
        op.create_index("ix_song_play_events_listener_key", EVENTS, ["listener_key"])
        op.create_index("ix_song_play_events_day_song", EVENTS, ["day", "song_number"])
        op.create_index("ix_song_play_events_client_day", EVENTS, ["client_key", "day"])
    if not inspector.has_table(DAILY):
        op.create_table(
            DAILY,
            sa.Column("song_number", sa.Integer(), primary_key=True),
            sa.Column("day", sa.Date(), primary_key=True),
            sa.Column("plays", sa.Integer(), nullable=False, server_default="0"),
        )


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if inspector.has_table(DAILY):
        op.drop_table(DAILY)
    if inspector.has_table(EVENTS):
        op.drop_table(EVENTS)
