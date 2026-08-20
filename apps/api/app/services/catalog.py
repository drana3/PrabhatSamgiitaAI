from __future__ import annotations

from collections.abc import Iterable
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import InventoryItem, Media, Notation, Song, SongChunk
from app.services.faiss_store import get_faiss_store
from app.services.seed_data import load_rows

_songs: dict[int, Song] | None = None
_media: dict[int, list[Media]] | None = None
_notations: dict[int, Notation] | None = None
_inventory: tuple[InventoryItem, ...] | None = None
_catalog_complete: bool | None = None


def reset_catalog_memory() -> None:
    """Drop in-process replicas so the next read reloads packaged seed files."""
    global _songs, _media, _notations, _inventory, _catalog_complete
    _songs = None
    _media = None
    _notations = None
    _inventory = None
    _catalog_complete = None
    from app.services.lyric_search import lyric_index

    lyric_index.cache_clear()


def _ensure_catalog_loaded() -> None:
    global _songs, _media, _notations, _inventory
    if _songs is not None and _media is not None and _notations is not None:
        return
    _songs = {song.number: song for song in (Song(**row) for row in load_rows("songs.json"))}
    grouped: dict[int, list[Media]] = {}
    for item in (Media(**row) for row in load_rows("media.json")):
        if item.song_number is None:
            continue
        grouped.setdefault(item.song_number, []).append(item)
    _media = grouped
    _notations = {
        item.song_number: item for item in (Notation(**row) for row in load_rows("notations.json"))
    }
    if _inventory is None:
        _inventory = tuple(InventoryItem(**row) for row in load_rows("inventory.json"))


def catalog_song_snapshot() -> tuple[Song, ...]:
    _ensure_catalog_loaded()
    assert _songs is not None
    return tuple(_songs.values())


def catalog_media_snapshot() -> tuple[Media, ...]:
    _ensure_catalog_loaded()
    assert _media is not None
    return tuple(item for items in _media.values() for item in items)


def catalog_notation_snapshot() -> tuple[Notation, ...]:
    _ensure_catalog_loaded()
    assert _notations is not None
    return tuple(_notations.values())


def catalog_inventory_snapshot() -> tuple[InventoryItem, ...]:
    _ensure_catalog_loaded()
    assert _inventory is not None
    return _inventory


def songs_by_number() -> dict[int, Song]:
    _ensure_catalog_loaded()
    assert _songs is not None
    return _songs


def media_by_song_number() -> dict[int, tuple[Media, ...]]:
    _ensure_catalog_loaded()
    assert _media is not None
    return {number: tuple(items) for number, items in _media.items()}


def notations_by_song_number() -> dict[int, Notation]:
    _ensure_catalog_loaded()
    assert _notations is not None
    return _notations


def _detach_song(song: Song) -> Song:
    return Song(
        number=song.number,
        title=song.title,
        first_line=song.first_line,
        lyrics_original=song.lyrics_original,
        transliteration=song.transliteration,
        hindi_meaning=song.hindi_meaning,
        english_meaning=song.english_meaning,
        theme=song.theme,
        occasion=song.occasion,
        festival=song.festival,
        season=song.season,
        mood=song.mood,
        language=song.language,
        difficulty=song.difficulty,
        meditation_context=song.meditation_context,
        raga=song.raga,
        tala=song.tala,
        harmonium_notation=song.harmonium_notation,
        canonical_source_url=song.canonical_source_url,
        canonical_source_status=song.canonical_source_status,
        is_verified=bool(song.is_verified),
        metadata_json=dict(song.metadata_json or {}),
    )


def _detach_media(item: Media) -> Media:
    return Media(
        song_number=item.song_number,
        kind=item.kind,
        provider=item.provider,
        title=item.title,
        url=item.url,
        embed_url=item.embed_url,
        verification_status=item.verification_status,
        source_url=item.source_url,
        notes=item.notes,
        metadata_json=dict(item.metadata_json or {}),
    )


def _detach_notation(item: Notation) -> Notation:
    return Notation(
        song_number=item.song_number,
        source_url=item.source_url,
        notation_text=item.notation_text,
        scale=item.scale,
        verification_status=item.verification_status,
        metadata_json=dict(item.metadata_json or {}),
    )


def _invalidate_derived_indexes() -> None:
    from app.services.lyric_search import lyric_index

    lyric_index.cache_clear()
    # Drop search response caches so clients never keep stale song metadata/media.
    try:
        from app.api.v1.search import clear_search_result_caches_sync

        clear_search_result_caches_sync()
    except Exception:
        # Search router may not be imported yet during early bootstrap.
        pass


