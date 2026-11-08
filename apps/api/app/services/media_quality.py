"""Which audio and video a client may see, and in which order.

Selection rules (one place, so every endpoint agrees):

1. Status. Only media whose ``verification_status`` is one of ``ACCEPTED_MEDIA_STATUSES`` reaches a
   client. ``unverified``, ``draft``, ``ai_generated``, ``needs_review``, ``rejected`` and rows with
   no status never do. Sarkarverse mirrors are audio of unknown rights and are not served either.
2. Merge. Bundled snapshot rows (official audio, ``youtube_videos.json``) and database rows (admin
   approvals, channel scans) are combined for every song. A database row replaces a snapshot row of
   the same recording, so an admin rejection removes a bundled video. A recording is identified by
   its YouTube embed id (any watch/short/embed URL form), otherwise by its URL.
3. Order (``media_quality_key``, same order everywhere): audio before video; then current, normal
   quality, direct recordings before old versions, low quality files and legacy proxies; then
   official/verified sources before community ones; then recordings flagged ``is_primary`` in the
   metadata; then the higher ``match_score``; then the title in natural order ("SONG 2" before
   "SONG 10", the plain file name before its numbered copies); finally the URL. No step depends on
   database row order or on insertion order.
4. Best. ``is_latest`` marks exactly one audio file per song: the first audio in that order that is
   neither an old version nor low quality (the first audio if every file is). It is the default
   track to play, chosen by the rule above and, where a person has set ``is_primary``, by that
   choice. It is not a judgement of musical quality.
"""

import re
from collections.abc import Iterable
from urllib.parse import parse_qs, urlparse

from app.config import get_settings
from app.models.media import Media
from app.schemas.song import MediaItemResponse
from app.services.media_proxy import BROKEN_TLS_MEDIA_HOSTS, client_media_url
from app.services.recording_loudness import loudness_from_metadata

ACCEPTED_MEDIA_STATUSES = frozenset(
    {"verified", "verified_external", "human_reviewed", "officially_verified"}
)

_YOUTUBE_ID = re.compile(r"^[A-Za-z0-9_-]{11}$")
_YOUTUBE_HOSTS = {
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "music.youtube.com",
    "youtube-nocookie.com",
    "www.youtube-nocookie.com",
    "youtu.be",
}
# A video of a dance staging, a live programme or a compilation is a different thing from a plain
# recording of the song; it is listed after the plain recordings.
_PROGRAMME_TITLE = re.compile(
    r"\b(dance|dancing|live|programme|program|compilation|medley|festival|concert|"
    r"interview|podcast|talk)\b",
    re.IGNORECASE,
)
_DIGITS = re.compile(r"(\d+)")


def media_is_accepted(item: Media) -> bool:
    """True when the row's review status allows showing it to a client."""
    return str(item.verification_status or "").strip().lower() in ACCEPTED_MEDIA_STATUSES


def youtube_embed_id(item: Media) -> str | None:
    """The 11-character YouTube id of a row, from its metadata or any of its URLs."""
    metadata = item.metadata_json or {}
    candidates: list[str] = []
    external = metadata.get("external_id")
    if isinstance(external, str):
        candidates.append(external.strip())
    for raw in (item.embed_url, item.url):
        if not raw:
            continue
        parsed = urlparse(raw)
        host = (parsed.hostname or "").lower().rstrip(".")
        if host not in _YOUTUBE_HOSTS:
            continue
        parts = [part for part in parsed.path.split("/") if part]
        if host == "youtu.be" and parts:
            candidates.append(parts[0])
        elif parts and parts[0] in {"embed", "shorts", "live", "v"} and len(parts) > 1:
            candidates.append(parts[1])
        else:
            candidates.extend(parse_qs(parsed.query).get("v", [])[:1])
    for candidate in candidates:
        if _YOUTUBE_ID.match(candidate):
            return candidate
    return None


def media_identity(item: Media) -> tuple[str, str]:
    """Two rows with the same identity are the same recording."""
    video_id = youtube_embed_id(item) if item.kind == "video" else None
    if video_id:
        return ("youtube", video_id)
    return (item.kind, (item.url or "").strip())


def merge_media(
    snapshot: Iterable[Media],
    database: Iterable[Media],
    *,
    accepted_only: bool = True,
) -> list[Media]:
    """Snapshot and database rows of one song as one de-duplicated, ordered list.

    A database row wins over the snapshot row of the same recording (so a rejection removes a
    bundled video); the status filter runs after that.
    """
    merged: dict[tuple[str, str], Media] = {}
    for item in snapshot:
        merged.setdefault(media_identity(item), item)
    for item in database:
        merged[media_identity(item)] = item
    rows = [item for item in merged.values() if media_is_accepted(item) or not accepted_only]
    return sorted(rows, key=media_quality_key)


