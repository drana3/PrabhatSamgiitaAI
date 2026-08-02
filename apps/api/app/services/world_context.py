from __future__ import annotations

import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import date

import httpx

UN_NEWS_RSS = "https://news.un.org/feed/subscribe/en/news/all/rss.xml"
UN_OBSERVANCES_URL = "https://www.un.org/en/observances/list-days-weeks"


@dataclass(frozen=True, slots=True)
class ContextSignal:
    title: str
    category: str
    summary: str
    source_name: str
    source_url: str
    keywords: tuple[str, ...]


def _observance(title: str, category: str, summary: str, *keywords: str) -> ContextSignal:
    return ContextSignal(
        title=title,
        category=category,
        summary=summary,
        source_name="United Nations",
        source_url=UN_OBSERVANCES_URL,
        keywords=keywords,
    )


UN_OBSERVANCES = {
    (1, 24): _observance(
        "International Day of Education",
        "humanity",
        "Learning, dignity, and collective progress.",
        "education",
        "service",
        "hope",
    ),
    (2, 20): _observance(
        "World Day of Social Justice",
        "service",
        "Dignity, fairness, and welfare for all.",
        "social justice",
        "service",
        "humanity",
    ),
    (3, 8): _observance(
        "International Women's Day",
        "humanity",
        "Equality, courage, and the dignity of women.",
        "women",
        "dignity",
        "courage",
    ),
    (3, 20): _observance(
        "International Day of Happiness",
        "bliss",
        "Well-being, joy, and the shared human spirit.",
        "happiness",
        "bliss",
        "joy",
    ),
    (3, 22): _observance(
        "World Water Day",
        "nature",
        "Care for water, life, and the natural world.",
        "water",
        "nature",
        "service",
    ),
    (4, 22): _observance(
        "International Mother Earth Day",
        "nature",
        "Reverence for our living planet.",
        "earth",
        "nature",
        "environment",
    ),
    (5, 16): _observance(
        "International Day of Living Together in Peace",
        "peace",
        "Harmony across communities and cultures.",
        "peace",
        "harmony",
        "humanity",
    ),
    (6, 5): _observance(
        "World Environment Day",
        "nature",
        "Collective care for nature and future generations.",
        "nature",
        "environment",
        "service",
    ),
    (6, 20): _observance(
        "World Refugee Day",
        "humanity",
        "Compassion and dignity for displaced people.",
        "refugee",
        "compassion",
        "service",
    ),
    (6, 21): _observance(
        "International Day of Yoga",
        "meditation",
        "Inner balance, health, and human unity.",
        "meditation",
        "harmony",
        "peace",
    ),
    (8, 19): _observance(
        "World Humanitarian Day",
        "service",
        "Courageous service to people in need.",
        "humanitarian",
        "service",
        "courage",
    ),
    (9, 21): _observance(
        "International Day of Peace",
        "peace",
        "A shared aspiration for peace and non-violence.",
        "peace",
        "love",
        "harmony",
    ),
    (10, 2): _observance(
        "International Day of Non-Violence",
        "peace",
        "Strength through compassion and non-violence.",
        "non-violence",
        "peace",
        "courage",
    ),
    (12, 5): _observance(
        "International Volunteer Day",
        "service",
        "Service, solidarity, and collective welfare.",
        "volunteer",
        "service",
        "humanity",
    ),
    (12, 10): _observance(
        "Human Rights Day",
        "humanity",
        "Universal dignity and freedom.",
        "human rights",
        "dignity",
        "humanity",
    ),
    (12, 21): _observance(
        "World Meditation Day",
        "meditation",
        "A global moment for inner peace.",
        "meditation",
        "peace",
        "bliss",
    ),
}

IMPACT_GROUPS = (
    (
        "peace",
        ("war", "conflict", "violence", "ceasefire", "peace", "attack"),
        ("peace", "compassion", "courage"),
    ),
    (
        "disaster",
        ("flood", "earthquake", "cyclone", "storm", "wildfire", "drought"),
        ("service", "hope", "humanity"),
    ),
    (
        "humanity",
        ("refugee", "hunger", "famine", "displaced", "humanitarian", "poverty"),
        ("compassion", "service", "humanity"),
    ),
    (
        "service",
        ("volunteer", "aid", "relief", "health", "education"),
        ("service", "courage", "hope"),
    ),
)


def observance_for_day(day: date) -> ContextSignal | None:
    return UN_OBSERVANCES.get((day.month, day.day))


def parse_un_news(xml_text: str) -> list[ContextSignal]:
    root = ET.fromstring(xml_text)
    signals: list[ContextSignal] = []
    for item in root.findall("./channel/item")[:20]:
        title = (item.findtext("title") or "").strip()
        link = (item.findtext("link") or UN_NEWS_RSS).strip()
        description = " ".join((item.findtext("description") or "").split())
        searchable = f"{title} {description}".casefold()
        for category, markers, keywords in IMPACT_GROUPS:
            if any(marker in searchable for marker in markers):
                signals.append(
                    ContextSignal(
                        title=title,
                        category=category,
                        summary=(
                            "A current humanitarian context reflected through peace, "
                            "hope, and service."
                        ),
                        source_name="UN News",
                        source_url=link,
                        keywords=keywords,
                    )
                )
                break
        if len(signals) >= 2:
            break
    return signals


async def current_humanitarian_signals() -> list[ContextSignal]:
    try:
        # News is optional enrichment and must never delay the core recommendation path.
        async with httpx.AsyncClient(timeout=1.0, follow_redirects=True) as client:
            response = await client.get(UN_NEWS_RSS)
            response.raise_for_status()
        return parse_un_news(response.text)
    except (httpx.HTTPError, ET.ParseError):
        return []
