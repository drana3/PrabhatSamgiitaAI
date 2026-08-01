from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any, cast

from sqlalchemy import delete, func, insert, select
from sqlalchemy.ext.asyncio import AsyncSession

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
from app.services.rag import build_song_chunks
from app.services.seed_data import load_rows

logger = logging.getLogger(__name__)


class BootstrapService:
    def __init__(self, session: AsyncSession, data_dir: Path) -> None:
        self.session = session
        self.data_dir = data_dir

    def _candidate_paths(self, filename: str) -> list[Path]:
        return [
            self.data_dir / "generated" / filename,
            self.data_dir / "seed" / filename,
        ]

    async def _replace_if_incomplete(
        self, model: type[Any], rows: list[dict[str, Any]], label: str
    ) -> bool:
        if not rows:
            return False
        existing_count = int(
            (await self.session.execute(select(func.count()).select_from(model))).scalar_one()
        )
        if existing_count >= len(rows):
            return False
        logger.info("Synchronizing %s: %s -> %s rows", label, existing_count, len(rows))
        await self.session.execute(delete(model))
        await self.session.execute(insert(model), rows)
        await self.session.commit()
        return True

    async def _load_json(self, filename: str) -> list[dict[str, Any]]:
        merged = load_rows(filename)
        if merged:
            return merged
        for path in self._candidate_paths(filename):
            if path.exists():
                return cast(list[dict[str, Any]], json.loads(path.read_text(encoding="utf-8")))
        return []

    async def ensure_seed_data(self) -> None:
        songs = await self._load_json("songs.json")
        media = await self._load_json("media.json")
        notations = await self._load_json("notations.json")
        inventory = await self._load_json("inventory.json")

        # Catalog data is committed before any RAG indexing. The API can therefore
        # serve all songs even if a later indexing step is interrupted.
        await self._replace_if_incomplete(Song, songs, "songs")
        await self._replace_if_incomplete(Media, media, "media")
        await self._replace_if_incomplete(Notation, notations, "notations")
        await self._replace_if_incomplete(InventoryItem, inventory, "inventory")
        await self._seed_lookup_tables()
        await self.session.commit()
        await self._ensure_song_chunks(songs)

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

    async def _ensure_song_chunks(self, song_rows: list[dict[str, Any]]) -> None:
        indexed_song_count = int(
            (
                await self.session.execute(
                    select(func.count(func.distinct(SongChunk.song_number)))
                )
            ).scalar_one()
        )
        if indexed_song_count >= len(song_rows):
            return
        logger.info(
            "Rebuilding RAG chunks: %s -> %s indexed songs",
            indexed_song_count,
            len(song_rows),
        )
        await self.session.execute(delete(SongChunk))
        await self.session.commit()
        batch: list[dict[str, Any]] = []
        for row in song_rows:
            batch.extend(build_song_chunks(Song(**row)))
            if len(batch) >= 1000:
                await self.session.execute(insert(SongChunk), batch)
                await self.session.commit()
                batch.clear()
        if batch:
            await self.session.execute(insert(SongChunk), batch)
            await self.session.commit()
