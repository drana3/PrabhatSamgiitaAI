from __future__ import annotations

import re
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
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
from app.services.localization import (
    LocalizationService,
    LocalizedSongText,
    localized_response_cache,
)
from app.services.lyrics_theme import (
    extract_trailing_english_theme,
    strip_trailing_theme_from_devanagari,
)
from app.services.media_quality import (
    client_media_items,
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
from app.services.song_meanings import normalize_language_code

router = APIRouter(prefix="/songs", tags=["songs"])

CATALOG_SONG_COUNT = 5018


def _localized_response_cache_key(number: int, language: str) -> str:
    code = normalize_language_code(language) or language.strip().casefold()
    return f"{number}:{code}"


def _schedule_localized_persist(
    background_tasks: BackgroundTasks,
    song_number: int,
    language_code: str,
    result: LocalizedSongText,
) -> None:
    background_tasks.add_task(
        LocalizationService.persist_localized_detached,
        song_number,
        language_code,
        result,
    )


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


@router.get("/published-sargam", response_model=list[SongSummary])
async def list_published_sargam(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[SongSummary]:
    songs = await CatalogService(session).list_published_sargam_songs()
    return [_summary(song) for song in songs]


@router.get("/{number}/localized", response_model=SongLocalizationResponse)
async def get_localized_song(
    number: int,
    session: Annotated[AsyncSession, Depends(get_session)],
    background_tasks: BackgroundTasks,
    language: str = Query(min_length=2),
    generate_central_idea: bool = Query(
        default=False,
        description=(
            "When true and the song has no official purport, run the slow LLM "
            "Central idea summary. Meaning translation always runs without this."
        ),
    ),
) -> SongLocalizationResponse:
    cache_key = _localized_response_cache_key(number, language)
    # Fast meaning path only — never cache slow LLM Central idea responses.
    if not generate_central_idea:
        cached = await localized_response_cache.get(cache_key)
        if isinstance(cached, dict):
            return SongLocalizationResponse.model_validate(cached)

    service = CatalogService(session)
    song = await service.get_song(number)
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")
    meta = song.metadata_json if isinstance(song.metadata_json, dict) else {}
    # Only official Central idea / Purport — never fall back to english_meaning
    # (that made translated Meaning appear as a fake "Central idea" on most songs).
    purport = meta.get("purport") if isinstance(meta.get("purport"), str) else None
    explanation = (
        (getattr(song, "central_idea", None) or "").strip()
        or (purport.strip() if purport else "")
        or None
    )

    def schedule_persist(
        song_number: int, language_code: str, result: LocalizedSongText
    ) -> None:
        _schedule_localized_persist(background_tasks, song_number, language_code, result)

    localized = await LocalizationService().localize(
        song,
        language,
        explanation=explanation,
        session=session,
        # Official purport still translates (Google) in the fast path.
        # LLM "In simple words" generation is opt-in so Meaning is not blocked.
        generate_missing_central_idea=generate_central_idea,
        schedule_persist=schedule_persist,
    )
    response = SongLocalizationResponse(
        song_number=song.number,
        language=localized.language,
        localized_title=localized.localized_title,
        localized_first_line=localized.localized_first_line,
        localized_meaning=localized.localized_meaning,
        localized_explanation=localized.localized_explanation,
        explanation_kind=localized.explanation_kind,
        provider=localized.provider,
    )
    if not generate_central_idea and response.localized_meaning:
        await localized_response_cache.set(cache_key, response.model_dump(mode="json"))
    return response


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
    media_items = sorted(
        client_media_items(await service.get_media(number)),
        key=media_quality_key,
    )
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
    peeled_theme = None
    if isinstance(lyrics_original, str):
        lyrics_original, peeled_theme = extract_trailing_english_theme(lyrics_original)
        lyrics_original = lyrics_original or None
    theme = summary.theme or peeled_theme
    meta = song.metadata_json or {}
    if isinstance(meta, dict) and meta.get("official_theme_label"):
        theme = str(meta["official_theme_label"]) or theme
    if theme and not summary.theme:
        summary = summary.model_copy(update={"theme": theme})
    transliteration = song.transliteration
    lyrics_devanagari = getattr(song, "lyrics_devanagari", None)
    known_theme = None
    if isinstance(meta, dict) and meta.get("official_theme_label"):
        known_theme = str(meta["official_theme_label"])
    known_theme = known_theme or theme
    lyrics_devanagari = strip_trailing_theme_from_devanagari(
        lyrics_original,
        lyrics_devanagari if isinstance(lyrics_devanagari, str) else None,
        known_theme=known_theme,
    )
    devanagari_status = getattr(song, "devanagari_status", None) or "none"
    hindi_meaning = song.hindi_meaning
    english_meaning = song.english_meaning
    metadata_json = song.metadata_json or {}
    central_idea = (getattr(song, "central_idea", None) or "").strip() or None
    if not central_idea and isinstance(metadata_json, dict):
        purport = metadata_json.get("purport")
        if isinstance(purport, str) and purport.strip():
            central_idea = purport.strip()
    if central_idea:
        from app.services.lyrics_theme import normalize_prose_block

        central_idea = normalize_prose_block(central_idea)
    festival = song.festival
    season = song.season
    meditation_context = song.meditation_context
    raga = song.raga
    tala = song.tala
    harmonium_notation = song.harmonium_notation
    canonical_source_url = song.canonical_source_url
    canonical_source_status = song.canonical_source_status
    related_summaries = [_summary(item) for item in await service.related_songs(song)]
    media_items = sorted(
        client_media_items(await service.get_media(number)),
        key=media_quality_key,
    )
    latest_url = preferred_audio_url(media_items)
    media_responses = [_media(item, latest_url=latest_url) for item in media_items]
    notation = await service.get_notation(number)
    return SongDetail(
        **summary.model_dump(),
        lyrics_original=lyrics_original,
        transliteration=transliteration,
        lyrics_devanagari=lyrics_devanagari,
        devanagari_status=devanagari_status,
        hindi_meaning=hindi_meaning,
        english_meaning=english_meaning,
        central_idea=central_idea,
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
        notation_enabled=is_notation_enabled(
            notation.metadata_json if notation else None,
            verification_status=notation.verification_status if notation else None,
            song_number=number,
        ),
        sargam_attribution=(
            SargamAttribution.model_validate(
                sargam_attribution_payload(notation.metadata_json, notation.verification_status)
            )
            if notation
            and is_notation_enabled(
                notation.metadata_json,
                verification_status=notation.verification_status,
                song_number=number,
            )
            and sargam_attribution_payload(notation.metadata_json, notation.verification_status)
            else None
        ),
        metadata_json=metadata_json,
    )
