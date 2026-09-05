from __future__ import annotations

from urllib.parse import quote, urlparse

import httpx
from fastapi import HTTPException

from app.core.urls import validate_external_media_url

# prabhatasamgiita.net currently serves a *.web-hosting.com certificate (hostname mismatch).
# Mobile AVPlayer and strict TLS clients fail; proxy through our API until hosting is fixed.
BROKEN_TLS_MEDIA_HOSTS = frozenset({"prabhatasamgiita.net", "www.prabhatasamgiita.net"})


def upstream_tls_verify(url: str) -> bool:
    hostname = (urlparse(url).hostname or "").lower().rstrip(".")
    return hostname not in BROKEN_TLS_MEDIA_HOSTS


def proxied_media_url(url: str | None, *, api_base_url: str) -> str | None:
    if not url:
        return url
    try:
        validated = validate_external_media_url(url)
    except ValueError:
        return url
    hostname = (urlparse(validated).hostname or "").lower().rstrip(".")
    if hostname not in BROKEN_TLS_MEDIA_HOSTS:
        return validated
    base = api_base_url.rstrip("/")
    return f"{base}/api/v1/media/stream?url={quote(validated, safe='')}"


async def stream_allowed_media(
    url: str,
    *,
    range_header: str | None = None,
) -> tuple[int, dict[str, str], httpx.AsyncClient, httpx.Response]:
    try:
        validated = validate_external_media_url(url)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Media URL is not allowed") from exc

    headers: dict[str, str] = {}
    if range_header:
        headers["Range"] = range_header

    client = httpx.AsyncClient(
        follow_redirects=True,
        verify=upstream_tls_verify(validated),
        timeout=httpx.Timeout(60.0, connect=15.0),
    )
    request = client.build_request("GET", validated, headers=headers)
    response = await client.send(request, stream=True)
    if response.status_code >= 400:
        body = await response.aread()
        await response.aclose()
        await client.aclose()
        detail = body.decode("utf-8", "replace")[:200]
        raise HTTPException(status_code=response.status_code, detail=detail)

    out_headers: dict[str, str] = {}
    for key in ("content-type", "content-length", "content-range", "accept-ranges"):
        value = response.headers.get(key)
        if value:
            out_headers[key.title()] = value
    if "Accept-Ranges" not in out_headers:
        out_headers["Accept-Ranges"] = "bytes"
    out_headers.setdefault("Cache-Control", "public, max-age=86400")
    return response.status_code, out_headers, client, response
