from __future__ import annotations

import json
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import AsyncTTLCache
from app.core.db import get_session
from app.schemas.search import SearchFilters, SearchResponse
from app.schemas.song import SearchRequest, SongSummary
from app.services.search import HybridSearchService

router = APIRouter(prefix="/search", tags=["search"])
simple_search_cache: AsyncTTLCache[list[dict[str, object]]] = AsyncTTLCache(
    ttl_seconds=300,
    maxsize=256,
)
rich_search_cache: AsyncTTLCache[dict[str, object]] = AsyncTTLCache(
    ttl_seconds=300,
    maxsize=256,
)


@router.post("", response_model=list[SongSummary])
async def search(
    request: SearchRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[SongSummary]:
    cache_key = json.dumps({"query": request.query}, sort_keys=True)
    cached = await simple_search_cache.get(cache_key)
    if isinstance(cached, list):
        return [SongSummary.model_validate(item) for item in cached]

    response = await HybridSearchService(session).search(request.query)
    payload = [
        SongSummary(
            number=item.song_number,
            title=item.opening_line or f"Song {item.song_number}",
            first_line=item.opening_line,
            theme=None,
            occasion=None,
            mood=None,
            language=None,
            difficulty=None,
            is_verified=item.verification_status == "officially_verified",
        )
        for item in response.items
    ]
    await simple_search_cache.set(cache_key, [item.model_dump() for item in payload])
    return payload


@router.get("", response_model=SearchResponse)
async def search_rich(
    session: Annotated[AsyncSession, Depends(get_session)],
    q: str = Query(min_length=1),
    language: str | None = Query(default=None),
    theme: str | None = Query(default=None),
    occasion: str | None = Query(default=None),
    festival: str | None = Query(default=None),
    season: str | None = Query(default=None),
    difficulty: str | None = Query(default=None),
    verification_status: str | None = Query(default=None),
    has_audio: bool | None = Query(default=None),
    has_video: bool | None = Query(default=None),
    has_notation: bool | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> SearchResponse:
    cache_key = json.dumps(
        {
            "q": q,
            "language": language,
            "theme": theme,
            "occasion": occasion,
            "festival": festival,
            "season": season,
            "difficulty": difficulty,
            "verification_status": verification_status,
            "has_audio": has_audio,
            "has_video": has_video,
            "has_notation": has_notation,
            "page": page,
            "page_size": page_size,
        },
        sort_keys=True,
    )
    cached = await rich_search_cache.get(cache_key)
    if isinstance(cached, dict):
        return SearchResponse.model_validate(cached)

    filters = SearchFilters(
        language=language,
        theme=theme,
        occasion=occasion,
        festival=festival,
        season=season,
        difficulty=difficulty,
        verification_status=verification_status,
        has_audio=has_audio,
        has_video=has_video,
        has_notation=has_notation,
    )
    response = await HybridSearchService(session).search(
        q,
        filters=filters,
        page=page,
        page_size=page_size,
    )
    await rich_search_cache.set(cache_key, response.model_dump())
    return response
