from __future__ import annotations

import re
import unicodedata
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
from app.services.seed_data import load_rows


@dataclass(slots=True)
class SearchCandidate:
    song: Song
    matched_by: set[str]
    score_parts: dict[str, float]


def normalize_query(value: str) -> str:
    return " ".join(value.lower().split())


EXPLANATION_TERMS = (
    "about",
    "explain",
    "interpret",
    "lyrics",
    "meaning",
    "notation",
    "tell me",
    "translate",
)


def extract_song_number_intent(query: str) -> int | None:
    """Resolve an explicit catalog identifier before fuzzy or vector retrieval."""
    cleaned = normalize_query(query)
    exact = re.fullmatch(
        r"(?:(?:ps|prabhat samgiita|prabhat sangeet|song)\s*)?#?(\d{1,4})",
        cleaned,
    )
    if exact:
        number = int(exact.group(1))
        return number if 1 <= number <= 5018 else None

    matches = [int(value) for value in re.findall(r"(?<!\d)(\d{1,4})(?!\d)", cleaned)]
    in_catalog = sorted({number for number in matches if 1 <= number <= 5018})
    if len(in_catalog) != 1:
        return None

    number = in_catalog[0]
    number_text = str(number)
    identity_patterns = (
        rf"\b(?:ps|song)(?:\s+(?:number|no\.?))?\s*#?\s*{number_text}\b",
        rf"\bprabhat(?:\s+[^\W\d_]+){{0,3}}\s*#?\s*{number_text}\b",
        rf"\b{number_text}\s+(?:ps|song)\b",
    )
    if any(re.search(pattern, cleaned, re.IGNORECASE) for pattern in identity_patterns):
        return number

    has_explanation_intent = any(term in cleaned for term in EXPLANATION_TERMS)
    has_song_context = any(
        term in cleaned for term in ("prabhat", "samgiita", "sangeet", "sagiat", "song", "ps")
    )
    return number if has_explanation_intent and has_song_context else None


def reciprocal_rank_fusion(ranked_lists: list[list[str]], k: int = 60) -> dict[str, float]:
    scores: dict[str, float] = defaultdict(float)
    for ranked_list in ranked_lists:
        for rank, item in enumerate(ranked_list, start=1):
            scores[item] += 1.0 / (k + rank)
    return scores


def detect_intent(query: str) -> str:
    cleaned = normalize_query(query)
    if extract_song_number_intent(cleaned) is not None:
        return "song_number_search"
    if any(token in cleaned for token in ("morning", "evening", "meditation", "festival")):
        return "occasion_search"
    if any(token in cleaned for token in ("hope", "courage", "devotion", "surrender", "nature")):
        return "theme_search"
    return "semantic_search"


def _search_doc(song: Song) -> str:
    assignment = (song.metadata_json or {}).get("canonical_theme_assignments") or {}
    assignment_text = " ".join(
        str(value)
        for key in ("themes", "festivals", "occasions", "seasons", "languages")
        for value in assignment.get(key, [])
    )
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
            song.language,
            song.difficulty,
            assignment_text,
        )
        if part
    )


def canonical_lexical_boost(query: str, song: Song) -> float:
    """Keep exact canonical text matches ahead of approximate vector neighbors."""
    query_norm = normalize_query(query)
    if not query_norm:
        return 0.0
    title = normalize_query(song.title)
    first_line = normalize_query(song.first_line or "")
    if query_norm in {title, first_line}:
        return 3.0
    document = normalize_query(_search_doc(song))
    if query_norm in document:
        return 1.5
    significant_terms = [term for term in query_norm.split() if len(term) > 2]
    if len(significant_terms) >= 2 and all(term in document for term in significant_terms):
        return 0.25
    return 0.0


FILTER_ASSIGNMENT_KEYS = {
    "language": "languages",
    "theme": "themes",
    "festival": "festivals",
    "occasion": "occasions",
    "season": "seasons",
}


def normalize_filter_text(value: str) -> str:
    decomposed = unicodedata.normalize("NFKD", value.casefold())
    plain = "".join(character for character in decomposed if not unicodedata.combining(character))
    normalized = re.sub(r"[^a-z0-9]+", " ", plain).strip()
    return normalized.replace("krishna", "krsna").replace("maethili", "maithili")


@dataclass(frozen=True, slots=True)
class CanonicalCollectionMatch:
    label: str
    category: str
    value: str
    song_numbers: frozenset[int]


def infer_canonical_collection(query: str) -> CanonicalCollectionMatch | None:
    query_text = normalize_filter_text(query)
    best: tuple[int, CanonicalCollectionMatch] | None = None
    for row in load_rows("theme_collections.json"):
        label = str(row.get("label") or "")
        value = str(row.get("value") or "")
        aliases = {
            normalize_filter_text(label),
            normalize_filter_text(value),
            normalize_filter_text(re.sub(r"\b(?:song|songs)\b", " ", label)),
        }
        score = max(
            (len(alias) for alias in aliases if len(alias) >= 3 and alias in query_text),
            default=0,
        )
        if score == 0:
            continue
        match = CanonicalCollectionMatch(
            label=label,
            category=str(row.get("category") or "theme"),
            value=value,
            song_numbers=frozenset(int(number) for number in row.get("song_numbers", [])),
        )
        if best is None or score > best[0]:
            best = (score, match)
    return best[1] if best else None


