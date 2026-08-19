from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from functools import lru_cache

from app.models import Song
from app.schemas.search import MediaSummary, SearchResultItem, SearchResponse
from app.services.catalog import catalog_song_snapshot

LYRIC_RESULT_LIMIT = 5
LYRIC_PHRASE_SCORE = 48.0
LYRIC_ENGLISH_SCORE = 40.0
_TOKEN = re.compile(r"[^a-z0-9]+")
_STOP = frozenset(
    "a an and as at be but by can do for from i if in is it me my no not o of oh on or so that the this to us we with you your".split()
)


def normalize_lyric_text(value: str | None) -> str:
    decomposed = unicodedata.normalize("NFKD", value or "").casefold()
    plain = "".join(character for character in decomposed if not unicodedata.combining(character))
    return _TOKEN.sub(" ", plain).strip()


@dataclass(frozen=True, slots=True)
class LyricHit:
    number: int
    score: float
    matched_by: str


@dataclass(frozen=True, slots=True)
class LyricRecord:
    number: int
    title: str
    opening: str
    body: str
    tokens: frozenset[str]


def _record_from_song(song: Song) -> LyricRecord:
    title = normalize_lyric_text(song.title)
    opening = normalize_lyric_text(song.first_line)
    lyrics = normalize_lyric_text(song.lyrics_original)
    translit = normalize_lyric_text(song.transliteration)
    body = " ".join(part for part in (title, opening, lyrics, translit) if part)
    return LyricRecord(
        number=int(song.number),
        title=title,
        opening=opening,
        body=body,
        tokens=frozenset(body.split()),
    )


@lru_cache(maxsize=1)
def lyric_index() -> tuple[tuple[LyricRecord, ...], dict[str, frozenset[int]]]:
    records = tuple(_record_from_song(song) for song in catalog_song_snapshot())
    postings: dict[str, set[int]] = {}
    for index, record in enumerate(records):
        for token in record.tokens:
            bucket = postings.get(token)
            if bucket is None:
                postings[token] = {index}
            else:
                bucket.add(index)
    frozen = {token: frozenset(rows) for token, rows in postings.items()}
    return records, frozen


def _candidate_indexes(tokens: list[str], postings: dict[str, frozenset[int]]) -> set[int]:
    lists = [postings[token] for token in tokens if token in postings]
    if not lists:
        return set()
    lists.sort(key=len)
    matched = set(lists[0])
    for bucket in lists[1:]:
        matched &= bucket
        if not matched:
            break
    if matched:
        return matched
    return set(lists[0])


def _score_record(query: str, tokens: list[str], record: LyricRecord) -> LyricHit | None:
    if query == record.opening or query == record.title:
        return LyricHit(record.number, 100.0, "opening_line")
    if record.opening.startswith(query) or record.title.startswith(query):
        return LyricHit(record.number, 88.0, "opening_line")
    if query in record.opening or query in record.title:
        return LyricHit(record.number, 72.0, "opening_line")
    if query in record.body:
        return LyricHit(record.number, 48.0, "full_text")
    if not tokens:
        return None
    distinctive = [token for token in tokens if token not in _STOP]
    scored = distinctive or tokens
    hits = sum(1 for token in scored if token in record.tokens)
    if hits == 0:
        return None
    coverage = hits / len(scored)
    if distinctive and len(distinctive) >= 3 and coverage >= 0.7:
        return LyricHit(record.number, LYRIC_ENGLISH_SCORE, "full_text")
    if coverage < 0.6:
        return None
    return LyricHit(record.number, 12.0 * coverage, "full_text")


def search_lyrics(query: str, limit: int = LYRIC_RESULT_LIMIT) -> list[LyricHit]:
    normalized = normalize_lyric_text(query)
    if len(normalized) < 2:
        return []
    records, _postings = lyric_index()
    tokens = normalized.split()
    hits: list[LyricHit] = []
    for record in records:
        hit = _score_record(normalized, tokens, record)
        if hit:
            hits.append(hit)
    hits.sort(key=lambda item: (-item.score, item.number))
    return hits[: max(1, limit)]


def confident_lyric_hits(hits: list[LyricHit]) -> list[LyricHit]:
    return [hit for hit in hits if hit.matched_by == "opening_line" or hit.score >= LYRIC_ENGLISH_SCORE]


def lyric_search_response(
    query: str,
    hits: list[LyricHit],
    songs: list[Song],
    media_counts: dict[int, MediaSummary],
) -> SearchResponse:
    lookup = {song.number: song for song in songs}
    items: list[SearchResultItem] = []
    for hit in hits:
        song = lookup.get(hit.number)
        if song is None:
            continue
        summary = media_counts.get(song.number, MediaSummary())
        matched_by = [hit.matched_by]
        if song.is_verified or song.canonical_source_status == "verified":
            matched_by.append("verified")
        items.append(
            SearchResultItem(
                song_number=song.number,
                opening_line=song.first_line,
                matched_by=matched_by,
                score=round(hit.score, 4),
                verification_status="officially_verified"
                if song.is_verified or song.canonical_source_status == "verified"
                else song.canonical_source_status,
                themes=[value for value in [song.theme] if value],
                media_summary=summary,
            )
        )
    return SearchResponse(
        query=query,
        detected_intent="lyric_search",
        total=len(items),
        items=items,
    )
