from __future__ import annotations

from urllib.error import URLError

from scripts.sync_youtube import CHANNELS, GENERAL_YOUTUBE, fetch, media_row, review_row

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
    video = {"video_id": "new-video", "title": "A devotional dawn melody"}

    assert media_row(video, SONGS) is None
    review = review_row(video, SONGS)
    assert review["status"] == "pending_review"
    assert review["review_reason"] == "missing_explicit_song_number"


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
