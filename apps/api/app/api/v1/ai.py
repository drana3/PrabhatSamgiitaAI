from __future__ import annotations

import re
from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.db import get_session
from app.schemas.song import ExplanationRequest
from app.services.ai import select_provider
from app.services.catalog import CatalogService
from app.services.rag import RAGService
from app.services.streaming import stream_text

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/explain")
async def explain(
    request: ExplanationRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> StreamingResponse:
    catalog = CatalogService(session)
    song = await catalog.get_song(request.song_number)
    if not song:
        return StreamingResponse(stream_text(["Song not found."]), media_type="text/event-stream")
    prompt = request.prompt or f"Explain song {song.number}: {song.title}"
    provider = select_provider(get_settings())
    rag = RAGService(session, provider)
    answer, chunks = await rag.build_grounded_answer(song, prompt)
    citations = "\n".join(
        f"[{idx}] {chunk.song_number}:{chunk.chunk_index} {chunk.song_title} ({chunk.chunk_type})"
        for idx, chunk in enumerate(chunks, start=1)
    )
    parts = [
        f"Verified song {song.number}: {song.title}.",
        answer,
        "Sources:",
        citations or "No supporting passages were retrieved.",
    ]
    streamed = [
        part
        for section in parts
        for part in re.split(r"\n{2,}", section)
        if part.strip()
    ]
    return StreamingResponse(stream_text(streamed), media_type="text/event-stream")
