from __future__ import annotations

from functools import lru_cache
from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import InventoryItem, Media, Notation, Song, SongChunk
from app.services.seed_data import load_rows


@lru_cache(maxsize=1)
def catalog_song_snapshot() -> tuple[Song, ...]:
    return tuple(Song(**row) for row in load_rows("songs.json"))


@lru_cache(maxsize=1)
def catalog_media_snapshot() -> tuple[Media, ...]:
    return tuple(Media(**row) for row in load_rows("media.json"))


@lru_cache(maxsize=1)
def catalog_notation_snapshot() -> tuple[Notation, ...]:
    return tuple(Notation(**row) for row in load_rows("notations.json"))


@lru_cache(maxsize=1)
def catalog_inventory_snapshot() -> tuple[InventoryItem, ...]:
    return tuple(InventoryItem(**row) for row in load_rows("inventory.json"))


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
        return await self._database_song_count() >= len(catalog_song_snapshot())

    async def list_songs(self, limit: int = 50, offset: int = 0) -> list[Song]:
        if not await self._database_catalog_complete():
            return self._seed_songs()[offset : offset + limit]
        try:
            result = await self.session.execute(
                select(Song).order_by(Song.number).limit(limit).offset(offset)
            )
            rows = list(result.scalars().all())
            if rows:
                return rows
        except SQLAlchemyError:
            await self.session.rollback()
        return self._seed_songs()[offset : offset + limit]

    async def get_song(self, number: int) -> Song | None:
        try:
            result = await self.session.execute(select(Song).where(Song.number == number))
            song = result.scalar_one_or_none()
            if song:
                return song
        except SQLAlchemyError:
            await self.session.rollback()
        return next((song for song in self._seed_songs() if song.number == number), None)

    async def search(self, query: str, limit: int = 20) -> list[Song]:
        if await self._database_catalog_complete():
            try:
                terms = [term for term in query.lower().split() if term]
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
        query_norm = query.lower().strip()
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
        return scored[:limit]

    async def related_songs(self, song: Song, limit: int = 6) -> list[Song]:
        if await self._database_catalog_complete():
            try:
                filters = []
                for field in ("theme", "occasion", "festival", "season", "mood", "language"):
                    value = getattr(song, field)
                    if value:
                        filters.append(getattr(Song, field) == value)
                if filters:
                    result = await self.session.execute(
                        select(Song)
                        .where(Song.number != song.number)
                        .where(or_(*filters))
                        .limit(limit)
                    )
                    rows = list(result.scalars().all())
                    if rows:
                        return rows
            except SQLAlchemyError:
                await self.session.rollback()
        seeded = self._seed_songs()
        related: list[Song] = []
        for candidate in seeded:
            if candidate.number == song.number:
                continue
            if any(
                getattr(song, field) and getattr(candidate, field) == getattr(song, field)
                for field in ("theme", "occasion", "festival", "season", "mood", "language")
            ):
                related.append(candidate)
        return related[:limit]

    async def get_media(self, song_number: int) -> list[Media]:
        snapshot = [item for item in self._seed_media() if item.song_number == song_number]
        try:
            result = await self.session.execute(
                select(Media).where(Media.song_number == song_number)
            )
            rows = list(result.scalars().all())
            merged = {item.url: item for item in snapshot}
            merged.update({item.url: item for item in rows})
            return list(merged.values())
        except SQLAlchemyError:
            await self.session.rollback()
        return snapshot

    async def get_notation(self, song_number: int) -> Notation | None:
        try:
            result = await self.session.execute(
                select(Notation).where(Notation.song_number == song_number)
            )
            notation = result.scalar_one_or_none()
            if notation:
                return notation
        except SQLAlchemyError:
            await self.session.rollback()
        return next(
            (item for item in self._seed_notations() if item.song_number == song_number),
            None,
        )

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
            embedded_songs = await self.session.execute(
                select(func.count()).select_from(Song).where(Song.embeddings.is_not(None))
            )
            database["embedded_songs"] = int(embedded_songs.scalar_one())
            embedded_chunks = await self.session.execute(
                select(func.count()).select_from(SongChunk).where(SongChunk.embeddings.is_not(None))
            )
            database["embedded_chunks"] = int(embedded_chunks.scalar_one())
        except SQLAlchemyError:
            await self.session.rollback()
        return {"snapshot": snapshot, "database": database}
