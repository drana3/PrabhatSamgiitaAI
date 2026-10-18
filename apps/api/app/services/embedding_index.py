from __future__ import annotations

import asyncio
import logging
from collections.abc import Awaitable, Callable
from pathlib import Path

import numpy as np
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.core.db import SessionLocal
from app.core.vector import VECTOR_DIMENSION
from app.models import Song, SongChunk
from app.services.ai import GroundedProvider, select_provider
from app.services.faiss_store import download_faiss_snapshot, get_faiss_store

logger = logging.getLogger(__name__)


def embedding_provider_configured(settings: Settings) -> bool:
    azure_ready = bool(
        settings.azure_openai_endpoint
        and settings.azure_openai_api_key
        and settings.azure_openai_embedding_deployment
    )
    return azure_ready or bool(settings.openai_api_key)


def song_embedding_text(song: Song) -> str:
    text = "\n".join(
        part
        for part in (
            f"Prabhat Samgiita song {song.number}",
            song.title,
            song.first_line,
            song.lyrics_original,
            song.transliteration,
            song.english_meaning,
            song.hindi_meaning,
            song.metadata_json.get("purport") if song.metadata_json else None,
        )
        if part
    )
    return text[:24000]


def chunk_embedding_text(chunk: SongChunk) -> str:
    return "\n".join(
        part
        for part in (
            chunk.title,
            f"Prabhat Samgiita song {chunk.song_number}",
            chunk.content,
            chunk.metadata_json.get("song_title") if chunk.metadata_json else None,
            chunk.metadata_json.get("first_line") if chunk.metadata_json else None,
        )
        if part
    )


def load_faiss_snapshot(settings: Settings) -> bool:
    directory = Path(settings.faiss_index_dir)
    store = get_faiss_store()
    if store.load(directory):
        return True
    if settings.faiss_index_url:
        try:
            download_faiss_snapshot(settings.faiss_index_url, directory)
        except Exception:
            logger.exception("Failed to download FAISS snapshot")
            return False
        return store.load(directory)
    return False


async def index_song_batch(
    session: AsyncSession,
    provider: GroundedProvider,
    batch_size: int = 64,
) -> int:
    store = get_faiss_store()
    existing = store.songs.id_set()
    number_rows = await session.execute(select(Song.number).order_by(Song.number))
    pending_numbers = [number for number in number_rows.scalars().all() if number not in existing][
        :batch_size
    ]
    if not pending_numbers:
        return 0
    result = await session.execute(select(Song).where(Song.number.in_(pending_numbers)))
    pending = list(result.scalars().all())
    vectors = await provider.embed_many([song_embedding_text(song) for song in pending])
    store.songs.upsert(
        np.asarray([song.number for song in pending], dtype=np.int64),
        np.asarray(vectors, dtype=np.float32),
    )
    store.save()
    return len(pending)


async def index_chunk_batch(
    session: AsyncSession,
    provider: GroundedProvider,
    batch_size: int = 64,
) -> int:
    store = get_faiss_store()
    existing = store.chunks.id_set()
    id_rows = await session.execute(
        select(SongChunk.id).order_by(SongChunk.song_number, SongChunk.chunk_index)
    )
    pending_ids = [chunk_id for chunk_id in id_rows.scalars().all() if chunk_id not in existing][
        :batch_size
    ]
    if not pending_ids:
        return 0
    result = await session.execute(select(SongChunk).where(SongChunk.id.in_(pending_ids)))
    pending = list(result.scalars().all())
    vectors = await provider.embed_many([chunk_embedding_text(chunk) for chunk in pending])
    store.chunks.upsert(
        np.asarray([chunk.id for chunk in pending], dtype=np.int64),
        np.asarray(vectors, dtype=np.float32),
        np.asarray([chunk.song_number for chunk in pending], dtype=np.int64),
    )
    store.save()
    return len(pending)


async def _build_index(
    provider: GroundedProvider,
    label: str,
    index_batch: Callable[..., Awaitable[int]],
    throttle_seconds: float,
) -> None:
    indexed = 0
    while True:
        try:
            async with SessionLocal() as session:
                batch_count = await index_batch(session, provider)
            if batch_count == 0:
                logger.info("%s FAISS index is complete", label)
                return
            indexed += batch_count
            if indexed == batch_count or indexed % 512 == 0:
                logger.info("Indexed %s %s embeddings into FAISS", indexed, label)
            await asyncio.sleep(throttle_seconds)
        except Exception:
            logger.exception("%s embedding batch failed; retrying later", label)
            await asyncio.sleep(30)


async def build_embedding_indexes(settings: Settings, force: bool = False) -> None:
    store = get_faiss_store()
    if force:
        store.songs.replace(
            np.empty((0,), dtype=np.int64),
            np.empty((0, VECTOR_DIMENSION), dtype=np.float32),
        )
        store.chunks.replace(
            np.empty((0,), dtype=np.int64),
            np.empty((0, VECTOR_DIMENSION), dtype=np.float32),
        )
    else:
        load_faiss_snapshot(settings)
        if store.songs.ntotal > 0 and store.chunks.ntotal > 0:
            logger.info(
                "FAISS snapshot ready (%s songs, %s chunks); skipping re-embed",
                store.songs.ntotal,
                store.chunks.ntotal,
            )
            return
    if not embedding_provider_configured(settings):
        logger.info("Embedding index disabled because no embedding provider is configured")
        return
    provider = select_provider(settings)
    await _build_index(provider, "song", index_song_batch, throttle_seconds=7)
    await _build_index(provider, "RAG chunk", index_chunk_batch, throttle_seconds=3)
