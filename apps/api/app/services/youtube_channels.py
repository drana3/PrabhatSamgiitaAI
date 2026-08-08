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
    channel_videos,
    fetch,
    initial_data,
    media_row,
    review_row,
    walk,
    youtube_video_in_scope,
)


def normalize_channel_url(url: str) -> str:
    cleaned = url.strip().rstrip("/")
    if not cleaned:
        raise HTTPException(status_code=422, detail="Channel URL is required.")
    if "/videos" not in cleaned:
        cleaned = f"{cleaned}/videos"
    return cleaned


def resolve_channel_id(channel_url: str, explicit_id: str | None = None) -> str:
    if explicit_id and explicit_id.strip().startswith("UC"):
        return explicit_id.strip()
    normalized = normalize_channel_url(channel_url)
    match = re.search(r"/channel/(UC[\w-]+)", normalized)
    if match:
        return match.group(1)
    try:
        html = fetch(normalized)
        payload = initial_data(html)
    except Exception as exc:
        raise HTTPException(
            status_code=422,
            detail="Could not resolve the YouTube channel ID from that URL.",
        ) from exc
    for item in walk(payload):
        metadata = item.get("metadata")
        if isinstance(metadata, dict):
            channel_id = metadata.get("externalId")
            if isinstance(channel_id, str) and channel_id.startswith("UC"):
                return channel_id
        channel_id = item.get("channelId")
        if isinstance(channel_id, str) and channel_id.startswith("UC"):
            return channel_id
    raise HTTPException(
        status_code=422,
        detail="Could not resolve the YouTube channel ID. Paste the channel ID (UC…) if needed.",
    )


def channel_dict(row: YoutubeScanChannel) -> dict[str, Any]:
    return {
        "url": normalize_channel_url(row.channel_url),
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


async def _load_songs_map(session: AsyncSession) -> dict[int, dict[str, Any]]:
    rows = list((await session.scalars(select(Song))).all())
    return {
        row.number: {
            "number": row.number,
            "title": row.title,
            "first_line": row.first_line,
        }
        for row in rows
    }


async def _known_external_ids(session: AsyncSession) -> set[str]:
    media_rows = list(
        (await session.scalars(select(Media).where(Media.provider == "youtube"))).all()
    )
    known: set[str] = set()
    for media in media_rows:
        metadata = media.metadata_json or {}
        external_id = metadata.get("external_id")
        if isinstance(external_id, str) and external_id:
            known.add(external_id)
        if "watch?v=" in media.url:
            match = re.search(r"[?&]v=([\w-]{6,})", media.url)
            if match:
                known.add(match.group(1))
    review_rows = list((await session.scalars(select(YoutubeReviewQueue))).all())
    for review in review_rows:
        known.add(review.external_id)
    return known


async def scan_youtube_channel(
    session: AsyncSession,
    channel_row_id: UUID,
    *,
    max_pages: int = 50,
) -> dict[str, int]:
    channel_row = await session.get(YoutubeScanChannel, channel_row_id)
    if channel_row is None or not channel_row.is_active:
        raise HTTPException(status_code=404, detail="YouTube channel not found.")

    songs = await _load_songs_map(session)
    known_ids = await _known_external_ids(session)
    channel = channel_dict(channel_row)

    try:
        discovered_videos = await asyncio.to_thread(channel_videos, channel, max_pages)
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Could not scan {channel_row.name}: {exc}",
        ) from exc

    new_queued = 0
    new_linked = 0
    known_count = 0

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

    return {
        "discovered": len(discovered_videos),
        "already_known": known_count,
        "new_queued_for_review": new_queued,
        "new_auto_linked": new_linked,
    }


async def scan_all_youtube_channels(
    session: AsyncSession, *, max_pages: int = 50
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
