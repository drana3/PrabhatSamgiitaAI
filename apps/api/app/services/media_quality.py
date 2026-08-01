from app.models.media import Media


def media_quality_key(item: Media) -> tuple[int, int, int, float, str]:
    metadata = item.metadata_json or {}
    searchable = f"{item.title} {item.url}".casefold()
    low_quality = 1 if "low quality" in searchable else 0
    old_version = 1 if metadata.get("version") == "old" or "old version" in searchable else 0
    source_status = str(metadata.get("source_status") or item.verification_status)
    source_order = {"official": 0, "verified": 0, "verified_community": 1, "community": 2}
    match_score = float(metadata.get("match_score") or 0)
    return (
        low_quality,
        old_version,
        source_order.get(source_status, 3),
        -match_score,
        item.title.casefold(),
    )
