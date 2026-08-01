from app.models.song import Song
from app.services.domain_catalog import fixed_reviewed_festival
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
