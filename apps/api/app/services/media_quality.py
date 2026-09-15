from urllib.parse import urlparse

from app.config import get_settings
from app.models.media import Media
from app.schemas.song import MediaItemResponse
from app.services.media_proxy import BROKEN_TLS_MEDIA_HOSTS, proxied_media_url


def requires_broken_tls_proxy(url: str | None) -> bool:
    if not url:
        return False
    hostname = (urlparse(url).hostname or "").lower().rstrip(".")
    return hostname in BROKEN_TLS_MEDIA_HOSTS


def media_is_low_quality(item: Media) -> bool:
    return "low quality" in f"{item.title} {item.url}".casefold()


def media_is_older(item: Media) -> bool:
    metadata = item.metadata_json or {}
    searchable = f"{item.title} {item.url}".casefold()
    return metadata.get("version") == "old" or "old version" in searchable


def media_quality_key(item: Media) -> tuple[int, int, int, int, int, float, str]:
    metadata = item.metadata_json or {}
    source_status = str(metadata.get("source_status") or item.verification_status)
    source_order = {"official": 0, "verified": 0, "verified_community": 1, "community": 2}
    match_score = float(metadata.get("match_score") or 0)
    is_primary = 0 if metadata.get("is_primary") else 1
    source_rank = source_order.get(source_status)
    if source_rank is None:
        source_rank = 0 if item.provider == "official" else 3
    return (
        1 if media_is_low_quality(item) else 0,
        1 if media_is_older(item) else 0,
        1 if requires_broken_tls_proxy(item.url) else 0,
        source_rank,
        is_primary,
        -match_score,
        item.title.casefold(),
    )


def _pick_best_audio(pool: list[Media]) -> str | None:
    ranked = sorted(pool, key=media_quality_key)
    for item in ranked:
        if not media_is_older(item) and not media_is_low_quality(item):
            return item.url
    return ranked[0].url if ranked else None


def preferred_audio_url(items: list[Media]) -> str | None:
    audio = [item for item in items if item.kind == "audio"]
    if not audio:
        return None
    direct = [item for item in audio if not requires_broken_tls_proxy(item.url)]
    picked = _pick_best_audio(direct)
    if picked:
        return picked
    return _pick_best_audio(audio)


def filter_audio_media_for_clients(items: list[Media]) -> list[Media]:
    """Hide prabhatasamgiita.net archive streams when a direct mirror is available.

    Production App Store builds still rank official archive URLs first and cannot
    play the HTML challenge pages our Azure media proxy sometimes returns.
    """
    audio = [item for item in items if item.kind == "audio"]
    if not audio:
        return items
    latest = preferred_audio_url(audio)
    if not latest or requires_broken_tls_proxy(latest):
        return items
    playable = [
        item for item in audio if not requires_broken_tls_proxy(item.url) or item.url == latest
    ]
    if len(playable) == len(audio):
        return items
    return [item for item in items if item.kind != "audio"] + playable


def to_media_item_response(item: Media, *, latest_url: str | None = None) -> MediaItemResponse:
    metadata = item.metadata_json or {}
    is_audio = item.kind == "audio"
    is_older = is_audio and media_is_older(item)
    is_low_quality = is_audio and media_is_low_quality(item)
    api_base = get_settings().next_public_api_base_url
    client_url = proxied_media_url(item.url, api_base_url=api_base) or item.url
    client_embed = (
        proxied_media_url(item.embed_url, api_base_url=api_base) if item.embed_url else None
    )
    return MediaItemResponse(
        kind=item.kind,
        provider=item.provider,
        title=item.title,
        url=client_url,
        embed_url=client_embed,
        verification_status=item.verification_status,
        source_url=item.source_url,
        notes=item.notes,
        external_id=metadata.get("external_id"),
        channel_name=metadata.get("channel_name"),
        source_status=metadata.get("source_status"),
        rights_status=metadata.get("rights_status"),
        availability_status=metadata.get("availability_status"),
        language=metadata.get("language"),
        match_score=metadata.get("match_score"),
        is_older=is_older,
        is_low_quality=is_low_quality,
        is_latest=bool(is_audio and latest_url and item.url == latest_url),
    )
