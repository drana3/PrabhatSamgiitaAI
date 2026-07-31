from __future__ import annotations

import re
from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from math import sqrt
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Song, SongChunk
from app.services.ai import GroundedProvider
from app.services.catalog import CatalogService


@dataclass(slots=True)
class RetrievedChunk:
    song_number: int
    song_title: str
    chunk_index: int
    chunk_type: str
    title: str
    content: str
    source_url: str | None
    metadata_json: dict[str, Any]
    score: float


def clean_text(value: str | None) -> str:
    return " ".join((value or "").split()).strip()


def split_text_blocks(text: str | None, max_chars: int = 900) -> list[str]:
    raw = (text or "").strip()
    if not raw:
        return []
    paragraphs = [part.strip() for part in re.split(r"\n{2,}", raw) if part.strip()]
    if not paragraphs:
        paragraphs = [clean_text(raw)]
    blocks: list[str] = []
    for paragraph in paragraphs:
        paragraph = clean_text(paragraph)
        if len(paragraph) <= max_chars:
            blocks.append(paragraph)
            continue
        words = paragraph.split()
        current = ""
        for word in words:
            candidate = word if not current else f"{current} {word}"
            if current and len(candidate) > max_chars:
                blocks.append(current)
                current = word
            else:
                current = candidate
        if current:
            blocks.append(current)
    return blocks


def build_song_chunks(song: Song) -> list[dict[str, Any]]:
    metadata = song.metadata_json or {}
    chunks: list[dict[str, Any]] = []

    def add_chunk(chunk_type: str, title: str, content: str | None) -> None:
        for part in split_text_blocks(content):
            chunks.append(
                {
                    "song_number": song.number,
                    "chunk_index": len(chunks),
                    "chunk_type": chunk_type,
                    "title": title,
                    "content": part,
                    "source_url": song.canonical_source_url,
                    "metadata_json": {
                        "source": "canonical-song-page",
                        "song_number": song.number,
                        "song_title": song.title,
                        "first_line": song.first_line,
                        **metadata,
                    },
                }
            )

    add_chunk(
        "summary",
        f"Song {song.number}: {song.title}",
        "\n".join(
            part
            for part in (
                f"Song {song.number}.",
                song.title,
                f"First line: {song.first_line}" if song.first_line else "",
                f"Theme: {song.theme}" if song.theme else "",
                f"Occasion: {song.occasion}" if song.occasion else "",
                f"Mood: {song.mood}" if song.mood else "",
                f"Language: {song.language}" if song.language else "",
                f"Context: {song.meditation_context}" if song.meditation_context else "",
            )
            if part
        ),
    )
    add_chunk("lyrics", "Canonical original lyrics", song.lyrics_original)
    add_chunk("transliteration", "Canonical transliteration", song.transliteration)
    add_chunk("meaning", "Canonical English meaning", song.english_meaning)
    add_chunk("meaning", "Canonical Hindi meaning", song.hindi_meaning)
    add_chunk("purport", "Canonical purport", metadata.get("purport"))
    return chunks


def cosine_similarity(left: Sequence[float], right: Sequence[float]) -> float:
    if len(left) != len(right) or not left:
        return 0.0
    numerator = sum(a * b for a, b in zip(left, right, strict=False))
    left_norm = sqrt(sum(a * a for a in left))
    right_norm = sqrt(sum(b * b for b in right))
    if not left_norm or not right_norm:
        return 0.0
    return numerator / (left_norm * right_norm)


def token_score(query: str, content: str) -> float:
    query_tokens = {token for token in clean_text(query).lower().split() if token}
    if not query_tokens:
        return 0.0
    content_text = clean_text(content).lower()
    score = 0.0
    for token in query_tokens:
        if token in content_text:
            score += 1.0
    return score / len(query_tokens)


