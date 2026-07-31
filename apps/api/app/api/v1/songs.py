from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.db import get_session
from app.models.song import Song
from app.schemas.song import SongDetail, SongLocalizationResponse, SongSummary
from app.services.ai import select_provider
from app.services.catalog import CatalogService
from app.services.localization import LocalizationService
from app.services.rag import RAGService

router = APIRouter(prefix="/songs", tags=["songs"])
logger = logging.getLogger(__name__)


def _summary(song: Song) -> SongSummary:
    return SongSummary(
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


@router.get("/{number}/localized", response_model=SongLocalizationResponse)
async def get_localized_song(
    number: int,
    session: Annotated[AsyncSession, Depends(get_session)],
    language: str = Query(min_length=2),
) -> SongLocalizationResponse:
    service = CatalogService(session)
    song = await service.get_song(number)
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")
    provider = select_provider(get_settings())
    rag = RAGService(session, provider)
    try:
        explanation, _ = await rag.build_grounded_answer(
            song,
            f"Explain song {song.number}: {song.title}",
        )
    except Exception:  # pragma: no cover - runtime fallback for provider/db issues
        logger.exception("Localized explanation fallback for song %s", song.number)
        explanation = song.english_meaning or song.hindi_meaning or song.first_line or song.title
    localized = await LocalizationService().localize(song, language, explanation=explanation)
    return SongLocalizationResponse(
        song_number=song.number,
        language=localized.language,
        localized_title=localized.localized_title,
        localized_first_line=localized.localized_first_line,
        localized_meaning=localized.localized_meaning,
        localized_explanation=localized.localized_explanation,
    )


@router.get("", response_model=list[SongSummary])
async def list_songs(
    session: Annotated[AsyncSession, Depends(get_session)],
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> list[SongSummary]:
    songs = await CatalogService(session).list_songs(limit=limit, offset=offset)
    return [_summary(song) for song in songs]


@router.get("/{number}", response_model=SongDetail)
async def get_song(
    number: int,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> SongDetail:
    service = CatalogService(session)
    song = await service.get_song(number)
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")
    related = await service.related_songs(song)
    media = await service.get_media(number)
    notation = await service.get_notation(number)
    return SongDetail(
        **_summary(song).model_dump(),
        lyrics_original=song.lyrics_original,
        transliteration=song.transliteration,
        hindi_meaning=song.hindi_meaning,
        english_meaning=song.english_meaning,
        festival=song.festival,
        season=song.season,
        meditation_context=song.meditation_context,
        raga=song.raga,
        tala=song.tala,
        harmonium_notation=song.harmonium_notation,
        canonical_source_url=song.canonical_source_url,
        canonical_source_status=song.canonical_source_status,
        related_songs=[_summary(item) for item in related],
        media=[
            {
                "kind": item.kind,
                "provider": item.provider,
                "title": item.title,
                "url": item.url,
                "embed_url": item.embed_url,
                "verification_status": item.verification_status,
                "source_url": item.source_url,
                "notes": item.notes,
            }
            for item in media
        ],
        notation_scale=notation.scale if notation else None,
        metadata_json=song.metadata_json or {},
    )
