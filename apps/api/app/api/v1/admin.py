from __future__ import annotations

from datetime import date, timedelta
from typing import Annotated, Any

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.core.db import get_session
from app.core.security import require_admin
from app.models import AnalyticsDaily, ContentAudit, Media, Notation, Song
from app.schemas.admin import (
    AdminActionResponse,
    AdminAnalyticsItem,
    AdminAnalyticsSummary,
    AdminMediaUpdate,
    AdminMediaWrite,
    AdminNotationWrite,
    AdminSongUpdate,
    AdminSongWrite,
)
from app.schemas.song import MediaItemResponse, SongSummary
from app.services.embedding_index import build_embedding_indexes

router = APIRouter(prefix="/admin", tags=["admin"])
AdminIdentity = Annotated[str, Depends(require_admin)]
DatabaseSession = Annotated[AsyncSession, Depends(get_session)]


def _song_summary(song: Song) -> SongSummary:
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


def _media_response(media: Media) -> MediaItemResponse:
    metadata = media.metadata_json or {}
    return MediaItemResponse(
        kind=media.kind,
        provider=media.provider,
        title=media.title,
        url=media.url,
        embed_url=media.embed_url,
        verification_status=media.verification_status,
        source_url=media.source_url,
        notes=media.notes,
        external_id=metadata.get("external_id"),
        channel_name=metadata.get("channel_name"),
        source_status=metadata.get("source_status"),
        rights_status=metadata.get("rights_status"),
        availability_status=metadata.get("availability_status"),
        language=metadata.get("language"),
        match_score=metadata.get("match_score"),
    )


def _audit(
    session: AsyncSession,
    *,
    entity_type: str,
    entity_id: str,
    reviewer: str,
    previous_status: str | None,
    new_status: str,
    review_note: str | None,
) -> None:
    session.add(
        ContentAudit(
            entity_type=entity_type,
            entity_id=entity_id,
            reviewer=reviewer,
            previous_status=previous_status,
            new_status=new_status,
            review_note=review_note,
        )
    )


@router.post("/songs", response_model=SongSummary, status_code=status.HTTP_201_CREATED)
async def create_song(
    payload: AdminSongWrite,
    admin: AdminIdentity,
    session: DatabaseSession,
) -> SongSummary:
    existing = await session.scalar(select(Song).where(Song.number == payload.number))
    if existing:
        raise HTTPException(status_code=409, detail="Song number already exists")
    values = payload.model_dump()
    song = Song(**values)
    session.add(song)
    _audit(
        session,
        entity_type="song",
        entity_id=str(payload.number),
        reviewer=admin,
        previous_status=None,
        new_status=payload.canonical_source_status,
        review_note="Created through authenticated admin API",
    )
    await session.commit()
    return _song_summary(song)


@router.put("/songs/{song_number}", response_model=SongSummary)
async def update_song(
    song_number: int,
    payload: AdminSongUpdate,
    admin: AdminIdentity,
    session: DatabaseSession,
) -> SongSummary:
    song = await session.scalar(select(Song).where(Song.number == song_number))
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")
    previous_status = song.canonical_source_status
    values = payload.model_dump(exclude_unset=True)
    review_note = values.pop("review_note", None)
    for field, value in values.items():
        setattr(song, field, value)
    if song.canonical_source_status != previous_status:
        _audit(
            session,
            entity_type="song",
            entity_id=str(song_number),
            reviewer=admin,
            previous_status=previous_status,
            new_status=song.canonical_source_status,
            review_note=review_note,
        )
    await session.commit()
    return _song_summary(song)


@router.post("/media", response_model=MediaItemResponse, status_code=status.HTTP_201_CREATED)
async def create_media(
    payload: AdminMediaWrite,
    admin: AdminIdentity,
    session: DatabaseSession,
) -> MediaItemResponse:
    if not await session.scalar(select(Song.id).where(Song.number == payload.song_number)):
        raise HTTPException(status_code=404, detail="Song not found")
    media = Media(**payload.model_dump())
    session.add(media)
    await session.flush()
    _audit(
        session,
        entity_type="media",
        entity_id=str(media.id),
        reviewer=admin,
        previous_status=None,
        new_status=media.verification_status,
        review_note="Created through authenticated admin API",
    )
    await session.commit()
    return _media_response(media)


