from __future__ import annotations

import json
import logging
from collections import defaultdict, deque
from dataclasses import asdict
from datetime import date as date_type
from datetime import datetime
from time import monotonic
from typing import Annotated
from uuid import uuid4
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import AsyncTTLCache
from app.core.db import get_session
from app.core.security import require_public_quota
from app.models import (
    AnalyticsDaily,
    CommunityTestimonial,
    ContentReport,
    ReflectionQuote,
    UserFeedback,
)
from app.schemas.discovery import (
    AnalyticsEventRequest,
    CommunityTestimonialResponse,
    ContentReportRequest,
    ContentReportResponse,
    ContextSignalResponse,
    FestivalResponse,
    InspirationStoryDetailResponse,
    InspirationStoryResponse,
    OccasionResponse,
    ReflectionQuoteResponse,
    TodayRecommendationItem,
    TodayResponse,
    UserFeedbackRequest,
    UserFeedbackResponse,
)
from app.services.catalog import CatalogService
from app.services.domain_catalog import (
    OCCASIONS,
    canonical_festivals,
    canonical_timezone,
    fixed_reviewed_festival,
    reviewed_festival_collection_labels,
    reviewed_festival_context,
    reviewed_festival_song_numbers,
    reviewed_humanitarian_collection_labels,
    season_for_month,
    song_numbers_for_collection_labels,
    time_of_day,
)
from app.services.feedback_triage import feedback_acknowledgement, feedback_is_priority
from app.services.recommendations import RecommendationContext, RecommendationEngine
from app.services.reflections import select_reflection
from app.services.stories import (
    InspirationStory,
    get_story_by_slug,
    load_stories,
    select_featured_story,
    stories_for_song,
)
from app.services.world_context import (
    ContextSignal,
    current_india_humanitarian_signals,
    observance_for_day,
)

router = APIRouter(tags=["discovery"])
logger = logging.getLogger(__name__)
ANANDA_MARGA_CALENDAR_URL = "https://india.anandamarga.org/ananda-marga-festivals-imp-days/"
today_cache: AsyncTTLCache[dict[str, object]] = AsyncTTLCache(ttl_seconds=3600, maxsize=128)
report_attempts: dict[str, deque[float]] = defaultdict(deque)
feedback_attempts: dict[str, deque[float]] = defaultdict(deque)
logger = logging.getLogger(__name__)


def enforce_report_rate_limit(client_key: str, limit: int = 5, window: int = 60) -> None:
    now = monotonic()
    attempts = report_attempts[client_key]
    while attempts and attempts[0] <= now - window:
        attempts.popleft()
    if len(attempts) >= limit:
        raise HTTPException(status_code=429, detail="Too many reports; please try again later")
    attempts.append(now)


def enforce_feedback_rate_limit(client_key: str, limit: int = 3, window: int = 300) -> None:
    now = monotonic()
    attempts = feedback_attempts[client_key]
    while attempts and attempts[0] <= now - window:
        attempts.popleft()
    if len(attempts) >= limit:
        raise HTTPException(
            status_code=429, detail="Thank you. Please wait before sending more feedback."
        )
    attempts.append(now)


@router.get("/occasions", response_model=list[OccasionResponse])
async def list_occasions() -> list[OccasionResponse]:
    return [OccasionResponse.model_validate(item) for item in OCCASIONS]


@router.get("/festivals", response_model=list[FestivalResponse])
async def list_festivals() -> list[FestivalResponse]:
    return [FestivalResponse.model_validate(item) for item in canonical_festivals()]


@router.get("/reflections/today", response_model=ReflectionQuoteResponse)
async def reflection_today(
    session: Annotated[AsyncSession, Depends(get_session)],
    date: date_type | None = None,
    theme: str | None = Query(default=None, max_length=80),
) -> ReflectionQuoteResponse:
    local_date = date or datetime.now(ZoneInfo("Asia/Kolkata")).date()
    result = await session.execute(
        select(ReflectionQuote).where(
            ReflectionQuote.is_active.is_(True),
            ReflectionQuote.verification_status == "source_verified",
        )
    )
    quote, context_label = select_reflection(list(result.scalars()), local_date, theme)
    if quote is None:
        raise HTTPException(status_code=404, detail="No source-verified reflection is available")
    return ReflectionQuoteResponse(
        quote_text=quote.quote_text,
        attribution=quote.attribution,
        source_title=quote.source_title,
        source_url=quote.source_url,
        source_date=quote.source_date,
        context_label=context_label,
        verification_status=quote.verification_status,
    )


