from __future__ import annotations

from urllib.error import URLError

from scripts.sync_youtube import CHANNELS, fetch, media_row, review_row

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
