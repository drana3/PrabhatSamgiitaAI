from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import date

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Media, RecommendationAudit, Song


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

    async def media_availability(self, session: AsyncSession) -> dict[int, dict[str, int]]:
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
        return counts

    def _match_score(self, desired: str | None, actual: str | None) -> float:
        if not desired or not actual:
            return 0.0
        desired_norm = desired.lower().strip()
        actual_norm = actual.lower().strip()
        if desired_norm == actual_norm:
            return 1.0
        if desired_norm in actual_norm:
            return 0.8
        return 0.0

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

        score = (
            0.30 * breakdown["occasion"]
            + 0.20 * breakdown["theme"]
            + 0.15 * breakdown["festival"]
            + 0.10 * breakdown["season"]
            + 0.10 * breakdown["language"]
            + 0.05 * breakdown["difficulty"]
            + 0.05 * breakdown["media"]
            + 0.05 * breakdown["diversity"]
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
        ):
            value = getattr(context, attr_name)
            song_value = getattr(song, attr_name)
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
