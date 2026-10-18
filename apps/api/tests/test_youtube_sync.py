from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta
from typing import Any
from urllib.error import URLError
from urllib.request import Request

from scripts.sync_youtube import (
    CHANNELS,
    GENERAL_YOUTUBE,
    _should_stop_scan_page,
    ellipsis_catalog_song_number,
    enrich_video_for_channel,
    enrich_videos_for_channel,
    explicit_song_number,
    extract_videos,
    fetch,
    fetch_video_description,
    fold_pending_videos,
    media_row,
    mentions_prabhat_samgiita,
    needs_description,
    parse_youtube_relative_time,
    persist_youtube_inventory,
    queued_needs_description,
    review_matches_channel,
    review_row,
    video_match_text,
    youtube_video_in_scope,
)

DESCRIPTION_CHANNEL = {
    "url": "https://www.youtube.com/channel/UCdescription/videos",
    "id": "UCdescription",
    "name": "Description channel",
    "trusted": True,
    "number_source": "description",
    "notes": "Number lives in the description.",
}

SONGS = {1: {"number": 1, "title": "Bandhu He Niye Calo", "first_line": "Bandhu He"}}


def test_extract_videos_reads_classic_grid_renderer() -> None:
    payload = {
        "contents": {
            "gridVideoRenderer": {
                "videoId": "abc123xyz01",
                "title": {"runs": [{"text": "Prabhat Sangeet song #42 - Morning melody"}]},
                "publishedTimeText": {"simpleText": "2 days ago"},
            }
        }
    }

    videos = extract_videos(payload)

    assert videos[0]["video_id"] == "abc123xyz01"
    assert videos[0]["title"] == "Prabhat Sangeet song #42 - Morning melody"
    assert isinstance(videos[0].get("published_at"), datetime)


def test_parse_youtube_relative_time() -> None:
    now = datetime(2026, 8, 21, 12, 0, tzinfo=UTC)
    assert parse_youtube_relative_time("2 days ago", now=now) == now - timedelta(days=2)
    assert parse_youtube_relative_time("Streamed 3 weeks ago", now=now) == now - timedelta(weeks=3)
    assert parse_youtube_relative_time("just now", now=now) == now


def test_should_stop_scan_page_on_known_ids() -> None:
    page = [
        {"video_id": "a", "title": "A"},
        {"video_id": "b", "title": "B"},
    ]
    assert _should_stop_scan_page(page, since=None, known_ids={"a", "b"}) is True
    assert _should_stop_scan_page(page, since=None, known_ids={"a"}) is False


def test_should_stop_scan_page_on_since() -> None:
    now = datetime(2026, 8, 21, 12, 0, tzinfo=UTC)
    page = [
        {
            "video_id": "old",
            "title": "Old upload",
            "published_at": now - timedelta(days=30),
        }
    ]
    assert _should_stop_scan_page(page, since=now - timedelta(days=7), known_ids=None) is True


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


MANAS_DESCRIPTION = """
PRABHAT SAMGIIT IS A TREASURE OF 5018 SPIRITUAL SONGS
WRITTEN AND SET TO TUNE BY SHRI PRABHAT RANJAN SARKAR....

..............................................................................

PRABHAT SAMGIIT
TUMI PRANER POROSHE ...
..............................................................................


VOICE : SAMEETA  MANDAL ...4577

..............................................................................
ITS A MANAS RAWA ASSAM PRODUCTION...
"""


def test_ellipsis_catalog_song_number_reads_manas_description() -> None:
    assert ellipsis_catalog_song_number(MANAS_DESCRIPTION) == 4577
    assert ellipsis_catalog_song_number("KAHAKEO PAPI BHEBE ....0695") == 695
    assert ellipsis_catalog_song_number("TUMI KON ATITE MORE ..2065") == 2065
    assert explicit_song_number(f"Prabhat Samgiita\n{MANAS_DESCRIPTION}") == 4577


def test_description_channel_matches_manas_ellipsis_number() -> None:
    songs = {
        4577: {
            "number": 4577,
            "title": "Tumi Praner Poroshe",
            "first_line": "Tumi Praner Poroshe",
        }
    }
    video = {
        "video_id": "manas-4577",
        "title": "PRABHAT SAMGIITA || TUMI PRANER POROSHE || SAMAETA MANDAL",
        "description": MANAS_DESCRIPTION,
    }

    row = media_row(video, songs, DESCRIPTION_CHANNEL)
    assert row is not None
    assert row["song_number"] == 4577
    assert row["verification_status"] == "verified"


