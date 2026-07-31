from __future__ import annotations

from collections.abc import Iterable

from sqlalchemy import Select, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import InventoryItem, Media, Notation, Song


class CatalogService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def list_songs(self, limit: int = 50, offset: int = 0) -> list[Song]:
        result = await self.session.execute(select(Song).order_by(Song.number).limit(limit).offset(offset))
        return list(result.scalars().all())

    async def get_song(self, number: int) -> Song | None:
        result = await self.session.execute(select(Song).where(Song.number == number))
        return result.scalar_one_or_none()

    async def search(self, query: str, limit: int = 20) -> list[Song]:
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
        return list(fallback.scalars().all())

    async def related_songs(self, song: Song, limit: int = 6) -> list[Song]:
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

    async def get_media(self, song_number: int) -> list[Media]:
        result = await self.session.execute(select(Media).where(Media.song_number == song_number))
        return list(result.scalars().all())

    async def get_notation(self, song_number: int) -> Notation | None:
        result = await self.session.execute(select(Notation).where(Notation.song_number == song_number))
        return result.scalar_one_or_none()

    async def inventory(self) -> list[InventoryItem]:
        result = await self.session.execute(select(InventoryItem).order_by(InventoryItem.source_kind, InventoryItem.title))
        return list(result.scalars().all())
