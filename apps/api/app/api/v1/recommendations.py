from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.schemas.song import RecommendationRequest, SongSummary
from app.services.catalog import CatalogService
from app.services.recommendations import RecommendationContext, RecommendationEngine

router = APIRouter(prefix="/recommendations", tags=["recommendations"])
logger = logging.getLogger(__name__)


@router.post("", response_model=list[SongSummary])
async def recommend(
    request: RecommendationRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[SongSummary]:
    catalog = CatalogService(session)
    songs = await catalog.list_songs(limit=10000)
    context = RecommendationContext(**request.model_dump())
    engine = RecommendationEngine()
    ranked = await engine.rank(session, songs, context)
    try:
        await engine.audit(session, context, ranked)
        await session.commit()
    except SQLAlchemyError:
        await session.rollback()
        logger.exception("Skipping recommendation audit persistence")
    return [
        SongSummary(
            number=item.song.number,
            title=item.song.title,
            first_line=item.song.first_line,
            theme=item.song.theme,
            occasion=item.song.occasion,
            mood=item.song.mood,
            language=item.song.language,
            difficulty=item.song.difficulty,
            is_verified=item.song.is_verified,
        )
        for item in ranked[: request.maximum_results]
    ]
