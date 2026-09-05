from __future__ import annotations

from urllib.parse import quote

from app.services.media_proxy import (
    BROKEN_TLS_MEDIA_HOSTS,
    proxied_media_url,
    upstream_tls_verify,
)


def test_proxied_media_url_rewrites_prabhata_net() -> None:
    raw = "https://prabhatasamgiita.net/1-999/3%20SONG.mp3"
    proxied = proxied_media_url(raw, api_base_url="https://www.prabhatasamgiita.org")
    assert proxied is not None
    assert proxied.startswith("https://www.prabhatasamgiita.org/api/v1/media/stream?url=")
    assert quote(raw, safe="") in proxied


def test_proxied_media_url_leaves_sarkarverse_alone() -> None:
    raw = "https://sarkarverse.org/PS/song3.mp3"
    assert proxied_media_url(raw, api_base_url="https://www.prabhatasamgiita.org") == raw


def test_upstream_tls_verify() -> None:
    assert upstream_tls_verify("https://prabhatasamgiita.net/x.mp3") is False
    assert upstream_tls_verify("https://sarkarverse.org/x.mp3") is True
    assert "prabhatasamgiita.net" in BROKEN_TLS_MEDIA_HOSTS
