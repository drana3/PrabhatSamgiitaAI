from __future__ import annotations

import json
import logging
import re
from typing import Annotated

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.cache import AsyncTTLCache
from app.core.db import get_session
from app.core.security import require_public_quota
from app.schemas.song import ExplanationRequest
from app.services.ai import select_provider
from app.services.catalog import CatalogService
from app.services.conversation import try_conversation_answer
from app.services.direct_answers import try_direct_answer
from app.services.query_guard import assess_query
from app.services.rag import RAGService
from app.services.streaming import stream_text

router = APIRouter(prefix="/ai", tags=["ai"])
explanation_cache: AsyncTTLCache[list[str]] = AsyncTTLCache(ttl_seconds=300, maxsize=256)
logger = logging.getLogger(__name__)


@router.post("/explain")
async def explain(
    payload: ExplanationRequest,
    request: Request,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> StreamingResponse:
    require_public_quota(request, bucket="ai", limit=10)
    catalog = CatalogService(session)
    song = await catalog.get_song(payload.song_number)
    if not song:
        return StreamingResponse(stream_text(["Song not found."]), media_type="text/event-stream")
    prompt = payload.prompt or f"Explain song {song.number}: {song.title}"
    assessment = assess_query(prompt, max_length=800)
    if not assessment.allowed:
        return StreamingResponse(
            stream_text([assessment.guidance]),
            media_type="text/event-stream",
        )
    prompt = assessment.normalized
    history: list[tuple[str, str]] = []
    for turn in payload.history:
        content = " ".join(turn.content.split())
        if turn.role == "user" and not assess_query(content, max_length=2000).allowed:
            continue
        history.append((turn.role, content))
    cache_key = json.dumps(
        {
            "song_number": song.number,
            "prompt": prompt,
            "history": history,
            "profile_context": payload.profile_context,
        },
        sort_keys=True,
    )
    cached = await explanation_cache.get(cache_key)
    if isinstance(cached, list):
        return StreamingResponse(stream_text(cached), media_type="text/event-stream")
    conversation_answer = try_conversation_answer(prompt, history)
    if conversation_answer:
        streamed = [conversation_answer]
        await explanation_cache.set(cache_key, streamed)
        return StreamingResponse(stream_text(streamed), media_type="text/event-stream")
    direct = try_direct_answer(prompt, song)
    if direct:
        streamed = [direct.text, f"Source: {direct.source_label}."]
        await explanation_cache.set(cache_key, streamed)
        return StreamingResponse(stream_text(streamed), media_type="text/event-stream")
    provider = select_provider(get_settings())
    rag = RAGService(session, provider)
    try:
        answer, chunks = await rag.build_grounded_answer(
            song,
            prompt,
            history=history,
            profile_context=payload.profile_context,
        )
    except Exception:  # pragma: no cover - runtime fallback for provider/db issues
        logger.exception("Grounded explanation fallback for song %s", song.number)
        answer = (
            f"Here is a grounded fallback for song {song.number}: {song.title}. "
            f"{song.english_meaning or song.hindi_meaning or song.first_line or ''}".strip()
        )
        chunks = []
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
    streamed = [part for section in parts for part in re.split(r"\n{2,}", section) if part.strip()]
    await explanation_cache.set(cache_key, streamed)
    return StreamingResponse(stream_text(streamed), media_type="text/event-stream")
