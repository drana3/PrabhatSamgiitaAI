from __future__ import annotations

import re
import unicodedata
from dataclasses import asdict, dataclass, field
from datetime import date

from sqlalchemy import case, func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Media, RecommendationAudit, Song
from app.services.seed_data import load_rows


@dataclass(slots=True)
class RecommendationContext:
    date: str | None = None
    timezone: str | None = None
    day: str | None = None
    occasion: str | None = None
    festival: str | None = None
    season: str | None = None
    mood: str | None = None
    language: str | None = None
    difficulty: str | None = None
    meditation_context: str | None = None
    theme: str | None = None
    time_of_day: str | None = None
    media_preference: str | None = None
    maximum_results: int = 20


@dataclass(slots=True)
class RankedRecommendation:
    song: Song
    score: float
    breakdown: dict[str, float] = field(default_factory=dict)


class RecommendationEngine:
    algorithm_version = "r2"

    def _seed_media_counts(self) -> dict[int, dict[str, int]]:
        counts: dict[int, dict[str, int]] = {}
        for row in load_rows("media.json"):
            song_number = row.get("song_number")
            if song_number is None:
                continue
            counts.setdefault(int(song_number), {"audio_count": 0, "video_count": 0})
            if row.get("kind") == "audio":
                counts[int(song_number)]["audio_count"] += 1
            if row.get("kind") == "video":
                counts[int(song_number)]["video_count"] += 1
        return counts

    async def media_availability(self, session: AsyncSession) -> dict[int, dict[str, int]]:
        try:
            rows = await session.execute(
                select(
                    Media.song_number,
                    func.sum(case((Media.kind == "audio", 1), else_=0)).label("audio_count"),
                    func.sum(case((Media.kind == "video", 1), else_=0)).label("video_count"),
                )
                .where(Media.song_number.is_not(None))
                .group_by(Media.song_number)
            )
            counts: dict[int, dict[str, int]] = {}
            for row in rows.all():
                counts[int(row.song_number)] = {
                    "audio_count": int(row.audio_count or 0),
                    "video_count": int(row.video_count or 0),
                }
            if counts:
                return counts
        except SQLAlchemyError:
            await session.rollback()
        return self._seed_media_counts()

    def _match_score(self, desired: str | None, actual: str | None) -> float:
        if not desired or not actual:
            return 0.0
        actual_norm = self._normalize(actual)
        scores = []
        for desired_value in desired.split("|"):
            desired_norm = self._normalize(desired_value)
            if desired_norm == actual_norm:
                scores.append(1.0)
            elif desired_norm and desired_norm in actual_norm:
                scores.append(0.8)
            else:
                scores.append(0.0)
        return max(scores, default=0.0)

    def _normalize(self, value: str) -> str:
        decomposed = unicodedata.normalize("NFKD", value)
        plain = "".join(
            character for character in decomposed if not unicodedata.combining(character)
        )
        return " ".join(re.findall(r"[a-z0-9]+", plain.lower()))

    def _context_text_score(self, song: Song, context: RecommendationContext) -> float:
        desired = " ".join(
            value
            for value in (
                context.occasion,
                context.festival,
                context.season,
                context.mood,
                context.theme,
                context.meditation_context,
            )
            if value
        )
        desired_tokens = {
            token
            for token in self._normalize(desired).split()
            if len(token) > 2 and token not in {"song", "songs", "music"}
        }
        if not desired_tokens:
            return 0.0
        metadata = song.metadata_json or {}
        document = " ".join(
            str(value)
            for value in (
                song.title,
                song.first_line,
                song.english_meaning,
                song.hindi_meaning,
                song.theme,
                song.occasion,
                song.festival,
                song.season,
                song.mood,
                song.meditation_context,
                metadata.get("category"),
                metadata.get("purport"),
            )
            if value
        )
        document_tokens = set(self._normalize(document).split())
        return len(desired_tokens & document_tokens) / len(desired_tokens)

    def score_details(
        self,
        song: Song,
        context: RecommendationContext,
        media_counts: dict[int, dict[str, int]] | None = None,
    ) -> tuple[float, dict[str, float]]:
        media_counts = media_counts or {}
        breakdown = {
            "occasion": self._match_score(context.occasion, song.occasion),
            "theme": self._match_score(context.mood, song.mood),
            "festival": self._match_score(context.festival, song.festival),
            "season": self._match_score(context.season, song.season),
            "language": self._match_score(context.language, song.language),
            "difficulty": self._match_score(context.difficulty, song.difficulty),
            "meditation_context": self._match_score(
                context.meditation_context, song.meditation_context
            ),
            "collection_theme": self._match_score(context.theme, song.theme),
        }
        media = media_counts.get(song.number, {})
        media_relevance = 0.0
        if context.media_preference == "audio":
            media_relevance = 1.0 if media.get("audio_count", 0) > 0 else 0.0
        elif context.media_preference == "video":
            media_relevance = 1.0 if media.get("video_count", 0) > 0 else 0.0
        elif context.media_preference == "any":
            media_relevance = 1.0 if media else 0.0
        breakdown["media"] = media_relevance
        breakdown["diversity"] = 0.4 + (0.2 if song.number % 2 else 0.0)
        breakdown["context_text"] = self._context_text_score(song, context)

        score = (
            0.30 * breakdown["occasion"]
            + 0.20 * breakdown["theme"]
            + 0.15 * breakdown["festival"]
            + 0.10 * breakdown["season"]
            + 0.10 * breakdown["language"]
            + 0.05 * breakdown["difficulty"]
            + 0.05 * breakdown["media"]
            + 0.05 * breakdown["diversity"]
            + 0.25 * breakdown["context_text"]
            + 0.25 * breakdown["collection_theme"]
        )
        if song.is_verified or song.canonical_source_status == "verified":
            score += 0.05
        if context.day and song.metadata_json.get("days"):
            score += 0.02 if context.day in song.metadata_json["days"] else 0.0
        if context.date:
            try:
                day_name = date.fromisoformat(context.date).strftime("%A")
                if (
                    context.day is None
                    and song.metadata_json.get("days")
                    and day_name in song.metadata_json["days"]
                ):
                    score += 0.01
            except ValueError:
                pass
        return round(min(10.0, score * 15.0), 4), breakdown

    def score(
        self,
        song: Song,
        context: RecommendationContext,
        media_counts: dict[int, dict[str, int]] | None = None,
    ) -> float:
        return self.score_details(song, context, media_counts)[0]

    def explain(self, song: Song, context: RecommendationContext) -> str:
        reasons = []
        for attr_name in (
            "occasion",
            "festival",
            "season",
            "mood",
            "language",
            "difficulty",
            "meditation_context",
            "theme",
        ):
            value = getattr(context, attr_name)
            song_value = song.theme if attr_name == "theme" else getattr(song, attr_name)
            if value and song_value and value.lower() in song_value.lower():
                reasons.append(f"matches {attr_name}")
        return ", ".join(reasons) if reasons else "balanced grounding with verified metadata"

    async def rank(
        self,
        session: AsyncSession,
        songs: list[Song],
        context: RecommendationContext,
    ) -> list[RankedRecommendation]:
        media_counts = await self.media_availability(session)
        ranked: list[RankedRecommendation] = []
        for song in songs:
            if song.canonical_source_status == "draft":
                continue
            score, breakdown = self.score_details(song, context, media_counts)
            if context.festival and breakdown["festival"] == 0:
                continue
            if context.theme and breakdown["collection_theme"] == 0:
                continue
            ranked.append(RankedRecommendation(song=song, score=score, breakdown=breakdown))
        ranked.sort(key=lambda item: item.score, reverse=True)
        return ranked[: context.maximum_results]

    async def audit(
        self,
        session: AsyncSession,
        context: RecommendationContext,
        ranked: list[RankedRecommendation],
    ) -> None:
        audit = RecommendationAudit(
            request_context=asdict(context),
            candidate_scores={
                str(item.song.number): {
                    "score": item.score,
                    "breakdown": item.breakdown,
                }
                for item in ranked
            },
            selected_song_ids={"song_numbers": [item.song.number for item in ranked]},
            algorithm_version=self.algorithm_version,
        )
        session.add(audit)
