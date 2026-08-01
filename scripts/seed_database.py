from __future__ import annotations

import asyncio
from pathlib import Path

from app.core.db import SessionLocal, engine
from app.models import Base
from app.services.bootstrap import BootstrapService

ROOT = Path(__file__).resolve().parents[1]


async def seed() -> None:
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    async with SessionLocal() as session:
        await BootstrapService(session, ROOT / "data").ensure_seed_data()
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
