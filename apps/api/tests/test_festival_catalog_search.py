from app.services.festival_catalog_search import infer_observance_collection


def test_observance_search_maps_new_years_day_to_year_end_collection() -> None:
    match = infer_observance_collection("New Year's Day")
    assert match is not None
    assert match.label == "Year-end Song"
    assert 126 in match.song_numbers


def test_observance_search_maps_ps_divasa_to_curated_numbers() -> None:
    match = infer_observance_collection("Prabhat Samgiita Divasa")
    assert match is not None
    assert 5018 in match.song_numbers
    assert 1 in match.song_numbers