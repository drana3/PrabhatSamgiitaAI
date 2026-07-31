from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.schemas.song import SearchRequest, SongSummary
from app.services.catalog import CatalogService

router = APIRouter(prefix="/search", tags=["search"])


@router.post("", response_model=list[SongSummary])
async def search(request: SearchRequest, session: AsyncSession = Depends(get_session)) -> list[SongSummary]:
    songs = await CatalogService(session).search(request.query)
    return [
        SongSummary(
            number=song.number,
            title=song.title,
            first_line=song.first_line,
            theme=song.theme,
            occasion=song.occasion,
            mood=song.mood,
            language=song.language,
            difficulty=song.difficulty,
            is_verified=song.is_verified,
        )
        for song in songs
    ]
