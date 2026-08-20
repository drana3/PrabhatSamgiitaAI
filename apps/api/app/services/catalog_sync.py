"""Poll Postgres so in-process catalog memory stays aligned without user-visible lag."""

from __future__ import annotations

import asyncio
import logging
from datetime import UTC, datetime, timedelta

from app.config import get_settings
from app.services.catalog import refresh_catalog_changes_since

logger = logging.getLogger(__name__)

_last_success_at: datetime | None = None


def reset_catalog_sync_state() -> None:
    """Test helper — forget the poll watermark."""
    global _last_success_at
    _last_success_at = None


def _since_for_poll(now: datetime) -> datetime:
    settings = get_settings()
    if _last_success_at is None:
        return now - timedelta(minutes=settings.catalog_poll_lookback_minutes)
    overlap = timedelta(seconds=settings.catalog_poll_overlap_seconds)
    return _last_success_at - overlap


async def sync_catalog_from_database() -> int:
    """Pull recent DB changes into memory. Returns number of songs refreshed."""
    global _last_success_at
    from app.core.db import SessionLocal

    now = datetime.now(UTC)
    since = _since_for_poll(now)
    async with SessionLocal() as session:
        refreshed = await refresh_catalog_changes_since(session, since)
    _last_success_at = now
    if refreshed:
        logger.info(
            "Catalog memory synced from database (refreshed=%s, since=%s)",
            refreshed,
            since.isoformat(),
        )
    return refreshed


async def catalog_poll_loop() -> None:
    """Background loop: short interval + overlapping lookback so DB edits appear quickly."""
    settings = get_settings()
    if settings.catalog_poll_initial_delay_seconds:
        await asyncio.sleep(settings.catalog_poll_initial_delay_seconds)
    while True:
        try:
            await sync_catalog_from_database()
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Catalog memory refresh from database failed")
        await asyncio.sleep(settings.catalog_poll_interval_seconds)
