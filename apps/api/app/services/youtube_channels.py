from __future__ import annotations

import asyncio
import re
import sys
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Media, Song, UserAccount
from app.models.admin_workflow import YoutubeReviewQueue, YoutubeScanChannel

REPO_ROOT = Path(__file__).resolve().parents[4]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from scripts.sync_youtube import (  # noqa: E402
    CHANNELS,
    SCAN_LOOKBACK,
    channel_videos,
    fetch,
    initial_data,
    media_row,
    review_row,
    walk,
    youtube_video_in_scope,
)

ADMIN_SCAN_MAX_PAGES = 4
BATCH_SCAN_MAX_PAGES = 50
INCREMENTAL_SCAN_MAX_PAGES = 4


def normalize_channel_url(url: str) -> str:
    cleaned = url.strip().rstrip("/")
    if not cleaned:
        raise HTTPException(status_code=422, detail="Channel URL is required.")
    if "/videos" not in cleaned:
        cleaned = f"{cleaned}/videos"
    return cleaned


def _channel_id_from_item(item: dict[str, Any]) -> str | None:
    metadata = item.get("metadata")
    if isinstance(metadata, dict):
        channel_id = metadata.get("externalId")
        if isinstance(channel_id, str) and channel_id.startswith("UC"):
            return channel_id
    for key in ("channelId", "browseId", "externalId"):
        channel_id = item.get(key)
        if isinstance(channel_id, str) and channel_id.startswith("UC"):
            return channel_id
    return None


def _channel_id_from_html(html: str) -> str | None:
    for pattern in (
        r'"browseId"\s*:\s*"(UC[\w-]+)"',
        r'"channelId"\s*:\s*"(UC[\w-]+)"',
        r'"externalId"\s*:\s*"(UC[\w-]+)"',
        r'itemprop="channelId"\s+content="(UC[\w-]+)"',
        r"/channel/(UC[\w-]+)",
    ):
        match = re.search(pattern, html)
        if match:
            return match.group(1)
    return None


def resolve_channel_id(channel_url: str, explicit_id: str | None = None) -> str:
    if explicit_id and explicit_id.strip().startswith("UC"):
        return explicit_id.strip()
    normalized = normalize_channel_url(channel_url)
    match = re.search(r"/channel/(UC[\w-]+)", normalized)
    if match:
        return match.group(1)
    handle_match = re.search(r"youtube\.com/@([\w.-]+)", normalized, re.I)
    if handle_match:
        handle = handle_match.group(1).casefold()
        for channel in CHANNELS:
            url = str(channel.get("url", ""))
            url_handle = re.search(r"youtube\.com/@([\w.-]+)", url, re.I)
            if url_handle and url_handle.group(1).casefold() == handle:
                channel_id = channel.get("id")
                if isinstance(channel_id, str) and channel_id.startswith("UC"):
                    return channel_id
    try:
        html = fetch(normalized)
        channel_id = _channel_id_from_html(html)
        if channel_id:
            return channel_id
        payload = initial_data(html)
    except Exception as exc:
        raise HTTPException(
            status_code=422,
            detail="Could not resolve the YouTube channel ID from that URL.",
        ) from exc
    for item in walk(payload):
        channel_id = _channel_id_from_item(item)
        if channel_id:
            return channel_id
    raise HTTPException(
        status_code=422,
        detail="Could not resolve the YouTube channel ID. Paste the channel ID (UC…) if needed.",
    )


def channel_dict(row: YoutubeScanChannel) -> dict[str, Any]:
    scan_url = f"https://www.youtube.com/channel/{row.channel_id}/videos"
    return {
        "url": scan_url,
        "id": row.channel_id,
        "name": row.name,
        "trusted": row.is_trusted,
        "notes": row.notes or f"Scanned from {row.name}; embedded only, not re-hosted.",
    }


async def list_youtube_scan_channels(session: AsyncSession) -> list[YoutubeScanChannel]:
    return list(
        (
            await session.execute(
                select(YoutubeScanChannel)
                .where(YoutubeScanChannel.is_active.is_(True))
                .order_by(YoutubeScanChannel.name.asc())
            )
        ).scalars()
    )


async def list_all_youtube_scan_channels(session: AsyncSession) -> list[YoutubeScanChannel]:
    return list(
        (
            await session.execute(
                select(YoutubeScanChannel).order_by(
                    YoutubeScanChannel.is_active.desc(),
                    YoutubeScanChannel.name.asc(),
                )
            )
        ).scalars()
    )


