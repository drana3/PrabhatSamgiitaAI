from __future__ import annotations

import json
from typing import Any
from urllib.error import URLError
from urllib.request import Request

from scripts.sync_youtube import (
    CHANNELS,
    GENERAL_YOUTUBE,
    fetch,
    media_row,
    mentions_prabhat_samgiita,
    persist_youtube_inventory,
    review_row,
    youtube_video_in_scope,
)

SONGS = {1: {"number": 1, "title": "Bandhu He Niye Calo", "first_line": "Bandhu He"}}


def test_numbered_channel_video_is_published_by_song_number() -> None:
    video = {
        "video_id": "D4LHhnSLhro",
        "title": "Prabhat Samgiita No. 1 - Bandhu He Niye Calo",
    }

    row = media_row(video, SONGS)

    assert row is not None
    assert row["song_number"] == 1
    assert row["embed_url"] == "https://www.youtube-nocookie.com/embed/D4LHhnSLhro"


def test_unnumbered_upload_is_retained_for_human_review() -> None:
    video = {"video_id": "new-video", "title": "Prabhat Samgiita devotional dawn melody"}

    assert media_row(video, SONGS) is None
    review = review_row(video, SONGS)
    assert review is not None
    assert review["status"] == "pending_review"
    assert review["review_reason"] == "missing_explicit_song_number"


def test_unrelated_upload_is_ignored() -> None:
    video = {"video_id": "new-video", "title": "A devotional dawn melody"}

    assert youtube_video_in_scope(video["title"]) is False
    assert media_row(video, SONGS) is None
    assert review_row(video, SONGS) is None


def test_loose_prabhat_samgiita_match_accepts_common_typos() -> None:
    assert mentions_prabhat_samgiita("Probhat Samgita Song Number 1") is True
    assert mentions_prabhat_samgiita("Prabhata Samgeeta morning meditation") is True
    assert mentions_prabhat_samgiita("Morning kiirtan and meditation") is False


def test_loose_prabhat_samgiita_still_links_numbered_song() -> None:
    video = {
        "video_id": "typo-title",
        "title": "Probhat Samgita No. 1 - Bandhu He Niye Calo",
    }

    row = media_row(video, SONGS)

    assert row is not None
    assert row["song_number"] == 1


def test_numbered_ananda_marga_video_maps_to_its_canonical_song() -> None:
    songs = {
        680: {
            "number": 680,
            "title": "Tumi Mor Jiivanera Andharer Dhruva Tara",
            "first_line": "Tumi Mor Jiivanera Andharer Dhruva Tara",
        }
    }
    video = {
        "video_id": "qtevjGHM3Ls",
        "title": (
            "TUMI MOR JIIVANERA ÁNDHÁRER DHRUVA TÁRÁ #680 "
            "PRABHAT SAMGIITA During New Year 2023."
        ),
    }

    row = media_row(video, songs, CHANNELS[1])

    assert row is not None
    assert row["song_number"] == 680
    assert row["metadata_json"]["external_id"] == "qtevjGHM3Ls"
    assert row["metadata_json"]["channel_name"] == "ANANDA MARGA"


def test_explicit_number_marker_survives_transliteration_title_differences() -> None:
    songs = {
        68: {
            "number": 68,
            "title": "WE LOVE THIS TINY GREEN ISLAND",
            "first_line": "WE LOVE THIS TINY GREEN ISLAND",
        }
    }
    video = {
        "video_id": "number-first",
        "title": "English Song - I Love This Tiny Green Island - Prabhat Sangeet #68",
    }

    row = media_row(video, songs)

    assert row is not None
    assert row["song_number"] == 68
    assert row["verification_status"] == "verified"
    assert row["metadata_json"]["match_method"] == "explicit_song_number_marker"


