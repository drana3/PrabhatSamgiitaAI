from app.models.media import Media
from app.schemas.song import MediaItemResponse


def media_is_low_quality(item: Media) -> bool:
    return "low quality" in f"{item.title} {item.url}".casefold()


def media_is_older(item: Media) -> bool:
    metadata = item.metadata_json or {}
    searchable = f"{item.title} {item.url}".casefold()
    return metadata.get("version") == "old" or "old version" in searchable


def media_quality_key(item: Media) -> tuple[int, int, int, int, float, str]:
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
        source_rank,
        is_primary,
        -match_score,
        item.title.casefold(),
    )


def preferred_audio_url(items: list[Media]) -> str | None:
    audio = sorted((item for item in items if item.kind == "audio"), key=media_quality_key)
    for item in audio:
        if not media_is_older(item) and not media_is_low_quality(item):
            return item.url
    return audio[0].url if audio else None


def to_media_item_response(item: Media, *, latest_url: str | None = None) -> MediaItemResponse:
    metadata = item.metadata_json or {}
    is_audio = item.kind == "audio"
    is_older = is_audio and media_is_older(item)
    is_low_quality = is_audio and media_is_low_quality(item)
    return MediaItemResponse(
        kind=item.kind,
        provider=item.provider,
        title=item.title,
        url=item.url,
        embed_url=item.embed_url,
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
