from app.services.domain_catalog import (
    canonical_festivals,
    fixed_reviewed_festival,
    reviewed_festival_collection_labels,
    reviewed_festival_song_numbers,
    reviewed_humanitarian_collection_labels,
    season_for_month,
    song_numbers_for_collection_labels,
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


def test_festival_recommendations_use_only_exact_reviewed_collections() -> None:
    assert reviewed_festival_collection_labels(8, 28, 2026) == (
        "Shravanii Purnima Day Song",
    )
    assert reviewed_festival_song_numbers(8, 28, 2026) == (4954,)
    assert set(reviewed_festival_song_numbers(5, 1, 2026)) == {
        133,
        134,
        135,
        903,
        2649,
    }
    assert reviewed_festival_collection_labels(1, 25, 2026) == ()


def test_humanitarian_context_uses_only_reviewed_source_collections() -> None:
    assert reviewed_humanitarian_collection_labels("peace") == ("Neo-Humanism Songs",)
    assert reviewed_humanitarian_collection_labels("service") == (
        "AMURT Song",
        "Neo-Humanism Songs",
    )
    assert reviewed_humanitarian_collection_labels("unknown") == ()
    assert song_numbers_for_collection_labels(("Neo-Humanism Songs",))
    assert reviewed_festival_song_numbers(1, 25, 2026) == ()
