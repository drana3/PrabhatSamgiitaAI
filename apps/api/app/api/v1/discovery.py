from __future__ import annotations

import json
from collections import defaultdict, deque
from datetime import date as date_type
from datetime import datetime
from time import monotonic
from typing import Annotated
from uuid import uuid4
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import AsyncTTLCache
from app.core.db import get_session
from app.models import ContentReport
from app.schemas.discovery import (
    ContentReportRequest,
    ContentReportResponse,
    FestivalResponse,
    OccasionResponse,
    TodayRecommendationItem,
    TodayResponse,
)
from app.services.catalog import CatalogService
from app.services.domain_catalog import (
    OCCASIONS,
    canonical_festivals,
    fixed_reviewed_festival,
    season_for_month,
    time_of_day,
)
from app.services.recommendations import RecommendationContext, RecommendationEngine

router = APIRouter(tags=["discovery"])
today_cache: AsyncTTLCache[dict[str, object]] = AsyncTTLCache(ttl_seconds=300, maxsize=128)
report_attempts: dict[str, deque[float]] = defaultdict(deque)


def enforce_report_rate_limit(client_key: str, limit: int = 5, window: int = 60) -> None:
    now = monotonic()
    attempts = report_attempts[client_key]
    while attempts and attempts[0] <= now - window:
        attempts.popleft()
    if len(attempts) >= limit:
        raise HTTPException(status_code=429, detail="Too many reports; please try again later")
    attempts.append(now)


@router.get("/occasions", response_model=list[OccasionResponse])
async def list_occasions() -> list[OccasionResponse]:
    return [OccasionResponse.model_validate(item) for item in OCCASIONS]


@router.get("/festivals", response_model=list[FestivalResponse])
async def list_festivals() -> list[FestivalResponse]:
    return [FestivalResponse.model_validate(item) for item in canonical_festivals()]


@router.get("/recommendations/today", response_model=TodayResponse)
async def recommendations_today(
    session: Annotated[AsyncSession, Depends(get_session)],
    timezone: str = Query(default="Asia/Kolkata"),
    date: date_type | None = None,
) -> TodayResponse:
    try:
        zone = ZoneInfo(timezone)
    except ZoneInfoNotFoundError as exc:
        raise HTTPException(status_code=400, detail="Unknown timezone") from exc
    now = datetime.now(zone)
    local_date = date or now.date()
    local_hour = now.hour if date is None else 8
    period = time_of_day(local_hour)
    season = season_for_month(local_date.month)
    festival = fixed_reviewed_festival(local_date.month, local_date.day)
    context = {
        "date": local_date.isoformat(),
        "timezone": timezone,
        "time_of_day": period,
        "season": season,
        "festival": festival,
    }
    cache_key = json.dumps(context, sort_keys=True)
    cached = await today_cache.get(cache_key)
    if cached:
        return TodayResponse.model_validate(cached)
    songs = await CatalogService(session).list_songs(limit=10000)
    recommendation_context = RecommendationContext(
        date=local_date.isoformat(),
        timezone=timezone,
        occasion=f"{period} meditation" if period in {"morning", "evening"} else None,
        festival=festival,
        season=season,
        time_of_day=period,
        maximum_results=3,
    )
    ranked = await RecommendationEngine().rank(session, songs, recommendation_context)
    items = [
        TodayRecommendationItem(
            number=item.song.number,
            title=item.song.title,
            first_line=item.song.first_line,
            score=item.score,
            reasons=[
                label.replace("_", " ")
                for label, value in item.breakdown.items()
                if value > 0
            ][:4]
            or ["Verified canonical song"],
            is_verified=item.song.is_verified,
        )
        for item in ranked[:3]
    ]
    response = TodayResponse(
        context=context,
        recommendations=items,
        disclaimer=(
            "Recommendations use reviewed metadata and contextual matching; they are not "
            "presented as spiritually authoritative."
        ),
    )
    await today_cache.set(cache_key, response.model_dump(mode="json"))
    return response


@router.post(
    "/reports",
    response_model=ContentReportResponse,
    status_code=status.HTTP_201_CREATED,
)
async def report_content(
    payload: ContentReportRequest,
    request: Request,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ContentReportResponse:
    client_key = request.client.host if request.client else "unknown"
    enforce_report_rate_limit(client_key)
    report = ContentReport(
        id=uuid4(),
        entity_type=payload.entity_type,
        entity_id=payload.entity_id,
        reason=payload.reason,
        comment=payload.comment,
        status="new",
    )
    try:
        session.add(report)
        await session.commit()
    except SQLAlchemyError as exc:
        await session.rollback()
        raise HTTPException(
            status_code=503,
            detail="Report storage temporarily unavailable",
        ) from exc
    return ContentReportResponse(
        report_id=str(report.id),
        status="received",
        message="Thank you. The report is queued for human review.",
    )
