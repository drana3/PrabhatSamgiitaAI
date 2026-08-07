from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.services.quiz_events import recent_quiz_winners

router = APIRouter(prefix="/quiz", tags=["quiz-events"])
DatabaseSession = Annotated[AsyncSession, Depends(get_session)]


@router.get("/winners")
async def read_quiz_winners(session: DatabaseSession) -> list[dict[str, object]]:
    return await recent_quiz_winners(session)
