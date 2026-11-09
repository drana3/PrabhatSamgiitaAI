import asyncio
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Response
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.db import get_session
from app.services.catalog import CatalogService
from app.services.embedding_index import embedding_provider_configured
from app.services.faiss_store import get_faiss_store
from app.services.server_tools import tools_summary

router = APIRouter(tags=["health"])


@router.get("/health")
@router.get("/health/live")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/health/deep")
async def deep_health(
    session: Annotated[AsyncSession, Depends(get_session)], response: Response
) -> dict[str, Any]:
    """For an uptime monitor (docs/observability.md): 200 when the database answers, 503 when not.

    It names no secret, no host and no row count, only whether each part works, plus the version.
    """
    settings = get_settings()
    checks: dict[str, str] = {}
    try:
        await asyncio.wait_for(session.execute(text("SELECT 1")), timeout=4.0)
        checks["database"] = "ok"
    except (TimeoutError, Exception):
        checks["database"] = "down"
    checks["recording_storage"] = (
        "configured"
        if settings.recording_storage_backend.lower() == "s3" and settings.recording_s3_bucket
        else settings.recording_storage_backend.lower()
    )
    healthy = checks["database"] == "ok"
    if not healthy:
        response.status_code = 503
    return {
        "status": "ok" if healthy else "down",
        "version": settings.app_version,
        "environment": settings.app_env,
        "checks": checks,
        # yes/no per helper program (ffmpeg, fpcalc, ClamAV, tzdata); details: /admin/server-tools
        "tools": tools_summary(settings),
    }


@router.get("/health/readiness")
@router.get("/health/ready")
async def readiness(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> dict[str, Any]:
    settings = get_settings()
    try:
        stats = await asyncio.wait_for(CatalogService(session).statistics(), timeout=6.0)
    except (TimeoutError, Exception):
        # Neon stalls must not hang Container Apps readiness / mobile song loads.
        return {
            "status": "degraded",
            "catalog_serving_source": "packaged_snapshot",
            "snapshot_complete": True,
            "database_synced": False,
            "rag_chunks_ready": False,
            "embedding_provider_configured": embedding_provider_configured(settings),
            "embedding_progress": 0.0,
            "song_embedding_progress": 0.0,
            "chunk_embedding_progress": 0.0,
            "vector_index_ready": False,
            "database_unreachable": True,
        }
    snapshot = stats["snapshot"]
    database = stats["database"]
    snapshot_complete = snapshot["songs"] >= 5018
    database_synced = all(
        database[key] >= snapshot[key] for key in ("songs", "media", "notations", "inventory")
    )
    rag_chunked = database["rag_song_chunks"] >= snapshot["songs"]
    embedded_songs = database["embedded_songs"]
    rag_chunks = database["rag_chunks"]
    song_embedding_progress = (
        round(embedded_songs / snapshot["songs"], 4) if snapshot["songs"] else 0.0
    )
    chunk_embedding_progress = (
        round(database["embedded_chunks"] / rag_chunks, 4) if rag_chunks else 0.0
    )
    embedding_progress = min(song_embedding_progress, chunk_embedding_progress)
    return {
        "status": (
            "ready" if snapshot_complete and database_synced and rag_chunked else "degraded"
        ),
        "catalog_serving_source": "database" if database_synced else "packaged_snapshot",
        "snapshot_complete": snapshot_complete,
        "database_synced": database_synced,
        "rag_chunks_ready": rag_chunked,
        "embedding_provider_configured": embedding_provider_configured(settings),
        "embedding_progress": embedding_progress,
        "song_embedding_progress": song_embedding_progress,
        "chunk_embedding_progress": chunk_embedding_progress,
        "vector_index_ready": get_faiss_store().ready() and embedding_progress >= 1.0,
        **stats,
    }
