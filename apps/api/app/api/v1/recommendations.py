from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.schemas.song import RecommendationRequest, SongSummary
from app.services.catalog import CatalogService
from app.services.recommendations import RecommendationContext, RecommendationEngine

router = APIRouter(prefix="/recommendations", tags=["recommendations"])


@router.post("", response_model=list[SongSummary])
async def recommend(
    request: RecommendationRequest, session: AsyncSession = Depends(get_session)
) -> list[SongSummary]:
    catalog = CatalogService(session)
    songs = await catalog.list_songs(limit=500)
    context = RecommendationContext(**request.model_dump())
    engine = RecommendationEngine()
    ranked = sorted(songs, key=lambda song: engine.score(song, context), reverse=True)
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
        for song in ranked[:20]
    ]
