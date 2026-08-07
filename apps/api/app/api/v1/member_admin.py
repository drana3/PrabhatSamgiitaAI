from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.models import UserAccount, UserFeedback
from app.schemas.admin import AdminFeedbackItem, AdminFeedbackListResponse, AdminFeedbackUpdate
from app.schemas.admin_workflow import (
    LanguageCheckRequest,
    LanguageCheckResponse,
    SongIngestionItem,
    SongIngestionListResponse,
    SongIngestionPreview,
    SongIngestionReviewWrite,
    SongIngestionWrite,
    TranslateFromEnglishRequest,
    TranslateFromEnglishResponse,
    YoutubeReviewApproveWrite,
    YoutubeReviewItem,
    YoutubeReviewListResponse,
)
from app.schemas.member import AdminGrantWrite, AdminMemberItem, QuizEventCreateWrite
from app.services.admin_members import (
    grant_admin,
    grant_super_admin,
    is_protected_admin,
    list_admin_members,
    require_admin_member,
    require_super_admin_member,
    revoke_admin,
)
from app.services.admin_workflow import (
    approve_youtube_review,
    check_language,
    list_song_ingestions,
    list_youtube_reviews,
    review_song_ingestion,
    song_ingestion_preview,
    submit_song_ingestion,
    sync_youtube_review_queue,
    translate_meaning_from_english,
)
from app.services.feedback_live import (
    feedback_is_on_live_ticker,
    publish_feedback_to_live,
    unpublish_feedback_from_live,
)
from app.services.feedback_triage import feedback_is_priority
from app.services.members import require_member_identity, sync_member
from app.services.quiz_events import (
    create_quiz_event,
    get_quiz_event_admin,
    list_quiz_events,
    publish_quiz_event,
    verify_quiz_event,
)

router = APIRouter(prefix="/members/admin", tags=["member-admin"])
DatabaseSession = Annotated[AsyncSession, Depends(get_session)]


def _admin_item(member: UserAccount) -> AdminMemberItem:
    return AdminMemberItem(
        id=member.id,
        display_name=member.display_name,
        email=member.email,
        is_admin=member.is_admin,
        is_super_admin=member.is_super_admin,
        is_protected=is_protected_admin(member),
    )


async def admin_member(request: Request, session: DatabaseSession) -> UserAccount:
    member = await sync_member(session, require_member_identity(request))
    return await require_admin_member(session, member)


@router.get("/users", response_model=list[AdminMemberItem])
async def admin_users(
    request: Request,
    session: DatabaseSession,
    q: str | None = Query(default=None, max_length=320),
) -> list[AdminMemberItem]:
    await admin_member(request, session)
    if q and q.strip():
        needle = q.strip().casefold()
        rows = list(
            (
                await session.execute(
                    select(UserAccount)
                    .where(
                        UserAccount.deleted_at.is_(None),
                        func.lower(UserAccount.email).contains(needle),
                    )
                    .order_by(UserAccount.is_admin.desc(), UserAccount.display_name.asc())
                    .limit(20)
                )
            ).scalars()
        )
        return [_admin_item(row) for row in rows]
    return [_admin_item(row) for row in await list_admin_members(session)]


@router.post("/grant", response_model=AdminMemberItem)
async def admin_grant(
    payload: AdminGrantWrite, request: Request, session: DatabaseSession
) -> AdminMemberItem:
    await admin_member(request, session)
    member = await grant_admin(session, payload.email)
    return _admin_item(member)


@router.delete("/users/{user_id}", response_model=AdminMemberItem)
async def admin_revoke(
    user_id: UUID, request: Request, session: DatabaseSession
) -> AdminMemberItem:
    actor = await admin_member(request, session)
    member = await revoke_admin(session, user_id, actor)
    return _admin_item(member)


async def _feedback_item(session: AsyncSession, item: UserFeedback) -> AdminFeedbackItem:
    return AdminFeedbackItem(
        feedback_id=str(item.id),
        category=item.category,
        rating=item.rating,
        comment=item.comment,
        page_path=item.page_path,
        contact=item.contact,
        status=item.status,
        created_at=(item.created_at.isoformat() if item.created_at else ""),
        priority=feedback_is_priority(item.category, item.rating),
        on_live_ticker=await feedback_is_on_live_ticker(session, item.comment),
    )


