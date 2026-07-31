from __future__ import annotations

from dataclasses import dataclass
from urllib.parse import urljoin

import httpx
from bs4 import BeautifulSoup


@dataclass(slots=True)
class ExternalResource:
    kind: str
    title: str
    url: str
    status: str = "active"
    metadata_json: dict | None = None
    notes: str | None = None


class OfficialCatalogScraper:
    def __init__(self, base_url: str) -> None:
        self.base_url = base_url.rstrip("/")

    async def fetch_page(self, path: str) -> str:
        async with httpx.AsyncClient(timeout=60, follow_redirects=True) as client:
            response = await client.get(urljoin(self.base_url + "/", path.lstrip("/")))
            response.raise_for_status()
            return response.text

    async def inventory(self) -> list[ExternalResource]:
        html = await self.fetch_page("/")
        soup = BeautifulSoup(html, "html.parser")
        resources: list[ExternalResource] = []
        for anchor in soup.find_all("a", href=True):
            href = anchor["href"]
            text = anchor.get_text(" ", strip=True)
            if not text:
                continue
            if "youtube.com" in href or "youtu.be" in href:
                kind = "video"
            elif href.endswith(".mp3"):
                kind = "audio"
            elif href.endswith(".pdf"):
                kind = "notation"
            else:
                kind = "page"
            resources.append(
                ExternalResource(
                    kind=kind,
                    title=text,
                    url=urljoin(self.base_url + "/", href),
                    metadata_json={"source": "official-site"},
                )
            )
        unique: dict[str, ExternalResource] = {}
        for item in resources:
            unique.setdefault(item.url, item)
        return list(unique.values())

    async def song_page(self, number: int) -> str | None:
        html = await self.fetch_page("/1-5018.htm")
        marker = f"{number} "
        if marker not in html:
            return None
        return html


def is_translatable(song_text: str) -> bool:
    return bool(song_text.strip())
