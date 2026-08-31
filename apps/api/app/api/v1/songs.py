from __future__ import annotations

import re
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.models import Media
from app.models.song import Song
from app.schemas.song import (
    MediaItemResponse,
    SargamAttribution,
    SongDetail,
    SongLocalizationResponse,
    SongSummary,
)
from app.services.catalog import CatalogService
from app.services.localization import LocalizationService
from app.services.media_quality import (
    media_quality_key,
    preferred_audio_url,
    to_media_item_response,
)
from app.services.notation_links import learner_notation_url
from app.services.sargam_capture import (
    is_learner_playable_notation,
    is_notation_enabled,
    sargam_attribution_payload,
)

router = APIRouter(prefix="/songs", tags=["songs"])

CATALOG_SONG_COUNT = 5018


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


def _media(item: Media, *, latest_url: str | None = None) -> MediaItemResponse:
    return to_media_item_response(item, latest_url=latest_url)


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
    limit: int = Query(default=CATALOG_SONG_COUNT, ge=1, le=CATALOG_SONG_COUNT),
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
    media_items = sorted(await service.get_media(number), key=media_quality_key)
    latest_url = preferred_audio_url(media_items)
    rows = [_media(item, latest_url=latest_url) for item in media_items]
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
    media_items = sorted(await service.get_media(number), key=media_quality_key)
    latest_url = preferred_audio_url(media_items)
    media_responses = [_media(item, latest_url=latest_url) for item in media_items]
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
        notation_source_url=learner_notation_url(
            notation.source_url if notation else None,
            *((notation.metadata_json or {}).get("source_urls") or []) if notation else (),
        ),
        notation_verification_status=notation.verification_status if notation else None,
        notation_transposition_available=bool(
            notation
            and is_learner_playable_notation(
                number, notation.verification_status, notation.notation_text, notation.metadata_json
            )
        ),
        notation_enabled=is_notation_enabled(notation.metadata_json if notation else None),
        sargam_attribution=(
            SargamAttribution.model_validate(
                sargam_attribution_payload(notation.metadata_json, notation.verification_status)
            )
            if notation
            and is_notation_enabled(notation.metadata_json)
            and sargam_attribution_payload(notation.metadata_json, notation.verification_status)
            else None
        ),
        metadata_json=metadata_json,
    )
