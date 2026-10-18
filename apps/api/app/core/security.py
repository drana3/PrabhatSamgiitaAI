from __future__ import annotations

import hashlib
import hmac
from collections import defaultdict, deque
from time import monotonic
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import APIKeyHeader

from app.config import Settings, get_settings

admin_key_header = APIKeyHeader(name="X-Admin-Key", auto_error=False)
admin_attempts: dict[str, deque[float]] = defaultdict(deque)
public_attempts: dict[str, deque[float]] = defaultdict(deque)


def hash_admin_api_key(value: str) -> str:
    return f"sha256:{hashlib.sha256(value.encode('utf-8')).hexdigest()}"


def _rate_limit(client_key: str, limit: int = 30, window_seconds: int = 60) -> None:
    now = monotonic()
    attempts = admin_attempts[client_key]
    while attempts and attempts[0] <= now - window_seconds:
        attempts.popleft()
    if len(attempts) >= limit:
        raise HTTPException(status_code=429, detail="Too many admin requests")
    attempts.append(now)


def require_public_quota(
    request: Request,
    *,
    bucket: str,
    limit: int,
    window_seconds: int = 60,
) -> None:
    """Bound expensive public operations before retrieval or model calls."""
    host = request.client.host if request.client else "unknown"
    key = f"{bucket}:{host}"
    now = monotonic()
    attempts = public_attempts[key]
    while attempts and attempts[0] <= now - window_seconds:
        attempts.popleft()
    if len(attempts) >= limit:
        raise HTTPException(
            status_code=429,
            detail="Please wait a moment before trying again.",
        )
    attempts.append(now)


async def require_admin(
    request: Request,
    provided_key: Annotated[str | None, Depends(admin_key_header)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> str:
    _rate_limit(request.client.host if request.client else "unknown")
    configured = settings.admin_api_key_hash
    if not configured:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Admin API is not configured",
        )
    expected = configured if configured.startswith("sha256:") else f"sha256:{configured}"
    supplied = hash_admin_api_key(provided_key or "")
    if not hmac.compare_digest(supplied, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid admin credentials",
        )
    return "api-key-admin"
