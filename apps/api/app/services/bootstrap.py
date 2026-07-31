from __future__ import annotations

import json
from pathlib import Path
from typing import Any, cast

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import InventoryItem, Media, Notation, Song


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
        incoming_keys = {
            row.get(key_field) for row in rows if row.get(key_field) is not None
        }
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
        await self.session.commit()