async def create_youtube_scan_channel(
    session: AsyncSession,
    *,
    creator: UserAccount,
    name: str,
    channel_url: str,
    channel_id: str | None = None,
    is_trusted: bool = True,
    notes: str | None = None,
) -> YoutubeScanChannel:
    normalized_url = normalize_channel_url(channel_url)
    resolved_id = resolve_channel_id(normalized_url, channel_id)
    existing = await session.scalar(
        select(YoutubeScanChannel).where(YoutubeScanChannel.channel_id == resolved_id)
    )
    if existing is not None:
        if not existing.is_active:
            existing.is_active = True
            existing.name = name.strip()[:255]
            existing.channel_url = normalized_url
            existing.is_trusted = is_trusted
            existing.notes = notes
            await session.commit()
            await session.refresh(existing)
            return existing
        raise HTTPException(status_code=409, detail="That YouTube channel is already configured.")

    row = YoutubeScanChannel(
        name=name.strip()[:255],
        channel_id=resolved_id,
        channel_url=normalized_url,
        is_trusted=is_trusted,
        is_active=True,
        notes=notes,
        created_by=creator.id,
    )
    session.add(row)
    await session.commit()
    await session.refresh(row)
    return row


async def seed_default_youtube_scan_channels(
    session: AsyncSession,
    *,
    creator: UserAccount,
) -> list[YoutubeScanChannel]:
    rows: list[YoutubeScanChannel] = []
    for channel in CHANNELS:
        channel_id = str(channel["id"])
        raw_notes = channel.get("notes")
        notes = raw_notes if isinstance(raw_notes, str) else None
        existing = await session.scalar(
            select(YoutubeScanChannel).where(YoutubeScanChannel.channel_id == channel_id)
        )
        if existing is not None:
            if not existing.is_active:
                existing.is_active = True
                existing.name = str(channel["name"])[:255]
                existing.channel_url = normalize_channel_url(str(channel["url"]))
                existing.is_trusted = bool(channel.get("trusted", True))
                existing.notes = notes
            rows.append(existing)
            continue
        row = YoutubeScanChannel(
            name=str(channel["name"])[:255],
            channel_id=channel_id,
            channel_url=normalize_channel_url(str(channel["url"])),
            is_trusted=bool(channel.get("trusted", True)),
            is_active=True,
            notes=notes,
            created_by=creator.id,
        )
        session.add(row)
        rows.append(row)
    await session.commit()
    for row in rows:
        await session.refresh(row)
    return rows


async def deactivate_youtube_scan_channel(
    session: AsyncSession, channel_id: UUID
) -> YoutubeScanChannel:
    row = await session.get(YoutubeScanChannel, channel_id)
    if row is None:
        raise HTTPException(status_code=404, detail="YouTube channel not found.")
    row.is_active = False
    await session.commit()
    await session.refresh(row)
    return row


async def update_youtube_scan_channel(
    session: AsyncSession,
    channel_row_id: UUID,
    *,
    name: str | None = None,
    channel_url: str | None = None,
    channel_id: str | None = None,
    is_trusted: bool | None = None,
    notes: str | None = None,
    is_active: bool | None = None,
) -> YoutubeScanChannel:
    row = await session.get(YoutubeScanChannel, channel_row_id)
    if row is None:
        raise HTTPException(status_code=404, detail="YouTube channel not found.")

    next_url = normalize_channel_url(channel_url) if channel_url is not None else row.channel_url
    explicit_id = channel_id if channel_id is not None else None
    if channel_url is not None or explicit_id:
        resolved_id = resolve_channel_id(next_url, explicit_id or row.channel_id)
        if resolved_id != row.channel_id:
            conflict = await session.scalar(
                select(YoutubeScanChannel).where(YoutubeScanChannel.channel_id == resolved_id)
            )
            if conflict is not None and conflict.id != row.id:
                raise HTTPException(
                    status_code=409,
                    detail="Another configured channel already uses that YouTube channel ID.",
                )
            row.channel_id = resolved_id
        row.channel_url = next_url

    if name is not None:
        row.name = name.strip()[:255]
    if is_trusted is not None:
        row.is_trusted = is_trusted
    if notes is not None:
        row.notes = notes
    if is_active is not None:
        row.is_active = is_active

    await session.commit()
    await session.refresh(row)
    return row


async def _load_songs_map(session: AsyncSession) -> dict[int, dict[str, Any]]:
    stmt = select(Song.number, Song.title, Song.first_line).order_by(Song.number)
    rows = (await session.execute(stmt)).all()
    return {
        number: {
            "number": number,
            "title": title,
            "first_line": first_line,
        }
        for number, title, first_line in rows
    }


