from __future__ import annotations

import pytest
from fastapi import HTTPException, Request
from pydantic import ValidationError

from app.config import Settings
from app.core.security import admin_attempts, hash_admin_api_key, require_admin
from app.core.urls import validate_external_media_url
from app.schemas.admin import AdminMediaWrite


def request_from(host: str = "127.0.0.1") -> Request:
    return Request({"type": "http", "client": (host, 1234), "headers": []})


@pytest.mark.asyncio
async def test_admin_key_is_compared_by_hash() -> None:
    admin_attempts.clear()
    key = "a-long-random-admin-key"
    settings = Settings(
        DATABASE_URL="postgresql+psycopg://test:test@localhost/test",
        ADMIN_API_KEY_HASH=hash_admin_api_key(key),
    )
    assert await require_admin(request_from(), key, settings) == "api-key-admin"

    with pytest.raises(HTTPException) as error:
        await require_admin(request_from(), "wrong-key", settings)
    assert error.value.status_code == 401


@pytest.mark.asyncio
async def test_admin_api_is_closed_when_not_configured() -> None:
    admin_attempts.clear()
    settings = Settings(DATABASE_URL="postgresql+psycopg://test:test@localhost/test")
    with pytest.raises(HTTPException) as error:
        await require_admin(request_from(), "any-key", settings)
    assert error.value.status_code == 503


@pytest.mark.parametrize(
    "url",
    [
        "javascript:alert(1)",
        "data:text/plain,bad",
        "http://www.youtube.com/watch?v=abc",
        "https://localhost/media.mp3",
        "https://127.0.0.1/media.mp3",
        "https://example.com/media.mp3",
    ],
)
def test_external_media_url_rejects_unsafe_targets(url: str) -> None:
    with pytest.raises(ValueError):
        validate_external_media_url(url)


def test_admin_media_accepts_privacy_enhanced_youtube_embed() -> None:
    item = AdminMediaWrite(
        song_number=1,
        kind="video",
        provider="youtube",
        title="Prabhat Samgiita 1",
        url="https://www.youtube.com/watch?v=D4LHhnSLhro",
        embed_url="https://www.youtube-nocookie.com/embed/D4LHhnSLhro",
    )
    assert item.song_number == 1


def test_admin_media_schema_rejects_unlisted_host() -> None:
    with pytest.raises(ValidationError):
        AdminMediaWrite(
            song_number=1,
            kind="audio",
            provider="direct_audio",
            title="Unsafe media",
            url="https://example.com/audio.mp3",
        )