def test_description_channel_matches_number_from_description() -> None:
    video = {
        "video_id": "desc-match-01",
        "title": "Bandhu He Niye Calo - Prabhat Samgiita",
        "description": "Prabhat Samgiita No. 1\nSung during morning meditation.",
    }

    # Title alone has no number, so title-mode would not match.
    assert media_row(video, SONGS, CHANNELS[0]) is None

    row = media_row(video, SONGS, DESCRIPTION_CHANNEL)
    assert row is not None
    assert row["song_number"] == 1
    assert row["metadata_json"]["external_id"] == "desc-match-01"
    # The stored title stays the real video title, not the description.
    assert row["title"] == "Bandhu He Niye Calo - Prabhat Samgiita"


def test_video_match_text_combines_title_and_description() -> None:
    video = {"title": "Morning melody", "description": "Prabhat Samgiita No. 1"}
    assert video_match_text(video, CHANNELS[0]) == "Morning melody"
    assert "Prabhat Samgiita No. 1" in video_match_text(video, DESCRIPTION_CHANNEL)


def test_needs_description_prefilters_on_title_scope() -> None:
    # Title mode never fetches descriptions.
    assert needs_description({"title": "Prabhat Samgiita"}, CHANNELS[0]) is False
    # Description mode fetches only when the title looks like Prabhat Samgiita.
    assert needs_description({"title": "Prabhat Samgiita melody"}, DESCRIPTION_CHANNEL) is True
    assert needs_description({"title": "Random cooking video"}, DESCRIPTION_CHANNEL) is False
    # Already-fetched descriptions are not refetched.
    assert (
        needs_description(
            {"title": "Prabhat Samgiita", "description": "already here"},
            DESCRIPTION_CHANNEL,
        )
        is False
    )


def test_enrich_videos_for_channel_defers_after_cap(monkeypatch) -> None:  # type: ignore[no-untyped-def]
    fetched: list[str] = []

    def fake_fetch(video_id: str) -> str:
        fetched.append(video_id)
        return "Prabhat Samgiita No. 1"

    monkeypatch.setattr("scripts.sync_youtube.fetch_video_description", fake_fetch)
    videos = [
        {"video_id": "a", "title": "Prabhat Samgiita melody one"},
        {"video_id": "b", "title": "Prabhat Samgiita melody two"},
        {"video_id": "c", "title": "Prabhat Samgiita melody three"},
    ]
    deferred = enrich_videos_for_channel(videos, DESCRIPTION_CHANNEL, max_fetches=2)
    assert set(fetched) == {"a", "b"}
    assert deferred == {"c"}
    assert videos[0]["description"] == "Prabhat Samgiita No. 1"


def test_enrich_video_for_channel_populates_description(monkeypatch) -> None:  # type: ignore[no-untyped-def]
    monkeypatch.setattr(
        "scripts.sync_youtube.fetch_video_description",
        lambda _video_id: "Prabhat Samgiita No. 1",
    )
    video = {"video_id": "desc-01", "title": "Prabhat Samgiita melody"}
    enrich_video_for_channel(video, DESCRIPTION_CHANNEL)
    assert video["description"] == "Prabhat Samgiita No. 1"

    title_video = {"video_id": "title-01", "title": "Prabhat Samgiita No. 5"}
    enrich_video_for_channel(title_video, CHANNELS[0])
    assert "description" not in title_video


def test_fetch_video_description_reads_player_response(monkeypatch) -> None:  # type: ignore[no-untyped-def]
    import scripts.sync_youtube as sync_youtube

    sync_youtube._innertube_cache = None
    html = (
        "<html><body><script>var ytInitialPlayerResponse = "
        '{"videoDetails": {"shortDescription": "Prabhat Samgiita No. 42"}};'
        "</script></body></html>"
    )

    def fake_fetch(
        url: str,
        payload: dict | None = None,
        extra_headers: dict | None = None,
    ) -> str:
        if "youtubei/" in url:
            return json.dumps({"playabilityStatus": {"status": "LOGIN_REQUIRED"}})
        return html

    monkeypatch.setattr("scripts.sync_youtube.fetch", fake_fetch)
    assert fetch_video_description("abc123") == "Prabhat Samgiita No. 42"


