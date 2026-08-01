from __future__ import annotations

import json
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import AsyncTTLCache
from app.core.db import get_session
from app.core.security import require_public_quota
from app.schemas.search import SearchFilters, SearchResponse
from app.schemas.song import SearchRequest, SongSummary
from app.services.catalog import catalog_song_snapshot
from app.services.query_guard import assess_query
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
    payload: SearchRequest,
    request: Request,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[SongSummary]:
    require_public_quota(request, bucket="search", limit=40)
    assessment = assess_query(payload.query, max_length=200)
    if not assessment.allowed:
        raise HTTPException(status_code=422, detail=assessment.guidance)
    query = assessment.normalized
    cache_key = json.dumps({"query": query}, sort_keys=True)
    cached = await simple_search_cache.get(cache_key)
    if isinstance(cached, list):
        return [SongSummary.model_validate(item) for item in cached]

    response = await HybridSearchService(session).search(query)
    songs_by_number = {song.number: song for song in catalog_song_snapshot()}
    results: list[SongSummary] = []
    for item in response.items:
        song = songs_by_number.get(item.song_number)
        results.append(
            SongSummary(
                number=item.song_number,
                title=(song.title if song else item.opening_line) or "Title awaiting source review",
                first_line=song.first_line if song else item.opening_line,
                theme=song.theme if song else None,
                occasion=song.occasion if song else None,
                mood=song.mood if song else None,
                language=song.language if song else None,
                difficulty=song.difficulty if song else None,
                is_verified=item.verification_status
                in {"verified", "officially_verified", "human_reviewed"},
            )
        )
    await simple_search_cache.set(cache_key, [item.model_dump() for item in results])
    return results


@router.get("", response_model=SearchResponse)
async def search_rich(
    request: Request,
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
    require_public_quota(request, bucket="search", limit=40)
    assessment = assess_query(q, max_length=200)
    if not assessment.allowed:
        raise HTTPException(status_code=422, detail=assessment.guidance)
    q = assessment.normalized
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
