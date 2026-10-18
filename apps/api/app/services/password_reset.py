from __future__ import annotations

import hashlib
import secrets
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models import PasswordResetToken, UserCredential
from app.services.acs_email import send_transactional_email
from app.services.local_auth import _hash_password, _normalize_email
from app.services.members import _find_canonical_by_email

RESET_TTL_HOURS = 1
FORGOT_PASSWORD_COOLDOWN_MINUTES = 15


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


async def request_password_reset(session: AsyncSession, email: str) -> None:
    """Always completes without revealing whether the email exists."""
    normalized = _normalize_email(email)
    member = await _find_canonical_by_email(session, normalized)
    if member is None:
        return

    credential = await session.scalar(
        select(UserCredential).where(UserCredential.user_id == member.id)
    )
    if credential is None:
        return

    recent = await session.scalar(
        select(func.count())
        .select_from(PasswordResetToken)
        .where(
            PasswordResetToken.user_id == member.id,
            PasswordResetToken.created_at
            >= datetime.now(UTC) - timedelta(minutes=FORGOT_PASSWORD_COOLDOWN_MINUTES),
            PasswordResetToken.used_at.is_(None),
        )
    )
    if int(recent or 0) > 0:
        return

    raw_token = secrets.token_urlsafe(32)
    token_row = PasswordResetToken(
        user_id=member.id,
        token_hash=_hash_token(raw_token),
        expires_at=datetime.now(UTC) + timedelta(hours=RESET_TTL_HOURS),
    )
    session.add(token_row)
    await session.commit()

    site = get_settings().public_site_url.rstrip("/")
    reset_url = f"{site}/reset-password?token={raw_token}"
    subject = "Reset your Prabhat Samgiita password"
    plain = (
        "You requested a password reset for your Prabhat Samgiita account.\n\n"
        f"Open this link within {RESET_TTL_HOURS} hour(s):\n{reset_url}\n\n"
        "If you did not request this, you can ignore this email."
    )
    html = (
        "<p>You requested a password reset for your Prabhat Samgiita account.</p>"
        f'<p><a href="{reset_url}">Reset your password</a> (expires in {RESET_TTL_HOURS} hour).</p>'
        "<p>If you did not request this, you can ignore this email.</p>"
    )
    if member.email:
        send_transactional_email(
            to_address=member.email,
            subject=subject,
            plain_text=plain,
            html_body=html,
        )


async def complete_password_reset(session: AsyncSession, token: str, password: str) -> None:
    if len(password) < 8:
        raise HTTPException(status_code=422, detail="Password must be at least 8 characters.")

    token_hash = _hash_token(token.strip())
    row = await session.scalar(
        select(PasswordResetToken).where(PasswordResetToken.token_hash == token_hash)
    )
    if row is None or row.used_at is not None:
        raise HTTPException(status_code=400, detail="This reset link is invalid or has expired.")
    if row.expires_at < datetime.now(UTC):
        raise HTTPException(status_code=400, detail="This reset link is invalid or has expired.")

    credential = await session.scalar(
        select(UserCredential).where(UserCredential.user_id == row.user_id)
    )
    if credential is None:
        raise HTTPException(status_code=400, detail="This account cannot reset a password here.")

    credential.password_hash = _hash_password(password)
    row.used_at = datetime.now(UTC)
    await session.commit()
