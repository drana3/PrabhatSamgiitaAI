"""Dependencies the recording extras' routers share (comments, chord sheets, video links).

One `get_member` / `get_optional_member` for all of them, so they authenticate exactly like the
song comments and the chord proposals (the member identity of the request, synced to an account),
and a test can override them in one place. docs/recording-extras.md.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, HTTPException, Path, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.core.db import get_session
from app.models import UserAccount
from app.models.recordings import PS_SONG_COUNT
from app.services.members import require_member_identity, sync_member, try_member_identity
from app.services.recordings import is_team_member

DatabaseSession = Annotated[AsyncSession, Depends(get_session)]
AppSettings = Annotated[Settings, Depends(get_settings)]
SongNumber = Annotated[int, Path(ge=1, le=PS_SONG_COUNT)]


async def get_member(request: Request, session: DatabaseSession) -> UserAccount:
    return await sync_member(session, require_member_identity(request))


async def get_optional_member(request: Request, session: DatabaseSession) -> UserAccount | None:
    identity = try_member_identity(request)
    return await sync_member(session, identity) if identity else None


Member = Annotated[UserAccount, Depends(get_member)]
OptionalMember = Annotated[UserAccount | None, Depends(get_optional_member)]


async def get_team_member(member: Member, settings: AppSettings) -> UserAccount:
    if not is_team_member(member, settings):
        raise HTTPException(status_code=403, detail="Only the team can do this.")
    return member


TeamMember = Annotated[UserAccount, Depends(get_team_member)]


def client_host(request: Request) -> str:
    return request.client.host if request.client else "unknown"