def accepted_media(items: Iterable[Media]) -> list[Media]:
    """The rows of a whole snapshot that a client may see, by the same rules as ``merge_media``.

    Rows are grouped by song, each song is merged and status-filtered, so counts and statistics
    (search filters, direct answers) agree with what ``CatalogService.get_media`` returns.
    """
    by_song: dict[int | None, list[Media]] = {}
    for item in items:
        by_song.setdefault(item.song_number, []).append(item)
    rows: list[Media] = []
    for song_rows in by_song.values():
        rows.extend(merge_media(song_rows, ()))
    return rows


def is_sarkarverse_audio_url(url: str | None) -> bool:
    if not url:
        return False
    hostname = (urlparse(url).hostname or "").lower().rstrip(".")
    return hostname in {"sarkarverse.org", "www.sarkarverse.org"} and "/ps/" in url.lower()


def client_media_items(items: list[Media]) -> list[Media]:
    """Return only client-playable media: official archive audio, never Sarkarverse mirrors."""
    without_sarkarverse = [
        item
        for item in items
        if media_is_accepted(item)
        and not (item.kind == "audio" and is_sarkarverse_audio_url(item.url))
    ]
    return filter_audio_media_for_clients(without_sarkarverse)


def requires_broken_tls_proxy(url: str | None) -> bool:
    """True for legacy API proxy URLs that still return HTML from Azure."""
    if not url:
        return False
    if "/api/v1/media/stream?" in url:
        return True
    hostname = (urlparse(url).hostname or "").lower().rstrip(".")
    return hostname in BROKEN_TLS_MEDIA_HOSTS


def media_is_low_quality(item: Media) -> bool:
    return "low quality" in f"{item.title} {item.url}".casefold()


def media_is_older(item: Media) -> bool:
    metadata = item.metadata_json or {}
    searchable = f"{item.title} {item.url}".casefold()
    return metadata.get("version") == "old" or "old version" in searchable


def _natural(text: str) -> tuple[tuple[int, int, str], ...]:
    """Sort key where digit runs compare as numbers: "song 2" < "song 10"."""
    return tuple(
        (0, int(part), "") if part.isdigit() else (1, 0, part)
        for part in _DIGITS.split(text.casefold())
        if part
    )


def media_quality_key(
    item: Media,
) -> tuple[int, int, int, int, int, int, int, float, tuple[tuple[int, int, str], ...], str]:
    metadata = item.metadata_json or {}
    source_status = str(metadata.get("source_status") or item.verification_status)
    source_order = {"official": 0, "verified": 0, "verified_community": 1, "community": 2}
    match_score = float(metadata.get("match_score") or 0)
    is_primary = 0 if metadata.get("is_primary") else 1
    source_rank = source_order.get(source_status)
    if source_rank is None:
        source_rank = 0 if item.provider == "official" else 3
    kind_rank = {"audio": 0, "video": 1}.get(item.kind, 2)
    programme = 1 if item.kind == "video" and _PROGRAMME_TITLE.search(item.title or "") else 0
    return (
        kind_rank,
        1 if media_is_low_quality(item) else 0,
        1 if media_is_older(item) else 0,
        1 if requires_broken_tls_proxy(item.url) else 0,
        programme,
        source_rank,
        is_primary,
        -match_score,
        _natural(item.title or ""),
        item.url or "",
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


def client_playable_audio_url(items: list[Media], *, api_base_url: str) -> str | None:
    """Best direct archive audio URL for mobile/web clients."""
    picked = preferred_audio_url(items)
    if not picked:
        return None
    return client_media_url(picked, api_base_url=api_base_url)


def filter_audio_media_for_clients(items: list[Media]) -> list[Media]:
    """Drop legacy `/media/stream` proxy URLs when a direct archive take is available."""
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
    client_url = client_media_url(item.url, api_base_url=api_base) or item.url
    client_embed = (
        client_media_url(item.embed_url, api_base_url=api_base) if item.embed_url else None
    )
    loudness = loudness_from_metadata(metadata) if is_audio else None
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
        loudness_lufs=loudness[0] if loudness else None,
        true_peak_db=loudness[1] if loudness else None,
    )
