from __future__ import annotations

import hashlib
from dataclasses import dataclass
from datetime import date
from functools import lru_cache
from typing import Any
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import InspirationStoryRecord
from app.services.seed_data import load_rows

STORIES_INDEX_PATH = "/stories"


@dataclass(frozen=True)
class InspirationStory:
    slug: str
    title: str
    author: str
    teaser: str
    source_url: str
    themes: tuple[str, ...]
    song_numbers: tuple[int, ...]
    body_paragraphs: tuple[str, ...] = ()

    @property
    def read_path(self) -> str:
        return f"{STORIES_INDEX_PATH}/{self.slug}"

    @classmethod
    def from_row(cls, row: dict[str, Any]) -> InspirationStory:
        source_url = str(row.get("source_url") or row.get("url") or "")
        return cls(
            slug=str(row["slug"]),
            title=str(row["title"]),
            author=str(row["author"]),
            teaser=str(row["teaser"]),
            source_url=source_url,
            themes=tuple(str(theme) for theme in row.get("themes", [])),
            song_numbers=tuple(int(number) for number in row.get("song_numbers", [])),
            body_paragraphs=tuple(str(part) for part in row.get("body_paragraphs", [])),
        )

    @classmethod
    def from_record(cls, record: InspirationStoryRecord) -> InspirationStory:
        return cls(
            slug=record.slug,
            title=record.title,
            author=record.author,
            teaser=record.teaser,
            source_url=record.source_url,
            themes=tuple(str(theme) for theme in (record.themes or [])),
            song_numbers=tuple(int(number) for number in (record.song_numbers or [])),
            body_paragraphs=tuple(str(part) for part in (record.body_paragraphs or [])),
        )


def story_rows_for_bootstrap() -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for row in load_rows("stories.json"):
        rows.append(
            {
                "id": uuid4(),
                "slug": row["slug"],
                "title": row["title"],
                "author": row["author"],
                "teaser": row["teaser"],
                "source_url": row.get("source_url") or row.get("url"),
                "body_paragraphs": row.get("body_paragraphs") or [row["teaser"]],
                "themes": row.get("themes") or [],
                "song_numbers": row.get("song_numbers") or [],
                "verification_status": row.get("verification_status", "source_verified"),
                "is_active": row.get("is_active", True),
            }
        )
    return rows


@lru_cache(maxsize=1)
def load_stories_from_seed() -> list[InspirationStory]:
    return [InspirationStory.from_row(row) for row in load_rows("stories.json")]


async def load_stories(session: AsyncSession | None = None) -> list[InspirationStory]:
    if session is not None:
        result = await session.execute(
            select(InspirationStoryRecord)
            .where(
                InspirationStoryRecord.is_active.is_(True),
                InspirationStoryRecord.verification_status == "source_verified",
            )
            .order_by(InspirationStoryRecord.title.asc())
        )
        records = list(result.scalars())
        if records:
            return [InspirationStory.from_record(record) for record in records]
    return load_stories_from_seed()


async def get_story_by_slug(session: AsyncSession | None, slug: str) -> InspirationStory | None:
    if session is not None:
        record = await session.scalar(
            select(InspirationStoryRecord).where(
                InspirationStoryRecord.slug == slug,
                InspirationStoryRecord.is_active.is_(True),
                InspirationStoryRecord.verification_status == "source_verified",
            )
        )
        if record is not None:
            return InspirationStory.from_record(record)
    for story in load_stories_from_seed():
        if story.slug == slug:
            return story
    return None


def select_featured_story(
    stories: list[InspirationStory], day: date | None = None
) -> InspirationStory | None:
    if not stories:
        return None
    local_day = day or date.today()
    digest = hashlib.sha256(local_day.isoformat().encode()).hexdigest()
    index = int(digest, 16) % len(stories)
    return stories[index]


def stories_for_song(stories: list[InspirationStory], song_number: int) -> list[InspirationStory]:
    return [story for story in stories if song_number in story.song_numbers]


def stories_matching_query(
    stories: list[InspirationStory],
    query: str,
    song_number: int | None = None,
    limit: int = 5,
) -> list[InspirationStory]:
    if song_number is not None:
        related = stories_for_song(stories, song_number)
        if related:
            return related[:limit]

    cleaned = query.casefold().strip()
    scored: list[tuple[int, InspirationStory]] = []
    for story in stories:
        score = 0
        haystack = " ".join((story.title, story.author, story.teaser, " ".join(story.themes))).casefold()
        if cleaned and cleaned in haystack:
            score += 20
        for token in cleaned.split():
            if len(token) < 4:
                continue
            if token in haystack:
                score += 2
        if score:
            scored.append((score, story))
    if scored:
        scored.sort(key=lambda item: (-item[0], item[1].title))
        return [story for _, story in scored[:limit]]
    return stories[:limit]
