"""Merge and store a member's Learn progress (docs/learn-sync.md).

The rule is per song, last write wins by `updated_at`:

* an incoming entry replaces the stored one only when it is strictly newer (a tie keeps the
  stored one);
* a timestamp from the future is cut back to the server's clock, so a wrong phone clock cannot pin
  a song forever;
* markers of removed songs older than `TOMBSTONE_DAYS` are dropped to keep the document small;
* more than `MAX_ENTRIES` entries after that refuses the whole write.

Pure functions first (tested without a database), then the two database calls.
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.learn_sync import MemberLearnProgress
from app.schemas.learn_sync import MAX_ENTRIES, LearnSongEntry

DOCUMENT_VERSION = 1
TOMBSTONE_DAYS = 90
DAY_MS = 86_400_000


class LearnProgressTooLargeError(Exception):
    """The merged document would hold more than MAX_ENTRIES entries."""


def now_ms() -> int:
    return int(datetime.now(UTC).timestamp() * 1000)


def stored_entries(document: Mapping[str, Any] | None) -> dict[str, LearnSongEntry]:
    """The valid entries of a stored document. Anything malformed is skipped, never raised."""
    songs = (document or {}).get("songs")
    if not isinstance(songs, Mapping):
        return {}
    result: dict[str, LearnSongEntry] = {}
    for song_id, raw in songs.items():
        try:
            entry = LearnSongEntry.model_validate(raw)
        except ValueError:
            continue
        if entry.song_id == song_id:
            result[song_id] = entry
    return result


def merge_entries(
    stored: Mapping[str, LearnSongEntry],
    incoming: Iterable[LearnSongEntry],
    *,
    now: int,
) -> dict[str, LearnSongEntry]:
    """Stored entries with the newer incoming ones applied, then tidied.

    Raises LearnProgressTooLargeError when more than MAX_ENTRIES entries are left.
    """
    merged = dict(stored)
    for entry in incoming:
        candidate = entry
        if candidate.updated_at > now:
            candidate = entry.model_copy(update={"updated_at": now})
        current = merged.get(candidate.song_id)
        if current is None or candidate.updated_at > current.updated_at:
            merged[candidate.song_id] = candidate
    cutoff = now - TOMBSTONE_DAYS * DAY_MS
    merged = {
        song_id: entry
        for song_id, entry in merged.items()
        if not (entry.removed and entry.updated_at < cutoff)
    }
    if len(merged) > MAX_ENTRIES:
        raise LearnProgressTooLargeError
    return merged


def to_document(entries: Mapping[str, LearnSongEntry]) -> dict[str, Any]:
    return {
        "version": DOCUMENT_VERSION,
        "songs": {song_id: entry.model_dump() for song_id, entry in sorted(entries.items())},
    }


def ordered(entries: Mapping[str, LearnSongEntry]) -> list[LearnSongEntry]:
    return sorted(entries.values(), key=lambda entry: (entry.number, entry.song_id))


async def read_progress(
    session: AsyncSession, member_id: Any
) -> tuple[list[LearnSongEntry], datetime | None]:
    row = await session.get(MemberLearnProgress, member_id)
    if row is None:
        return [], None
    return ordered(stored_entries(row.document)), row.updated_at


async def merge_progress(
    session: AsyncSession,
    member_id: Any,
    incoming: Iterable[LearnSongEntry],
) -> tuple[list[LearnSongEntry], datetime | None]:
    """Merge `incoming` into the member's document and return the whole merged document."""
    incoming = list(incoming)
    for attempt in (1, 2):
        row = await session.scalar(
            select(MemberLearnProgress)
            .where(MemberLearnProgress.user_id == member_id)
            .with_for_update()
        )
        created = row is None
        if row is None:
            row = MemberLearnProgress(user_id=member_id, document={})
        merged = merge_entries(stored_entries(row.document), incoming, now=now_ms())
        row.document = to_document(merged)
        if created:
            session.add(row)
        try:
            await session.commit()
        except IntegrityError:
            # two first writes of the same member raced; the second one retries as an update
            await session.rollback()
            if attempt == 2:
                raise
            continue
        await session.refresh(row)
        return ordered(merged), row.updated_at
    raise RuntimeError("unreachable")  # pragma: no cover
