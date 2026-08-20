from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from functools import lru_cache

from app.models import Song
from app.schemas.search import MediaSummary, SearchResponse, SearchResultItem
from app.services.catalog import catalog_song_snapshot

LYRIC_RESULT_LIMIT = 5
LYRIC_PHRASE_SCORE = 48.0
LYRIC_ENGLISH_SCORE = 40.0
_TOKEN = re.compile(r"[^a-z0-9]+")
_STOP = frozenset(
    (
        "a an and as at be but by can do for from i if in is it me my no not o of oh "
        "on or so that the this to us we with you your"
    ).split()
)


def normalize_lyric_text(value: str | None) -> str:
    decomposed = unicodedata.normalize("NFKD", value or "").casefold()
    plain = "".join(character for character in decomposed if not unicodedata.combining(character))
    return _TOKEN.sub(" ", plain).strip()


def fold_lyric_phonetic(value: str) -> str:
    """Fold common Roman-transliteration spellings: humdardi ≈ hamdardi, siv ≈ shiva."""
    return " ".join(token for token in (_fold_lyric_token(part) for part in value.split()) if token)


def _fold_lyric_token(token: str) -> str:
    folded = token
    replacements = (
        (r"aa+", "a"),
        (r"ee+", "i"),
        (r"oo+", "u"),
        (r"uu+", "u"),
        (r"kh", "k"),
        (r"gh", "g"),
        (r"bh", "b"),
        (r"dh", "d"),
        (r"ph", "f"),
        (r"th", "t"),
        (r"sh", "s"),
        (r"ch", "c"),
        (r"v", "w"),
        (r"y", "i"),
    )
    for pattern, replacement in replacements:
        folded = re.sub(pattern, replacement, folded)
    if len(folded) >= 4 and folded.endswith("a"):
        folded = folded[:-1]
    folded = re.sub(r"[ou]", "a", folded)
    folded = re.sub(r"i{2,}", "i", folded)
    folded = re.sub(r"a{2,}", "a", folded)
    return folded


def max_lyric_edits(length: int) -> int:
    if length < 4:
        return 0
    if length < 6:
        return 1
    return 2


def _adjacent_transpose(left: str, right: str) -> bool:
    if len(left) != len(right) or len(left) < 2:
        return False
    index = 0
    while index < len(left) and left[index] == right[index]:
        index += 1
    if index >= len(left) - 1:
        return False
    if left[index] != right[index + 1] or left[index + 1] != right[index]:
        return False
    return left[index + 2 :] == right[index + 2 :]


def within_lyric_edits(left: str, right: str, max_edits: int | None = None) -> bool:
    allowed = max_lyric_edits(len(left)) if max_edits is None else max_edits
    if left == right:
        return True
    if allowed <= 0:
        return False
    if abs(len(left) - len(right)) > allowed:
        return False
    if len(left) == len(right) and _adjacent_transpose(left, right):
        return True
    previous = list(range(len(right) + 1))
    current = [0] * (len(right) + 1)
    for row, left_ch in enumerate(left, start=1):
        current[0] = row
        best = current[0]
        for col, right_ch in enumerate(right, start=1):
            cost = 0 if left_ch == right_ch else 1
            value = min(previous[col] + 1, current[col - 1] + 1, previous[col - 1] + cost)
            current[col] = value
            if value < best:
                best = value
        if best > allowed:
            return False
        previous, current = current, previous
    return previous[len(right)] <= allowed


def fuzzy_token_match(needle: str, tokens: tuple[str, ...] | frozenset[str]) -> bool:
    if not needle or len(needle) < 4:
        return False
    allowed = max_lyric_edits(len(needle))
    if allowed <= 0:
        return False
    for token in tokens:
        if not token or len(token) < 3:
            continue
        if token == needle:
            return True
        if token.startswith(needle) and len(token) - len(needle) <= allowed + 1:
            return True
        if needle.startswith(token) and len(needle) - len(token) <= allowed + 1:
            return True
        if abs(len(token) - len(needle)) > allowed:
            continue
        if within_lyric_edits(needle, token, allowed):
            return True
    return False


def lyric_tokens_match(left: str, right: str) -> bool:
    if not left or not right:
        return False
    if left == right:
        return True
    a = fold_lyric_phonetic(left)
    b = fold_lyric_phonetic(right)
    if not a or not b:
        return False
    if a == b:
        return True
    if len(a) >= 5 and len(b) > len(a) and b.startswith(a) and len(b) - len(a) <= 2:
        return True
    if len(b) >= 5 and len(a) > len(b) and a.startswith(b) and len(a) - len(b) <= 2:
        return True
    if len(a) < 5 or len(b) < 5:
        return False
    if a[:4] != b[:4]:
        return False
    return within_lyric_edits(a, b, 1)