@router.put("/media/{media_id}", response_model=MediaItemResponse)
async def update_media(
    media_id: int,
    payload: AdminMediaUpdate,
    admin: AdminIdentity,
    session: DatabaseSession,
) -> MediaItemResponse:
    media = await session.get(Media, media_id)
    if not media:
        raise HTTPException(status_code=404, detail="Media not found")
    previous_status = media.verification_status
    values = payload.model_dump(exclude_unset=True)
    review_note = values.pop("review_note", None)
    for field, value in values.items():
        setattr(media, field, value)
    if media.verification_status != previous_status:
        _audit(
            session,
            entity_type="media",
            entity_id=str(media_id),
            reviewer=admin,
            previous_status=previous_status,
            new_status=media.verification_status,
            review_note=review_note,
        )
    await session.commit()
    return _media_response(media)


@router.post("/media/{media_id}/approve", response_model=AdminActionResponse)
async def approve_media(
    media_id: int,
    admin: AdminIdentity,
    session: DatabaseSession,
) -> AdminActionResponse:
    media = await session.get(Media, media_id)
    if not media:
        raise HTTPException(status_code=404, detail="Media not found")
    previous_status = media.verification_status
    media.verification_status = "human_reviewed"
    metadata: dict[str, Any] = dict(media.metadata_json or {})
    metadata["source_status"] = "verified_community"
    media.metadata_json = metadata
    _audit(
        session,
        entity_type="media",
        entity_id=str(media_id),
        reviewer=admin,
        previous_status=previous_status,
        new_status=media.verification_status,
        review_note="Approved through authenticated admin API",
    )
    await session.commit()
    return AdminActionResponse(status="approved", entity_type="media", entity_id=str(media_id))


@router.post(
    "/notations",
    response_model=AdminActionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_notation(
    payload: AdminNotationWrite,
    admin: AdminIdentity,
    session: DatabaseSession,
) -> AdminActionResponse:
    if not await session.scalar(select(Song.id).where(Song.number == payload.song_number)):
        raise HTTPException(status_code=404, detail="Song not found")
    notation = Notation(**payload.model_dump())
    session.add(notation)
    await session.flush()
    _audit(
        session,
        entity_type="notation",
        entity_id=str(notation.id),
        reviewer=admin,
        previous_status=None,
        new_status=notation.verification_status,
        review_note="Created through authenticated admin API",
    )
    await session.commit()
    return AdminActionResponse(status="created", entity_type="notation", entity_id=str(notation.id))


async def _refresh_embeddings(settings: Settings) -> None:
    await build_embedding_indexes(settings)


@router.post("/reindex", response_model=AdminActionResponse, status_code=status.HTTP_202_ACCEPTED)
async def reindex(
    background_tasks: BackgroundTasks,
    admin: AdminIdentity,
    settings: Annotated[Settings, Depends(get_settings)],
) -> AdminActionResponse:
    background_tasks.add_task(_refresh_embeddings, settings)
    return AdminActionResponse(status="accepted", entity_type="search_index", entity_id="all")


@router.get("/analytics/summary", response_model=AdminAnalyticsSummary)
async def analytics_summary(
    admin: AdminIdentity,
    session: DatabaseSession,
    days: int = Query(default=30, ge=1, le=365),
) -> AdminAnalyticsSummary:
    del admin
    start = (date.today() - timedelta(days=days - 1)).isoformat()
    result = await session.execute(
        select(AnalyticsDaily)
        .where(AnalyticsDaily.metric_date >= start)
        .order_by(AnalyticsDaily.metric_date.desc(), AnalyticsDaily.count.desc())
    )
    return AdminAnalyticsSummary(
        days=days,
        metrics=[
            AdminAnalyticsItem(
                date=item.metric_date,
                metric_type=item.metric_type,
                dimension=item.dimension,
                count=item.count,
            )
            for item in result.scalars().all()
        ],
    )
