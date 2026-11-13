"""Push notifications: register this phone, take it off, and the member's "replies" switch.

Docs: docs/comment-replies.md ("Push"). A phone registers its Expo push token after sign-in and
takes it off at sign-out; the token is never shown back to anyone. Without `PUSH_ENABLED` on the
server everything here still works (so the app can be built and tested first), but nothing is sent.
"""

from __future__ import annotations

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.models import UserAccount
from app.services import push as service
from app.services.members import require_member_identity, sync_member
from app.services.recordings import limiter

router = APIRouter(prefix="/push", tags=["push"])

DatabaseSession = Annotated[AsyncSession, Depends(get_session)]

# Limits that stop a script, not a person (one place each).
REGISTER_PER_HOUR = 30


async def get_member(request: Request, session: DatabaseSession) -> UserAccount:
    return await sync_member(session, require_member_identity(request))


Member = Annotated[UserAccount, Depends(get_member)]


class DeviceIn(BaseModel):
    token: str = Field(min_length=10, max_length=255)
    platform: Literal["ios", "android"]
    # the app's language (en, ru, es): the push is written in it
    language: str | None = Field(default=None, max_length=8)


class DeviceOut(BaseModel):
    registered: bool


class TokenIn(BaseModel):
    token: str = Field(min_length=10, max_length=255)


class PreferencesIn(BaseModel):
    replies: bool


class PreferencesOut(BaseModel):
    replies: bool
    # false when the server has push off: the switch still saves, nothing is sent yet
    server_enabled: bool


@router.put("/devices", response_model=DeviceOut)
async def register_device(payload: DeviceIn, session: DatabaseSession, member: Member) -> DeviceOut:
    limiter.hit("push-register", str(member.id), limit=REGISTER_PER_HOUR, window_seconds=3600)
    token = payload.token.strip()
    if not service.valid_token(token):
        raise HTTPException(
            status_code=422,
            detail={"code": "bad_token", "message": "Not an Expo push token"},
        )
    await service.register_device(session, member.id, token, payload.platform, payload.language)
    return DeviceOut(registered=True)


@router.post("/devices/unregister", response_model=DeviceOut)
async def unregister_device(
    payload: TokenIn, session: DatabaseSession, member: Member
) -> DeviceOut:
    limiter.hit("push-register", str(member.id), limit=REGISTER_PER_HOUR, window_seconds=3600)
    await service.unregister_device(session, member.id, payload.token.strip())
    return DeviceOut(registered=False)


@router.get("/preferences", response_model=PreferencesOut)
async def read_preferences(session: DatabaseSession, member: Member) -> PreferencesOut:
    return PreferencesOut(
        replies=await service.replies_on(session, member.id), server_enabled=service.enabled()
    )


@router.put("/preferences", response_model=PreferencesOut)
async def write_preferences(
    payload: PreferencesIn, session: DatabaseSession, member: Member
) -> PreferencesOut:
    limiter.hit("push-prefs", str(member.id), limit=60, window_seconds=3600)
    await service.set_replies(session, member.id, payload.replies)
    return PreferencesOut(replies=payload.replies, server_enabled=service.enabled())
