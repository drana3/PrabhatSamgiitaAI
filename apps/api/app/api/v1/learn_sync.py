"""Learn progress of a signed-in member: read it, merge changes into it (docs/learn-sync.md).

Member auth is the one every member endpoint uses (X-Member-Proxy-Key + principal, see
docs/security-member-auth.md). A guest has no account and no sync.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.security import require_public_quota
from app.models import UserAccount
from app.schemas.learn_sync import LearnProgressResponse, LearnProgressWrite
from app.services import learn_sync as service
from app.services.members import require_member_identity, sync_member

router = APIRouter(prefix="/members/me/learn-progress", tags=["learn"])

DatabaseSession = Annotated[AsyncSession, Depends(get_session)]


async def get_member(request: Request, session: DatabaseSession) -> UserAccount:
    return await sync_member(session, require_member_identity(request))


Member = Annotated[UserAccount, Depends(get_member)]


@router.get("", response_model=LearnProgressResponse)
async def read_learn_progress(
    request: Request, member: Member, session: DatabaseSession
) -> LearnProgressResponse:
    require_public_quota(request, bucket="learn-sync", limit=60)
    songs, updated_at = await service.read_progress(session, member.id)
    return LearnProgressResponse(songs=songs, updated_at=updated_at)


@router.put("", response_model=LearnProgressResponse)
async def merge_learn_progress(
    payload: LearnProgressWrite,
    request: Request,
    member: Member,
    session: DatabaseSession,
) -> LearnProgressResponse:
    """Merge the entries the phone changed (newest `updated_at` per song wins); return all."""
    require_public_quota(request, bucket="learn-sync", limit=60)
    try:
        songs, updated_at = await service.merge_progress(session, member.id, payload.songs)
    except service.LearnProgressTooLargeError as exc:
        raise HTTPException(
            status_code=413,
            detail="Too many songs in the Learn progress.",
            headers={"X-Error-Code": "learn_progress_too_large"},
        ) from exc
    return LearnProgressResponse(songs=songs, updated_at=updated_at)
