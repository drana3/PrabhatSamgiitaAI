from app.models.song import Song
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
