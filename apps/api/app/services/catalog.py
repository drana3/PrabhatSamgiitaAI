from __future__ import annotations

from sqlalchemy import or_, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import InventoryItem, Media, Notation, Song
from app.services.seed_data import load_rows


class CatalogService:
    def __init__(self, session: AsyncSession):
        self.session = session

    def _seed_songs(self) -> list[Song]:
        rows = load_rows("songs.json")
        return [Song(**row) for row in rows]

    def _seed_media(self) -> list[Media]:
        rows = load_rows("media.json")
        return [Media(**row) for row in rows]

    def _seed_notations(self) -> list[Notation]:
        rows = load_rows("notations.json")
        return [Notation(**row) for row in rows]

    def _seed_inventory(self) -> list[InventoryItem]:
        rows = load_rows("inventory.json")
        return [InventoryItem(**row) for row in rows]

    async def list_songs(self, limit: int = 50, offset: int = 0) -> list[Song]:
        try:
            result = await self.session.execute(
                select(Song).order_by(Song.number).limit(limit).offset(offset)
            )
            rows = list(result.scalars().all())
            if rows:
                return rows
        except SQLAlchemyError:
            pass
        return self._seed_songs()[offset : offset + limit]

    async def get_song(self, number: int) -> Song | None:
        try:
            result = await self.session.execute(select(Song).where(Song.number == number))
            song = result.scalar_one_or_none()
            if song:
                return song
        except SQLAlchemyError:
            pass
        return next((song for song in self._seed_songs() if song.number == number), None)

    async def search(self, query: str, limit: int = 20) -> list[Song]:
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
            fallback = await self.session.execute(
                select(Song)
                .where(
                    or_(
                        Song.title.ilike(f"%{query}%"),
                        Song.first_line.ilike(f"%{query}%"),
                        Song.theme.ilike(f"%{query}%"),
                    )
                )
                .limit(limit)
            )
            rows = list(fallback.scalars().all())
            if rows:
                return rows
        except SQLAlchemyError:
            pass
        query_norm = query.lower().strip()
        seeded = self._seed_songs()
        scored = [
            song
            for song in seeded
            if query_norm in " ".join(
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
        try:
            filters = []
            for field in ("theme", "occasion", "festival", "season", "mood", "language"):
                value = getattr(song, field)
                if value:
                    filters.append(getattr(Song, field) == value)
            if not filters:
                raise SQLAlchemyError("no relation filters")
            result = await self.session.execute(
                select(Song).where(Song.number != song.number).where(or_(*filters)).limit(limit)
            )
            rows = list(result.scalars().all())
            if rows:
                return rows
        except SQLAlchemyError:
            pass
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
        try:
            result = await self.session.execute(
                select(Media).where(Media.song_number == song_number)
            )
            rows = list(result.scalars().all())
            if rows:
                return rows
        except SQLAlchemyError:
            pass
        return [item for item in self._seed_media() if item.song_number == song_number]

    async def get_notation(self, song_number: int) -> Notation | None:
        try:
            result = await self.session.execute(
                select(Notation).where(Notation.song_number == song_number)
            )
            notation = result.scalar_one_or_none()
            if notation:
                return notation
        except SQLAlchemyError:
            pass
        return next(
            (item for item in self._seed_notations() if item.song_number == song_number),
            None,
        )

    async def inventory(self) -> list[InventoryItem]:
        try:
            result = await self.session.execute(
                select(InventoryItem).order_by(
                    InventoryItem.source_kind,
                    InventoryItem.title,
                )
            )
            rows = list(result.scalars().all())
            if rows:
                return rows
        except SQLAlchemyError:
            pass
        return self._seed_inventory()
