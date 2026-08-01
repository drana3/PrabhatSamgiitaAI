from typing import Annotated, Any

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.db import get_session
from app.services.catalog import CatalogService
from app.services.embedding_index import embedding_provider_configured

router = APIRouter(tags=["health"])


@router.get("/health")
@router.get("/health/live")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/health/readiness")
@router.get("/health/ready")
async def readiness(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> dict[str, Any]:
    stats = await CatalogService(session).statistics()
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
    settings = get_settings()
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
        "vector_index_ready": embedding_progress >= 1.0,
        **stats,
    }
