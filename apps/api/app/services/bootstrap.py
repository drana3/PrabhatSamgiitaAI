from __future__ import annotations

import json
from pathlib import Path
from typing import Any, cast

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models import (
    InventoryItem,
    Media,
    Notation,
    Occasion,
    Season,
    Song,
    SongChunk,
    Theme,
)
from app.services.ai import select_provider
from app.services.rag import build_song_chunks


class BootstrapService:
    def __init__(self, session: AsyncSession, data_dir: Path) -> None:
        self.session = session
        self.data_dir = data_dir

    def _candidate_paths(self, filename: str) -> list[Path]:
        return [
            self.data_dir / "generated" / filename,
            self.data_dir / "seed" / filename,
        ]

    async def _load_rows(
        self, model: type[Any], rows: list[dict[str, Any]], key_field: str
    ) -> None:
        result = await self.session.execute(select(model))
        existing_rows = result.scalars().all()
        existing_keys = {
            getattr(item, key_field)
            for item in existing_rows
            if getattr(item, key_field) is not None
        }
        incoming_keys = {row.get(key_field) for row in rows if row.get(key_field) is not None}
        if not rows:
            return
        if incoming_keys.issubset(existing_keys) and len(existing_rows) >= len(rows):
            return
        if existing_rows:
            await self.session.execute(delete(model))
        for row in rows:
            self.session.add(model(**row))

    async def _load_json(self, filename: str) -> list[dict[str, Any]]:
        for path in self._candidate_paths(filename):
            if path.exists():
                return cast(list[dict[str, Any]], json.loads(path.read_text(encoding="utf-8")))
        return []

    async def ensure_seed_data(self) -> None:
        songs = await self._load_json("songs.json")
        media = await self._load_json("media.json")
        notations = await self._load_json("notations.json")
        inventory = await self._load_json("inventory.json")

        await self._load_rows(Song, songs, "number")
        await self._load_rows(Media, media, "url")
        await self._load_rows(Notation, notations, "source_url")
        await self._load_rows(InventoryItem, inventory, "url")
        await self._seed_lookup_tables()
        await self._ensure_song_embeddings()
        await self._ensure_song_chunks()
        await self.session.commit()

    async def _seed_lookup_tables(self) -> None:
        theme_result = await self.session.execute(select(Theme.id).limit(1))
        if not theme_result.first():
            for slug, name, description in [
                ("devotion", "Devotion", "Songs of devotion and surrender."),
                ("surrender", "Surrender", "Songs of yielding the ego to the divine."),
                ("hope", "Hope", "Songs that lift the spirit."),
                ("courage", "Courage", "Songs of strength and resolve."),
                ("nature", "Nature", "Songs of skies, rivers, seasons, and living earth."),
                ("dawn", "Dawn", "Songs for early-morning meditation and awakening."),
                ("evening", "Evening", "Songs for twilight reflection."),
                ("neohumanism", "NeoHumanism", "Songs of universal inclusion and dignity."),
                (
                    "collective-spirit",
                    "Collective Spirit",
                    "Songs of community and shared purpose.",
                ),
                ("spiritual-longing", "Spiritual Longing", "Songs of yearning for the divine."),
                ("social-service", "Social Service", "Songs of service and uplift."),
                ("ecology", "Ecology", "Songs that honor the living world."),
                ("joy", "Joy", "Songs of celebration and bliss."),
                ("introspection", "Introspection", "Songs of inward reflection."),
            ]:
                self.session.add(Theme(slug=slug, name=name, description=description))

        occasion_result = await self.session.execute(select(Occasion.id).limit(1))
        if not occasion_result.first():
            for slug, name, category, weight in [
                ("morning-meditation", "Morning Meditation", "meditation", 0.95),
                ("evening-meditation", "Evening Meditation", "meditation", 0.9),
                ("collective-gathering", "Collective Gathering", "program", 0.8),
                ("children-programme", "Children's Programme", "program", 0.7),
                ("service-programme", "Service Programme", "service", 0.75),
                ("spiritual-retreat", "Spiritual Retreat", "retreat", 0.85),
                ("environmental-programme", "Environmental Programme", "service", 0.7),
                ("marriage", "Marriage", "life-event", 0.65),
                ("memorial", "Memorial", "life-event", 0.6),
                ("dharma-cakra", "Dharma Cakra", "meditation", 0.95),
            ]:
                self.session.add(
                    Occasion(
                        slug=slug,
                        name=name,
                        category=category,
                        default_weight=weight,
                        requires_human_approval=False,
                        is_active=True,
                    )
                )

        season_result = await self.session.execute(select(Season.id).limit(1))
        if not season_result.first():
            for slug, name, hemisphere, start_month, end_month in [
                ("spring", "Spring", "northern", 3, 5),
                ("summer", "Summer", "northern", 6, 8),
                ("autumn", "Autumn", "northern", 9, 11),
                ("winter", "Winter", "northern", 12, 2),
            ]:
                self.session.add(
                    Season(
                        slug=slug,
                        name=name,
                        hemisphere=hemisphere,
                        start_month=start_month,
                        end_month=end_month,
                    )
                )

    async def _ensure_song_embeddings(self) -> None:
        result = await self.session.execute(
            select(Song.id).where(Song.embeddings.is_(None)).limit(1)
        )
        if not result.first():
            return
        provider = select_provider(get_settings())
        songs_result = await self.session.execute(select(Song).order_by(Song.number))
        for song in songs_result.scalars().all():
            if song.embeddings is not None:
                continue
            text = "\n".join(
                part
                for part in (
                    str(song.number),
                    song.title,
                    song.first_line,
                    song.lyrics_original,
                    song.transliteration,
                    song.english_meaning,
                    song.hindi_meaning,
                )
                if part
            )
            song.embeddings = await provider.embed(text)

    async def _ensure_song_chunks(self) -> None:
        result = await self.session.execute(select(SongChunk.id).limit(1))
        if result.first():
            return
        songs_result = await self.session.execute(select(Song).order_by(Song.number))
        for song in songs_result.scalars().all():
            for row in build_song_chunks(song):
                self.session.add(SongChunk(**row))
