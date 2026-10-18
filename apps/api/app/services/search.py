from __future__ import annotations

import asyncio
import re
import unicodedata
from collections import defaultdict
from collections.abc import Awaitable
from dataclasses import dataclass
from difflib import SequenceMatcher

from sqlalchemy import case, func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession
from unidecode import unidecode

from app.config import get_settings
from app.models import Media, Notation, Song
from app.schemas.search import MediaSummary, SearchFilters, SearchResponse, SearchResultItem
from app.services.ai import select_provider
from app.services.catalog import (
    catalog_media_snapshot,
    catalog_notation_snapshot,
    catalog_song_snapshot,
)
from app.services.faiss_store import get_faiss_store
from app.services.seed_data import load_rows


@dataclass(slots=True)
class SearchCandidate:
    song: Song
    matched_by: set[str]
    score_parts: dict[str, float]


def normalize_query(value: str) -> str:
    return " ".join(value.lower().split())


VOICE_COMMAND_PREFIXES = (
    "can you find",
    "could you find",
    "find me",
    "find",
    "please find",
    "play me",
    "play",
    "search for",
    "search",
    "show me",
    "tell me",
    "mujhe sunao",
    "mujhe batao",
    "mujhe dhundho",
    "gaana sunao",
    "gana sunao",
    "khojo",
    "dhundho",
)

VOICE_DOMAIN_FILLERS = (
    "prabhat samgiita ka",
    "prabhat samgita ka",
    "prabhat sangeet ka",
    "prabhat samgiita",
    "prabhat samgita",
    "prabhat sangeet",
    "song about",
    "song for",
    "song",
    "gaana",
    "gana",
)

VOICE_CONCEPT_ALIASES: dict[str, tuple[str, ...]] = {
    "anand": ("bliss", "joy"),
    "asha": ("hope",),
    "baarish": ("rain", "rainy"),
    "barish": ("rain", "rainy"),
    "barsaat": ("rain", "rainy"),
    "bhakti": ("devotion",),
    "bliss": ("bliss", "joy"),
    "compassion": ("compassion", "daya"),
    "daya": ("compassion",),
    "devotion": ("devotion", "bhakti"),
    "devotional": ("devotion", "bhakti"),
    "dukh": ("sorrow", "pain"),
    "feeling": ("feeling", "mood"),
    "festival": ("festival", "utsav"),
    "gam": ("sorrow",),
    "guru": ("guru", "master"),
    "happy": ("joy", "bliss", "happiness"),
    "happiness": ("joy", "bliss"),
    "hope": ("hope", "asha"),
    "ishq": ("love", "devotion"),
    "janamdin": ("birthday",),
    "janmadin": ("birthday",),
    "joy": ("joy", "bliss"),
    "khushi": ("joy", "bliss"),
    "kishan": ("krsna", "krishna"),
    "kisna": ("krsna", "krishna"),
    "kishna": ("krsna", "krishna"),
    "krishna": ("krsna",),
    "krisna": ("krsna", "krishna"),
    "krsna": ("krishna",),
    "krushna": ("krsna", "krishna"),
    "love": ("love", "devotion"),
    "meditat": ("meditation", "contemplation"),
    "meditation": ("meditation", "contemplation", "sadhana"),
    "mohabbat": ("love", "devotion"),
    "morning": ("morning", "dawn", "pratah"),
    "musafir": ("journey", "traveller"),
    "musaaphir": ("journey", "traveller"),
    "nature": ("nature",),
    "nikah": ("marriage",),
    "peace": ("peace", "shanti", "calm"),
    "peaceful": ("peace", "shanti", "calm"),
    "prakriti": ("nature",),
    "prem": ("love", "devotion"),
    "pyar": ("love", "devotion"),
    "pyaar": ("love", "devotion"),
    "rain": ("rain", "rainy", "baarish"),
    "sad": ("sorrow", "pain"),
    "safar": ("journey",),
    "salgirah": ("birthday",),
    "seva": ("service", "humanity"),
    "sewa": ("service", "humanity"),
    "shaadi": ("marriage",),
    "shadi": ("marriage",),
    "shankar": ("shiva",),
    "shanti": ("peace",),
    "shaanti": ("peace",),
    "shiv": ("shiva",),
    "shiva": ("shiva",),
    "siv": ("shiva",),
    "siva": ("shiva",),
    "sorrow": ("sorrow", "pain"),
    "stress": ("peace", "shanti", "calm"),
    "stressed": ("peace", "shanti", "calm"),
    "stressful": ("peace", "shanti", "calm"),
    "anxious": ("peace", "shanti", "calm"),
    "anxiety": ("peace", "shanti", "calm"),
    "tense": ("peace", "shanti", "calm"),
    "worried": ("peace", "shanti", "calm"),
    "overwhelm": ("peace", "shanti", "calm"),
    "overwhelmed": ("peace", "shanti", "calm"),
    "ummid": ("hope",),
    "umeed": ("hope",),
    "vivah": ("marriage",),
}


