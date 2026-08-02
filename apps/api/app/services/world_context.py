from __future__ import annotations

import asyncio
import xml.etree.ElementTree as ET
from dataclasses import dataclass, replace
from datetime import date
from urllib.parse import urlparse

import httpx

NDMA_ALL_INDIA_RSS = (
    "https://sachet.ndma.gov.in/cap_public_website/rss/rss_india.xml"
)
NDMA_SACHET_URL = "https://sachet.ndma.gov.in/"
INDIA_NATIONAL_PORTAL = "https://knowindia.india.gov.in/"


@dataclass(frozen=True, slots=True)
class ContextSignal:
    title: str
    category: str
    summary: str
    source_name: str
    source_url: str
    keywords: tuple[str, ...]


def _india_observance(
    title: str, category: str, summary: str, *keywords: str
) -> ContextSignal:
    return ContextSignal(
        title=title,
        category=category,
        summary=summary,
        source_name="National Portal of India",
        source_url=INDIA_NATIONAL_PORTAL,
        keywords=keywords,
    )


INDIA_OBSERVANCES = {
    (1, 12): _india_observance(
        "National Youth Day",
        "humanity",
        "Courage, service, and the potential of young people.",
        "youth",
        "service",
        "courage",
    ),
    (1, 26): _india_observance(
        "Republic Day of India",
        "humanity",
        "Collective dignity, responsibility, and national welfare.",
        "humanity",
        "dignity",
        "service",
    ),
    (8, 15): _india_observance(
        "Independence Day of India",
        "humanity",
        "Freedom joined with social responsibility and collective progress.",
        "freedom",
        "humanity",
        "service",
    ),
    (10, 2): _india_observance(
        "Gandhi Jayanti",
        "peace",
        "A day for courage, peace, and service to humanity.",
        "peace",
        "service",
        "courage",
    ),
    (10, 31): _india_observance(
        "National Unity Day",
        "humanity",
        "Unity amid diversity and shared national welfare.",
        "unity",
        "humanity",
        "harmony",
    ),
    (11, 26): _india_observance(
        "Constitution Day of India",
        "humanity",
        "Justice, dignity, and responsibility in collective life.",
        "justice",
        "dignity",
        "humanity",
    ),
}

DISASTER_MARKERS = (
    "severe flood",
    "flood",
    "earthquake",
    "cyclone",
    "storm surge",
    "landslide",
    "cloudburst",
    "tsunami",
    "drought",
    "wildfire",
    "forest fire",
    "building collapse",
    "industrial fire",
    "flash flood",
    "above normal flood",
    "severe weather",
)
CAP_NAMESPACE = "urn:oasis:names:tc:emergency:cap:1.2"


def observance_for_day(day: date) -> ContextSignal | None:
    return INDIA_OBSERVANCES.get((day.month, day.day))


def parse_india_disaster_alerts(xml_text: str) -> list[ContextSignal]:
    """Return only significant India disaster signals, not routine weather forecasts."""
    root = ET.fromstring(xml_text)
    signals: list[ContextSignal] = []
    for item in root.findall("./channel/item")[:80]:
        title = " ".join((item.findtext("title") or "").split())
        searchable = title.casefold()
        if not title or not any(marker in searchable for marker in DISASTER_MARKERS):
            continue
        link = (item.findtext("link") or NDMA_SACHET_URL).strip()
        signals.append(
            ContextSignal(
                title=title,
                category="disaster",
                summary=(
                    "An official India disaster alert calling for compassion, "
                    "courage, and service to affected communities."
                ),
                source_name="NDMA SACHET",
                source_url=link,
                keywords=("service", "relief", "hope", "humanity"),
            )
        )
        if len(signals) >= 2:
            break
    return signals


def needs_english_headline(title: str) -> bool:
    letters = [character for character in title if character.isalpha()]
    if not letters:
        return False
    latin_letters = [character for character in letters if character.isascii()]
    return len(latin_letters) / len(letters) < 0.6


def extract_english_cap_headline(xml_text: str) -> str | None:
    root = ET.fromstring(xml_text)
    prefix = f"{{{CAP_NAMESPACE}}}"
    for info in root.findall(f"{prefix}info"):
        language = (info.findtext(f"{prefix}language") or "").casefold()
        headline = " ".join((info.findtext(f"{prefix}headline") or "").split())
        if language.startswith("en") and headline:
            return headline
    return None


def english_disaster_fallback(title: str) -> str:
    normalized = title.casefold()
    for marker in sorted(DISASTER_MARKERS, key=len, reverse=True):
        if marker in normalized:
            return f"{marker.title()} alert in India"
    return "Significant disaster alert in India"


async def _english_signal(client: httpx.AsyncClient, signal: ContextSignal) -> ContextSignal:
    if not needs_english_headline(signal.title):
        return signal
    parsed = urlparse(signal.source_url)
    if parsed.hostname != "sachet.ndma.gov.in":
        return replace(signal, title=english_disaster_fallback(signal.title))
    try:
        response = await client.get(signal.source_url)
        response.raise_for_status()
        headline = extract_english_cap_headline(response.text)
    except (httpx.HTTPError, ET.ParseError):
        headline = None
    return replace(signal, title=headline or english_disaster_fallback(signal.title))


async def current_india_humanitarian_signals() -> list[ContextSignal]:
    try:
        # Current alerts enrich the page but must never delay core song discovery.
        async with httpx.AsyncClient(timeout=1.5, follow_redirects=True) as client:
            response = await client.get(NDMA_ALL_INDIA_RSS)
            response.raise_for_status()
            signals = parse_india_disaster_alerts(response.text)
            localized = await asyncio.gather(
                *(_english_signal(client, signal) for signal in signals)
            )
            # RSS item links are machine-readable CAP/XML endpoints, not public pages.
            return [replace(signal, source_url=NDMA_SACHET_URL) for signal in localized]
    except (httpx.HTTPError, ET.ParseError):
        return []
