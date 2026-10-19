from __future__ import annotations

import os
from collections.abc import AsyncIterator
from unittest.mock import AsyncMock, patch
from uuid import uuid4

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://test:test@localhost/test")

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.v1.admin import router as admin_router
from app.core.db import get_session
from app.core.security import require_admin


def _client() -> TestClient:
    app = FastAPI()
    app.include_router(admin_router, prefix="/api/v1")

    async def fake_session() -> AsyncIterator[object]:
        yield object()

    app.dependency_overrides[get_session] = fake_session
    app.dependency_overrides[require_admin] = lambda: "api-key-admin"
    return TestClient(app)


def test_admin_lists_youtube_channels() -> None:
    client = _client()
    with patch(
        "app.api.v1.admin.list_all_youtube_scan_channels",
        new=AsyncMock(return_value=[]),
    ):
        response = client.get("/api/v1/admin/youtube-channels")
    assert response.status_code == 200
    assert response.json() == {"items": []}


def test_admin_scan_all_youtube_channels() -> None:
    client = _client()
    payload = {
        "channels_scanned": 3,
        "discovered": 90,
        "already_known": 10,
        "new_queued_for_review": 0,
        "new_auto_linked": 2,
        "already_queued": 20,
        "deferred": 0,
        "descriptions_read": 12,
        "channels": [],
    }
    with patch(
        "app.api.v1.admin.scan_all_youtube_channels",
        new=AsyncMock(return_value=payload),
    ):
        response = client.post("/api/v1/admin/youtube-channels/scan-all?max_pages=4")
    assert response.status_code == 200
    assert response.json()["channels_scanned"] == 3
    assert response.json()["new_auto_linked"] == 2


def test_admin_scan_one_youtube_channel() -> None:
    client = _client()
    channel_id = uuid4()
    payload = {
        "discovered": 12,
        "already_known": 4,
        "new_queued_for_review": 0,
        "new_auto_linked": 1,
        "already_queued": 7,
        "deferred": 0,
        "descriptions_read": 8,
    }
    with patch(
        "app.api.v1.admin.scan_youtube_channel",
        new=AsyncMock(return_value=payload),
    ):
        response = client.post(f"/api/v1/admin/youtube-channels/{channel_id}/scan")
    assert response.status_code == 200
    assert response.json()["new_auto_linked"] == 1
    assert response.json()["descriptions_read"] == 8