async def refresh_catalog_song(
    session: AsyncSession,
    number: int,
    *,
    invalidate: bool = True,
) -> bool:
    """Copy one Neon song (plus its media/notation) into the in-process catalog."""
    _ensure_catalog_loaded()
    assert _songs is not None and _media is not None and _notations is not None
    try:
        song = (
            await session.execute(select(Song).where(Song.number == number))
        ).scalar_one_or_none()
        media_rows = list(
            (
                await session.execute(select(Media).where(Media.song_number == number))
            ).scalars().all()
        )
        notation = (
            await session.execute(select(Notation).where(Notation.song_number == number))
        ).scalar_one_or_none()
    except SQLAlchemyError:
        await session.rollback()
        return False
    if song is None:
        return False
    _songs[song.number] = _detach_song(song)
    merged = {item.url: item for item in _media.get(song.number, [])}
    for item in media_rows:
        merged[item.url] = _detach_media(item)
    _media[song.number] = list(merged.values())
    if notation is not None:
        _notations[song.number] = _detach_notation(notation)
    if invalidate:
        _invalidate_derived_indexes()
    return True


async def refresh_catalog_songs(session: AsyncSession, numbers: Iterable[int]) -> int:
    refreshed = 0
    for number in dict.fromkeys(int(value) for value in numbers):
        if await refresh_catalog_song(session, number, invalidate=False):
            refreshed += 1
    if refreshed:
        _invalidate_derived_indexes()
    return refreshed


async def refresh_catalog_changes_since(session: AsyncSession, since: datetime) -> int:
    """Reload songs/media/notation rows with updated_at >= since into memory."""
    numbers: set[int] = set()
    try:
        song_numbers = await session.execute(select(Song.number).where(Song.updated_at >= since))
        numbers.update(int(value) for value in song_numbers.scalars().all())
        media_numbers = await session.execute(
            select(Media.song_number).where(
                Media.updated_at >= since,
                Media.song_number.is_not(None),
            )
        )
        numbers.update(int(value) for value in media_numbers.scalars().all() if value is not None)
        notation_numbers = await session.execute(
            select(Notation.song_number).where(Notation.updated_at >= since)
        )
        numbers.update(int(value) for value in notation_numbers.scalars().all())
    except SQLAlchemyError:
        await session.rollback()
        return 0
    return await refresh_catalog_songs(session, numbers)


async def refresh_recent_catalog_changes(session: AsyncSession, *, minutes: int = 15) -> int:
    """Reload songs that Neon reports as updated in the last `minutes`."""
    cutoff = datetime.now(UTC) - timedelta(minutes=minutes)
    return await refresh_catalog_changes_since(session, cutoff)