def ordered_lyric_coverage(query_tokens: list[str], haystack_tokens: list[str]) -> float:
    if not query_tokens or not haystack_tokens:
        return 0.0
    best = 0.0
    max_gap = 1 if len(query_tokens) >= 4 else 2
    first = query_tokens[0]
    for start, hay in enumerate(haystack_tokens):
        if not lyric_tokens_match(first, hay):
            continue
        qi = 1
        gaps = 0
        for hi in range(start + 1, len(haystack_tokens)):
            if qi >= len(query_tokens):
                break
            if lyric_tokens_match(query_tokens[qi], haystack_tokens[hi]):
                qi += 1
                gaps = 0
                continue
            gaps += 1
            if gaps > max_gap:
                break
        best = max(best, qi / len(query_tokens))
        if best == 1:
            return 1.0
    return best


def _has_lyric_phrase_anchor(
    anchors: list[str],
    record: LyricRecord,
    opening_words: list[str],
    body_words: list[str],
) -> bool:
    for anchor in anchors:
        if len(anchor) < 4 or anchor in _COMMON_LYRIC_TOKENS:
            continue
        if anchor in record.folded_tokens or anchor in record.opening_token_set:
            return True
        if any(lyric_tokens_match(anchor, token) for token in opening_words):
            return True
        if any(lyric_tokens_match(anchor, token) for token in body_words):
            return True
    return False


_COMMON_LYRIC_TOKENS = frozenset(
    (
        "ami tumi tomar tomay tomake tomakei mora mor mama go re se oi ei ar na ki kii he "
        "ogo prabhu more moreke amay amake"
    ).split()
)


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
    folded_title: str
    folded_opening: str
    folded_body: str
    folded_tokens: frozenset[str]
    opening_tokens: tuple[str, ...]
    opening_token_set: frozenset[str]
    token_list: tuple[str, ...]
    opening_raw_tokens: tuple[str, ...]
    raw_token_list: tuple[str, ...]


