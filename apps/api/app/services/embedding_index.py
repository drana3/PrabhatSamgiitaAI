from __future__ import annotations

import asyncio
import logging
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.core.db import SessionLocal
from app.models import Song, SongChunk
from app.services.ai import GroundedProvider, select_provider

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


async def index_song_batch(
    session: AsyncSession,
    provider: GroundedProvider,
    batch_size: int = 64,
) -> int:
    try:
        result = await session.execute(
            select(Song)
            .where(Song.embeddings.is_(None))
            .order_by(Song.number)
            .limit(batch_size)
            .with_for_update(skip_locked=True)
        )
        songs = list(result.scalars().all())
        if not songs:
            await session.rollback()
            return 0
        vectors = await provider.embed_many([song_embedding_text(song) for song in songs])
        for song, vector in zip(songs, vectors, strict=True):
            song.embeddings = vector
        await session.commit()
        return len(songs)
    except Exception:
        await session.rollback()
        raise


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


async def index_chunk_batch(
    session: AsyncSession,
    provider: GroundedProvider,
    batch_size: int = 64,
) -> int:
    try:
        result = await session.execute(
            select(SongChunk)
            .where(SongChunk.embeddings.is_(None))
            .order_by(SongChunk.song_number, SongChunk.chunk_index)
            .limit(batch_size)
            .with_for_update(skip_locked=True)
        )
        chunks = list(result.scalars().all())
        if not chunks:
            await session.rollback()
            return 0
        vectors = await provider.embed_many([chunk_embedding_text(chunk) for chunk in chunks])
        for chunk, vector in zip(chunks, vectors, strict=True):
            chunk.embeddings = vector
        await session.commit()
        return len(chunks)
    except Exception:
        await session.rollback()
        raise


async def _build_index(
    provider: GroundedProvider,
    label: str,
    index_batch: Any,
    throttle_seconds: float,
) -> None:
    indexed = 0
    while True:
        try:
            async with SessionLocal() as session:
                batch_count = await index_batch(session, provider)
            if batch_count == 0:
                logger.info("%s embedding index is complete", label)
                return
            indexed += batch_count
            if indexed == batch_count or indexed % 512 == 0:
                logger.info("Indexed %s %s embeddings in this run", indexed, label)
            await asyncio.sleep(throttle_seconds)
        except Exception:
            logger.exception("%s embedding batch failed; retrying later", label)
            await asyncio.sleep(30)


async def build_embedding_indexes(settings: Settings) -> None:
    if not embedding_provider_configured(settings):
        logger.info("Embedding index disabled because no embedding provider is configured")
        return
    provider = select_provider(settings)
    # The pauses keep sustained throughput below the configured Azure OpenAI TPM quota.
    await _build_index(provider, "song", index_song_batch, throttle_seconds=7)
    await _build_index(provider, "RAG chunk", index_chunk_batch, throttle_seconds=3)