def test_unmarked_year_is_not_published_as_a_song_number() -> None:
    songs = {
        2026: {
            "number": 2026,
            "title": "A completely different canonical song",
            "first_line": "A completely different canonical song",
        }
    }
    video = {
        "video_id": "event-year",
        "title": "Prabhat Samgiita celebration during New Year 2026",
    }

    assert media_row(video, songs) is None


def test_general_youtube_is_a_strict_last_resort_source() -> None:
    video = {
        "video_id": "community-match",
        "title": "Bandhu He Niye Calo - Prabhat Samgiita #1",
    }

    row = media_row(video, SONGS, GENERAL_YOUTUBE)

    assert row is not None
    assert row["verification_status"] == "verified_external"
    assert row["metadata_json"]["source_status"] == "community"


def test_general_youtube_rejects_number_only_without_title_agreement() -> None:
    video = {
        "video_id": "unrelated-community-video",
        "title": "Completely unrelated performance - Prabhat Samgiita #1",
    }

    assert media_row(video, SONGS, GENERAL_YOUTUBE) is None


def test_fetch_retries_transient_youtube_errors(monkeypatch) -> None:  # type: ignore[no-untyped-def]
    attempts = 0

    class Response:
        def __enter__(self) -> Response:
            return self

        def __exit__(self, *_args: object) -> None:
            return None

        def read(self) -> bytes:
            return b"ok"

    def flaky_urlopen(*_args: object, **_kwargs: object) -> Response:
        nonlocal attempts
        attempts += 1
        if attempts < 3:
            raise URLError("temporary")
        return Response()

    monkeypatch.setattr("scripts.sync_youtube.urlopen", flaky_urlopen)
    monkeypatch.setattr("scripts.sync_youtube.time.sleep", lambda _seconds: None)

    assert fetch("https://example.test") == "ok"
    assert attempts == 3


def test_persist_youtube_inventory_skips_without_database_url(monkeypatch) -> None:
    monkeypatch.delenv("DATABASE_URL", raising=False)
    result = persist_youtube_inventory([], [], {})
    assert result["inserted_media"] == 0
    assert result["inserted_reviews"] == 0
    assert result["inserted_song_numbers"] == []


def test_notify_live_catalog_refresh_skips_without_credentials(monkeypatch, capsys) -> None:
    monkeypatch.delenv("CATALOG_API_URL", raising=False)
    monkeypatch.delenv("API_BASE_URL", raising=False)
    monkeypatch.delenv("ADMIN_API_KEY", raising=False)
    from scripts.sync_youtube import notify_live_catalog_refresh

    notify_live_catalog_refresh([1])
    captured = capsys.readouterr()
    assert "Skipping live catalog refresh" in captured.err


def test_notify_live_catalog_refresh_posts_song_numbers(monkeypatch) -> None:
    monkeypatch.setenv("CATALOG_API_URL", "https://api.example.test")
    monkeypatch.setenv("ADMIN_API_KEY", "secret-admin-key")
    captured: dict[str, Any] = {}

    class Response:
        def __enter__(self) -> "Response":
            return self

        def __exit__(self, *_args: object) -> None:
            return None

        def read(self) -> bytes:
            return b'{"refreshed": 1}'

    def fake_urlopen(request: Request, timeout: int = 0) -> Response:
        captured["url"] = request.get_full_url()
        captured["timeout"] = timeout
        captured["body"] = json.loads(request.data.decode("utf-8"))
        captured["admin_key"] = request.get_header("X-admin-key")
        return Response()

    monkeypatch.setattr("scripts.sync_youtube.urlopen", fake_urlopen)
    from scripts.sync_youtube import notify_live_catalog_refresh

    notify_live_catalog_refresh([12, 12, 40], recent_minutes=30)
    assert captured["url"] == "https://api.example.test/api/v1/admin/catalog/refresh"
    assert captured["body"] == {"song_numbers": [12, 40], "recent_minutes": 30}
    assert captured["admin_key"] == "secret-admin-key"
