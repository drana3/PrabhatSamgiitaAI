from __future__ import annotations

import argparse
import json
import re
import sys
import time
import unicodedata
from collections.abc import Iterator
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

CHANNELS = (
    {
        "url": "https://www.youtube.com/@AMPS0521spirituality/videos",
        "id": "UCzJy4vdGKx6gzP782-5buOQ",
        "name": "AMPS Spirituality",
        "notes": "Embedded from the allow-listed AMPS spirituality channel; not re-hosted.",
    },
    {
        "url": "https://www.youtube.com/@Ananda_Marga/videos",
        "id": "UCc3f8g07me5NpqHfAsF8GIA",
        "name": "ANANDA MARGA",
        "notes": "Embedded from the allow-listed ANANDA MARGA channel; not re-hosted.",
    },
)
OUTPUT_PATH = Path(__file__).resolve().parents[1] / "data" / "generated" / "youtube_videos.json"
REVIEW_OUTPUT_PATH = (
    Path(__file__).resolve().parents[1] / "data" / "generated" / "youtube_review_queue.json"
)
SONGS_PATH = Path(__file__).resolve().parents[1] / "data" / "generated" / "songs.json"
USER_AGENT = "Mozilla/5.0 (compatible; PrabhatSamgiitaAI/1.0; +https://github.com/drana3/PrabhatSamgiitaAI)"


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


def channel_videos(channel: dict[str, str], max_pages: int = 50) -> list[dict[str, str]]:
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


def explicit_song_number(title: str) -> int | None:
    if not re.search(r"prabhat\s*(?:samgiita|samgita|sangeet|sangeeta)", title, re.I):
        return None
    patterns = (
        r"(?:song\s*)?(?:number|no\.?|#)\s*(\d{1,4})",
        r"prabhat\s*(?:samgiita|samgita|sangeet|sangeeta)\D{0,24}(\d{1,4})",
    )
    for pattern in patterns:
        match = re.search(pattern, title, re.I)
        if match:
            number = int(match.group(1))
            if 1 <= number <= 5018:
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
    channel: dict[str, str] = CHANNELS[0],
) -> dict[str, Any] | None:
    number = explicit_song_number(video["title"])
    if number is None or number not in songs:
        return None
    similarity = title_similarity(video["title"], songs[number])
    score = round(0.35 + 0.25 * similarity + 0.15 * similarity + 0.15, 3)
    if score < 0.75:
        return None
    video_id = video["video_id"]
    verification = "verified" if score >= 0.9 else "pending_review"
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
            "source_status": "verified_community",
            "rights_status": "embed_only",
            "availability_status": "available",
            "match_score": score,
            "match_method": "explicit_song_number_then_canonical_title",
        },
    }


def review_row(
    video: dict[str, str],
    songs: dict[int, dict[str, Any]],
    channel: dict[str, str] = CHANNELS[0],
) -> dict[str, Any]:
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


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--max-pages", type=int, default=50)
    parser.add_argument("--output", type=Path, default=OUTPUT_PATH)
    parser.add_argument("--review-output", type=Path, default=REVIEW_OUTPUT_PATH)
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
    for channel in CHANNELS:
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
            row = media_row(video, songs, channel)
            if row is None:
                review = review_row(video, songs, channel)
                review_by_id[review["external_id"]] = review
            else:
                rows_by_id[row["metadata_json"]["external_id"]] = row
                review_by_id.pop(row["metadata_json"]["external_id"], None)
    rows = list(rows_by_id.values())
    review_rows = list(review_by_id.values())
    rows.sort(key=lambda row: (row["song_number"], row["url"]))
    review_rows.sort(key=lambda row: row["external_id"])
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    args.review_output.write_text(
        json.dumps(review_rows, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(
        json.dumps(
            {
                "channel_videos_discovered": discovered_by_channel,
                "numbered_song_videos_published": len(rows),
                "songs_with_video": len({row["song_number"] for row in rows}),
                "videos_pending_review": len(review_rows),
                "output": str(args.output),
                "review_output": str(args.review_output),
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
