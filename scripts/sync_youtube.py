from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import unicodedata
from collections.abc import Iterator
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote_plus
from urllib.request import Request, urlopen

CHANNELS = (
    {
        "url": "https://www.youtube.com/@AMPS0521spirituality/videos",
        "id": "UCzJy4vdGKx6gzP782-5buOQ",
        "name": "AMPS Spirituality",
        "trusted": True,
        "notes": "Embedded from the allow-listed AMPS spirituality channel; not re-hosted.",
    },
    {
        "url": "https://www.youtube.com/@Ananda_Marga/videos",
        "id": "UCc3f8g07me5NpqHfAsF8GIA",
        "name": "ANANDA MARGA",
        "trusted": True,
        "notes": "Embedded from the allow-listed ANANDA MARGA channel; not re-hosted.",
    },
)
GENERAL_YOUTUBE = {
    "url": "https://www.youtube.com/results",
    "id": "youtube-community-search",
    "name": "YouTube community",
    "trusted": False,
    "notes": "A number-first community match discovered after trusted channels; not re-hosted.",
}
OUTPUT_PATH = Path(__file__).resolve().parents[1] / "data" / "generated" / "youtube_videos.json"
REVIEW_OUTPUT_PATH = (
    Path(__file__).resolve().parents[1] / "data" / "generated" / "youtube_review_queue.json"
)
SEARCH_STATE_PATH = (
    Path(__file__).resolve().parents[1] / "data" / "generated" / "youtube_search_state.json"
)
SONGS_PATH = Path(__file__).resolve().parents[1] / "data" / "generated" / "songs.json"
USER_AGENT = "Mozilla/5.0 (compatible; PrabhatSamgiitaAI/1.0; +https://github.com/drana3/PrabhatSamgiitaAI)"
MIN_SONG_NUMBER = 1
MAX_SONG_NUMBER = 5018
PRABHAT_SAMGIITA_RE = re.compile(
    r"prabhat\s*(?:samgiita|samgita|sangeet|sangeeta)",
    re.I,
)
PRABHAT_HINT_RE = re.compile(r"prab?h?a?t", re.I)
SAMGIITA_HINT_RE = re.compile(
    r"sam?g+i+[et]{1,2}a?|sange+e?t+a?|samgita|samgiit|sangiita",
    re.I,
)
PRABHAT_ROOT = "prabhat"
SAMGIITA_ROOTS = ("samgiita", "samgita", "sangeet", "sangeeta", "samgeeta")


def _libpq_url(database_url: str) -> str:
    return database_url.replace("postgresql+psycopg://", "postgresql://", 1)


