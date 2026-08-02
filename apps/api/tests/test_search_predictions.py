from app.services.search import TOP_SEARCH_PREDICTIONS


def test_typed_and_voice_search_expose_top_five_predictions() -> None:
    assert TOP_SEARCH_PREDICTIONS == 5
