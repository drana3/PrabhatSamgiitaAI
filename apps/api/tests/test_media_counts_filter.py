"""Search media counts and direct answers use the same status filter as CatalogService.get_media."""

from __future__ import annotations

import os

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://test:test@localhost/test")

import pytest

from app.models.media import Media
from app.services import direct_answers, search
from app.services.media_quality import accepted_media
from tests.test_media_selection import audio, video


def snapshot() -> list[Media]:
    return [
        audio("Good take", song=1, status="verified"),
        audio("Draft take", song=1, status="draft"),
        audio("Unreviewed", song=2, status="unverified"),
        audio("AI made", song=3, status="ai_generated"),
        video("aaaaaaaaaaa", song=3, status="verified"),
        video("bbbbbbbbbbb", song=4, status="needs_review"),
        video("ccccccccccc", song=4, status="rejected"),
    ]


def test_accepted_media_keeps_only_accepted_rows() -> None:
    kept = accepted_media(snapshot())
    assert sorted((m.song_number, m.title) for m in kept) == [
        (1, "Good take"),
        (3, "Song - Prabhat Sangeet #7"),
    ]


def test_accepted_media_collapses_the_same_recording() -> None:
    twin = video("aaaaaaaaaaa", song=3, status="verified", url="https://youtu.be/aaaaaaaaaaa")
    kept = accepted_media([*snapshot(), twin])
    assert len([m for m in kept if m.kind == "video"]) == 1


def test_search_counts_ignore_unreviewed_media(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(search, "catalog_media_snapshot", lambda: tuple(snapshot()))
    monkeypatch.setattr(search, "catalog_notation_snapshot", lambda: ())
    service = search.HybridSearchService.__new__(search.HybridSearchService)
    counts = service._build_seed_media_counts()
    assert (counts[1].audio_count, counts[1].video_count) == (1, 0)
    assert 2 not in counts  # only an unverified file: nothing to filter on
    assert (counts[3].audio_count, counts[3].video_count) == (0, 1)
    assert 4 not in counts


def test_direct_answers_count_only_accepted_media(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(direct_answers, "catalog_media_snapshot", lambda: tuple(snapshot()))
    audio_answer = direct_answers.try_direct_answer("How many audio recordings are there?")
    video_answer = direct_answers.try_direct_answer("How many videos are available?")
    assert audio_answer is not None and "1 audio renditions covering 1 of" in audio_answer.text
    assert video_answer is not None and "1 matched videos covering 1 songs" in video_answer.text