async def _known_external_ids(session: AsyncSession) -> set[str]:
    known: set[str] = set()
    media_rows = await session.execute(
        select(Media.metadata_json, Media.url).where(Media.provider == "youtube")
    )
    for metadata_json, url in media_rows.all():
        metadata = metadata_json or {}
        external_id = metadata.get("external_id")
        if isinstance(external_id, str) and external_id:
            known.add(external_id)
        if isinstance(url, str) and "watch?v=" in url:
            match = re.search(r"[?&]v=([\w-]{6,})", url)
            if match:
                known.add(match.group(1))
    review_rows = await session.scalars(select(YoutubeReviewQueue.external_id))
    known.update(review_rows.all())
    return known


async def scan_youtube_channel(
    session: AsyncSession,
    channel_row_id: UUID,
    *,
    max_pages: int = ADMIN_SCAN_MAX_PAGES,
) -> dict[str, int]:
    channel_row = await session.get(YoutubeScanChannel, channel_row_id)
    if channel_row is None or not channel_row.is_active:
        raise HTTPException(status_code=404, detail="YouTube channel not found.")

    songs = await _load_songs_map(session)
    known_ids = await _known_external_ids(session)
    channel = channel_dict(channel_row)

    since = None
    effective_max_pages = max_pages
    if channel_row.last_scanned_at is not None:
        since = channel_row.last_scanned_at.astimezone(UTC) - SCAN_LOOKBACK
        effective_max_pages = min(max_pages, INCREMENTAL_SCAN_MAX_PAGES)

    try:
        discovered_videos = await asyncio.to_thread(
            channel_videos,
            channel,
            effective_max_pages,
            since=since,
            known_ids=known_ids,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Could not scan {channel_row.name}: {exc}",
        ) from exc

    new_queued = 0
    new_linked = 0
    known_count = 0
    linked_numbers: list[int] = []

    for video in discovered_videos:
        external_id = video["video_id"]
        if external_id in known_ids:
            known_count += 1
            continue

        if not youtube_video_in_scope(video["title"]):
            continue

        matched = media_row(video, songs, channel)
        if matched is not None:
            verification = str(matched.get("verification_status") or "pending_review")
            if verification in {"verified", "verified_external"}:
                metadata = dict(matched.get("metadata_json") or {})
                session.add(
                    Media(
                        song_number=int(matched["song_number"]),
                        kind="video",
                        provider="youtube",
                        title=str(matched["title"])[:255],
                        url=str(matched["url"]),
                        embed_url=str(matched.get("embed_url") or ""),
                        verification_status=verification,
                        source_url=str(matched.get("source_url") or channel["url"]),
                        notes=str(matched.get("notes") or ""),
                        metadata_json=metadata,
                    )
                )
                new_linked += 1
                linked_numbers.append(int(matched["song_number"]))
                known_ids.add(external_id)
                continue

        review = review_row(video, songs, channel)
        if review is None:
            continue
        session.add(
            YoutubeReviewQueue(
                external_id=review["external_id"],
                title=review["title"],
                url=review["url"],
                channel_id=review.get("channel_id"),
                channel_name=review.get("channel_name"),
                source_url=review.get("source_url"),
                candidate_song_number=review.get("candidate_song_number"),
                title_similarity=review.get("title_similarity"),
                review_reason=str(review.get("review_reason") or "pending_review"),
                status="pending_review",
            )
        )
        new_queued += 1
        known_ids.add(external_id)

    channel_row.last_scanned_at = datetime.now(UTC)
    channel_row.last_scan_discovered = len(discovered_videos)
    channel_row.last_scan_new = new_queued + new_linked
    channel_row.last_scan_known = known_count
    await session.commit()
    if linked_numbers:
        from app.services.catalog import refresh_catalog_songs

        try:
            await refresh_catalog_songs(session, linked_numbers)
        except Exception:
            # Scan results are already persisted; catalog refresh can be retried separately.
            pass

    return {
        "discovered": len(discovered_videos),
        "already_known": known_count,
        "new_queued_for_review": new_queued,
        "new_auto_linked": new_linked,
    }


async def scan_all_youtube_channels(
    session: AsyncSession, *, max_pages: int = ADMIN_SCAN_MAX_PAGES
) -> dict[str, Any]:
    channels = await list_youtube_scan_channels(session)
    totals: dict[str, Any] = {
        "channels_scanned": 0,
        "discovered": 0,
        "already_known": 0,
        "new_queued_for_review": 0,
        "new_auto_linked": 0,
        "channels": [],
    }
    for channel in channels:
        result = await scan_youtube_channel(session, channel.id, max_pages=max_pages)
        totals["channels_scanned"] += 1
        totals["discovered"] += result["discovered"]
        totals["already_known"] += result["already_known"]
        totals["new_queued_for_review"] += result["new_queued_for_review"]
        totals["new_auto_linked"] += result["new_auto_linked"]
        totals["channels"].append({"name": channel.name, **result})
    return totals
