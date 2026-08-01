from app.services.domain_catalog import (
    canonical_festivals,
    fixed_reviewed_festival,
    season_for_month,
    time_of_day,
)


def test_canonical_festivals_include_source_provenance() -> None:
    festivals = canonical_festivals()

    shravanii = next(item for item in festivals if item["name"] == "Shravanii Purnima Day")
    song_count = shravanii["song_count"]
    assert isinstance(song_count, int)
    assert song_count >= 1
    assert shravanii["source_urls"]


def test_today_context_rules_are_deterministic() -> None:
    assert fixed_reviewed_festival(5, 21) == "Bábá Birthday"
    assert fixed_reviewed_festival(8, 1) is None
    assert season_for_month(8) == "monsoon"
    assert time_of_day(6) == "morning"
    assert time_of_day(20) == "evening"
