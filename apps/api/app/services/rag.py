from __future__ import annotations

import re
from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from math import sqrt
from typing import Any

from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
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


RELATED_SONG_PATTERN = re.compile(
    r"\b(?:related|similar|another|compare|recommend|other\s+songs?|songs?\s+like)\b",
    re.IGNORECASE,
)


def requests_related_songs(query: str) -> bool:
    return RELATED_SONG_PATTERN.search(query) is not None


def song_chunk_priority(query: str, chunk_type: str) -> int:
    normalized = clean_text(query).casefold()
    if re.search(r"\b(?:lyric|line|pronoun|sing|word)\b", normalized):
        order = {"lyrics": 6, "transliteration": 5, "meaning": 4, "summary": 3, "purport": 2}
    elif re.search(r"\b(?:meaning|mean|about|explain|imagery|spiritual|arth|matlab)\b", normalized):
        order = {"meaning": 6, "purport": 5, "lyrics": 4, "summary": 3, "transliteration": 2}
    else:
        order = {"meaning": 6, "lyrics": 5, "summary": 4, "purport": 3, "transliteration": 2}
    return order.get(chunk_type, 1)


def fresh_song_chunks(song: Song, query: str) -> list[RetrievedChunk]:
    rows = build_song_chunks(song)
    ranked = sorted(
        rows,
        key=lambda row: (
            song_chunk_priority(query, str(row["chunk_type"])),
            token_score(query, str(row["content"])),
            -int(row["chunk_index"]),
        ),
        reverse=True,
    )
    return [
        RetrievedChunk(
            song_number=song.number,
            song_title=song.title,
            chunk_index=int(row["chunk_index"]),
            chunk_type=str(row["chunk_type"]),
            title=str(row["title"]),
            content=str(row["content"]),
            source_url=row["source_url"],
            metadata_json=row["metadata_json"],
            score=float(song_chunk_priority(query, str(row["chunk_type"]))),
        )
        for row in ranked
    ]


def build_grounded_prompt(
    song: Song,
    query: str,
    context_lines: list[str],
    history: list[tuple[str, str]] | None = None,
    profile_context: str | None = None,
) -> str:
    recent_conversation = "\n".join(
        f"{role.title()}: {content}" for role, content in (history or [])
    )
    return "\n\n".join(
        [
            "You are a grounded assistant for Prabhat Samgiita.",
            "Answer factual claims only from the retrieved canonical context below.",
            "Use the recent conversation to resolve pronouns, references, and follow-up questions.",
            "Use the optional member interest summary only to personalize language, tone, and "
            "helpful next steps. It is not a factual source and must never override the song "
            "context.",
            "When the user refers to a previous turn, acknowledge that turn directly instead of "
            "claiming that context is missing.",
            "Be warm, reverent, and practical.",
            "Reply in the language and script used by the user. If the user writes a language "
            "in Roman letters, such as Hindi 'pyar' or 'is gaane ka arth', reply naturally in "
            "that same Romanized style unless they request another language.",
            "The selected song is the source of truth. Never say its lyrics or meaning are "
            "missing when a selected-song context passage contains them.",
            "Do not use another song to explain the selected song unless the user explicitly "
            "asks for related songs or a comparison.",
            "If the canonical context is insufficient, say so plainly and offer the "
            "closest grounded help you can.",
            "Keep the answer concise and cite the source labels like [1], [2].",
            "Do not invent an answer for meaningless text; ask for a clear song-related question.",
            f"Recent conversation (may be empty):\n{recent_conversation or 'No earlier turns.'}",
            f"Member interest summary (may be empty):\n{profile_context or 'No member summary.'}",
            f"Current user question: {query}",
            f"Song focus: {song.number} - {song.title}",
            "Retrieved canonical context:",
            "\n\n".join(context_lines),
        ]
    )


class RAGService:
    def __init__(self, session: AsyncSession, provider: GroundedProvider) -> None:
        self.session = session
        self.provider = provider

    def _fallback_chunks(self, song: Song, limit: int) -> list[RetrievedChunk]:
        return fresh_song_chunks(song, "")[:limit]

    async def ensure_song_chunks(self) -> None:
        try:
            result = await self.session.execute(select(SongChunk.id).limit(1))
            if result.first():
                return
            songs_result = await self.session.execute(select(Song).order_by(Song.number))
            songs = list(songs_result.scalars().all())
            for song in songs:
                for row in build_song_chunks(song):
                    self.session.add(SongChunk(**row))
            await self.session.flush()
        except SQLAlchemyError:
            return

    async def chunks_for_song(self, song_number: int) -> list[SongChunk]:
        try:
            result = await self.session.execute(
                select(SongChunk)
                .where(SongChunk.song_number == song_number)
                .order_by(SongChunk.chunk_index)
            )
            return list(result.scalars().all())
        except SQLAlchemyError:
            return []

    async def _ensure_embeddings(self, chunks: Iterable[SongChunk]) -> bool:
        pending = [chunk for chunk in chunks if chunk.embeddings is None]
        if not pending:
            return True
        try:
            vectors = await self.provider.embed_many(
                [self.chunk_embedding_text(chunk) for chunk in pending]
            )
        except Exception:
            return False
        for chunk, vector in zip(pending, vectors, strict=True):
            chunk.embeddings = vector
        try:
            await self.session.commit()
            return True
        except SQLAlchemyError:
            await self.session.rollback()
            return False

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
        selected_chunks = fresh_song_chunks(song, query)
        if not requests_related_songs(query):
            return selected_chunks[:limit]
        try:
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
            if not chunks:
                return self._fallback_chunks(song, limit)
            fallback = selected_chunks[:limit]
            if not await self._ensure_embeddings(chunks):
                return fallback

            try:
                query_embedding = await self.provider.embed(query or song.title)
            except Exception:
                query_embedding = []
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
            related = [item for item in scored if item.song_number != song.number]
            selected_limit = min(3, limit)
            return (selected_chunks[:selected_limit] + related)[:limit]
        except SQLAlchemyError:
            return self._fallback_chunks(song, limit)

    async def build_grounded_answer(
        self,
        song: Song,
        query: str,
        history: list[tuple[str, str]] | None = None,
        profile_context: str | None = None,
    ) -> tuple[str, list[RetrievedChunk]]:
        chunks = await self.retrieve(song, query, limit=5)
        context_lines = []
        for idx, chunk in enumerate(chunks, start=1):
            source = f"{chunk.song_number}:{chunk.chunk_index}"
            context_lines.append(
                f"[{idx}] {chunk.song_title} | {chunk.chunk_type} | source {source}\n"
                f"{chunk.content}"
            )
        prompt = build_grounded_prompt(song, query, context_lines, history, profile_context)
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