def infer_search_filters(query: str, songs: list[Song]) -> SearchFilters:
    """Resolve canonical collection names before semantic ranking."""
    query_text = normalize_filter_text(query)
    matches: dict[str, tuple[int, str]] = {}
    for song in songs:
        assignment = (song.metadata_json or {}).get("canonical_theme_assignments") or {}
        for field, assignment_key in FILTER_ASSIGNMENT_KEYS.items():
            values = list(assignment.get(assignment_key, []))
            if field == "language" and song.language:
                values.extend(part.strip() for part in song.language.split(",") if part.strip())
            for value in values:
                if not isinstance(value, str):
                    continue
                normalized = normalize_filter_text(value)
                simplified = re.sub(r"\b(?:day|song|songs)\b", " ", normalized)
                simplified = " ".join(simplified.split())
                aliases = {normalized, simplified}
                matched_length = max(
                    (len(alias) for alias in aliases if len(alias) >= 3 and alias in query_text),
                    default=0,
                )
                if matched_length > matches.get(field, (0, ""))[0]:
                    matches[field] = (matched_length, value)
    return SearchFilters(
        language=matches.get("language", (0, None))[1],
        theme=matches.get("theme", (0, None))[1],
        festival=matches.get("festival", (0, None))[1],
        occasion=matches.get("occasion", (0, None))[1],
        season=matches.get("season", (0, None))[1],
    )


def merge_search_filters(explicit: SearchFilters, inferred: SearchFilters) -> SearchFilters:
    values = explicit.model_dump()
    for field, value in inferred.model_dump().items():
        if values.get(field) is None and value is not None:
            values[field] = value
    return SearchFilters.model_validate(values)


def has_search_filters(filters: SearchFilters) -> bool:
    return any(value is not None for value in filters.model_dump().values())


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
                select(
                    Notation.song_number, func.count(Notation.id).label("notation_count")
                ).group_by(Notation.song_number)
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
        number = extract_song_number_intent(query)
        return [str(number)] if number is not None else []

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
        collection_match = infer_canonical_collection(query)
        filters = merge_search_filters(filters, infer_search_filters(query, songs))
        intent = (
            "collection_search"
            if collection_match
            else "filtered_search"
            if has_search_filters(filters)
            else detect_intent(query)
        )

        exact_number = await self._exact_number_rank(query)
        query_embedding: list[float] = []
        if not exact_number and await self._has_vector_index():
            try:
                query_embedding = await self.provider.embed(query)
            except Exception:
                query_embedding = []
        # A catalog number is an identifier, not fuzzy text. Returning only the
        # exact number prevents queries such as 2256 from surfacing Song 226.
        opening_rank = [] if exact_number else await self._opening_line_rank(query, songs, limit=50)
        fts_rank = [] if exact_number else await self._fts_rank(query, songs, limit=50)
        trigram_rank = [] if exact_number else await self._trigram_rank(query, songs, limit=50)
        vector_rank = (
            [] if exact_number else await self._vector_rank(songs, query_embedding, limit=50)
        )
        structured_rank = (
            [
                str(song.number)
                for song in songs
                if (
                    (not collection_match or song.number in collection_match.song_numbers)
                    and self._apply_filters(
                        song,
                        filters,
                        media_counts.get(song.number, MediaSummary()),
                    )
                )
            ]
            if has_search_filters(filters) or collection_match
            else []
        )

        fused = reciprocal_rank_fusion(
            [exact_number, structured_rank, opening_rank, fts_rank, trigram_rank, vector_rank]
        )
        candidates = sorted(
            {
                item
                for ranked in (
                    exact_number,
                    structured_rank,
                    opening_rank,
                    fts_rank,
                    trigram_rank,
                    vector_rank,
                )
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
            if collection_match and song.number not in collection_match.song_numbers:
                continue
            summary = media_counts.get(song.number, MediaSummary())
            if not self._apply_filters(song, filters, summary):
                continue
            matched_by = []
            for label, ranked in (
                ("exact_number", exact_number),
                ("structured_filter", structured_rank),
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
            score += canonical_lexical_boost(query, song)
            score += 10.0 if candidate in exact_number else 0.0
            score += 0.005 if summary.audio_count else 0.0
            score += 0.002 if summary.notation_count else 0.0
            score += 0.003 if song.is_verified else 0.0
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

        items.sort(key=lambda item: (-item.score, item.song_number))
        total = len(items)
        start = max(page - 1, 0) * page_size
        end = start + page_size
        paged = items[start:end]
        return SearchResponse(query=query, detected_intent=intent, total=total, items=paged)
