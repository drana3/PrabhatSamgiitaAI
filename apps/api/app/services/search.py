from __future__ import annotations

import re
from collections import defaultdict
from dataclasses import dataclass
from difflib import SequenceMatcher

from sqlalchemy import case, func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models import Media, Notation, Song
from app.schemas.search import MediaSummary, SearchFilters, SearchResponse, SearchResultItem
from app.services.ai import select_provider
from app.services.catalog import CatalogService, catalog_media_snapshot, catalog_notation_snapshot


@dataclass(slots=True)
class SearchCandidate:
    song: Song
    matched_by: set[str]
    score_parts: dict[str, float]


def normalize_query(value: str) -> str:
    return " ".join(value.lower().split())


def reciprocal_rank_fusion(ranked_lists: list[list[str]], k: int = 60) -> dict[str, float]:
    scores: dict[str, float] = defaultdict(float)
    for ranked_list in ranked_lists:
        for rank, item in enumerate(ranked_list, start=1):
            scores[item] += 1.0 / (k + rank)
    return scores


def detect_intent(query: str) -> str:
    cleaned = normalize_query(query)
    if re.fullmatch(r"(?:ps\s*)?\d{1,4}", cleaned):
        return "song_number_search"
    if any(token in cleaned for token in ("morning", "evening", "meditation", "festival")):
        return "occasion_search"
    if any(token in cleaned for token in ("hope", "courage", "devotion", "surrender", "nature")):
        return "theme_search"
    return "semantic_search"


def _search_doc(song: Song) -> str:
    return " ".join(
        part
        for part in (
            str(song.number),
            song.title,
            song.first_line,
            song.lyrics_original,
            song.transliteration,
            song.hindi_meaning,
            song.english_meaning,
            song.theme,
            song.occasion,
            song.festival,
            song.season,
        )
        if part
    )


