from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.schemas.auth import AuthSessionResponse, LocalLoginWrite, LocalRegisterWrite
from app.services.local_auth import login_local_user, register_local_user

router = APIRouter(prefix="/auth", tags=["auth"])
DatabaseSession = Annotated[AsyncSession, Depends(get_session)]
logger = logging.getLogger(__name__)


@router.post("/register", response_model=AuthSessionResponse)
async def register(payload: LocalRegisterWrite, session: DatabaseSession) -> AuthSessionResponse:
    try:
        return await register_local_user(session, payload)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Local registration failed")
        raise HTTPException(
            status_code=503, detail="Registration is temporarily unavailable"
        ) from exc


@router.post("/login", response_model=AuthSessionResponse)
async def login(payload: LocalLoginWrite, session: DatabaseSession) -> AuthSessionResponse:
    try:
        return await login_local_user(session, payload)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Local login failed")
        raise HTTPException(status_code=503, detail="Sign-in is temporarily unavailable") from exc
