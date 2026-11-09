from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.schemas.auth import AuthSessionResponse, LocalLoginWrite, LocalRegisterWrite
from app.schemas.password_reset import ForgotPasswordWrite, MessageResponse, ResetPasswordWrite
from app.services.local_auth import login_local_user, register_local_user
from app.services.password_reset import complete_password_reset, request_password_reset
from app.services.rate_limit import enforce_rate_limit

router = APIRouter(prefix="/auth", tags=["auth"])
DatabaseSession = Annotated[AsyncSession, Depends(get_session)]
logger = logging.getLogger(__name__)


@router.post("/register", response_model=AuthSessionResponse)
async def register(
    payload: LocalRegisterWrite, request: Request, session: DatabaseSession
) -> AuthSessionResponse:
    try:
        return await register_local_user(session, payload, request.headers.get("x-device-label"))
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Local registration failed")
        raise HTTPException(
            status_code=503, detail="Registration is temporarily unavailable"
        ) from exc


@router.post("/login", response_model=AuthSessionResponse)
async def login(
    payload: LocalLoginWrite, request: Request, session: DatabaseSession
) -> AuthSessionResponse:
    # The middleware counts tries per address. This counts them per e-mail AND address, so one
    # place cannot hammer one account, while a stranger typing the owner's e-mail from another
    # address cannot use up the owner's tries (that would be a way to lock someone out).
    await enforce_rate_limit(
        request, "sign_in", key_extra=str(payload.email), ip=False, key_with_ip=True
    )
    try:
        return await login_local_user(session, payload, request.headers.get("x-device-label"))
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Local login failed")
        raise HTTPException(status_code=503, detail="Sign-in is temporarily unavailable") from exc


@router.post("/forgot-password", response_model=MessageResponse)
async def forgot_password(
    payload: ForgotPasswordWrite, request: Request, session: DatabaseSession
) -> MessageResponse:
    # Per e-mail, in a bucket of its own (not the one for signing in), so nobody can fill one
    # inbox with reset links and nobody can block a sign-in by asking for resets.
    await enforce_rate_limit(
        request,
        "password_reset_email",
        key_extra=str(payload.email),
        ip=False,
        key_policy="password_reset_email",
    )
    try:
        await request_password_reset(session, str(payload.email))
    except Exception as exc:
        logger.exception("Forgot-password request failed")
        raise HTTPException(
            status_code=503, detail="Password reset is temporarily unavailable"
        ) from exc
    return MessageResponse(
        message="If an account exists for that email, a reset link has been sent."
    )


@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(payload: ResetPasswordWrite, session: DatabaseSession) -> MessageResponse:
    try:
        await complete_password_reset(session, payload.token, payload.password)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Password reset failed")
        raise HTTPException(
            status_code=503, detail="Password reset is temporarily unavailable"
        ) from exc
    return MessageResponse(message="Your password has been updated. You can sign in now.")
