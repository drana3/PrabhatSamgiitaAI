from __future__ import annotations

import argparse
import json
import re
import unicodedata
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any
from urllib.parse import urlparse
from urllib.request import Request, urlopen

from bs4 import BeautifulSoup

SOURCE_URL = "https://psplayer.org/"
OUTPUT_PATH = Path(__file__).resolve().parents[1] / "data" / "generated" / "external_audio.json"
SONGS_PATH = Path(__file__).resolve().parents[1] / "data" / "generated" / "songs.json"
USER_AGENT = "Mozilla/5.0 (compatible; PrabhatSamgiitaAI/1.0; +https://github.com/drana3/PrabhatSamgiitaAI)"
ALLOWED_AUDIO_HOSTS = {"sarkarverse.org", "www.sarkarverse.org"}


def fetch(url: str) -> str:
    request = Request(url, headers={"User-Agent": USER_AGENT})
    with urlopen(request, timeout=90) as response:
        return bytes(response.read()).decode("utf-8", errors="replace")


def normalize(value: str) -> str:
    decomposed = unicodedata.normalize("NFKD", value)
    plain = "".join(character for character in decomposed if not unicodedata.combining(character))
    return " ".join(re.findall(r"[a-z0-9]+", plain.lower()))


def title_similarity(source_title: str, song: dict[str, Any]) -> float:
    candidate = normalize(source_title)
    scores: list[float] = []
    for key in ("title", "first_line"):
        canonical = normalize(str(song.get(key) or ""))
        if not canonical:
            continue
        scores.append(
            1.0
            if canonical in candidate or candidate in canonical
            else SequenceMatcher(None, canonical, candidate).ratio()
        )
    return max(scores, default=0.0)


def parse_index(html: str, songs: dict[int, dict[str, Any]]) -> list[dict[str, Any]]:
    soup = BeautifulSoup(html, "html.parser")
    rows: list[dict[str, Any]] = []
    seen_urls: set[str] = set()
    for card in soup.select("article.song-card[data-number]"):
        raw_number = str(card.get("data-number") or "")
        if not raw_number.isdigit():
            continue
        number = int(raw_number)
        if number not in songs:
            continue
        play = card.select_one("[data-audio-url]")
        audio_url = str(play.get("data-audio-url") or "") if play else ""
        parsed = urlparse(audio_url)
        if parsed.scheme != "https" or (parsed.hostname or "").lower() not in ALLOWED_AUDIO_HOSTS:
            continue
        if audio_url in seen_urls:
            continue
        title_element = card.select_one(".song-card__title a")
        title = title_element.get_text(" ", strip=True) if title_element else songs[number]["title"]
        similarity = title_similarity(title, songs[number])
        match_score = round(0.65 + 0.35 * similarity, 3)
        rows.append(
            {
                "song_number": number,
                "kind": "audio",
                "provider": "external_site",
                "title": f"PS {number}: {title}",
                "url": audio_url,
                "embed_url": audio_url,
                "verification_status": "unverified",
                "source_url": f"https://psplayer.org/song.php?n={number:04d}",
                "notes": (
                    "Public number-indexed community audio link discovered through PS Player; "
                    "streamed from Sarkarverse and not re-hosted."
                ),
                "metadata_json": {
                    "source_status": "community",
                    "rights_status": "link_only",
                    "availability_status": "available",
                    "match_score": match_score,
                    "match_method": "source_song_number_then_canonical_title",
                    "discovered_from": SOURCE_URL,
                },
            }
        )
        seen_urls.add(audio_url)
    return sorted(rows, key=lambda row: (row["song_number"], row["url"]))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=OUTPUT_PATH)
    parser.add_argument("--source", default=SOURCE_URL)
    args = parser.parse_args()
    songs = {row["number"]: row for row in json.loads(SONGS_PATH.read_text(encoding="utf-8"))}
    rows = parse_index(fetch(args.source), songs)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(
        json.dumps(
            {
                "audio_links_discovered": len(rows),
                "songs_with_audio": len({row["song_number"] for row in rows}),
                "source": args.source,
                "output": str(args.output),
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
