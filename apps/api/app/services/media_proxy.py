from __future__ import annotations

from urllib.parse import parse_qs, quote, unquote, urlparse

import httpx
from fastapi import HTTPException

from app.core.urls import validate_external_media_url

# Do not proxy prabhatasamgiita.net archive MP3s through Azure: LiteSpeed bot protection
# serves a JS challenge HTML page to datacenter IPs. Browsers fetch audio/mpeg directly.
BROKEN_TLS_MEDIA_HOSTS: frozenset[str] = frozenset()

MEDIA_FETCH_USER_AGENT = (
    "Mozilla/5.0 (compatible; PrabhatSamgiitaAI/1.0; +https://www.prabhatasamgiita.org)"
)


def upstream_tls_verify(url: str) -> bool:
    hostname = (urlparse(url).hostname or "").lower().rstrip(".")
    return hostname not in BROKEN_TLS_MEDIA_HOSTS


def is_legacy_media_proxy_url(url: str | None) -> bool:
    return bool(url and "/api/v1/media/stream?" in url)


def unwrap_legacy_proxy_url(url: str | None) -> str | None:
    """Extract the upstream archive URL from a stale `/api/v1/media/stream` link."""
    if not is_legacy_media_proxy_url(url):
        return url
    upstream = parse_qs(urlparse(url or "").query).get("url", [None])[0]
    if not upstream:
        return url
    decoded = unquote(upstream)
    if not decoded.startswith(("http://", "https://")):
        return url
    try:
        return validate_external_media_url(decoded)
    except ValueError:
        return url


def client_media_url(url: str | None, *, api_base_url: str) -> str | None:
    """Return a direct client-playable URL — never a legacy API proxy."""
    direct = unwrap_legacy_proxy_url(url)
    if not direct:
        return direct
    return proxied_media_url(direct, api_base_url=api_base_url)


def proxied_media_url(url: str | None, *, api_base_url: str) -> str | None:
    if not url:
        return url
    try:
        validated = validate_external_media_url(url)
    except ValueError:
        return url
    hostname = (urlparse(validated).hostname or "").lower().rstrip(".")
    if hostname in BROKEN_TLS_MEDIA_HOSTS:
        base = api_base_url.rstrip("/")
        return f"{base}/api/v1/media/stream?url={quote(validated, safe='')}"
    return validated


async def stream_allowed_media(
    url: str,
    *,
    range_header: str | None = None,
) -> tuple[int, dict[str, str], httpx.AsyncClient, httpx.Response]:
    try:
        validated = validate_external_media_url(url)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Media URL is not allowed") from exc

    headers: dict[str, str] = {"User-Agent": MEDIA_FETCH_USER_AGENT}
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

    content_type = (response.headers.get("content-type") or "").lower()
    if "text/html" in content_type:
        body = await response.aread()
        await response.aclose()
        await client.aclose()
        detail = body.decode("utf-8", "replace")[:200]
        raise HTTPException(status_code=502, detail=f"Upstream returned HTML: {detail}")

    out_headers: dict[str, str] = {}
    for key in ("content-type", "content-length", "content-range", "accept-ranges"):
        value = response.headers.get(key)
        if value:
            out_headers[key.title()] = value
    if "Accept-Ranges" not in out_headers:
        out_headers["Accept-Ranges"] = "bytes"
    out_headers.setdefault("Cache-Control", "public, max-age=86400")
    return response.status_code, out_headers, client, response