@router.get("/testimonials", response_model=list[CommunityTestimonialResponse])
async def approved_testimonials(
    session: Annotated[AsyncSession, Depends(get_session)],
    limit: int = Query(default=8, ge=1, le=20),
) -> list[CommunityTestimonialResponse]:
    result = await session.execute(
        select(CommunityTestimonial)
        .where(CommunityTestimonial.status == "approved")
        .order_by(CommunityTestimonial.approved_at.desc())
        .limit(limit)
    )
    return [
        CommunityTestimonialResponse(
            quote_text=item.quote_text,
            display_name=item.display_name,
            display_location=item.display_location,
            avatar_url=item.avatar_url,
        )
        for item in result.scalars()
    ]


def _story_response(story: InspirationStory) -> InspirationStoryResponse:
    return InspirationStoryResponse(
        slug=story.slug,
        title=story.title,
        author=story.author,
        teaser=story.teaser,
        read_path=story.read_path,
        source_url=story.source_url,
        themes=list(story.themes),
        song_numbers=list(story.song_numbers),
    )


def _story_detail_response(story: InspirationStory) -> InspirationStoryDetailResponse:
    return InspirationStoryDetailResponse(
        **_story_response(story).model_dump(),
        body_paragraphs=list(story.body_paragraphs),
    )


@router.get("/stories", response_model=list[InspirationStoryResponse])
async def list_stories(
    session: Annotated[AsyncSession, Depends(get_session)],
    song_number: int | None = Query(default=None, ge=1, le=5018),
    limit: int = Query(default=24, ge=1, le=50),
) -> list[InspirationStoryResponse]:
    stories = await load_stories(session)
    filtered = stories_for_song(stories, song_number) if song_number else stories
    return [_story_response(story) for story in filtered[:limit]]


@router.get("/stories/featured", response_model=InspirationStoryResponse)
async def featured_story(
    session: Annotated[AsyncSession, Depends(get_session)],
    date: date_type | None = None,
) -> InspirationStoryResponse:
    local_date = date or datetime.now(ZoneInfo("Asia/Kolkata")).date()
    stories = await load_stories(session)
    story = select_featured_story(stories, local_date)
    if story is None:
        raise HTTPException(status_code=404, detail="No inspiration stories are available")
    return _story_response(story)