@router.get("/feedback", response_model=AdminFeedbackListResponse)
async def admin_feedback_list(
    request: Request,
    session: DatabaseSession,
    status: str | None = Query(default="new"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> AdminFeedbackListResponse:
    await admin_member(request, session)
    statement = select(UserFeedback)
    count_statement = select(func.count()).select_from(UserFeedback)
    if status and status != "all":
        statement = statement.where(UserFeedback.status == status)
        count_statement = count_statement.where(UserFeedback.status == status)
    total = await session.scalar(count_statement)
    result = await session.execute(
        statement.order_by(UserFeedback.created_at.desc()).offset(offset).limit(limit)
    )
    rows = list(result.scalars().all())
    items = [await _feedback_item(session, item) for item in rows]
    return AdminFeedbackListResponse(total=int(total or 0), items=items)


@router.patch("/feedback/{feedback_id}", response_model=AdminFeedbackItem)
async def admin_feedback_update(
    feedback_id: UUID,
    payload: AdminFeedbackUpdate,
    request: Request,
    session: DatabaseSession,
) -> AdminFeedbackItem:
    await admin_member(request, session)
    feedback = await session.get(UserFeedback, feedback_id)
    if feedback is None:
        raise HTTPException(status_code=404, detail="Feedback not found")
    if payload.status is None and not payload.publish_to_live and not payload.unpublish_from_live:
        raise HTTPException(status_code=400, detail="No feedback update provided")
    # Publish/unpublish before status commit so a failed ticker publish
    # does not silently move the item out of the current filter.
    if payload.publish_to_live:
        try:
            await publish_feedback_to_live(session, feedback)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
    if payload.unpublish_from_live:
        await unpublish_feedback_from_live(session, feedback)
    if payload.status is not None:
        feedback.status = payload.status
        await session.commit()
        await session.refresh(feedback)
    return await _feedback_item(session, feedback)


@router.get("/quiz-events")
async def admin_quiz_events(request: Request, session: DatabaseSession) -> list[dict[str, object]]:
    await admin_member(request, session)
    return await list_quiz_events(session)


@router.post("/quiz-events")
async def admin_create_quiz_event(
    payload: QuizEventCreateWrite, request: Request, session: DatabaseSession
) -> dict[str, object]:
    admin = await admin_member(request, session)
    try:
        event = await create_quiz_event(
            session,
            admin,
            title=payload.title,
            description=payload.description,
            deadline=payload.deadline,
            tags=payload.tags,
            questions=[question.model_dump() for question in payload.questions],
            publish=payload.publish,
        )
        detail = await get_quiz_event_admin(session, event.id)
        return detail or {}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/quiz-events/{event_id}")
async def admin_quiz_event_detail(
    event_id: UUID, request: Request, session: DatabaseSession
) -> dict[str, object]:
    await admin_member(request, session)
    detail = await get_quiz_event_admin(session, event_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="Quiz event not found")
    return detail


@router.post("/quiz-events/{event_id}/publish")
async def admin_publish_quiz_event(
    event_id: UUID, request: Request, session: DatabaseSession
) -> dict[str, object]:
    await admin_member(request, session)
    try:
        await publish_quiz_event(session, event_id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    detail = await get_quiz_event_admin(session, event_id)
    return detail or {}


@router.post("/quiz-events/{event_id}/verify")
async def admin_verify_quiz_event(
    event_id: UUID, request: Request, session: DatabaseSession
) -> dict[str, object]:
    await admin_member(request, session)
    try:
        await verify_quiz_event(session, event_id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    detail = await get_quiz_event_admin(session, event_id)
    return detail or {}


@router.post("/grant-super-admin", response_model=AdminMemberItem)
async def admin_grant_super_admin(
    payload: AdminGrantWrite, request: Request, session: DatabaseSession
) -> AdminMemberItem:
    actor = await admin_member(request, session)
    await require_super_admin_member(session, actor)
    member = await grant_super_admin(session, payload.email)
    return _admin_item(member)


@router.post("/youtube-reviews/sync")
async def admin_sync_youtube_reviews(request: Request, session: DatabaseSession) -> dict[str, int]:
    await admin_member(request, session)
    imported = await sync_youtube_review_queue(session)
    return {"imported": imported}


@router.get("/youtube-reviews", response_model=YoutubeReviewListResponse)
async def admin_list_youtube_reviews(
    request: Request,
    session: DatabaseSession,
    status: str = Query(default="pending_review"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> YoutubeReviewListResponse:
    await admin_member(request, session)
    total, rows = await list_youtube_reviews(session, status=status, limit=limit, offset=offset)
    return YoutubeReviewListResponse(
        total=total,
        items=[
            YoutubeReviewItem(
                id=str(row.id),
                external_id=row.external_id,
                title=row.title,
                url=row.url,
                channel_name=row.channel_name,
                candidate_song_number=row.candidate_song_number,
                title_similarity=row.title_similarity,
                review_reason=row.review_reason,
                status=row.status,
                created_at=row.created_at.isoformat() if row.created_at else "",
            )
            for row in rows
        ],
    )


@router.post("/youtube-reviews/{review_id}/approve")
async def admin_approve_youtube_review(
    review_id: UUID,
    payload: YoutubeReviewApproveWrite,
    request: Request,
    session: DatabaseSession,
) -> dict[str, str]:
    reviewer = await admin_member(request, session)
    media = await approve_youtube_review(session, review_id, reviewer, payload)
    return {"status": "approved", "media_id": str(media.id)}


@router.get("/ingestions/preview", response_model=SongIngestionPreview)
async def admin_ingestion_preview(
    request: Request,
    session: DatabaseSession,
    song_number: int = Query(ge=1, le=5018),
) -> SongIngestionPreview:
    await admin_member(request, session)
    return await song_ingestion_preview(session, song_number)


@router.post("/ingestions/check-language", response_model=LanguageCheckResponse)
async def admin_check_ingestion_language(
    payload: LanguageCheckRequest,
    request: Request,
    session: DatabaseSession,
) -> LanguageCheckResponse:
    await admin_member(request, session)
    ok, message = check_language(payload.language, payload.text)
    return LanguageCheckResponse(ok=ok, message=message)


@router.post(
    "/ingestions/translate-from-english",
    response_model=TranslateFromEnglishResponse,
)
async def admin_translate_ingestion_from_english(
    payload: TranslateFromEnglishRequest,
    request: Request,
    session: DatabaseSession,
) -> TranslateFromEnglishResponse:
    await admin_member(request, session)
    return await translate_meaning_from_english(
        session,
        payload.song_number,
        payload.target_language,
        english_text=payload.english_text,
    )


@router.post("/ingestions", response_model=SongIngestionItem, status_code=201)
async def admin_submit_ingestion(
    payload: SongIngestionWrite,
    request: Request,
    session: DatabaseSession,
    allow_warnings: bool = Query(default=False),
) -> SongIngestionItem:
    submitter = await admin_member(request, session)
    submission = await submit_song_ingestion(
        session, submitter, payload, allow_warnings=allow_warnings
    )
    return SongIngestionItem(
        id=str(submission.id),
        song_number=submission.song_number,
        status=submission.status,
        payload=submission.payload_json,
        language_warnings=[str(item) for item in submission.language_warnings or []],
        review_note=submission.review_note,
        submitted_by_email=submitter.email,
        created_at=submission.created_at.isoformat() if submission.created_at else "",
    )


@router.get("/ingestions", response_model=SongIngestionListResponse)
async def admin_list_ingestions(
    request: Request,
    session: DatabaseSession,
    status: str = Query(default="pending_super_admin"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> SongIngestionListResponse:
    actor = await admin_member(request, session)
    await require_super_admin_member(session, actor)
    total, rows = await list_song_ingestions(session, status=status, limit=limit, offset=offset)
    return SongIngestionListResponse(
        total=total,
        items=[
            SongIngestionItem(
                id=str(submission.id),
                song_number=submission.song_number,
                status=submission.status,
                payload=submission.payload_json,
                language_warnings=[str(item) for item in submission.language_warnings or []],
                review_note=submission.review_note,
                submitted_by_email=email,
                created_at=submission.created_at.isoformat() if submission.created_at else "",
            )
            for submission, email in rows
        ],
    )


@router.post("/ingestions/{submission_id}/review", response_model=SongIngestionItem)
async def admin_review_ingestion(
    submission_id: UUID,
    payload: SongIngestionReviewWrite,
    request: Request,
    session: DatabaseSession,
) -> SongIngestionItem:
    reviewer = await admin_member(request, session)
    await require_super_admin_member(session, reviewer)
    submission = await review_song_ingestion(
        session,
        submission_id,
        reviewer,
        approve=payload.approve,
        review_note=payload.review_note,
    )
    return SongIngestionItem(
        id=str(submission.id),
        song_number=submission.song_number,
        status=submission.status,
        payload=submission.payload_json,
        language_warnings=[str(item) for item in submission.language_warnings or []],
        review_note=submission.review_note,
        submitted_by_email=reviewer.email,
        created_at=submission.created_at.isoformat() if submission.created_at else "",
    )