def persist_youtube_inventory(
    rows: list[dict[str, Any]],
    review_rows: list[dict[str, Any]],
    discovered_by_channel: dict[str, int],
    database_url: str | None = None,
) -> dict[str, int]:
    """Upsert scanned media and review-queue rows into Postgres (Neon)."""
    database_url = database_url or os.environ.get("DATABASE_URL")
    if not database_url:
        print("Skipping Neon persist because DATABASE_URL is unset", file=sys.stderr)
        return {"inserted_media": 0, "inserted_reviews": 0, "updated_reviews": 0}
    import psycopg
    from psycopg.types.json import Json

    inserted_media = 0
    inserted_reviews = 0
    with psycopg.connect(_libpq_url(database_url), connect_timeout=30) as conn:
        with conn.cursor() as cur:
            cur.execute("SET statement_timeout = '5min'")
            for row in rows:
                metadata = dict(row.get("metadata_json") or {})
                external_id = str(metadata.get("external_id") or "").strip()
                if not external_id:
                    continue
                cur.execute(
                    """
                    SELECT id FROM media
                    WHERE provider = 'youtube'
                      AND (
                        metadata_json->>'external_id' = %s
                        OR url LIKE %s
                      )
                    LIMIT 1
                    """,
                    (external_id, f"%{external_id}%"),
                )
                if cur.fetchone():
                    continue
                cur.execute(
                    """
                    INSERT INTO media (
                        song_number, kind, provider, title, url, embed_url,
                        verification_status, source_url, notes, metadata_json
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        int(row["song_number"]),
                        str(row.get("kind") or "video"),
                        str(row.get("provider") or "youtube"),
                        str(row.get("title") or "")[:255],
                        str(row.get("url") or ""),
                        row.get("embed_url"),
                        str(row.get("verification_status") or "unverified"),
                        row.get("source_url"),
                        row.get("notes"),
                        Json(metadata),
                    ),
                )
                inserted_media += 1
            for row in review_rows:
                external_id = str(row.get("external_id") or "").strip()
                if not external_id:
                    continue
                cur.execute(
                    """
                    INSERT INTO youtube_review_queue (
                        id, external_id, title, url, channel_id, channel_name,
                        source_url, candidate_song_number, title_similarity,
                        review_reason, status
                    )
                    VALUES (
                        gen_random_uuid(), %s, %s, %s, %s, %s, %s, %s, %s, %s, 'pending_review'
                    )
                    ON CONFLICT (external_id) DO UPDATE SET
                        title = EXCLUDED.title,
                        candidate_song_number = EXCLUDED.candidate_song_number,
                        title_similarity = EXCLUDED.title_similarity,
                        review_reason = EXCLUDED.review_reason,
                        source_url = EXCLUDED.source_url
                    WHERE youtube_review_queue.status = 'pending_review'
                    """,
                    (
                        external_id,
                        str(row.get("title") or "Untitled video"),
                        str(row.get("url") or ""),
                        row.get("channel_id"),
                        row.get("channel_name"),
                        row.get("source_url"),
                        row.get("candidate_song_number"),
                        row.get("title_similarity"),
                        str(row.get("review_reason") or "pending_review"),
                    ),
                )
                inserted_reviews += max(cur.rowcount or 0, 0)
            for channel_name, discovered in discovered_by_channel.items():
                cur.execute(
                    """
                    UPDATE youtube_scan_channels
                    SET last_scanned_at = NOW(),
                        last_scan_discovered = %s
                    WHERE name = %s AND is_active = true
                    """,
                    (int(discovered), channel_name),
                )
        conn.commit()
    return {
        "inserted_media": inserted_media,
        "inserted_reviews": inserted_reviews,
        "updated_reviews": 0,
    }


def load_scan_channels(database_url: str | None = None) -> list[dict[str, Any]]:
    database_url = database_url or os.environ.get("DATABASE_URL")
    if not database_url:
        return list(CHANNELS)
    try:
        import psycopg

        url = _libpq_url(database_url)
        with psycopg.connect(url, connect_timeout=30) as conn, conn.cursor() as cur:
            cur.execute(
                """
                SELECT channel_id, channel_url, name, is_trusted, notes
                FROM youtube_scan_channels
                WHERE is_active = true
                ORDER BY name
                """
            )
            rows = cur.fetchall()
        if not rows:
            return list(CHANNELS)
        return [
            {
                "url": row[1],
                "id": row[0],
                "name": row[2],
                "trusted": bool(row[3]),
                "notes": row[4]
                or f"Scanned from {row[2]}; embedded only, not re-hosted.",
            }
            for row in rows
        ]
    except Exception as exc:
        print(f"Using default channels after DB load failed: {exc}", file=sys.stderr)
        return list(CHANNELS)


def fetch(url: str, payload: dict[str, Any] | None = None) -> str:
    body = json.dumps(payload).encode() if payload is not None else None
    for attempt in range(3):
        request = Request(
            url,
            data=body,
            headers={"User-Agent": USER_AGENT, "Content-Type": "application/json"},
        )
        try:
            with urlopen(request, timeout=45) as response:
                return bytes(response.read()).decode("utf-8")
        except (HTTPError, URLError, TimeoutError):
            if attempt == 2:
                raise
            time.sleep(2 ** (attempt + 1))
    raise RuntimeError("YouTube request retry loop ended unexpectedly")


def initial_data(html: str) -> dict[str, Any]:
    for marker in ("var ytInitialData = ", "window[\"ytInitialData\"] = "):
        start = html.find(marker)
        if start >= 0:
            value, _ = json.JSONDecoder().raw_decode(html, start + len(marker))
            if isinstance(value, dict):
                return value
    raise ValueError("YouTube initial data was not found")


def walk(value: Any) -> Iterator[dict[str, Any]]:
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from walk(child)
    elif isinstance(value, list):
        for child in value:
            yield from walk(child)


def nested(value: dict[str, Any], *keys: str) -> Any:
    current: Any = value
    for key in keys:
        if not isinstance(current, dict):
            return None
        current = current.get(key)
    return current


def extract_videos(payload: dict[str, Any]) -> list[dict[str, str]]:
    videos: dict[str, dict[str, str]] = {}
    for item in walk(payload):
        model = item.get("lockupViewModel")
        if not isinstance(model, dict) or model.get("contentType") != "LOCKUP_CONTENT_TYPE_VIDEO":
            continue
        video_id = model.get("contentId")
        title = nested(model, "metadata", "lockupMetadataViewModel", "title", "content")
        if not isinstance(title, str):
            title = nested(model, "rendererContext", "accessibilityContext", "label")
        if isinstance(video_id, str) and isinstance(title, str):
            videos[video_id] = {"video_id": video_id, "title": title.strip()}
    return list(videos.values())


def continuation_tokens(payload: dict[str, Any]) -> list[str]:
    tokens: list[str] = []
    for item in walk(payload):
        command = item.get("continuationCommand")
        if isinstance(command, dict) and isinstance(command.get("token"), str):
            tokens.append(command["token"])
    return list(dict.fromkeys(tokens))


def youtube_config(html: str) -> tuple[str, str]:
    key_match = re.search(r'"INNERTUBE_API_KEY":"([^"]+)"', html)
    version_match = re.search(r'"INNERTUBE_CLIENT_VERSION":"([^"]+)"', html)
    if not key_match or not version_match:
        raise ValueError("YouTube API configuration was not found")
    return key_match.group(1), version_match.group(1)


def channel_videos(channel: dict[str, Any], max_pages: int = 50) -> list[dict[str, str]]:
    html = fetch(channel["url"])
    payload = initial_data(html)
    api_key, client_version = youtube_config(html)
    videos = {item["video_id"]: item for item in extract_videos(payload)}
    pending = continuation_tokens(payload)
    seen_tokens: set[str] = set()
    pages = 1
    while pending and pages < max_pages:
        token = pending.pop(0)
        if token in seen_tokens:
            continue
        seen_tokens.add(token)
        try:
            response = json.loads(
                fetch(
                    f"https://www.youtube.com/youtubei/v1/browse?key={api_key}",
                    {
                        "context": {
                            "client": {
                                "clientName": "WEB",
                                "clientVersion": client_version,
                            }
                        },
                        "continuation": token,
                    },
                )
            )
        except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as exc:
            print(
                f"Partial scan for {channel['name']}: continuation unavailable ({exc})",
                file=sys.stderr,
            )
            break
        videos.update({item["video_id"]: item for item in extract_videos(response)})
        pending.extend(continuation_tokens(response))
        pages += 1
    return list(videos.values())


def normalize(value: str) -> str:
    value = unicodedata.normalize("NFKD", value)
    value = "".join(character for character in value if not unicodedata.combining(character))
    return " ".join(re.findall(r"[a-z0-9]+", value.lower()))


def _token_looks_like_prabhat(token: str) -> bool:
    if len(token) < 5:
        return False
    if PRABHAT_HINT_RE.fullmatch(token) or PRABHAT_HINT_RE.search(token):
        return True
    return SequenceMatcher(None, token, PRABHAT_ROOT).ratio() >= 0.78


def _token_looks_like_samgiita(token: str) -> bool:
    if len(token) < 5:
        return False
    if SAMGIITA_HINT_RE.search(token):
        return True
    return any(SequenceMatcher(None, token, root).ratio() >= 0.78 for root in SAMGIITA_ROOTS)


def mentions_prabhat_samgiita(title: str) -> bool:
    if PRABHAT_SAMGIITA_RE.search(title):
        return True
    if PRABHAT_HINT_RE.search(title) and SAMGIITA_HINT_RE.search(title):
        return True
    normalized = normalize(title)
    compact = normalized.replace(" ", "")
    if "prabh" in compact and ("samg" in compact or "sang" in compact):
        return True
    tokens = normalized.split()
    has_prabhat = any(_token_looks_like_prabhat(token) for token in tokens)
    has_samgiita = any(_token_looks_like_samgiita(token) for token in tokens)
    return has_prabhat and has_samgiita


def bare_catalog_song_number(title: str) -> int | None:
    match = re.search(r"(?:song\s*)?(?:number|no\.?|#)\s*(\d{1,4})", title, re.I)
    if not match:
        return None
    number = int(match.group(1))
    if MIN_SONG_NUMBER <= number <= MAX_SONG_NUMBER:
        return number
    return None


def youtube_video_in_scope(title: str) -> bool:
    """Only scan videos with a catalog song number or Prabhat Samgiita in the title."""
    if bare_catalog_song_number(title) is not None:
        return True
    return mentions_prabhat_samgiita(title)


def explicit_song_number(title: str) -> int | None:
    if not mentions_prabhat_samgiita(title):
        return None
    patterns = (
        r"(?:song\s*)?(?:number|no\.?|#)\s*(\d{1,4})",
        r"#\s*(\d{1,4})",
        r"(?:samg|sang)[a-z]*\D{0,24}(\d{1,4})",
        r"prab[a-z]*\D{0,24}(\d{1,4})",
    )
    for pattern in patterns:
        match = re.search(pattern, title, re.I)
        if match:
            number = int(match.group(1))
            if MIN_SONG_NUMBER <= number <= MAX_SONG_NUMBER:
                return number
    return None


def title_similarity(video_title: str, song: dict[str, Any]) -> float:
    candidate = normalize(video_title)
    values = [normalize(str(song.get(key) or "")) for key in ("title", "first_line")]
    scores = []
    for value in values:
        if not value:
            continue
        if value in candidate:
            scores.append(1.0)
        else:
            scores.append(SequenceMatcher(None, value, candidate).ratio())
    return max(scores, default=0.0)


def media_row(
    video: dict[str, str],
    songs: dict[int, dict[str, Any]],
    channel: dict[str, Any] = CHANNELS[0],
) -> dict[str, Any] | None:
    number = explicit_song_number(video["title"])
    if number is None or number not in songs:
        return None
    similarity = title_similarity(video["title"], songs[number])
    has_explicit_marker = bool(
        re.search(
            rf"(?:song\s*)?(?:number|no\.?|#)\s*{number}(?!\d)",
            video["title"],
            re.I,
        )
    )
    trusted = bool(channel.get("trusted", True))
    if trusted:
        score = round(
            0.9 + 0.1 * similarity
            if has_explicit_marker
            else 0.35 + 0.25 * similarity + 0.15 * similarity + 0.15,
            3,
        )
        if not has_explicit_marker and score < 0.75:
            return None
    else:
        if not has_explicit_marker or similarity < 0.55:
            return None
        score = round(0.65 + 0.35 * similarity, 3)
    video_id = video["video_id"]
    verification = (
        "verified"
        if trusted and (has_explicit_marker or score >= 0.9)
        else "verified_external"
        if not trusted
        else "pending_review"
    )
    return {
        "song_number": number,
        "kind": "video",
        "provider": "youtube",
        "title": video["title"],
        "url": f"https://www.youtube.com/watch?v={video_id}",
        "embed_url": f"https://www.youtube-nocookie.com/embed/{video_id}",
        "verification_status": verification,
        "source_url": channel["url"],
        "notes": channel["notes"],
        "metadata_json": {
            "external_id": video_id,
            "channel_id": channel["id"],
            "channel_name": channel["name"],
            "source_status": "verified_community" if trusted else "community",
            "rights_status": "embed_only",
            "availability_status": "available",
            "match_score": score,
            "match_method": (
                "explicit_song_number_marker"
                if has_explicit_marker
                else "explicit_song_number_then_canonical_title"
            ),
        },
    }


def review_row(
    video: dict[str, str],
    songs: dict[int, dict[str, Any]],
    channel: dict[str, Any] = CHANNELS[0],
) -> dict[str, Any] | None:
    if not youtube_video_in_scope(video["title"]):
        return None
    number = explicit_song_number(video["title"])
    similarity = title_similarity(video["title"], songs[number]) if number in songs else 0.0
    reason = "missing_explicit_song_number"
    if number is not None:
        reason = "canonical_title_match_below_threshold"
    return {
        "external_id": video["video_id"],
        "title": video["title"],
        "url": f"https://www.youtube.com/watch?v={video['video_id']}",
        "candidate_song_number": number,
        "title_similarity": round(similarity, 3),
        "review_reason": reason,
        "channel_id": channel["id"],
        "channel_name": channel["name"],
        "source_url": channel["url"],
        "status": "pending_review",
    }


def search_youtube_for_song(song: dict[str, Any]) -> tuple[list[dict[str, Any]], str]:
    query = f"Prabhat Samgiita #{song['number']} {song.get('title') or ''}"
    search_url = f"https://www.youtube.com/results?search_query={quote_plus(query)}"
    html = fetch(search_url)
    videos = extract_videos(initial_data(html))[:20]
    source = {**GENERAL_YOUTUBE, "url": search_url}
    rows = [media_row(video, {int(song["number"]): song}, source) for video in videos]
    return [row for row in rows if row is not None], search_url


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--max-pages", type=int, default=50)
    parser.add_argument("--output", type=Path, default=OUTPUT_PATH)
    parser.add_argument("--review-output", type=Path, default=REVIEW_OUTPUT_PATH)
    parser.add_argument("--general-search-limit", type=int, default=0)
    parser.add_argument("--search-state", type=Path, default=SEARCH_STATE_PATH)
    args = parser.parse_args()
    songs = {row["number"]: row for row in json.loads(SONGS_PATH.read_text(encoding="utf-8"))}
    existing_rows = (
        json.loads(args.output.read_text(encoding="utf-8")) if args.output.exists() else []
    )
    existing_review_rows = (
        json.loads(args.review_output.read_text(encoding="utf-8"))
        if args.review_output.exists()
        else []
    )
    rows_by_id = {row["metadata_json"]["external_id"]: row for row in existing_rows}
    review_by_id = {row["external_id"]: row for row in existing_review_rows}
    discovered_by_channel: dict[str, int] = {}
    scan_channels = load_scan_channels()
    for channel in scan_channels:
        try:
            discovered = channel_videos(channel, max_pages=args.max_pages)
        except (HTTPError, URLError, TimeoutError, ValueError, json.JSONDecodeError) as exc:
            discovered_by_channel[channel["name"]] = 0
            print(
                f"Preserving {channel['name']} inventory after scan failure: {exc}",
                file=sys.stderr,
            )
            continue
        discovered_by_channel[channel["name"]] = len(discovered)
        for video in discovered:
            if not youtube_video_in_scope(video["title"]):
                continue
            row = media_row(video, songs, channel)
            if row is None:
                review = review_row(video, songs, channel)
                if review is not None:
                    review_by_id[review["external_id"]] = review
            else:
                rows_by_id[row["metadata_json"]["external_id"]] = row
                review_by_id.pop(row["metadata_json"]["external_id"], None)

    general_discovered = 0
    if args.general_search_limit > 0:
        state = (
            json.loads(args.search_state.read_text(encoding="utf-8"))
            if args.search_state.exists()
            else {"cursor": 0}
        )
        ordered_numbers = sorted(songs)
        cursor = int(state.get("cursor", 0)) % len(ordered_numbers)
        attempts = 0
        inspected = 0
        existing_song_numbers = {int(row["song_number"]) for row in rows_by_id.values()}
        while attempts < args.general_search_limit and inspected < len(ordered_numbers):
            index = (cursor + inspected) % len(ordered_numbers)
            number = ordered_numbers[index]
            inspected += 1
            if number in existing_song_numbers:
                continue
            attempts += 1
            try:
                discovered_rows, _ = search_youtube_for_song(songs[number])
            except (HTTPError, URLError, TimeoutError, ValueError, json.JSONDecodeError):
                continue
            for row in discovered_rows:
                rows_by_id[row["metadata_json"]["external_id"]] = row
                existing_song_numbers.add(number)
                general_discovered += 1
        args.search_state.parent.mkdir(parents=True, exist_ok=True)
        args.search_state.write_text(
            json.dumps({"cursor": (cursor + inspected) % len(ordered_numbers)}, indent=2)
            + "\n",
            encoding="utf-8",
        )
    rows = list(rows_by_id.values())
    review_by_id = {
        external_id: row
        for external_id, row in review_by_id.items()
        if youtube_video_in_scope(str(row.get("title") or ""))
    }
    review_rows = list(review_by_id.values())
    rows.sort(key=lambda row: (row["song_number"], row["url"]))
    review_rows.sort(key=lambda row: row["external_id"])
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    args.review_output.write_text(
        json.dumps(review_rows, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    persisted = persist_youtube_inventory(rows, review_rows, discovered_by_channel)
    print(
        json.dumps(
            {
                "channel_videos_discovered": discovered_by_channel,
                "numbered_song_videos_published": len(rows),
                "songs_with_video": len({row["song_number"] for row in rows}),
                "videos_pending_review": len(review_rows),
                "general_youtube_matches_added": general_discovered,
                "neon_inserted_media": persisted["inserted_media"],
                "neon_inserted_reviews": persisted["inserted_reviews"],
                "output": str(args.output),
                "review_output": str(args.review_output),
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
