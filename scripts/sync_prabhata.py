from __future__ import annotations

import json
import re
from dataclasses import asdict, dataclass
from pathlib import Path
from urllib.parse import urljoin

import httpx
from bs4 import BeautifulSoup

BASE_URL = "https://prabhatasamgiita.net"
OUT_DIR = Path("data/generated")


@dataclass(slots=True)
class Resource:
    source_kind: str
    title: str
    url: str
    status: str = "active"
    metadata_json: dict | None = None
    notes: str | None = None


def fetch(url: str) -> str:
    with httpx.Client(timeout=60, follow_redirects=True) as client:
        response = client.get(url)
        response.raise_for_status()
        return response.text


def clean(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def crawl_site() -> list[Resource]:
    resources: dict[str, Resource] = {}
    for path in ["/", "/listings.html", "/links.html", "/stories.html", "/shiva.html", "/sanskrit.html", "/aungika.html", "/indianclassical.html"]:
        html = fetch(urljoin(BASE_URL, path))
        soup = BeautifulSoup(html, "html.parser")
        for anchor in soup.find_all("a", href=True):
            href = anchor["href"].strip()
            title = clean(anchor.get_text(" ", strip=True))
            if not title:
                continue
            absolute = urljoin(BASE_URL, href)
            if absolute not in resources:
                if "youtube.com" in absolute or "youtu.be" in absolute:
                    kind = "video"
                elif absolute.endswith(".mp3"):
                    kind = "audio"
                elif absolute.endswith(".pdf"):
                    kind = "notation"
                else:
                    kind = "page"
                resources[absolute] = Resource(
                    source_kind=kind,
                    title=title,
                    url=absolute,
                    metadata_json={"discovered_from": path},
                )
    return list(resources.values())


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    inventory = crawl_site()
    (OUT_DIR / "inventory.json").write_text(
        json.dumps([asdict(item) for item in inventory], indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    print(f"Wrote {len(inventory)} resources to {OUT_DIR / 'inventory.json'}")


if __name__ == "__main__":
    main()