def prepare_voice_query(value: str) -> str:
    """Convert speech-recognition output into a compact catalog query."""
    cleaned = normalize_filter_text(value)
    cleaned = re.sub(r"^(?:mujhe|mere liye|kripya|please)\s+", "", cleaned)
    cleaned = re.sub(
        r"\s+(?:sunaao|sunao|bataao|batao|dikhaao|dikhao|dhundho|khojo)$",
        "",
        cleaned,
    )
    for prefix in VOICE_COMMAND_PREFIXES:
        if cleaned == prefix:
            return ""
        if cleaned.startswith(f"{prefix} "):
            cleaned = cleaned[len(prefix) + 1 :]
            break
    for filler in VOICE_DOMAIN_FILLERS:
        cleaned = re.sub(rf"\b{re.escape(filler)}\b", " ", cleaned)
    return " ".join(cleaned.split())


def expand_concept_query(value: str) -> str:
    """Local feeling/mood synonym expansion — no LLM round-trip."""
    cleaned = " ".join(normalize_filter_text(value).split())
    if not cleaned:
        return ""
    aliases: list[str] = []
    words = cleaned.split()
    word_set = set(words)
    for word, expansions in VOICE_CONCEPT_ALIASES.items():
        if word in word_set or any(token.startswith(word) for token in word_set if len(word) >= 5):
            aliases.extend(expansions)
    return " ".join(dict.fromkeys([*words, *aliases]))


def expand_voice_query(value: str) -> str:
    return expand_concept_query(prepare_voice_query(value))


def phonetic_key(value: str) -> str:
    """Make common speech-to-text spelling variations compare more forgivingly."""
    normalized = prepare_voice_query(value)
    replacements = (
        (r"ph", "f"),
        (r"bh", "b"),
        (r"dh", "d"),
        (r"th", "t"),
        (r"sh", "s"),
        (r"v", "w"),
        (r"aa+", "a"),
        (r"ee+", "i"),
        (r"oo+", "u"),
    )
    for pattern, replacement in replacements:
        normalized = re.sub(pattern, replacement, normalized)
    return normalized


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


def canonical_lexical_boost(query: str, song: Song, *, semantic_mode: bool = False) -> float:
    """Keep exact canonical text matches ahead of approximate vector neighbors."""
    query_norm = normalize_filter_text(query)
    if not query_norm:
        return 0.0
    title = normalize_filter_text(song.title)
    first_line = normalize_filter_text(song.first_line or "")
    if query_norm in {title, first_line}:
        return 3.0
    title_similarity = max(
        SequenceMatcher(None, query_norm, title).ratio(),
        SequenceMatcher(None, query_norm, first_line).ratio(),
    )
    if semantic_mode:
        # Feeling/meaning search must not promote songs that merely mention a mood
        # word somewhere in lyrics or commentary — that surfaces wrong results.
        if title_similarity >= 0.84:
            return 1.0
        return 0.0
    document = normalize_filter_text(_search_doc(song))
    if query_norm in document:
        return 1.5
    significant_terms = [term for term in query_norm.split() if len(term) > 2]
    if len(significant_terms) >= 2 and all(term in document for term in significant_terms):
        return 0.25
    if title_similarity >= 0.84:
        return 1.0
    if title_similarity >= 0.7:
        return 0.4
    return 0.0


FILTER_ASSIGNMENT_KEYS = {
    "language": "languages",
    "theme": "themes",
    "festival": "festivals",
    "occasion": "occasions",
    "season": "seasons",
}