class RAGService:
    def __init__(self, session: AsyncSession, provider: GroundedProvider) -> None:
        self.session = session
        self.provider = provider

    async def ensure_song_chunks(self) -> None:
        result = await self.session.execute(select(SongChunk.id).limit(1))
        if result.first():
            return
        songs_result = await self.session.execute(select(Song).order_by(Song.number))
        songs = list(songs_result.scalars().all())
        for song in songs:
            for row in build_song_chunks(song):
                self.session.add(SongChunk(**row))
        await self.session.flush()

    async def chunks_for_song(self, song_number: int) -> list[SongChunk]:
        result = await self.session.execute(
            select(SongChunk)
            .where(SongChunk.song_number == song_number)
            .order_by(SongChunk.chunk_index)
        )
        return list(result.scalars().all())

    async def _ensure_embeddings(self, chunks: Iterable[SongChunk]) -> None:
        pending = [chunk for chunk in chunks if chunk.embeddings is None]
        if not pending:
            return
        for chunk in pending:
            chunk.embeddings = await self.provider.embed(self.chunk_embedding_text(chunk))
        await self.session.flush()

    def chunk_embedding_text(self, chunk: SongChunk) -> str:
        return "\n".join(
            part
            for part in (
                chunk.title,
                f"Song {chunk.song_number}",
                chunk.content,
                chunk.metadata_json.get("song_title"),
                chunk.metadata_json.get("first_line"),
            )
            if part
        )

    async def retrieve(
        self,
        song: Song,
        query: str,
        limit: int = 5,
    ) -> list[RetrievedChunk]:
        await self.ensure_song_chunks()
        candidate_song_numbers = [song.number]
        if query.strip():
            matches = await CatalogService(self.session).search(query, limit=12)
            candidate_song_numbers.extend(
                item.number for item in matches if item.number != song.number
            )
        candidate_song_numbers = list(dict.fromkeys(candidate_song_numbers))
        result = await self.session.execute(
            select(SongChunk)
            .where(SongChunk.song_number.in_(candidate_song_numbers))
            .order_by(SongChunk.song_number, SongChunk.chunk_index)
        )
        chunks = list(result.scalars().all())
        await self._ensure_embeddings(chunks)

        query_embedding = await self.provider.embed(query or song.title)
        scored: list[RetrievedChunk] = []
        for chunk in chunks:
            lexical = token_score(query, chunk.title) * 0.4
            lexical += token_score(query, chunk.content) * 0.6
            similarity = cosine_similarity(query_embedding, chunk.embeddings or [])
            boost = 0.15 if chunk.song_number == song.number else 0.0
            total = lexical + similarity + boost
            scored.append(
                RetrievedChunk(
                    song_number=chunk.song_number,
                    song_title=chunk.metadata_json.get("song_title") or song.title,
                    chunk_index=chunk.chunk_index,
                    chunk_type=chunk.chunk_type,
                    title=chunk.title,
                    content=chunk.content,
                    source_url=chunk.source_url,
                    metadata_json=chunk.metadata_json or {},
                    score=total,
                )
            )
        scored.sort(key=lambda item: item.score, reverse=True)
        return scored[:limit]

    async def build_grounded_answer(
        self, song: Song, query: str
    ) -> tuple[str, list[RetrievedChunk]]:
        chunks = await self.retrieve(song, query, limit=5)
        context_lines = []
        for idx, chunk in enumerate(chunks, start=1):
            source = f"{chunk.song_number}:{chunk.chunk_index}"
            context_lines.append(
                f"[{idx}] {chunk.song_title} | {chunk.chunk_type} | source {source}\n"
                f"{chunk.content}"
            )
        prompt = "\n\n".join(
            [
                "You are a grounded assistant for Prabhat Samgiita.",
                "Answer only from the retrieved canonical context below.",
                "If the context is insufficient, say so plainly.",
                "Keep the answer concise, accurate, and cite the source labels like [1], [2].",
                f"User question: {query}",
                f"Song focus: {song.number} - {song.title}",
                "Retrieved context:",
                "\n\n".join(context_lines),
            ]
        )
        try:
            answer = await self.provider.complete(prompt)
        except Exception as exc:  # pragma: no cover - network/provider failures are runtime only
            cited = "; ".join(
                f"[{idx}] {chunk.song_title} ({chunk.chunk_type})"
                for idx, chunk in enumerate(chunks, start=1)
            )
            answer = (
                f"Grounded context collected for song {song.number}: {song.title}.\n"
                f"Retrieved passages: {cited or 'none'}.\n"
                f"Provider fallback: {exc!s}"
            )
        return answer, chunks
