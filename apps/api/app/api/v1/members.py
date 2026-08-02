from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request, Response
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.models import UserAccount, UserChatMessage, UserFavorite, UserInterestProfile
from app.schemas.member import (
    AnonymousMember,
    ChatMemoryResponse,
    ChatMemoryWrite,
    FavoriteWrite,
    MemberPreferencesWrite,
    MemberProfile,
)
from app.services.members import (
    member_profile,
    recent_chat_memory,
    require_member_identity,
    store_chat_memory,
    sync_member,
)

router = APIRouter(prefix="/members", tags=["members"])
DatabaseSession = Annotated[AsyncSession, Depends(get_session)]


async def current_member(request: Request, session: AsyncSession) -> UserAccount:
    return await sync_member(session, require_member_identity(request))


@router.get("/session", response_model=MemberProfile | AnonymousMember)
async def session_profile(request: Request, session: DatabaseSession) -> MemberProfile:
    member = await current_member(request, session)
    return await member_profile(session, member)


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
    if not member.personalization_enabled:
        return ChatMemoryResponse()
    summary = await store_chat_memory(session, member, payload)
    return ChatMemoryResponse(summary=summary)


@router.get("/chat-memory", response_model=ChatMemoryResponse)
async def read_chat_memory(
    request: Request,
    session: DatabaseSession,
    song_number: int | None = Query(default=None, ge=1, le=5018),
) -> ChatMemoryResponse:
    member = await current_member(request, session)
    summary, turns = await recent_chat_memory(session, member, song_number)
    return ChatMemoryResponse(summary=summary, recent_turns=turns)


@router.delete("/chat-memory", status_code=204)
async def clear_chat_memory(request: Request, session: DatabaseSession) -> Response:
    member = await current_member(request, session)
    await session.execute(delete(UserChatMessage).where(UserChatMessage.user_id == member.id))
    await session.execute(
        delete(UserInterestProfile).where(UserInterestProfile.user_id == member.id)
    )
    await session.commit()
    return Response(status_code=204)


@router.delete("/me", status_code=204)
async def delete_member_data(request: Request, session: DatabaseSession) -> Response:
    member = await current_member(request, session)
    await session.delete(member)
    await session.commit()
    return Response(status_code=204)
