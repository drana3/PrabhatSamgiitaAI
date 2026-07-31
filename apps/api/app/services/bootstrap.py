from __future__ import annotations

import json
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import InventoryItem, Media, Notation, Song


class BootstrapService:
    def __init__(self, session: AsyncSession, seed_dir: Path) -> None:
        self.session = session
        self.seed_dir = seed_dir

    async def ensure_seed_data(self) -> None:
        result = await self.session.execute(select(Song.id).limit(1))
        if result.first():
            return
        songs_path = self.seed_dir / "songs.json"
        if songs_path.exists():
            songs = json.loads(songs_path.read_text(encoding="utf-8"))
            for row in songs:
                self.session.add(Song(**row))
        media_path = self.seed_dir / "media.json"
        if media_path.exists():
            media = json.loads(media_path.read_text(encoding="utf-8"))
            for row in media:
                self.session.add(Media(**row))
        notation_path = self.seed_dir / "notations.json"
        if notation_path.exists():
            notations = json.loads(notation_path.read_text(encoding="utf-8"))
            for row in notations:
                self.session.add(Notation(**row))
        for inventory_path in (
            self.seed_dir / "inventory.json",
            Path("data/generated/inventory.json"),
        ):
            if inventory_path.exists():
                inventory = json.loads(inventory_path.read_text(encoding="utf-8"))
                for row in inventory:
                    self.session.add(InventoryItem(**row))
        await self.session.commit()