class HybridSearchService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.provider = select_provider(get_settings())

    def _seed_media(self) -> list[Media]:
        return list(catalog_media_snapshot())

    def _seed_notations(self) -> list[Notation]:
        return list(catalog_notation_snapshot())

    async def _song_index(self) -> list[Song]:
        return await CatalogService(self.session).list_songs(limit=10000)

    async def _media_counts(self) -> dict[int, MediaSummary]:
        counts: dict[int, MediaSummary] = defaultdict(MediaSummary)
        for media_item in self._seed_media():
            song_number = media_item.song_number
            if song_number is None:
                continue
            counts[int(song_number)].audio_count += 1 if media_item.kind == "audio" else 0
            counts[int(song_number)].video_count += 1 if media_item.kind == "video" else 0
        for notation_item in self._seed_notations():
            song_number = notation_item.song_number
            if song_number is None:
                continue
            counts[int(song_number)].notation_count += 1
        try:
            media_result = await self.session.execute(
                select(
                    Media.song_number,
                    func.sum(case((Media.kind == "audio", 1), else_=0)).label("audio_count"),
                    func.sum(case((Media.kind == "video", 1), else_=0)).label("video_count"),
                )
                .where(Media.song_number.is_not(None))
                .group_by(Media.song_number)
            )
            notation_result = await self.session.execute(
                select(Notation.song_number, func.count(Notation.id).label("notation_count"))
                .group_by(Notation.song_number)
            )
            for row in media_result.all():
                summary = counts[int(row.song_number)]
                summary.audio_count = max(summary.audio_count, int(row.audio_count or 0))
                summary.video_count = max(summary.video_count, int(row.video_count or 0))
            for notation_row in notation_result.all():
                summary = counts[int(notation_row.song_number)]
                summary.notation_count = max(
                    summary.notation_count, int(notation_row.notation_count or 0)
                )
            return counts
        except SQLAlchemyError:
            await self.session.rollback()
            return counts

    async def _vector_rank(
        self, songs: list[Song], query_embedding: list[float], limit: int
    ) -> list[str]:
        if not query_embedding:
            return []
        # Use pgvector ordering when available, but keep the service functional
        # with the in-memory fallback.
        try:
            stmt = (
                select(Song.number)
                .where(Song.embeddings.is_not(None))
                .order_by(Song.embeddings.op("<=>")(query_embedding))
                .limit(limit)
            )
            result = await self.session.execute(stmt)
            return [str(number) for number in result.scalars().all()]
        except Exception:
            await self.session.rollback()
            scored: list[tuple[str, float]] = []
            for song in songs:
                if not song.embeddings:
                    continue
                score = sum(a * b for a, b in zip(song.embeddings, query_embedding, strict=False))
                scored.append((str(song.number), score))
            scored.sort(key=lambda item: item[1], reverse=True)
            return [item[0] for item in scored[:limit]]

    async def _fts_rank(self, query: str, songs: list[Song], limit: int) -> list[str]:
        query_norm = normalize_query(query)
        query_terms = set(query_norm.split())
        scored = []
        for song in songs:
            doc = normalize_query(_search_doc(song))
            token_hits = sum(1 for term in query_terms if term and term in doc)
            phrase_bonus = 2.0 if query_norm and query_norm in doc else 0.0
            score = float(token_hits) + phrase_bonus
            if score:
                scored.append((str(song.number), score))
        scored.sort(key=lambda item: item[1], reverse=True)
        return [item[0] for item in scored[:limit]]

    async def _trigram_rank(self, query: str, songs: list[Song], limit: int) -> list[str]:
        scored = []
        query_norm = normalize_query(query)
        if not query_norm:
            return []
        for song in songs:
            title = normalize_query(song.title)
            first_line = normalize_query(song.first_line or "")
            similarity = max(
                SequenceMatcher(None, query_norm, title).ratio(),
                SequenceMatcher(None, query_norm, first_line).ratio(),
            )
            if similarity >= 0.35:
                scored.append((str(song.number), similarity))
        scored.sort(key=lambda item: item[1], reverse=True)
        return [item[0] for item in scored[:limit]]

    async def _has_vector_index(self) -> bool:
        try:
            result = await self.session.execute(
                select(Song.id).where(Song.embeddings.is_not(None)).limit(1)
            )
            return result.first() is not None
        except SQLAlchemyError:
            await self.session.rollback()
            return False

    async def _exact_number_rank(self, query: str) -> list[str]:
        match = re.fullmatch(
            r"(?:(?:ps|prabhat samgiita|prabhat sangeet|song)\s*)?#?(\d{1,4})",
            normalize_query(query),
        )
        if not match:
            return []
        return [match.group(1)]

    async def _opening_line_rank(self, query: str, songs: list[Song], limit: int) -> list[str]:
        query_norm = normalize_query(query)
        exact = []
        partial = []
        for song in songs:
            first_line = normalize_query(song.first_line or "")
            title = normalize_query(song.title)
            number = str(song.number)
            if query_norm == number or query_norm == first_line or query_norm == title:
                exact.append(number)
            elif query_norm and (query_norm in first_line or query_norm in title):
                partial.append(number)
        return (exact + partial)[:limit]

    def _apply_filters(
        self,
        song: Song,
        filters: SearchFilters,
        media_summary: MediaSummary,
    ) -> bool:
        checks = [
            (filters.language, song.language),
            (filters.theme, song.theme),
            (filters.occasion, song.occasion),
            (filters.festival, song.festival),
            (filters.season, song.season),
            (filters.difficulty, song.difficulty),
        ]
        for expected, actual in checks:
            if expected and (not actual or expected.lower() not in actual.lower()):
                return False
        if filters.verification_status and filters.verification_status.lower() not in (
            song.canonical_source_status.lower(),
            ("verified" if song.is_verified else "draft"),
        ):
            return False
        if filters.has_audio is True and media_summary.audio_count <= 0:
            return False
        if filters.has_video is True and media_summary.video_count <= 0:
            return False
        if filters.has_notation is True and media_summary.notation_count <= 0:
            return False
        return True

    async def search(
        self,
        query: str,
        filters: SearchFilters | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> SearchResponse:
        filters = filters or SearchFilters()
        songs = await self._song_index()
        media_counts = await self._media_counts()
        intent = detect_intent(query)

        query_embedding: list[float] = []
        if await self._has_vector_index():
            try:
                query_embedding = await self.provider.embed(query)
            except Exception:
                query_embedding = []
        exact_number = await self._exact_number_rank(query)
        opening_rank = await self._opening_line_rank(query, songs, limit=50)
        fts_rank = await self._fts_rank(query, songs, limit=50)
        trigram_rank = await self._trigram_rank(query, songs, limit=50)
        vector_rank = await self._vector_rank(songs, query_embedding, limit=50)

        fused = reciprocal_rank_fusion(
            [exact_number, opening_rank, fts_rank, trigram_rank, vector_rank]
        )
        candidates = sorted(
            {
                item
                for ranked in (exact_number, opening_rank, fts_rank, trigram_rank, vector_rank)
                for item in ranked
            },
            key=lambda item: fused.get(item, 0.0),
            reverse=True,
        )

        candidate_lookup = {song.number: song for song in songs}
        items: list[SearchResultItem] = []
        for candidate in candidates:
            song = candidate_lookup.get(int(candidate))
            if not song:
                continue
            summary = media_counts.get(song.number, MediaSummary())
            if not self._apply_filters(song, filters, summary):
                continue
            matched_by = []
            for label, ranked in (
                ("exact_number", exact_number),
                ("opening_line", opening_rank),
                ("full_text", fts_rank),
                ("trigram", trigram_rank),
                ("vector", vector_rank),
            ):
                if candidate in ranked:
                    matched_by.append(label)
            if song.is_verified or song.canonical_source_status == "verified":
                matched_by.append("verified")
            score = fused.get(candidate, 0.0)
            score += 0.05 if summary.audio_count else 0.0
            score += 0.02 if summary.notation_count else 0.0
            score += 0.03 if song.is_verified else 0.0
            items.append(
                SearchResultItem(
                    song_number=song.number,
                    opening_line=song.first_line,
                    matched_by=matched_by,
                    score=round(score, 4),
                    verification_status="officially_verified"
                    if song.is_verified or song.canonical_source_status == "verified"
                    else song.canonical_source_status,
                    themes=[value for value in [song.theme] if value],
                    media_summary=summary,
                )
            )

        total = len(items)
        start = max(page - 1, 0) * page_size
        end = start + page_size
        paged = items[start:end]
        return SearchResponse(query=query, detected_intent=intent, total=total, items=paged)
