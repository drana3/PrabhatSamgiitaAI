from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from urllib.parse import urljoin

import httpx
from bs4 import BeautifulSoup

BASE_URL = "https://prabhatasamgiita.net"
ROOT = Path(__file__).resolve().parents[1]
SEED_PATH = ROOT / "data" / "seed" / "stories.json"
OUTPUT_PATH = ROOT / "data" / "generated" / "stories.json"

SKIP_PHRASES = (
    "facebook page",
    "song search",
    "browse prabh",
    "firstline listings",
    "live recordings",
    "more about",
    "contact",
    "innersong.com",
    "prabhatasamgiita.net",
    "prabháta-sam",
)


def extract_paragraphs(html: str) -> list[str]:
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "nav", "header", "footer"]):
        tag.decompose()

    paragraphs: list[str] = []
    seen: set[str] = set()
    for node in soup.find_all(["p", "blockquote", "h3", "h4"]):
        text = " ".join(node.get_text(" ", strip=True).split())
        if len(text) < 40:
            continue
        lowered = text.casefold()
        if any(phrase in lowered for phrase in SKIP_PHRASES):
            continue
        if lowered in seen:
            continue
        seen.add(lowered)
        paragraphs.append(text)
    return paragraphs


def sync_stories() -> list[dict[str, object]]:
    seed_rows = json.loads(SEED_PATH.read_text(encoding="utf-8"))
    synced: list[dict[str, object]] = []

    with httpx.Client(timeout=30.0, follow_redirects=True) as client:
        for row in seed_rows:
            url = str(row["url"])
            print(f"Fetching {url}")
            response = client.get(url)
            response.raise_for_status()
            paragraphs = extract_paragraphs(response.text)
            if not paragraphs:
                paragraphs = [str(row["teaser"])]
            synced.append(
                {
                    **row,
                    "source_url": url,
                    "body_paragraphs": paragraphs,
                    "verification_status": "source_verified",
                    "is_active": True,
                }
            )

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(synced, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {len(synced)} stories to {OUTPUT_PATH}")
    return synced


if __name__ == "__main__":
    try:
        sync_stories()
    except Exception as exc:
        print(f"sync_stories failed: {exc}", file=sys.stderr)
        raise