def _record_from_song(song: Song) -> LyricRecord:
    title = normalize_lyric_text(song.title)
    opening = normalize_lyric_text(song.first_line)
    lyrics = normalize_lyric_text(song.lyrics_original)
    translit = normalize_lyric_text(song.transliteration)
    body = " ".join(part for part in (title, opening, lyrics, translit) if part)
    folded_title = fold_lyric_phonetic(title)
    folded_opening = fold_lyric_phonetic(opening)
    folded_body = fold_lyric_phonetic(body)
    folded_tokens = frozenset(folded_body.split())
    opening_tokens = tuple(
        dict.fromkeys(
            token
            for token in f"{folded_title} {folded_opening}".split()
            if len(token) >= 3
        )
    )
    opening_raw_tokens = tuple(
        dict.fromkeys(
            token
            for token in f"{title} {opening}".split()
            if len(token) >= 3
        )
    )
    raw_token_list = tuple(dict.fromkeys(token for token in body.split() if len(token) >= 3))
    return LyricRecord(
        number=int(song.number),
        title=title,
        opening=opening,
        body=body,
        tokens=frozenset(body.split()),
        folded_title=folded_title,
        folded_opening=folded_opening,
        folded_body=folded_body,
        folded_tokens=folded_tokens,
        opening_tokens=opening_tokens,
        opening_token_set=frozenset(opening_tokens),
        token_list=tuple(folded_tokens),
        opening_raw_tokens=opening_raw_tokens,
        raw_token_list=raw_token_list,
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


def _token_in_record(token: str, folded_token: str, record: LyricRecord) -> bool:
    if token in record.tokens:
        return True
    if len(token) < 4:
        return False
    return folded_token in record.folded_tokens


def _score_record(
    query: str,
    tokens: list[str],
    record: LyricRecord,
    folded_query: str,
    folded_tokens: list[str],
) -> LyricHit | None:
    if query == record.opening or query == record.title:
        return LyricHit(record.number, 100.0, "opening_line")
    if record.opening.startswith(query) or record.title.startswith(query):
        return LyricHit(record.number, 88.0, "opening_line")
    if query in record.opening or query in record.title:
        return LyricHit(record.number, 72.0, "opening_line")
    if query in record.body:
        return LyricHit(record.number, 48.0, "full_text")
    if len(folded_query) >= 4 and (
        folded_query in record.folded_opening or folded_query in record.folded_title
    ):
        return LyricHit(record.number, 64.0, "opening_line")
    if len(folded_query) >= 3 and folded_query in record.opening_token_set:
        return LyricHit(record.number, 64.0, "opening_line")
    if len(folded_query) >= 4 and folded_query in record.folded_body:
        return LyricHit(record.number, 44.0, "full_text")
    if len(folded_query) >= 3 and folded_query in record.folded_tokens:
        return LyricHit(record.number, 44.0, "full_text")

    if len(tokens) >= 3:
        opening_words = f"{record.title} {record.opening}".split()
        body_words = record.body.split()
        folded_opening_words = f"{record.folded_title} {record.folded_opening}".split()
        if _has_lyric_phrase_anchor(folded_tokens, record, opening_words, body_words):
            opening_coverage = max(
                ordered_lyric_coverage(tokens, opening_words),
                ordered_lyric_coverage(folded_tokens, folded_opening_words),
            )
            body_coverage = max(
                ordered_lyric_coverage(tokens, body_words),
                ordered_lyric_coverage(folded_tokens, record.folded_body.split()),
            )
            best_coverage = max(opening_coverage, body_coverage)
            if best_coverage >= 0.8:
                score = round(70 + best_coverage * 18)
                matched_by = "opening_line" if opening_coverage >= body_coverage else "full_text"
                return LyricHit(record.number, float(score), matched_by)

    if not tokens:
        return None
    distinctive = [token for token in tokens if token not in _STOP]
    scored = distinctive or tokens
    folded_map = dict(zip(tokens, folded_tokens, strict=True))
    opening_hits = 0
    body_hits = 0
    unmatched: list[tuple[str, str]] = []
    for token in scored:
        folded_token = folded_map[token]
        if token in record.opening_raw_tokens or (
            len(folded_token) >= 3 and folded_token in record.opening_token_set
        ):
            opening_hits += 1
            continue
        if token in record.tokens or (
            len(folded_token) >= 3 and folded_token in record.folded_tokens
        ):
            body_hits += 1
            continue
        unmatched.append((token, folded_token))
    matched = opening_hits + body_hits
    if not (matched / len(scored) >= 0.6) and unmatched and (len(scored) <= 2 or matched > 0):
        for token, folded_token in unmatched:
            if fuzzy_token_match(token, record.opening_raw_tokens) or fuzzy_token_match(
                folded_token, record.opening_tokens
            ):
                opening_hits += 1
                continue
            if fuzzy_token_match(token, record.raw_token_list) or fuzzy_token_match(
                folded_token, record.token_list
            ):
                body_hits += 1
    coverage = (opening_hits + body_hits) / len(scored)
    rare_opening_hits = 0
    for token in scored:
        folded_token = folded_map[token]
        if token in _COMMON_LYRIC_TOKENS or folded_token in _COMMON_LYRIC_TOKENS:
            continue
        if (
            token in record.opening_raw_tokens
            or (len(folded_token) >= 3 and folded_token in record.opening_token_set)
            or fuzzy_token_match(token, record.opening_raw_tokens)
            or fuzzy_token_match(folded_token, record.opening_tokens)
        ):
            rare_opening_hits += 1
    if opening_hits and opening_hits / len(scored) >= 0.6:
        if len(scored) >= 3 and rare_opening_hits == 0:
            return LyricHit(record.number, 36.0, "opening_line")
        if len(scored) == 1:
            return LyricHit(record.number, 64.0, "opening_line")
        if len(scored) >= 3:
            return LyricHit(record.number, 52.0, "opening_line")
        return LyricHit(record.number, 58.0, "opening_line")
    if opening_hits + body_hits and coverage >= 0.6:
        return LyricHit(record.number, 44.0 if len(scored) == 1 else 42.0, "full_text")
    return None


def search_lyrics(query: str, limit: int = LYRIC_RESULT_LIMIT) -> list[LyricHit]:
    normalized = normalize_lyric_text(query)
    if len(normalized) < 2:
        return []
    records, _postings = lyric_index()
    tokens = normalized.split()
    folded_query = fold_lyric_phonetic(normalized)
    folded_tokens = [fold_lyric_phonetic(token) for token in tokens]
    hits: list[LyricHit] = []
    for record in records:
        hit = _score_record(normalized, tokens, record, folded_query, folded_tokens)
        if hit:
            hits.append(hit)
    hits.sort(key=lambda item: (-item.score, item.number))
    return hits[: max(1, limit)]


def confident_lyric_hits(hits: list[LyricHit]) -> list[LyricHit]:
    return [
        hit
        for hit in hits
        if hit.matched_by == "opening_line" or hit.score >= LYRIC_ENGLISH_SCORE
    ]


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
