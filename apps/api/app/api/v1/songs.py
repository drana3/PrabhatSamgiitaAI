from __future__ import annotations

import re
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.models import Media
from app.models.song import Song
from app.schemas.song import MediaItemResponse, SongDetail, SongLocalizationResponse, SongSummary
from app.services.catalog import CatalogService
from app.services.localization import LocalizationService

router = APIRouter(prefix="/songs", tags=["songs"])


def _summary(song: Song) -> SongSummary:
    title = song.title
    if re.fullmatch(r"Song\s+\d+", title, flags=re.IGNORECASE):
        title = song.first_line or "Title awaiting source review"
    return SongSummary(
        number=song.number,
        title=title,
        first_line=song.first_line,
        theme=song.theme,
        occasion=song.occasion,
        mood=song.mood,
        language=song.language,
        difficulty=song.difficulty,
        is_verified=song.is_verified,
    )


def _media(item: Media) -> MediaItemResponse:
    metadata = item.metadata_json or {}
    return MediaItemResponse(
        kind=item.kind,
        provider=item.provider,
        title=item.title,
        url=item.url,
        embed_url=item.embed_url,
        verification_status=item.verification_status,
        source_url=item.source_url,
        notes=item.notes,
        external_id=metadata.get("external_id"),
        channel_name=metadata.get("channel_name"),
        source_status=metadata.get("source_status"),
        rights_status=metadata.get("rights_status"),
        availability_status=metadata.get("availability_status"),
        language=metadata.get("language"),
        match_score=metadata.get("match_score"),
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
    explanation = (
        (song.metadata_json or {}).get("purport")
        or song.english_meaning
        or song.hindi_meaning
        or song.first_line
        or song.title
    )
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


@router.get("/{number}/related", response_model=list[SongSummary])
async def get_related_songs(
    number: int,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[SongSummary]:
    service = CatalogService(session)
    song = await service.get_song(number)
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")
    return [_summary(item) for item in await service.related_songs(song)]


@router.get("/{number}/media", response_model=list[MediaItemResponse])
async def get_song_media(
    number: int,
    session: Annotated[AsyncSession, Depends(get_session)],
    media_type: str | None = Query(default=None),
    platform: str | None = Query(default=None),
    source_status: str | None = Query(default=None),
    language: str | None = Query(default=None),
    availability_status: str | None = Query(default=None),
) -> list[MediaItemResponse]:
    service = CatalogService(session)
    if not await service.get_song(number):
        raise HTTPException(status_code=404, detail="Song not found")
    rows = [_media(item) for item in await service.get_media(number)]
    filters = {
        "kind": media_type,
        "provider": platform,
        "source_status": source_status,
        "language": language,
        "availability_status": availability_status,
    }
    for field, value in filters.items():
        if value:
            rows = [item for item in rows if getattr(item, field) == value]
    source_order = {"official": 0, "verified_community": 1, "community": 2}
    rows.sort(
        key=lambda item: (
            source_order.get(item.source_status or item.verification_status, 3),
            -(item.match_score or 0),
            item.title.lower(),
        )
    )
    return rows


@router.get("/{number}", response_model=SongDetail)
async def get_song(
    number: int,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> SongDetail:
    service = CatalogService(session)
    song = await service.get_song(number)
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")
    summary = _summary(song)
    lyrics_original = song.lyrics_original
    transliteration = song.transliteration
    hindi_meaning = song.hindi_meaning
    english_meaning = song.english_meaning
    festival = song.festival
    season = song.season
    meditation_context = song.meditation_context
    raga = song.raga
    tala = song.tala
    harmonium_notation = song.harmonium_notation
    canonical_source_url = song.canonical_source_url
    canonical_source_status = song.canonical_source_status
    metadata_json = song.metadata_json or {}
    related_summaries = [_summary(item) for item in await service.related_songs(song)]
    media_responses = [_media(item) for item in await service.get_media(number)]
    notation = await service.get_notation(number)
    return SongDetail(
        **summary.model_dump(),
        lyrics_original=lyrics_original,
        transliteration=transliteration,
        hindi_meaning=hindi_meaning,
        english_meaning=english_meaning,
        festival=festival,
        season=season,
        meditation_context=meditation_context,
        raga=raga,
        tala=tala,
        harmonium_notation=harmonium_notation,
        canonical_source_url=canonical_source_url,
        canonical_source_status=canonical_source_status,
        related_songs=related_summaries,
        media=media_responses,
        notation_scale=notation.scale if notation else None,
        notation_source_url=notation.source_url if notation else None,
        notation_verification_status=notation.verification_status if notation else None,
        notation_transposition_available=bool(
            notation and notation.notation_text and notation.notation_text.strip().startswith("{")
        ),
        metadata_json=metadata_json,
    )
