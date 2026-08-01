from __future__ import annotations

import ipaddress
from urllib.parse import urlparse

ALLOWED_MEDIA_HOSTS = {
    "youtube.com",
    "www.youtube.com",
    "youtu.be",
    "youtube-nocookie.com",
    "www.youtube-nocookie.com",
    "prabhatasamgiita.net",
    "www.prabhatasamgiita.net",
    "anandamarga.org",
    "www.anandamarga.org",
    "india.anandamarga.org",
    "psplayer.org",
    "www.psplayer.org",
    "sarkarverse.org",
    "www.sarkarverse.org",
}


def validate_external_media_url(value: str) -> str:
    parsed = urlparse(value)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError("Media URLs must be public HTTPS URLs")
    hostname = parsed.hostname.lower().rstrip(".")
    if hostname == "localhost" or hostname.endswith(".localhost"):
        raise ValueError("Local media URLs are not allowed")
    try:
        address = ipaddress.ip_address(hostname)
    except ValueError:
        address = None
    if address and not address.is_global:
        raise ValueError("Private or local media addresses are not allowed")
    if hostname not in ALLOWED_MEDIA_HOSTS:
        raise ValueError("Media host is not allow-listed")
    return value
