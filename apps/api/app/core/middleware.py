from __future__ import annotations

import logging
from time import monotonic
from uuid import uuid4

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.types import ASGIApp

logger = logging.getLogger(__name__)


class RequestContextMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: ASGIApp, max_request_bytes: int) -> None:
        super().__init__(app)
        self.max_request_bytes = max_request_bytes

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        request_id = request.headers.get("X-Request-ID", str(uuid4()))[:128]
        content_length = request.headers.get("content-length")
        try:
            body_too_large = bool(
                content_length and int(content_length) > self.max_request_bytes
            )
        except ValueError:
            body_too_large = True
        if body_too_large:
            return Response(
                content='{"detail":"Request body is too large"}',
                status_code=413,
                media_type="application/json",
                headers={"X-Request-ID": request_id},
            )
        started = monotonic()
        response = await call_next(request)
        duration_ms = round((monotonic() - started) * 1000, 2)
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; frame-src 'self' https://www.youtube.com "
            "https://www.youtube-nocookie.com; media-src 'self' https:; "
            "img-src 'self' data: https:; connect-src 'self' https:"
        )
        logger.info(
            "request_complete",
            extra={
                "request_id": request_id,
                "path": request.url.path,
                "method": request.method,
                "status_code": response.status_code,
                "duration_ms": duration_ms,
            },
        )
        return response
