from __future__ import annotations

import asyncio

from app.config import get_settings
from app.core.db import engine
from app.services.embedding_index import build_embedding_indexes


async def reindex() -> None:
    await build_embedding_indexes(get_settings())
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(reindex())