class CatalogService:
    def __init__(self, session: AsyncSession):
        self.session = session

    def _seed_songs(self) -> list[Song]:
        return list(catalog_song_snapshot())

    def _seed_media(self) -> list[Media]:
        return list(catalog_media_snapshot())

    def _seed_notations(self) -> list[Notation]:
        return list(catalog_notation_snapshot())

    def _seed_inventory(self) -> list[InventoryItem]:
        return list(catalog_inventory_snapshot())

    async def _database_song_count(self) -> int:
        try:
            result = await self.session.execute(select(func.count()).select_from(Song))
            return int(result.scalar_one())
        except SQLAlchemyError:
            await self.session.rollback()
            return 0

    async def _database_catalog_complete(self) -> bool:
        global _catalog_complete
        if _catalog_complete:
            return True
        complete = await self._database_song_count() >= len(catalog_song_snapshot())
        if complete:
            _catalog_complete = True
        return complete

    async def list_songs(self, limit: int = 50, offset: int = 0) -> list[Song]:
        seeded = self._seed_songs()[offset : offset + limit]
        if seeded:
            return seeded
        if not await self._database_catalog_complete():
            return []
        try:
            result = await self.session.execute(
                select(Song).order_by(Song.number).limit(limit).offset(offset)
            )
            rows = list(result.scalars().all())
            if rows:
                return rows
        except SQLAlchemyError:
            await self.session.rollback()
        return []

    async def get_song(self, number: int) -> Song | None:
        seeded = songs_by_number().get(number)
        if seeded is not None:
            return seeded
        try:
            result = await self.session.execute(select(Song).where(Song.number == number))
            return result.scalar_one_or_none()
        except SQLAlchemyError:
            await self.session.rollback()
            return None

    async def search(self, query: str, limit: int = 20) -> list[Song]:
        query_norm = query.lower().strip()
        if not query_norm:
            return []
        seeded = self._seed_songs()
        scored = [
            song
            for song in seeded
            if query_norm
            in " ".join(
                part.lower()
                for part in (
                    str(song.number),
                    song.title,
                    song.first_line or "",
                    song.theme or "",
                    song.occasion or "",
                    song.festival or "",
                    song.mood or "",
                    song.language or "",
                )
            )
        ]
        if scored:
            return scored[:limit]
        try:
            terms = [term for term in query_norm.split() if term]
            stmt = select(Song)
            for term in terms:
                like = f"%{term}%"
                stmt = stmt.where(
                    or_(
                        Song.title.ilike(like),
                        Song.first_line.ilike(like),
                        Song.lyrics_original.ilike(like),
                        Song.english_meaning.ilike(like),
                        Song.hindi_meaning.ilike(like),
                        Song.theme.ilike(like),
                    )
                )
            result = await self.session.execute(stmt.limit(limit))
            rows = list(result.scalars().all())
            if rows:
                return rows
        except SQLAlchemyError:
            await self.session.rollback()
        return []

    async def related_songs(self, song: Song, limit: int = 6) -> list[Song]:
        related: list[Song] = []
        for candidate in catalog_song_snapshot():
            if candidate.number == song.number:
                continue
            if any(
                getattr(song, field) and getattr(candidate, field) == getattr(song, field)
                for field in ("theme", "occasion", "festival", "season", "mood", "language")
            ):
                related.append(candidate)
            if len(related) >= limit:
                break
        if related:
            return related
        if not await self._database_catalog_complete():
            return []
        try:
            filters = []
            for field in ("theme", "occasion", "festival", "season", "mood", "language"):
                value = getattr(song, field)
                if value:
                    filters.append(getattr(Song, field) == value)
            if not filters:
                return []
            result = await self.session.execute(
                select(Song)
                .where(Song.number != song.number)
                .where(or_(*filters))
                .limit(limit)
            )
            return list(result.scalars().all())
        except SQLAlchemyError:
            await self.session.rollback()
            return []

    async def get_media(self, song_number: int) -> list[Media]:
        snapshot = list(media_by_song_number().get(song_number, ()))
        if snapshot:
            return snapshot
        try:
            result = await self.session.execute(
                select(Media).where(Media.song_number == song_number)
            )
            return list(result.scalars().all())
        except SQLAlchemyError:
            await self.session.rollback()
            return []

    async def get_notation(self, song_number: int) -> Notation | None:
        seeded = notations_by_song_number().get(song_number)
        if seeded is not None:
            return seeded
        try:
            result = await self.session.execute(
                select(Notation).where(Notation.song_number == song_number)
            )
            return result.scalar_one_or_none()
        except SQLAlchemyError:
            await self.session.rollback()
            return None

    async def inventory(self, limit: int = 100, offset: int = 0) -> list[InventoryItem]:
        snapshot = self._seed_inventory()
        try:
            count_result = await self.session.execute(
                select(func.count()).select_from(InventoryItem)
            )
            if int(count_result.scalar_one()) < len(snapshot):
                return snapshot[offset : offset + limit]
            result = await self.session.execute(
                select(InventoryItem)
                .order_by(
                    InventoryItem.source_kind,
                    InventoryItem.title,
                )
                .limit(limit)
                .offset(offset)
            )
            rows = list(result.scalars().all())
            if rows:
                return rows
        except SQLAlchemyError:
            await self.session.rollback()
        return snapshot[offset : offset + limit]

    async def statistics(self) -> dict[str, Any]:
        snapshot = {
            "songs": len(catalog_song_snapshot()),
            "media": len(catalog_media_snapshot()),
            "notations": len(catalog_notation_snapshot()),
            "inventory": len(catalog_inventory_snapshot()),
        }
        database = {
            "songs": 0,
            "media": 0,
            "notations": 0,
            "inventory": 0,
            "rag_song_chunks": 0,
            "rag_chunks": 0,
            "embedded_songs": 0,
            "embedded_chunks": 0,
        }
        try:
            for key, model in (
                ("songs", Song),
                ("media", Media),
                ("notations", Notation),
                ("inventory", InventoryItem),
            ):
                result = await self.session.execute(select(func.count()).select_from(model))
                database[key] = int(result.scalar_one())
            chunked = await self.session.execute(
                select(func.count(func.distinct(SongChunk.song_number)))
            )
            database["rag_song_chunks"] = int(chunked.scalar_one())
            chunk_count = await self.session.execute(select(func.count()).select_from(SongChunk))
            database["rag_chunks"] = int(chunk_count.scalar_one())
            faiss_stats = get_faiss_store().stats()
            database["embedded_songs"] = int(faiss_stats["songs"])
            database["embedded_chunks"] = int(faiss_stats["chunks"])
        except SQLAlchemyError:
            await self.session.rollback()
        return {"snapshot": snapshot, "database": database}