@router.get("/stories/{slug}", response_model=InspirationStoryDetailResponse)
async def story_detail(
    slug: str,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> InspirationStoryDetailResponse:
    story = await get_story_by_slug(session, slug)
    if story is None:
        raise HTTPException(status_code=404, detail="Story not found")
    return _story_detail_response(story)


@router.get("/recommendations/today", response_model=TodayResponse)
async def recommendations_today(
    session: Annotated[AsyncSession, Depends(get_session)],
    timezone: str = Query(default="Asia/Kolkata"),
    date: date_type | None = None,
) -> TodayResponse:
    timezone = canonical_timezone(timezone)
    try:
        zone = ZoneInfo(timezone)
    except ZoneInfoNotFoundError as exc:
        raise HTTPException(status_code=400, detail="Unknown timezone") from exc
    now = datetime.now(zone)
    local_date = date or now.date()
    local_hour = now.hour if date is None else 8
    period = time_of_day(local_hour)
    season = season_for_month(local_date.month)
    festival = fixed_reviewed_festival(local_date.month, local_date.day, local_date.year)
    festival_context = reviewed_festival_context(
        local_date.month,
        local_date.day,
        local_date.year,
    )
    festival_collection_labels = reviewed_festival_collection_labels(
        local_date.month,
        local_date.day,
        local_date.year,
    )
    festival_song_numbers = set(
        reviewed_festival_song_numbers(
            local_date.month,
            local_date.day,
            local_date.year,
        )
    )
    observance = observance_for_day(local_date)
    context = {
        "date": local_date.isoformat(),
        "timezone": timezone,
        "time_of_day": period,
        "season": season,
        "festival": festival,
        "observance": observance.title if observance else None,
        "recommendation_mode": "strict_festival" if festival else "daily_reflection",
        "canonical_collections": list(festival_collection_labels),
    }
    cache_key = json.dumps(context, sort_keys=True)
    cached = await today_cache.get(cache_key)
    if cached:
        return TodayResponse.model_validate(cached)
    news_signals = await current_india_humanitarian_signals()
    humanitarian_collection_labels = reviewed_humanitarian_collection_labels(
        news_signals[0].category if news_signals else None
    )
    canonical_collection_labels = (
        festival_collection_labels or humanitarian_collection_labels
    )
    festival_signal = (
        ContextSignal(
            title=festival,
            category="festival",
            summary=f"A reviewed Ananda Marga observance for {local_date:%d %B %Y}.",
            source_name="Ananda Marga India",
            source_url=ANANDA_MARGA_CALENDAR_URL,
            keywords=(festival, "devotion", "meditation"),
        )
        if festival
        else None
    )
    signals = (
        ([festival_signal] if festival_signal else [])
        + ([observance] if observance else [])
        + news_signals[:1]
    )
    context_keywords = " ".join(keyword for signal in signals for keyword in signal.keywords)
    context["humanitarian_context"] = news_signals[0].category if news_signals else None
    context["canonical_collections"] = list(canonical_collection_labels)
    catalog = CatalogService(session)
    songs = await catalog.list_songs(limit=10000)
    recommendation_context = RecommendationContext(
        date=local_date.isoformat(),
        timezone=timezone,
        occasion=(
            f"{period} meditation {context_keywords}"
            if period in {"morning", "evening"}
            else context_keywords or None
        ),
        festival=festival_context.get("festival"),
        season=season,
        theme=festival_context.get("theme"),
        time_of_day=period,
        meditation_context=" ".join(
            part
            for part in (
                period,
                festival_context.get("meditation_context"),
                context_keywords,
            )
            if part
        ),
        media_preference="audio",
        maximum_results=3,
    )
    engine = RecommendationEngine()
    if canonical_collection_labels:
        eligible_song_numbers = festival_song_numbers or set(
            song_numbers_for_collection_labels(canonical_collection_labels)
        )
        eligible_songs = [song for song in songs if song.number in eligible_song_numbers]
        ranked = await engine.rank_source_constrained(
            session,
            eligible_songs,
            recommendation_context.maximum_results,
        )
    else:
        ranked = await engine.rank(session, songs, recommendation_context)
    items = []
    for item in ranked[:3]:
        media = await catalog.get_media(item.song.number)
        notation = await catalog.get_notation(item.song.number)
        audio = next((row for row in media if row.kind == "audio"), None)
        video = next((row for row in media if row.kind == "video" and row.embed_url), None)
        if canonical_collection_labels:
            reasons = [
                f"From the reviewed {label.removesuffix(' Songs').removesuffix(' Song')} collection"
                for label in canonical_collection_labels
            ]
        else:
            reasons = [signal.title for signal in signals[:1]]
            reasons.extend(
                label.replace("_", " ")
                for label, value in item.breakdown.items()
                if value > 0
            )
        items.append(
            TodayRecommendationItem(
                number=item.song.number,
                title=item.song.title,
                first_line=item.song.first_line,
                score=item.score,
                reasons=reasons[:4] or ["A verified song for reflection"],
                is_verified=item.song.is_verified,
                audio_url=audio.url if audio else None,
                video_embed_url=video.embed_url if video else None,
                notation_available=notation is not None,
            )
        )
    response = TodayResponse(
        context=context,
        recommendations=items,
        signals=[ContextSignalResponse(**asdict(signal)) for signal in signals],
        disclaimer=(
            "Festival selections are restricted to exact reviewed source collections."
            if festival
            else (
                "Daily selections use reviewed metadata and are not presented as "
                "spiritually authoritative."
            )
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


@router.post(
    "/feedback",
    response_model=UserFeedbackResponse,
    status_code=status.HTTP_201_CREATED,
)
async def submit_feedback(
    payload: UserFeedbackRequest,
    request: Request,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> UserFeedbackResponse:
    client_key = request.client.host if request.client else "unknown"
    enforce_feedback_rate_limit(client_key)
    feedback = UserFeedback(
        id=uuid4(),
        category=payload.category,
        rating=payload.rating,
        comment=payload.comment,
        page_path=payload.page_path,
        contact=payload.contact,
        status="new",
    )
    try:
        session.add(feedback)
        await session.commit()
    except SQLAlchemyError as exc:
        await session.rollback()
        raise HTTPException(
            status_code=503, detail="Feedback storage is temporarily unavailable"
        ) from exc
    priority = feedback_is_priority(payload.category, payload.rating)
    log = logger.warning if priority else logger.info
    log(
        "User feedback %s [%s/%s stars]%s on %s: %s",
        feedback.id,
        payload.category,
        payload.rating,
        " PRIORITY" if priority else "",
        payload.page_path or "unknown page",
        payload.comment[:240],
    )
    return UserFeedbackResponse(
        feedback_id=str(feedback.id),
        status="received",
        message=feedback_acknowledgement(str(feedback.id), priority=priority),
    )


@router.post("/analytics/events", status_code=status.HTTP_204_NO_CONTENT)
async def record_analytics_event(
    payload: AnalyticsEventRequest,
    request: Request,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> None:
    require_public_quota(request, bucket="analytics", limit=120)
    statement = pg_insert(AnalyticsDaily).values(
        metric_date=date_type.today().isoformat(),
        metric_type=payload.metric_type,
        dimension=payload.dimension,
        count=1,
    )
    statement = statement.on_conflict_do_update(
        constraint="uq_analytics_daily",
        set_={"count": AnalyticsDaily.count + 1},
    )
    try:
        await session.execute(statement)
        await session.commit()
    except SQLAlchemyError:
        # Analytics must never interrupt the spiritual or learning experience.
        await session.rollback()
