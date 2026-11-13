# ruff: noqa: E501
"""The colleagues' recordings of Prabhat Samgiita songs (docs/ps-audio.md).

The files sit in a PRIVATE Cloudflare R2 bucket under `audio-extractor/ps-audio/`. The catalogue (`media` rows,
provider `ps_colleagues`) points each recording at `GET /api/v1/ps-audio/{file name}`; that route answers with a
redirect to a short-lived signed link, so the bucket itself stays closed and a phone (or a download) just follows it.

Only files the catalogue knows are served: the route never takes a free key, so the rest of the bucket (other
projects keep books there) cannot be read through it.
"""

from __future__ import annotations

import re
from collections.abc import Iterable
from urllib.parse import quote

from app.config import Settings
from app.models.media import Media
from app.services.recording_storage import StorageError, presign_s3_url

PS_AUDIO_PROVIDER = "ps_colleagues"
PS_AUDIO_KEY_PREFIX = "audio-extractor/ps-audio/"
PS_AUDIO_ROUTE = "/api/v1/ps-audio/"
# `<song number> <English title>.<ext>`, as the files are named in the bucket. No slash, no dot-dot.
PS_AUDIO_FILE = re.compile(r"^(\d{1,5}) [A-Za-z0-9 .'\-]{1,150}\.(?:m4a|mp3|wav)$")


def ps_audio_file_ok(filename: str) -> bool:
    return bool(PS_AUDIO_FILE.fullmatch(filename)) and ".." not in filename


def ps_audio_key(filename: str) -> str:
    return PS_AUDIO_KEY_PREFIX + filename


def ps_audio_route_url(api_base_url: str, filename: str) -> str:
    """The address stored in `media.url`: the API route, file name percent-encoded."""
    return f"{api_base_url.rstrip('/')}{PS_AUDIO_ROUTE}{quote(filename, safe='')}"


def is_registered(filename: str, media_of_song: Iterable[Media]) -> bool:
    """True when a catalogue row names exactly this file (`metadata_json.r2_key`)."""
    key = ps_audio_key(filename)
    return any((item.metadata_json or {}).get("r2_key") == key for item in media_of_song)


def signed_get_url(settings: Settings, filename: str, *, method: str = "GET") -> str:
    """A signed link to the file, valid `PS_AUDIO_LINK_SECONDS`. Keys come from the environment, never printed."""
    endpoint = settings.ps_audio_s3_endpoint or settings.recording_s3_endpoint
    access_key = settings.ps_audio_s3_access_key_id or settings.recording_s3_access_key_id
    secret = settings.ps_audio_s3_secret_access_key or settings.recording_s3_secret_access_key
    missing = [
        name
        for name, value in (
            ("PS_AUDIO_S3_ENDPOINT (or RECORDING_S3_ENDPOINT)", endpoint),
            ("PS_AUDIO_S3_ACCESS_KEY_ID (or RECORDING_S3_ACCESS_KEY_ID)", access_key),
            ("PS_AUDIO_S3_SECRET_ACCESS_KEY (or RECORDING_S3_SECRET_ACCESS_KEY)", secret),
        )
        if not value
    ]
    if missing:
        raise StorageError("PS audio storage is not configured: " + ", ".join(missing))
    assert endpoint and access_key and secret  # for mypy
    return presign_s3_url(
        method=method,
        endpoint=endpoint,
        bucket=settings.ps_audio_s3_bucket,
        key=ps_audio_key(filename),
        access_key_id=access_key,
        secret_access_key=secret,
        region=settings.recording_s3_region,
        expires_in=settings.ps_audio_link_seconds,
    )