def normalize_filter_text(value: str) -> str:
    # Unidecode keeps Devanagari, Bengali, Gujarati, Gurmukhi, Tamil, Telugu,
    # Kannada, Malayalam, Odia, and Perso-Arabic speech transcripts searchable.
    decomposed = unicodedata.normalize("NFKD", unidecode(value).casefold())
    plain = "".join(character for character in decomposed if not unicodedata.combining(character))
    normalized = re.sub(r"[^a-z0-9]+", " ", plain).strip()
    swapped = {
        "krishna": "krsna",
        "krisna": "krsna",
        "kishan": "krsna",
        "kisan": "krsna",
        "kisna": "krsna",
        "kishna": "krsna",
        "krishn": "krsna",
        "krushna": "krsna",
        "krsna": "krsna",
        "siv": "shiva",
        "shiv": "shiva",
        "siva": "shiva",
        "mahadev": "shiva",
        "shankar": "shiva",
        "sadashiva": "shiva",
        "maethili": "maithili",
    }
    return " ".join(swapped.get(word, word) for word in normalized.split())


@dataclass(frozen=True, slots=True)
class CanonicalCollectionMatch:
    label: str
    category: str
    value: str
    song_numbers: frozenset[int]


def infer_canonical_collection(query: str) -> CanonicalCollectionMatch | None:
    query_text = normalize_filter_text(query)
    rows = load_rows("theme_collections.json")
    language_partition_queries = {
        "hindi": "hindi",
        "hindi song": "hindi",
        "hindi songs": "hindi",
        "hindi only song": "hindi",
        "hindi only songs": "hindi",
        "search prabhat samgiita for hindi only songs": "hindi",
        "urdu": "urdu",
        "urdu song": "urdu",
        "urdu songs": "urdu",
        "urdu only song": "urdu",
        "urdu only songs": "urdu",
        "search prabhat samgiita for urdu only songs": "urdu",
        "hindi urdu": "shared",
        "hindustani": "shared",
        "shared hindi urdu songs": "shared",
        "search prabhat samgiita for shared hindi urdu songs": "shared",
    }
    partition = language_partition_queries.get(query_text)
    if partition:
        language_rows = {
            str(row.get("label")): {
                int(number) for number in row.get("song_numbers", [])
            }
            for row in rows
            if str(row.get("label")) in {"Hindi Songs", "Urdu Songs"}
        }
        hindi = language_rows.get("Hindi Songs", set())
        urdu = language_rows.get("Urdu Songs", set())
        numbers = hindi - urdu if partition == "hindi" else urdu - hindi
        if partition == "shared":
            numbers = hindi & urdu
        labels = {
            "hindi": ("Hindi-only Songs", "Hindi"),
            "urdu": ("Urdu-only Songs", "Urdu"),
            "shared": ("Shared Hindi-Urdu Songs", "Hindi-Urdu / Hindustani"),
        }
        label, value = labels[partition]
        return CanonicalCollectionMatch(
            label=label,
            category="language",
            value=value,
            song_numbers=frozenset(numbers),
        )

    birthday_queries = {
        "birthday",
        "birthday song",
        "birthday songs",
        "all birthday song",
        "all birthday songs",
        "search prabhat samgiita for all birthday songs",
    }
    if query_text in birthday_queries:
        birthday_rows = [
            row
            for row in rows
            if str(row.get("label")) in {"Bábá Birthday Songs", "Birthday Song"}
        ]
        return CanonicalCollectionMatch(
            label="All Birthday Songs",
            category="festival",
            value="Birthday",
            song_numbers=frozenset(
                int(number)
                for row in birthday_rows
                for number in row.get("song_numbers", [])
            ),
        )

    best: tuple[int, CanonicalCollectionMatch] | None = None
    for row in rows:
        label = str(row.get("label") or "")
        value = str(row.get("value") or "")
        normalized_label = normalize_filter_text(label)
        aliases = {
            normalized_label,
            normalize_filter_text(value),
            " ".join(re.sub(r"\b(?:song|songs)\b", " ", normalized_label).split()),
            " ".join(
                re.sub(
                    r"\b(?:ceremony|day|song|songs)\b", " ", normalized_label
                ).split()
            ),
        }
        score = max(
            (
                len(alias)
                for alias in aliases
                if len(alias) >= 3
                and re.search(rf"(?:^| ){re.escape(alias)}(?: |$)", query_text)
            ),
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


SEMANTIC_QUERY_PROMPT = (
    "Rewrite this Prabhat Samgiita discovery question into compact search keywords "
    "covering theme, feeling, imagery, occasion, and spiritual mood. "
    "Return only the keywords, without explanation.\n"
    "Question: {query}"
)

# Short mood chips ("peace", "devotion", "morning meditation") expand locally.
# Only conversational asks pay for an LLM rewrite.
LLM_EXPANSION_HINTS = (
    "about",
    "feel",
    "feeling",
    "help me",
    "i am",
    "i'm",
    "looking for",
    "meaning",
    "recommend",
    "song for",
    "songs for",
    "suggest",
    "which song",
    "why",
)

# Kept for callers/tests that still refer to the broader semantic-mode hint list.
SEMANTIC_EXPANSION_HINTS = LLM_EXPANSION_HINTS + (
    "awakening",
    "bliss",
    "devotion",
    "festival",
    "hope",
    "joy",
    "meditat",
    "mood",
    "morning",
    "nature",
    "occasion",
    "peace",
    "rain",
    "service",
    "spiritual",
    "sorrow",
    "theme",
)

_SEMANTIC_EXPANSION_CACHE: dict[str, str] = {}
_SEMANTIC_EXPANSION_CACHE_MAX = 256


def needs_semantic_expansion(query: str) -> bool:
    """Return True only when an LLM keyword rewrite is worth the latency."""
    cleaned = normalize_query(query)
    if not cleaned:
        return False
    if extract_song_number_intent(cleaned) is not None:
        return False
    if any(hint in cleaned for hint in LLM_EXPANSION_HINTS):
        return True
    return len(cleaned.split()) > 8


# Typed and voice prediction UIs show a short ranked list, not the full candidate set.
TOP_SEARCH_PREDICTIONS = 5


class HybridSearchService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.provider = select_provider(get_settings())

    async def _expand_semantic_query(self, query: str) -> str:
        local = expand_concept_query(query) or query.strip()
        if not needs_semantic_expansion(query):
            return local
        cache_key = normalize_query(query)
        cached = _SEMANTIC_EXPANSION_CACHE.get(cache_key)
        if cached:
            return " ".join(dict.fromkeys(f"{local} {cached}".split()))
        try:
            expanded = await self.provider.complete(
                SEMANTIC_QUERY_PROMPT.format(query=query.strip())
            )
            cleaned = " ".join(expanded.split())
            if cleaned:
                if len(_SEMANTIC_EXPANSION_CACHE) >= _SEMANTIC_EXPANSION_CACHE_MAX:
                    _SEMANTIC_EXPANSION_CACHE.pop(next(iter(_SEMANTIC_EXPANSION_CACHE)))
                _SEMANTIC_EXPANSION_CACHE[cache_key] = cleaned
            return " ".join(dict.fromkeys(f"{local} {cleaned}".split())) or local
        except Exception:
            return local

    async def _rag_chunk_rank(
        self,
        query: str,
        query_embedding: list[float],
        songs: list[Song],
        limit: int = 80,
    ) -> list[str]:
        del query, songs
        if not query_embedding:
            return []
        scored: dict[int, float] = {}
        for _chunk_id, score, song_number in get_faiss_store().search_chunks(
            query_embedding, limit
        ):
            scored[song_number] = max(scored.get(song_number, 0.0), score)
        ranked = sorted(scored.items(), key=lambda item: item[1], reverse=True)
        return [str(number) for number, _ in ranked[:limit]]

    def _seed_media(self) -> list[Media]:
        return list(catalog_media_snapshot())

    def _seed_notations(self) -> list[Notation]:
        return list(catalog_notation_snapshot())

    def _build_seed_media_counts(self) -> dict[int, MediaSummary]:
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
        return counts

    @staticmethod
    def _needs_live_media_counts(filters: SearchFilters) -> bool:
        return any(
            value is not None
            for value in (filters.has_audio, filters.has_video, filters.has_notation)
        )

    def _snapshot_song_index(self) -> list[Song]:
        return list(catalog_song_snapshot())

    async def _load_search_catalog(
        self,
        filters: SearchFilters,
    ) -> tuple[list[Song], dict[int, MediaSummary]]:
        songs = self._snapshot_song_index()
        if self._needs_live_media_counts(filters):
            return songs, await self._media_counts()
        return songs, self._build_seed_media_counts()

    async def _media_counts(self) -> dict[int, MediaSummary]:
        counts = self._build_seed_media_counts()
        try:
            async with asyncio.timeout(8):
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
        except (SQLAlchemyError, TimeoutError):
            await self.session.rollback()
        return counts

    async def _vector_rank(
        self, songs: list[Song], query_embedding: list[float], limit: int
    ) -> list[str]:
        del songs
        if not query_embedding:
            return []
        return [
            str(number)
            for number, _score in get_faiss_store().search_songs(query_embedding, limit)
        ]

    async def _fts_rank(self, query: str, songs: list[Song], limit: int) -> list[str]:
        query_norm = normalize_filter_text(query)
        query_terms = set(query_norm.split())
        scored = []
        for song in songs:
            doc = normalize_filter_text(_search_doc(song))
            token_hits = sum(1 for term in query_terms if term and term in doc)
            phrase_bonus = 2.0 if query_norm and query_norm in doc else 0.0
            score = float(token_hits) + phrase_bonus
            if score:
                scored.append((str(song.number), score))
        scored.sort(key=lambda item: item[1], reverse=True)
        return [item[0] for item in scored[:limit]]

    async def _trigram_rank(self, query: str, songs: list[Song], limit: int) -> list[str]:
        scored = []
        query_norm = normalize_filter_text(query)
        if not query_norm:
            return []
        for song in songs:
            title = normalize_filter_text(song.title)
            first_line = normalize_filter_text(song.first_line or "")
            similarity = max(
                SequenceMatcher(None, query_norm, title).ratio(),
                SequenceMatcher(None, query_norm, first_line).ratio(),
            )
            if similarity >= 0.35:
                scored.append((str(song.number), similarity))
        scored.sort(key=lambda item: item[1], reverse=True)
        return [item[0] for item in scored[:limit]]

    async def _voice_phonetic_rank(
        self, query: str, songs: list[Song], limit: int
    ) -> list[str]:
        query_key = phonetic_key(query)
        query_terms = {term for term in query_key.split() if len(term) > 2}
        if not query_key or not query_terms:
            return []
        scored: list[tuple[str, float]] = []
        for song in songs:
            title_key = phonetic_key(song.title)
            first_line_key = phonetic_key(song.first_line or "")
            transliteration_key = phonetic_key(song.transliteration or "")
            document_terms = set(
                f"{title_key} {first_line_key} {transliteration_key}".split()
            )
            coverage = len(query_terms & document_terms) / len(query_terms)
            phrase_match = any(
                query_key in value
                for value in (title_key, first_line_key, transliteration_key)
                if value
            )
            similarity = max(
                SequenceMatcher(None, query_key, title_key).ratio(),
                SequenceMatcher(None, query_key, first_line_key).ratio(),
            )
            score = (1.25 if phrase_match else 0.0) + coverage + (similarity * 0.35)
            if phrase_match or coverage >= 0.5 or similarity >= 0.68:
                scored.append((str(song.number), score))
        scored.sort(key=lambda item: item[1], reverse=True)
        return [item[0] for item in scored[:limit]]

    async def _has_vector_index(self) -> bool:
        return get_faiss_store().ready()

    async def _exact_number_rank(self, query: str) -> list[str]:
        number = extract_song_number_intent(query)
        return [str(number)] if number is not None else []

    async def _opening_line_rank(self, query: str, songs: list[Song], limit: int) -> list[str]:
        query_norm = normalize_filter_text(query)
        exact = []
        partial = []
        for song in songs:
            first_line = normalize_filter_text(song.first_line or "")
            title = normalize_filter_text(song.title)
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
        assignment = (song.metadata_json or {}).get("canonical_theme_assignments") or {}
        checks = [
            (filters.language, [song.language, *(assignment.get("languages") or [])]),
            (filters.theme, [song.theme, *(assignment.get("themes") or [])]),
            (filters.occasion, [song.occasion, *(assignment.get("occasions") or [])]),
            (filters.festival, [song.festival, *(assignment.get("festivals") or [])]),
            (filters.season, [song.season, *(assignment.get("seasons") or [])]),
            (filters.difficulty, [song.difficulty]),
        ]
        for expected, actual_values in checks:
            values = [str(value) for value in actual_values if value]
            if expected and not any(expected.lower() in value.lower() for value in values):
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

    def _collection_search_response(
        self,
        query: str,
        collection_match: CanonicalCollectionMatch,
        songs: list[Song],
        media_counts: dict[int, MediaSummary],
        filters: SearchFilters,
        page: int,
        page_size: int,
    ) -> SearchResponse:
        lookup = {song.number: song for song in songs}
        items: list[SearchResultItem] = []
        for number in sorted(collection_match.song_numbers):
            song = lookup.get(number)
            if song is None:
                continue
            summary = media_counts.get(number, MediaSummary())
            if not self._apply_filters(song, filters, summary):
                continue
            matched_by = ["structured_filter"]
            if song.is_verified or song.canonical_source_status == "verified":
                matched_by.append("verified")
            items.append(
                SearchResultItem(
                    song_number=song.number,
                    opening_line=song.first_line,
                    matched_by=matched_by,
                    score=1.0,
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
        return SearchResponse(
            query=query,
            detected_intent="collection_search",
            total=total,
            items=items[start:end],
        )

    def _exact_number_response(
        self,
        query: str,
        song_number: str,
        songs: list[Song],
        media_counts: dict[int, MediaSummary],
        page: int,
        page_size: int,
    ) -> SearchResponse:
        song = next((row for row in songs if str(row.number) == song_number), None)
        if song is None:
            return SearchResponse(
                query=query,
                detected_intent="song_number_search",
                total=0,
                items=[],
            )
        summary = media_counts.get(song.number, MediaSummary())
        matched_by = ["exact_number"]
        if song.is_verified or song.canonical_source_status == "verified":
            matched_by.append("verified")
        item = SearchResultItem(
            song_number=song.number,
            opening_line=song.first_line,
            matched_by=matched_by,
            score=10.0,
            verification_status="officially_verified"
            if song.is_verified or song.canonical_source_status == "verified"
            else song.canonical_source_status,
            themes=[value for value in [song.theme] if value],
            media_summary=summary,
        )
        return SearchResponse(
            query=query,
            detected_intent="song_number_search",
            total=1,
            items=[item],
        )

    async def search(
        self,
        query: str,
        filters: SearchFilters | None = None,
        page: int = 1,
        page_size: int = 20,
        input_mode: str = "text",
        mode: str = "catalog",
    ) -> SearchResponse:
        filters = filters or SearchFilters()
        semantic_mode = mode == "semantic"
        exact_number = await self._exact_number_rank(query)
        collection_match = infer_canonical_collection(query)
        if (
            exact_number
            and not semantic_mode
            and not collection_match
            and not has_search_filters(filters)
        ):
            return self._exact_number_response(
                query,
                exact_number[0],
                list(catalog_song_snapshot()),
                self._build_seed_media_counts(),
                page,
                page_size,
            )

        songs, media_counts = await self._load_search_catalog(filters)
        if collection_match:
            return self._collection_search_response(
                query,
                collection_match,
                songs,
                media_counts,
                filters,
                page,
                page_size,
            )

        inferred_filters = SearchFilters() if semantic_mode else infer_search_filters(query, songs)
        filters = merge_search_filters(filters, inferred_filters)
        intent = (
            "semantic_search"
            if semantic_mode
            else "filtered_search"
            if has_search_filters(filters)
            else detect_intent(query)
        )

        if semantic_mode and input_mode == "voice":
            # Keep spoken feeling/meaning language for embeddings, and add
            # compact aliases so phonetic/catalog signals still help.
            voiced = expand_voice_query(query)
            expanded = (
                await self._expand_semantic_query(voiced or query)
                if needs_semantic_expansion(voiced or query)
                else ""
            )
            semantic_query = " ".join(dict.fromkeys(f"{query} {voiced} {expanded}".split()))
        elif semantic_mode:
            semantic_query = await self._expand_semantic_query(query)
        elif input_mode == "voice":
            semantic_query = expand_voice_query(query)
        else:
            semantic_query = query
        query_embedding: list[float] = []
        use_vectors = semantic_mode and not exact_number
        if use_vectors and await self._has_vector_index():
            try:
                query_embedding = await self.provider.embed(semantic_query)
            except Exception:
                query_embedding = []
        # A catalog number is an identifier, not fuzzy text. Returning only the
        # exact number prevents queries such as 2256 from surfacing Song 226.
        rank_tasks: list[tuple[str, Awaitable[list[str]]]] = []
        if not exact_number:
            # Semantic feeling/meaning search: skip FTS/trigram while vectors work —
            # keyword coincidences often return the wrong mood match.
            if semantic_mode:
                rank_tasks.append(
                    ("opening_line", self._opening_line_rank(query, songs, limit=50))
                )
                if input_mode == "voice":
                    rank_tasks.append(
                        ("voice_phonetic", self._voice_phonetic_rank(query, songs, limit=50))
                    )
            else:
                rank_tasks.extend(
                    [
                        ("opening_line", self._opening_line_rank(query, songs, limit=50)),
                        ("full_text", self._fts_rank(query, songs, limit=50)),
                        ("trigram", self._trigram_rank(query, songs, limit=50)),
                    ]
                )
                if input_mode == "voice":
                    rank_tasks.append(
                        ("voice_phonetic", self._voice_phonetic_rank(query, songs, limit=50))
                    )
        rank_coroutines = [task for _, task in rank_tasks]
        rank_results = await asyncio.gather(*rank_coroutines) if rank_coroutines else []
        rank_by_label = {
            label: result for (label, _), result in zip(rank_tasks, rank_results, strict=True)
        }
        opening_rank = rank_by_label.get("opening_line", [])
        fts_rank = rank_by_label.get("full_text", [])
        trigram_rank = rank_by_label.get("trigram", [])
        voice_phonetic_rank = rank_by_label.get("voice_phonetic", [])
        vector_rank: list[str] = []
        rag_chunk_rank: list[str] = []
        if not exact_number and use_vectors and query_embedding:
            if semantic_mode:
                vector_rank, rag_chunk_rank = await asyncio.gather(
                    self._vector_rank(songs, query_embedding, limit=50),
                    self._rag_chunk_rank(query, query_embedding, songs, limit=80),
                )
            else:
                vector_rank = await self._vector_rank(songs, query_embedding, limit=50)
        # No embeddings available: lexical fallback uses the expanded mood query,
        # not raw FTS on the original phrase alone.
        if semantic_mode and not exact_number and not vector_rank and not rag_chunk_rank:
            fts_rank, trigram_rank = await asyncio.gather(
                self._fts_rank(semantic_query, songs, limit=50),
                self._trigram_rank(semantic_query, songs, limit=50),
            )
        structured_rank = (
            [
                str(song.number)
                for song in songs
                if self._apply_filters(
                    song,
                    filters,
                    media_counts.get(song.number, MediaSummary()),
                )
            ]
            if has_search_filters(filters)
            else []
        )

        meaning_ranks = [rag_chunk_rank, vector_rank]
        has_meaning_hits = any(meaning_ranks)
        if semantic_mode and has_meaning_hits:
            fusion_lists = [
                exact_number,
                structured_rank,
                rag_chunk_rank,
                vector_rank,
                opening_rank,
            ]
            if input_mode == "voice":
                fusion_lists.append(voice_phonetic_rank)
        elif semantic_mode:
            fusion_lists = [
                exact_number,
                structured_rank,
                opening_rank,
                fts_rank,
                trigram_rank,
                voice_phonetic_rank,
            ]
        else:
            fusion_lists = [
                exact_number,
                structured_rank,
                rag_chunk_rank,
                opening_rank,
                fts_rank,
                trigram_rank,
                voice_phonetic_rank,
                vector_rank,
            ]

        fused = reciprocal_rank_fusion(fusion_lists)
        candidates = sorted(
            {item for ranked in fusion_lists for item in ranked},
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
                ("structured_filter", structured_rank),
                ("rag_chunk", rag_chunk_rank),
                ("opening_line", opening_rank),
                ("full_text", fts_rank),
                ("trigram", trigram_rank),
                ("voice_phonetic", voice_phonetic_rank),
                ("vector", vector_rank),
            ):
                if candidate in ranked:
                    matched_by.append(label)
            if song.is_verified or song.canonical_source_status == "verified":
                matched_by.append("verified")
            score = fused.get(candidate, 0.0)
            score += canonical_lexical_boost(query, song, semantic_mode=semantic_mode)
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
