from app.services.stories import (
    InspirationStory,
    load_stories_from_seed,
    select_featured_story,
    stories_for_song,
    stories_matching_query,
    story_rows_for_bootstrap,
)
from app.services.structured_answers import build_stories_answer, requests_stories_inspiration


def test_load_stories_from_seed() -> None:
    stories = load_stories_from_seed()
    assert len(stories) >= 20
    assert any(story.slug == "kalyan-deva" for story in stories)
    assert all(story.source_url.startswith("https://prabhatasamgiita.net/") for story in stories)
    assert all(story.read_path.startswith("/stories/") for story in stories)


def test_bootstrap_rows_include_body_paragraphs() -> None:
    rows = story_rows_for_bootstrap()
    assert rows
    assert rows[0]["body_paragraphs"]


def test_featured_story_rotates_by_day() -> None:
    stories = load_stories_from_seed()
    first = select_featured_story(stories, __import__("datetime").date(2026, 8, 2))
    second = select_featured_story(stories, __import__("datetime").date(2026, 8, 3))
    assert first is not None
    assert second is not None


def test_stories_for_song_419() -> None:
    related = stories_for_song(load_stories_from_seed(), 419)
    assert len(related) == 1
    assert related[0].slug == "anandakaruna-419"


def test_stories_matching_query_finds_heart_story() -> None:
    matched = stories_matching_query(load_stories_from_seed(), "ink of the heart")
    assert matched
    assert matched[0].slug == "kalyan-deva"


def test_requests_stories_inspiration() -> None:
    assert requests_stories_inspiration("Share a devotee story about this song")
    assert requests_stories_inspiration("Any inspiration from prabhatasamgiita.net?")


def test_build_stories_answer_links_to_in_app_pages() -> None:
    stories = stories_for_song(load_stories_from_seed(), 419)
    answer = build_stories_answer(None, stories)
    assert answer is not None
    assert "/stories/anandakaruna-419" in answer
    assert "/stories" in answer
