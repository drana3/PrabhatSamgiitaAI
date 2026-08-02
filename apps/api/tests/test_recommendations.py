from typing import Any

import pytest
from sqlalchemy.exc import SQLAlchemyError

from app.models.song import Song
from app.services.domain_catalog import fixed_reviewed_festival, reviewed_festival_context
from app.services.recommendations import RecommendationContext, RecommendationEngine


def test_recommendation_scores_match_metadata() -> None:
    song = Song(
        id=1,
        number=1,
        title="Bandhu He Niye Calo",
        theme="devotion",
        occasion="morning meditation",
        festival="",
        season="spring",
        mood="hopeful",
        language="roman",
        difficulty="easy",
        meditation_context="dawn",
    )
    engine = RecommendationEngine()
    score = engine.score(
        song,
        RecommendationContext(occasion="morning meditation", mood="hopeful", season="spring"),
    )
    assert score >= 9


def test_reviewed_2026_festival_dates_are_available_to_daily_recommendations() -> None:
    assert fixed_reviewed_festival(8, 28, 2026) == "Shrávanii Purnimá"
    assert fixed_reviewed_festival(9, 14, 2026) == "Prabháta Saḿgiita Divasa"


def test_lunar_festival_dates_are_not_guessed_for_other_years() -> None:
    assert fixed_reviewed_festival(8, 28, 2027) is None
    assert fixed_reviewed_festival(5, 21, 2027) == "Bábá Birthday"


def test_reviewed_observances_map_to_canonical_song_collections() -> None:
    assert reviewed_festival_context(5, 1, 2026)["festival"] == "Bábá Birthday"
    assert reviewed_festival_context(4, 14, 2026)["festival"] == "New Year"
    assert reviewed_festival_context(6, 5, 2026)["theme"] == "PROUT"
    assert reviewed_festival_context(8, 28, 2026)["festival"] == "Shravanii Purnima Day"
    assert reviewed_festival_context(10, 5, 2026)["festival"] == "Victory Day"
    assert reviewed_festival_context(11, 8, 2026)["festival"] == "Dipavali (Colour Festival) Day"


class UnavailableSession:
    async def execute(self, statement: Any) -> None:
        raise SQLAlchemyError("database unavailable")

    async def rollback(self) -> None:
        return None


@pytest.mark.asyncio
async def test_explicit_service_collection_excludes_unrelated_seasonal_song() -> None:
    service_song = Song(number=4599, title="PROUT song", theme="PROUT", metadata_json={})
    spring_song = Song(number=10, title="Vasant song", season="spring", metadata_json={})
    context = RecommendationContext(theme="AMURT|Neo-Humanism|PROUT", occasion="service")

    ranked = await RecommendationEngine().rank(
        UnavailableSession(),  # type: ignore[arg-type]
        [spring_song, service_song],
        context,
    )

    assert [item.song.number for item in ranked] == [4599]


@pytest.mark.asyncio
async def test_service_eligibility_uses_canonical_assignment_not_contaminated_text() -> None:
    unrelated = Song(
        number=10,
        title="Spring song",
        theme="PROUT",
        metadata_json={"canonical_theme_assignments": {"themes": ["Spring"]}},
    )
    service = Song(
        number=4599,
        title="PROUT song",
        theme="PROUT",
        metadata_json={"canonical_theme_assignments": {"themes": ["PROUT"]}},
    )

    ranked = await RecommendationEngine().rank(
        UnavailableSession(),  # type: ignore[arg-type]
        [unrelated, service],
        RecommendationContext(theme="PROUT", occasion="service"),
    )

    assert [item.song.number for item in ranked] == [4599]


@pytest.mark.asyncio
async def test_source_constrained_ranking_rewards_complete_listenable_songs() -> None:
    complete = Song(
        number=9001,
        title="Complete song",
        lyrics_original="Verified lyrics",
        english_meaning="Verified meaning",
        is_verified=True,
        canonical_source_status="verified",
        metadata_json={},
    )
    incomplete = Song(
        number=9002,
        title="Incomplete song",
        is_verified=True,
        canonical_source_status="verified",
        metadata_json={},
    )
    unverified = Song(
        number=9003,
        title="Unverified song",
        canonical_source_status="pending",
        metadata_json={},
    )

    ranked = await RecommendationEngine().rank_source_constrained(
        UnavailableSession(),  # type: ignore[arg-type]
        [incomplete, unverified, complete],
    )

    assert [item.song.number for item in ranked] == [9001, 9002]
    assert ranked[0].breakdown["lyrics"] == 1.0
    assert ranked[0].breakdown["meaning"] == 1.0


def test_song_number_parity_never_changes_recommendation_score() -> None:
    engine = RecommendationEngine()
    context = RecommendationContext(occasion="meditation")
    odd = Song(number=1, title="Odd", occasion="meditation", metadata_json={})
    even = Song(number=2, title="Even", occasion="meditation", metadata_json={})

    assert engine.score(odd, context) == engine.score(even, context)
