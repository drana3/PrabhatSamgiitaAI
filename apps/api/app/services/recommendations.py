from __future__ import annotations

from dataclasses import dataclass
from datetime import date

from app.models import Song


@dataclass(slots=True)
class RecommendationContext:
    date: str | None = None
    day: str | None = None
    occasion: str | None = None
    festival: str | None = None
    season: str | None = None
    mood: str | None = None
    language: str | None = None
    difficulty: str | None = None
    meditation_context: str | None = None


class RecommendationEngine:
    def score(self, song: Song, context: RecommendationContext) -> int:
        score = 0
        for field in ("occasion", "festival", "season", "mood", "language", "difficulty", "meditation_context"):
            desired = getattr(context, field)
            actual = getattr(song, field)
            if desired and actual and desired.lower() in actual.lower():
                score += 3
        if context.day and song.metadata_json.get("days"):
            score += 2 if context.day in song.metadata_json["days"] else 0
        if context.date:
            try:
                day_name = date.fromisoformat(context.date).strftime("%A")
                if context.day is None and song.metadata_json.get("days") and day_name in song.metadata_json["days"]:
                    score += 1
            except ValueError:
                pass
        return score

    def explain(self, song: Song, context: RecommendationContext) -> str:
        reasons = []
        for field in ("occasion", "festival", "season", "mood", "language", "difficulty", "meditation_context"):
            value = getattr(context, field)
            if value and getattr(song, field) and value.lower() in getattr(song, field).lower():
                reasons.append(f"matches {field}")
        return ", ".join(reasons) if reasons else "balanced grounding with verified metadata"
