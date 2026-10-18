from __future__ import annotations

import os

os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+psycopg://test:test@localhost/test",
)

from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.core.cache import AsyncTTLCache
from app.services.catalog_sync import (
    _since_for_poll,
    reset_catalog_sync_state,
    sync_catalog_from_database,
)


@pytest.mark.asyncio
async def test_async_ttl_cache_clear_drops_entries() -> None:
    cache: AsyncTTLCache[str] = AsyncTTLCache(ttl_seconds=60, maxsize=8)
    await cache.set("a", "1")
    assert await cache.get("a") == "1"
    await cache.clear()
    assert await cache.get("a") is None
    cache.clear_sync()


def test_poll_lookback_uses_overlap_after_first_success(monkeypatch: pytest.MonkeyPatch) -> None:
    reset_catalog_sync_state()
    monkeypatch.setenv("CATALOG_POLL_LOOKBACK_MINUTES", "30")
    monkeypatch.setenv("CATALOG_POLL_OVERLAP_SECONDS", "90")
    from app.config import get_settings

    get_settings.cache_clear()

    now = datetime(2026, 8, 20, 12, 0, tzinfo=UTC)
    first = _since_for_poll(now)
    assert first == now - timedelta(minutes=30)

    import app.services.catalog_sync as sync_mod

    sync_mod._last_success_at = now - timedelta(seconds=30)
    second = _since_for_poll(now)
    assert second == (now - timedelta(seconds=30)) - timedelta(seconds=90)

    reset_catalog_sync_state()
    get_settings.cache_clear()


@pytest.mark.asyncio
async def test_sync_catalog_from_database_advances_watermark() -> None:
    reset_catalog_sync_state()

    session = MagicMock()
    session_cm = AsyncMock()
    session_cm.__aenter__.return_value = session
    session_cm.__aexit__.return_value = None

    with (
        patch("app.core.db.SessionLocal", return_value=session_cm),
        patch(
            "app.services.catalog_sync.refresh_catalog_changes_since",
            new=AsyncMock(return_value=2),
        ) as refresh,
    ):
        refreshed = await sync_catalog_from_database()

    assert refreshed == 2
    assert refresh.await_count == 1
    import app.services.catalog_sync as sync_mod

    assert sync_mod._last_success_at is not None
    reset_catalog_sync_state()
