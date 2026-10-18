from __future__ import annotations

from collections.abc import AsyncIterator

from fastapi import APIRouter, Query, Request
from fastapi.responses import StreamingResponse

from app.services.media_proxy import stream_allowed_media

router = APIRouter(prefix="/media", tags=["media"])


@router.get("/stream")
async def stream_media(request: Request, url: str = Query(min_length=8)) -> StreamingResponse:
    status_code, headers, client, upstream = await stream_allowed_media(
        url,
        range_header=request.headers.get("range"),
    )

    async def body() -> AsyncIterator[bytes]:
        try:
            async for chunk in upstream.aiter_bytes():
                yield chunk
        finally:
            await upstream.aclose()
            await client.aclose()

    return StreamingResponse(body(), status_code=status_code, headers=headers)