def test_fetch_video_description_uses_android_innertube(monkeypatch) -> None:  # type: ignore[no-untyped-def]
    import scripts.sync_youtube as sync_youtube

    sync_youtube._innertube_cache = None
    clients: list[str] = []

    def fake_fetch(
        url: str,
        payload: dict | None = None,
        extra_headers: dict | None = None,
    ) -> str:
        assert "youtubei/" in url
        assert payload is not None
        clients.append(str(payload["context"]["client"]["clientName"]))
        if payload["context"]["client"]["clientName"] == "ANDROID":
            assert (extra_headers or {}).get("User-Agent", "").startswith(
                "com.google.android.youtube/"
            )
            return json.dumps(
                {"videoDetails": {"shortDescription": "TUMI KON ATITE MORE ..2065"}}
            )
        return json.dumps({"playabilityStatus": {"status": "LOGIN_REQUIRED"}})

    monkeypatch.setattr("scripts.sync_youtube.fetch", fake_fetch)
    assert fetch_video_description("KqHHEov2QaE") == "TUMI KON ATITE MORE ..2065"
    assert clients[0] == "ANDROID"


def test_fetch_video_description_skips_stub_without_catalog_number(
    monkeypatch,
) -> None:  # type: ignore[no-untyped-def]
    import scripts.sync_youtube as sync_youtube

    sync_youtube._innertube_cache = None

    def fake_fetch(
        url: str,
        payload: dict | None = None,
        extra_headers: dict | None = None,
    ) -> str:
        name = str((payload or {}).get("context", {}).get("client", {}).get("clientName"))
        if name == "ANDROID":
            return json.dumps(
                {
                    "videoDetails": {
                        "shortDescription": "TREASURE OF 5018 SPIRITUAL SONGS...."
                    }
                }
            )
        if name == "IOS":
            return json.dumps(
                {"videoDetails": {"shortDescription": "TUMI KON ATITE MORE ..2065"}}
            )
        return json.dumps({"playabilityStatus": {"status": "LOGIN_REQUIRED"}})

    monkeypatch.setattr("scripts.sync_youtube.fetch", fake_fetch)
    assert fetch_video_description("KqHHEov2QaE") == "TUMI KON ATITE MORE ..2065"


def test_persist_youtube_inventory_skips_without_database_url(monkeypatch) -> None:
    monkeypatch.delenv("DATABASE_URL", raising=False)
    result = persist_youtube_inventory([], [], {})
    assert result["inserted_media"] == 0
    assert result["inserted_reviews"] == 0
    assert result["approved_reviews"] == 0
    assert result["inserted_song_numbers"] == []


def test_fold_pending_videos_adds_queued_ids() -> None:
    discovered = [{"video_id": "on-channel", "title": "Already listed"}]
    pending = [
        {"external_id": "queued-2065", "title": "PRABHAT SAMGIITA || TUMI KON ATITE MORE"},
        {"external_id": "on-channel", "title": "Duplicate"},
        {"external_id": "already-linked", "title": "Skip"},
    ]
    videos = fold_pending_videos(discovered, pending, {"already-linked"})
    ids = {video["video_id"] for video in videos}
    assert ids == {"on-channel", "queued-2065"}


def test_review_matches_channel_accepts_name_and_handle() -> None:
    channel = {
        "id": "UCPEe8JPgsVkC77PHrioTa5g",
        "name": "Manas Rawa",
        "url": "https://www.youtube.com/@rawaassam/videos",
    }
    assert review_matches_channel(
        {
            "channel_id": "legacy",
            "channel_name": "MANAS RAWA ASSAM",
            "source_url": "",
        },
        channel,
    )
    assert review_matches_channel(
        {"channel_id": "UCPEe8JPgsVkC77PHrioTa5g", "channel_name": "", "source_url": ""},
        channel,
    )
    assert not review_matches_channel(
        {"channel_id": "other", "channel_name": "AMPS", "source_url": ""},
        channel,
    )


def test_queued_needs_description_skips_numbered_title_channels() -> None:
    title_channel = {**CHANNELS[0], "number_source": "title"}
    assert not queued_needs_description(
        {"title": "Prabhat Samgiita Song Number 12"},
        title_channel,
    )
    assert queued_needs_description(
        {"title": "PRABHAT SAMGIITA || TUMI KON ATITE MORE || MANAS"},
        title_channel,
    )
    assert queued_needs_description(
        {"title": "Prabhat Samgiita Song Number 12"},
        {**title_channel, "number_source": "description"},
    )


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
        def __enter__(self) -> Response:
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
