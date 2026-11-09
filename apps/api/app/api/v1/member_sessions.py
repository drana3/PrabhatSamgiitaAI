"""Sign-in tokens: exchange a provider proof, refresh, sign out (docs/security-member-auth.md)."""

from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.schemas.auth import (
    ProviderExchangeWrite,
    RefreshWrite,
    RevokeWrite,
    TokenPairResponse,
)
from app.services.member_tokens import (
    TokenError,
    refresh_session,
    revoke_all_sessions,
    revoke_session,
    session_tokens_enabled,
    start_session,
)
from app.services.members import (
    TRUST_PROVIDER,
    MemberIdentity,
    require_member_identity,
    sync_member,
)
from app.services.provider_tokens import ProviderTokenError, verify_provider_token
from app.services.rate_limit import enforce_rate_limit

router = APIRouter(prefix="/members/session", tags=["member-session"])
DatabaseSession = Annotated[AsyncSession, Depends(get_session)]
logger = logging.getLogger(__name__)


def _need_tokens() -> None:
    if not session_tokens_enabled():
        raise HTTPException(status_code=503, detail="Token sign-in is not set up on this server")


def _response(member, pair) -> TokenPairResponse:  # type: ignore[no-untyped-def]
    return TokenPairResponse(
        access_token=pair.access_token,
        refresh_token=pair.refresh_token,
        expires_in=pair.expires_in,
        account_id=str(member.id),
        display_name=member.display_name,
        email=member.email,
        identity_provider=member.identity_provider,
        is_admin=bool(member.is_admin),
    )


@router.post("/exchange", response_model=TokenPairResponse)
async def exchange(
    payload: ProviderExchangeWrite, request: Request, session: DatabaseSession
) -> TokenPairResponse:
    """The phone proves who it is with the provider's own signed token; the server issues ours."""
    await enforce_rate_limit(request, "sign_in", session=session)
    _need_tokens()
    try:
        proof = await verify_provider_token(
            payload.provider.casefold(),
            id_token=payload.id_token,
            access_token=payload.access_token,
            nonce=payload.nonce,
        )
    except ProviderTokenError as exc:
        logger.info("provider sign-in refused (%s): %s", payload.provider, exc.reason)
        detail = (
            "Sign-in could not be checked right now"
            if exc.status >= 500
            else "Sign-in proof was not accepted"
        )
        raise HTTPException(status_code=exc.status, detail=detail) from exc
    identity = MemberIdentity(
        subject=f"{proof.provider}:{proof.subject}",
        provider=proof.provider,
        display_name=proof.display_name,
        email=proof.email,
        avatar_url=proof.avatar_url,
        trust=TRUST_PROVIDER,
        email_verified=proof.email_verified,
    )
    member = await sync_member(session, identity)
    pair = await start_session(
        session, member, device_label=payload.device_label, provider=proof.provider
    )
    return _response(member, pair)


@router.post("/refresh", response_model=TokenPairResponse)
async def refresh(
    payload: RefreshWrite, request: Request, session: DatabaseSession
) -> TokenPairResponse:
    await enforce_rate_limit(request, "token_refresh", session=session)
    _need_tokens()
    try:
        member, pair = await refresh_session(session, payload.refresh_token)
    except TokenError as exc:
        logger.info("refresh refused: %s", exc.reason)
        raise HTTPException(status_code=401, detail="Sign in again") from exc
    return _response(member, pair)


@router.post("/revoke", status_code=204)
async def revoke(payload: RevokeWrite, request: Request, session: DatabaseSession) -> Response:
    """Sign out this device (or every device). Needs the access token of the person signing out."""
    identity = require_member_identity(request)
    if identity.session_id is None or identity.account_id is None:
        raise HTTPException(status_code=401, detail="Sign in again")
    member = await sync_member(session, identity)
    if payload.all_devices:
        await revoke_all_sessions(session, member.id)
    else:
        await revoke_session(session, identity.session_id, user_id=member.id)
    return Response(status_code=204)
