from __future__ import annotations

from app.services.media_proxy import (
    BROKEN_TLS_MEDIA_HOSTS,
    proxied_media_url,
    upstream_tls_verify,
)


def test_proxied_media_url_leaves_prabhata_net_direct() -> None:
    raw = "https://prabhatasamgiita.net/1-999/3%20SONG.mp3"
    assert proxied_media_url(raw, api_base_url="https://www.prabhatasamgiita.org") == raw


def test_proxied_media_url_leaves_sarkarverse_alone() -> None:
    raw = "https://sarkarverse.org/PS/song3.mp3"
    assert proxied_media_url(raw, api_base_url="https://www.prabhatasamgiita.org") == raw


def test_upstream_tls_verify() -> None:
    assert upstream_tls_verify("https://prabhatasamgiita.net/x.mp3") is True
    assert upstream_tls_verify("https://sarkarverse.org/x.mp3") is True
    assert not BROKEN_TLS_MEDIA_HOSTS


def test_client_media_items_drop_sarkarverse_audio() -> None:
    from app.models.media import Media
    from app.services.media_quality import client_media_items

    official = Media(
        song_number=1,
        kind="audio",
        provider="official",
        title="Archive",
        url="https://prabhatasamgiita.net/1-999/1.mp3",
        verification_status="verified",
    )
    mirror = Media(
        song_number=1,
        kind="audio",
        provider="external_site",
        title="Mirror",
        url="https://sarkarverse.org/PS/1-999-f/_1.mp3",
        verification_status="unverified",
    )
    video = Media(
        song_number=1,
        kind="video",
        provider="youtube",
        title="Watch",
        url="https://www.youtube.com/watch?v=abc",
        verification_status="verified",
    )
    filtered = client_media_items([official, mirror, video])
    assert video in filtered
    assert official in filtered
    assert mirror not in filtered


def test_filter_audio_media_hides_legacy_proxy_when_direct_mirror_exists() -> None:
    from app.models.media import Media
    from app.services.media_quality import filter_audio_media_for_clients

    legacy_proxy = Media(
        song_number=1,
        kind="audio",
        provider="official",
        title="Archive",
        url=(
            "https://www.prabhatasamgiita.org/api/v1/media/stream?"
            "url=https%3A%2F%2Fprabhatasamgiita.net%2F1-999%2F1.mp3"
        ),
        verification_status="verified",
    )
    direct = Media(
        song_number=1,
        kind="audio",
        provider="official",
        title="Official archive",
        url="https://prabhatasamgiita.net/1-999/1.mp3",
        verification_status="verified",
    )
    video = Media(
        song_number=1,
        kind="video",
        provider="youtube",
        title="Watch",
        url="https://www.youtube.com/watch?v=abc",
        verification_status="verified",
    )
    filtered = filter_audio_media_for_clients([legacy_proxy, direct, video])
    assert video in filtered
    assert direct in filtered
    assert legacy_proxy not in filtered


def test_to_media_item_response_keeps_direct_prabhata_urls() -> None:
    from app.models.media import Media
    from app.services.media_quality import to_media_item_response

    item = Media(
        song_number=1,
        kind="audio",
        provider="official",
        title="Official archive",
        url="https://prabhatasamgiita.net/1-999/1.mp3",
        verification_status="verified",
    )
    response = to_media_item_response(item, latest_url=item.url)
    assert response.url == "https://prabhatasamgiita.net/1-999/1.mp3"
    assert "media/stream" not in response.url
    assert response.is_latest is True


def test_song_one_client_media_is_direct_official_archive_only() -> None:
    from app.services.catalog import catalog_media_snapshot, reset_catalog_memory
    from app.services.media_quality import (
        client_media_items,
        media_quality_key,
        preferred_audio_url,
        to_media_item_response,
    )

    reset_catalog_memory()
    media_items = sorted(
        client_media_items([item for item in catalog_media_snapshot() if item.song_number == 1]),
        key=media_quality_key,
    )
    latest_url = preferred_audio_url(media_items)
    responses = [to_media_item_response(item, latest_url=latest_url) for item in media_items]
    audio = [row for row in responses if row.kind == "audio"]
    assert len(audio) >= 2
    assert all("prabhatasamgiita.net" in row.url for row in audio)
    assert all("sarkarverse.org" not in row.url.lower() for row in audio)
    assert all("/api/v1/media/stream?" not in row.url for row in audio)
    latest = next(row for row in audio if row.is_latest)
    assert latest.url.startswith("https://prabhatasamgiita.net/")
    assert not latest.is_older


def test_preferred_audio_prefers_current_official_archive() -> None:
    from app.models.media import Media
    from app.services.media_quality import preferred_audio_url

    current = Media(
        song_number=1,
        kind="audio",
        provider="official",
        title="Official archive",
        url="https://prabhatasamgiita.net/1-999/1.mp3",
        verification_status="verified",
    )
    older = Media(
        song_number=1,
        kind="audio",
        provider="official",
        title="Official archive (old version)",
        url="https://prabhatasamgiita.net/1-999/1%20old.mp3",
        verification_status="verified",
        metadata_json={"version": "old"},
    )
    assert preferred_audio_url([older, current]) == current.url
