"""Counted listens of Prabhat Samgiita CATALOGUE songs (the official audio of song 1..5018).

A song of the catalogue is not a row of `recordings`, so the recording counters (`play_events`,
`play_daily`, docs/author-profiles.md) cannot hold its plays. These two tables are the same pair for
a song number, with the same rules (services/song_plays.py reuses the counting rule, the keyed
listener hash and every cap of services/author_stats.py): raw rows with no member id, no device id
and no address, pruned after the same retention; a daily counter that stays.

Top Played (docs/radio-mixing.md, services/top_played.py) reads `play_daily` for recordings and
`song_play_daily` for catalogue songs.
"""

from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Index,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.author_profiles import BigIntPk
from app.models.base import Base


class SongPlayEvent(Base):
    """One counted listen: one listener, one catalogue song, one day. Raw rows, pruned with the
    others. The unique key is the "one count per listener per song per day" rule, kept by the
    database so two simultaneous requests cannot count twice."""

    __tablename__ = "song_play_events"
    __table_args__ = (
        UniqueConstraint(
            "song_number", "listener_key", "day", name="uq_song_play_events_once_a_day"
        ),
        Index("ix_song_play_events_day_song", "day", "song_number"),
        Index("ix_song_play_events_client_day", "client_key", "day"),
    )

    id: Mapped[int] = mapped_column(BigIntPk, primary_key=True, autoincrement=True)
    song_number: Mapped[int] = mapped_column(Integer, nullable=False)
    day: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    # A SHORT keyed hash, never an id (services/author_stats.py `listener_key`).
    listener_key: Mapped[str] = mapped_column(String(16), index=True, nullable=False)
    listened_sec: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    # Signed-out listening only: a short keyed hash of the client address (never the address).
    client_key: Mapped[str | None] = mapped_column(String(16))
    # false: stored but over the client's daily cap, so in no public number.
    counted: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default="true", nullable=False
    )


class SongPlayDaily(Base):
    """Counted listens per catalogue song and day. No listener data; kept after the raw rows go."""

    __tablename__ = "song_play_daily"

    song_number: Mapped[int] = mapped_column(Integer, primary_key=True)
    day: Mapped[date] = mapped_column(Date, primary_key=True)
    plays: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)
