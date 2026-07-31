from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.schemas.song import ExplanationRequest
from app.services.catalog import CatalogService
from app.services.streaming import stream_text

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/explain")
async def explain(
    request: ExplanationRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> StreamingResponse:
    song = await CatalogService(session).get_song(request.song_number)
    if not song:
        return StreamingResponse(stream_text(["Song not found."]), media_type="text/event-stream")
    prompt = request.prompt or f"Explain song {song.number}: {song.title}"
    parts = [
        f"Verified song {song.number}: {song.title}.",
        "This response is streamed in chunks from canonical metadata.",
        f"Prompt: {prompt}",
    ]
    return StreamingResponse(stream_text(parts), media_type="text/event-stream")
