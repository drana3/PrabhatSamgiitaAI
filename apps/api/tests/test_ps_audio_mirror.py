from __future__ import annotations

import json
from pathlib import Path
from urllib.parse import unquote, urlparse

from app.services.media_proxy import client_media_url, mirrored_audio_url

BASE = "https://audio.example.test"
API = "https://api.example.test"


def test_archive_mp3_maps_to_the_same_path_under_the_mirror() -> None:
    url = "https://prabhatasamgiita.net/1-999/1%20BANDHU%20HE%20NIYE%20CALO.mp3"
    assert mirrored_audio_url(url, BASE) == (
        "https://audio.example.test/official/1-999/1%20BANDHU%20HE%20NIYE%20CALO.mp3"
    )
    assert mirrored_audio_url(url, BASE + "/") == mirrored_audio_url(url, BASE)


def test_empty_mirror_keeps_archive_link() -> None:
    url = "https://prabhatasamgiita.net/1-999/1.mp3"
    assert mirrored_audio_url(url, "") is None
    assert client_media_url(url, api_base_url=API) == url
    assert client_media_url(url, api_base_url=API, mirror_base_url="") == url


def test_only_archive_mp3_over_https_is_mapped() -> None:
    for url in (
        "https://prabhatasamgiita.net/notations/andromeda.php",
        "http://prabhatasamgiita.net/1-999/1.mp3",
        "https://sarkarverse.org/ps/1.mp3",
        "https://www.youtube.com/watch?v=abcdefghijk",
        "https://prabhatasamgiita.net/../secret.mp3",
        None,
    ):
        assert mirrored_audio_url(url, BASE) is None


def test_client_media_url_uses_mirror_and_unwraps_legacy_proxy() -> None:
    proxy = f"{API}/api/v1/media/stream?url=https%3A%2F%2Fprabhatasamgiita.net%2F1-999%2F1.mp3"
    assert (
        client_media_url(proxy, api_base_url=API, mirror_base_url=BASE)
        == "https://audio.example.test/official/1-999/1.mp3"
    )


def test_every_catalogue_mp3_maps_to_the_bucket_key_the_copy_script_writes() -> None:
    """transfer.py stores `official/<unquoted archive path>`; the mirror URL must decode to the same key."""
    media = Path(__file__).resolve().parents[3] / "data" / "generated" / "media.json"
    rows = [
        r
        for r in json.loads(media.read_text())
        if r.get("kind") == "audio" and str(r.get("url", "")).lower().endswith(".mp3")
    ]
    assert rows
    for row in rows:
        mirrored = mirrored_audio_url(row["url"], BASE)
        assert mirrored is not None, row["url"]
        key = unquote(urlparse(mirrored).path.lstrip("/"))
        assert key == "official/" + unquote(urlparse(row["url"]).path.lstrip("/"))
