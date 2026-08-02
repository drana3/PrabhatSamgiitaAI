from __future__ import annotations

import json
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import AsyncTTLCache
from app.core.db import get_session
from app.core.security import require_public_quota
from app.models import Song
from app.schemas.search import SearchFilters, SearchResponse, SearchResultItem
from app.schemas.song import (
    SearchRequest,
    SongSummary,
    VoiceSearchMatch,
    VoiceSearchRequest,
    VoiceSearchResponse,
)
from app.services.catalog import catalog_song_snapshot
from app.services.query_guard import assess_query
from app.services.search import HybridSearchService, prepare_voice_query

router = APIRouter(prefix="/search", tags=["search"])
simple_search_cache: AsyncTTLCache[list[dict[str, object]]] = AsyncTTLCache(
    ttl_seconds=300,
    maxsize=256,
)
rich_search_cache: AsyncTTLCache[dict[str, object]] = AsyncTTLCache(
    ttl_seconds=300,
    maxsize=256,
)


def _song_summary(item: SearchResultItem, songs_by_number: dict[int, Song]) -> SongSummary:
    song_number = item.song_number
    song = songs_by_number.get(song_number)
    opening_line = item.opening_line
    return SongSummary(
        number=song_number,
        title=(song.title if song else opening_line) or "Title awaiting source review",
        first_line=song.first_line if song else opening_line,
        theme=song.theme if song else None,
        occasion=song.occasion if song else None,
        mood=song.mood if song else None,
        language=song.language if song else None,
        difficulty=song.difficulty if song else None,
        is_verified=item.verification_status
        in {"verified", "officially_verified", "human_reviewed"},
    )


def _voice_confidence(matched_by: list[str], score: float) -> tuple[float, str]:
    methods = set(matched_by)
    if "exact_number" in methods:
        return 0.99, "Exact Prabhat Samgiita number"
    if score >= 3 or {"opening_line", "full_text"} <= methods:
        return 0.96, "Opening words matched the verified song text"
    if "structured_filter" in methods:
        return 0.9, "Matched a reviewed language, festival, or collection"
    if {"full_text", "voice_phonetic"} <= methods:
        return 0.86, "Words and pronunciation matched the song text"
    if {"trigram", "voice_phonetic"} <= methods:
        return 0.76, "Close pronunciation and spelling match"
    if "full_text" in methods:
        return 0.72, "Words matched the song text or meaning"
    if "voice_phonetic" in methods:
        return 0.64, "Pronunciation is close to this song"
    if "vector" in methods:
        return 0.46, "Meaning is similar, but the wording was not an exact match"
    return 0.35, "Possible catalog match"


@router.post("/voice", response_model=VoiceSearchResponse)
async def search_voice(
    payload: VoiceSearchRequest,
    request: Request,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> VoiceSearchResponse:
    require_public_quota(request, bucket="voice-search", limit=30)
    assessment = assess_query(payload.transcript, max_length=200)
    if not assessment.allowed:
        return VoiceSearchResponse(
            heard=assessment.normalized,
            spoken_language=payload.spoken_language,
            interpreted_as="",
            confidence="none",
            guidance=assessment.guidance,
        )

    interpreted_as = prepare_voice_query(assessment.normalized)
    if not interpreted_as:
        return VoiceSearchResponse(
            heard=assessment.normalized,
            spoken_language=payload.spoken_language,
            interpreted_as="",
            confidence="none",
            guidance=(
                "Please say a song number, remembered lyric, feeling, festival, language, "
                "or occasion."
            ),
        )

    # Voice and typed natural-language asks both need meaning search across the
    # full embedding index. Catalog/lexical mode misses feeling queries such as
    # "I am feeling very happy today".
    response = await HybridSearchService(session).search(
        interpreted_as,
        page_size=12,
        input_mode="voice",
        mode="semantic",
    )
    songs_by_number = {song.number: song for song in catalog_song_snapshot()}
    matches: list[VoiceSearchMatch] = []
    for item in response.items[:12]:
        confidence, reason = _voice_confidence(item.matched_by, item.score)
        matches.append(
            VoiceSearchMatch(
                song=_song_summary(item, songs_by_number),
                confidence=confidence,
                match_reason=reason,
            )
        )

    top_confidence = matches[0].confidence if matches else 0
    confidence_label: Literal["high", "medium", "low", "none"] = (
        "high"
        if top_confidence >= 0.85
        else "medium"
        if top_confidence >= 0.62
        else "low"
        if matches
        else "none"
    )
    guidance = None
    if confidence_label == "low":
        guidance = (
            "These are possible meaning matches. Try a song number, a longer lyric line, "
            "or a clearer feeling such as peace, devotion, or joy."
        )
    elif confidence_label == "none":
        guidance = (
            "No confident song match was found. Try a song number, a longer lyric line, "
            "or a feeling such as peace, devotion, or hope."
        )
    return VoiceSearchResponse(
        heard=assessment.normalized,
        spoken_language=payload.spoken_language,
        interpreted_as=interpreted_as,
        confidence=confidence_label,
        matches=matches,
        guidance=guidance,
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
    mode = payload.mode
    cache_key = json.dumps({"query": query, "mode": mode}, sort_keys=True)
    cached = await simple_search_cache.get(cache_key)
    if isinstance(cached, list):
        return [SongSummary.model_validate(item) for item in cached]

    response = await HybridSearchService(session).search(query, mode=mode)
    songs_by_number = {song.number: song for song in catalog_song_snapshot()}
    results: list[SongSummary] = []
    for item in response.items:
        results.append(_song_summary(item, songs_by_number))
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
