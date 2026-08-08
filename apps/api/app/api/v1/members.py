from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.models import UserAccount, UserFavorite
from app.schemas.member import (
    AnonymousMember,
    ChatMemoryResponse,
    ChatMemoryWrite,
    FavoriteWrite,
    MemberPhoneWrite,
    MemberPreferencesWrite,
    MemberProfile,
    QuizEventSubmitWrite,
    QuizStartResponse,
    QuizStartWrite,
    QuizStatusResponse,
    QuizSubmitResponse,
    QuizSubmitWrite,
)
from app.services.member_phone import set_member_phone
from app.services.members import (
    clear_member_chat_memory,
    member_profile,
    recent_chat_memory,
    require_member_identity,
    store_chat_memory,
    sync_member,
)
from app.services.quiz import quiz_status, start_quiz, submit_quiz
from app.services.quiz_events import (
    event_metadata_for_member,
    start_event_quiz,
    submit_event_quiz,
)

router = APIRouter(prefix="/members", tags=["members"])
DatabaseSession = Annotated[AsyncSession, Depends(get_session)]
logger = logging.getLogger(__name__)


async def current_member(request: Request, session: AsyncSession) -> UserAccount:
    return await sync_member(session, require_member_identity(request))


@router.get("/session", response_model=MemberProfile | AnonymousMember)
async def session_profile(request: Request, session: DatabaseSession) -> MemberProfile:
    try:
        member = await current_member(request, session)
        return await member_profile(session, member)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Member session failed")
        raise HTTPException(
            status_code=503,
            detail="Member session is temporarily unavailable",
        ) from exc


@router.patch("/preferences", response_model=MemberProfile)
async def update_preferences(
    payload: MemberPreferencesWrite, request: Request, session: DatabaseSession
) -> MemberProfile:
    member = await current_member(request, session)
    if payload.preferred_language is not None:
        member.preferred_language = payload.preferred_language
    if payload.country is not None:
        member.country = payload.country
    if payload.personalization_enabled is not None:
        member.personalization_enabled = payload.personalization_enabled
    await session.commit()
    return await member_profile(session, member)


@router.patch("/phone", response_model=MemberProfile)
async def update_phone(
    payload: MemberPhoneWrite, request: Request, session: DatabaseSession
) -> MemberProfile:
    member = await current_member(request, session)
    await set_member_phone(
        session,
        member,
        phone_country_code=payload.phone_country_code,
        phone_number=payload.phone_number,
    )
    return await member_profile(session, member)


@router.get("/favorites", response_model=list[int])
async def favorites(request: Request, session: DatabaseSession) -> list[int]:
    member = await current_member(request, session)
    return list(
        (
            await session.execute(
                select(UserFavorite.song_number)
                .where(UserFavorite.user_id == member.id)
                .order_by(UserFavorite.created_at.desc())
            )
        ).scalars()
    )


@router.post("/favorites", response_model=list[int])
async def add_favorite(
    payload: FavoriteWrite, request: Request, session: DatabaseSession
) -> list[int]:
    member = await current_member(request, session)
    exists = await session.scalar(
        select(UserFavorite.id).where(
            UserFavorite.user_id == member.id,
            UserFavorite.song_number == payload.song_number,
        )
    )
    if exists is None:
        session.add(UserFavorite(user_id=member.id, song_number=payload.song_number))
        await session.commit()
    return await favorites(request, session)


@router.delete("/favorites/{song_number}", response_model=list[int])
async def remove_favorite(
    song_number: int, request: Request, session: DatabaseSession
) -> list[int]:
    member = await current_member(request, session)
    await session.execute(
        delete(UserFavorite).where(
            UserFavorite.user_id == member.id,
            UserFavorite.song_number == song_number,
        )
    )
    await session.commit()
    return await favorites(request, session)


@router.post("/chat-memory", response_model=ChatMemoryResponse)
async def write_chat_memory(
    payload: ChatMemoryWrite, request: Request, session: DatabaseSession
) -> ChatMemoryResponse:
    member = await current_member(request, session)
    # Chat turns always persist for signed-in members so companions restore after
    # sign-out/sign-in. personalization_enabled only gates interest profiling.
    summary = await store_chat_memory(session, member, payload)
    return ChatMemoryResponse(summary=summary)


@router.get("/chat-memory", response_model=ChatMemoryResponse)
async def read_chat_memory(
    request: Request,
    session: DatabaseSession,
    song_number: int | None = Query(default=None, ge=1, le=5018),
) -> ChatMemoryResponse:
    member = await current_member(request, session)
    summary, turns, history_days, archived_summary, monthly_summaries = await recent_chat_memory(
        session, member, song_number
    )
    return ChatMemoryResponse(
        summary=summary,
        recent_turns=turns,
        history_days=history_days,
        archived_summary=archived_summary,
        monthly_summaries=monthly_summaries,
    )


@router.delete("/chat-memory", status_code=204)
async def clear_chat_memory(request: Request, session: DatabaseSession) -> Response:
    member = await current_member(request, session)
    await clear_member_chat_memory(session, member)
    return Response(status_code=204)


@router.delete("/me", status_code=204)
async def delete_member_data(request: Request, session: DatabaseSession) -> Response:
    member = await current_member(request, session)
    await session.delete(member)
    await session.commit()
    return Response(status_code=204)


@router.get("/quiz/status", response_model=QuizStatusResponse)
async def read_quiz_status(request: Request, session: DatabaseSession) -> QuizStatusResponse:
    member = await current_member(request, session)
    return QuizStatusResponse.model_validate(await quiz_status(session, member))


@router.post("/quiz/start", response_model=QuizStartResponse)
async def begin_quiz(
    payload: QuizStartWrite, request: Request, session: DatabaseSession
) -> QuizStartResponse:
    member = await current_member(request, session)
    try:
        return QuizStartResponse.model_validate(await start_quiz(session, member, payload.level))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/quiz/submit", response_model=QuizSubmitResponse)
async def finish_quiz(
    payload: QuizSubmitWrite, request: Request, session: DatabaseSession
) -> QuizSubmitResponse:
    member = await current_member(request, session)
    try:
        result = await submit_quiz(
            session,
            member,
            payload.attempt_id,
            [answer.model_dump() for answer in payload.answers],
        )
        return QuizSubmitResponse.model_validate(result)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/quiz/events/{slug}")
async def read_quiz_event(
    slug: str, request: Request, session: DatabaseSession
) -> dict[str, object]:
    member = await current_member(request, session)
    try:
        return await event_metadata_for_member(session, member, slug)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/quiz/events/{slug}/start")
async def begin_quiz_event(
    slug: str, request: Request, session: DatabaseSession
) -> dict[str, object]:
    member = await current_member(request, session)
    try:
        return await start_event_quiz(session, member, slug)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/quiz/events/{slug}/submit")
async def finish_quiz_event(
    slug: str,
    payload: QuizEventSubmitWrite,
    request: Request,
    session: DatabaseSession,
) -> dict[str, object]:
    member = await current_member(request, session)
    try:
        return await submit_event_quiz(
            session,
            member,
            slug,
            [answer.model_dump() for answer in payload.answers],
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
