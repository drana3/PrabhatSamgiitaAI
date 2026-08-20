from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import AsyncTTLCache
from app.core.db import get_session
from app.services.quiz_events import recent_quiz_winners

router = APIRouter(prefix="/quiz", tags=["quiz-events"])
DatabaseSession = Annotated[AsyncSession, Depends(get_session)]
_winners_cache: AsyncTTLCache[list[dict[str, object]]] = AsyncTTLCache(ttl_seconds=120, maxsize=8)


@router.get("/winners")
async def read_quiz_winners(session: DatabaseSession) -> list[dict[str, object]]:
    cached = await _winners_cache.get("recent")
    if cached is not None:
        return cached
    rows = await recent_quiz_winners(session)
    await _winners_cache.set("recent", rows)
    return rows
