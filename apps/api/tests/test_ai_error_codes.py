import os

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://test:test@localhost/test")

import asyncio

import pytest
from fastapi import HTTPException

from app.api.v1 import ai as ai_module
from app.core import security
from app.models.song import Song
from app.schemas.song import ExplanationRequest


class FakeRequest:
    client = type("Client", (), {"host": "203.0.113.20"})()
    headers = type("Headers", (), {"get": lambda _self, _key, _default=None: None})()


def _patch_common(monkeypatch: pytest.MonkeyPatch, song: Song | None) -> None:
    class FakeCatalog:
        async def get_song(self, number: int) -> Song | None:
            return song

        async def related_songs(self, _song: Song) -> list[Song]:
            return []

    async def cache_get(_key: str) -> None:
        return None

    async def cache_set(_key: str, _value: list[str]) -> None:
        return None

    monkeypatch.setattr(ai_module, "CatalogService", lambda _session: FakeCatalog())
    monkeypatch.setattr(ai_module, "try_member_identity", lambda _request: None)
    monkeypatch.setattr(ai_module, "require_public_quota", lambda *_a, **_k: None)
    monkeypatch.setattr(ai_module.explanation_cache, "get", cache_get)
    monkeypatch.setattr(ai_module.explanation_cache, "set", cache_set)


def _run(payload: ExplanationRequest):
    return asyncio.run(
        ai_module.explain(payload, FakeRequest(), session=None)  # type: ignore[arg-type]
    )


def test_song_not_found_has_a_stable_code(monkeypatch: pytest.MonkeyPatch) -> None:
    _patch_common(monkeypatch, None)
    response = _run(ExplanationRequest(song_number=99999, prompt="what is this"))
    assert response.headers["x-error-code"] == "song_not_found"


def test_quota_exceeded_has_a_stable_code(monkeypatch: pytest.MonkeyPatch) -> None:
    song = Song(number=16, title="AJI", english_meaning="Deep in dream.", theme="Mysticism")
    _patch_common(monkeypatch, song)

    async def quota(**_kwargs):
        return type("Q", (), {"allowed": False, "guidance": "You have reached today's guest limit."})()

    monkeypatch.setattr(ai_module, "check_daily_ai_quota_persisted", quota)
    monkeypatch.setattr(ai_module, "try_structured_answer", lambda *_a, **_k: None)
    monkeypatch.setattr(ai_module, "try_direct_answer", lambda *_a, **_k: None)
    monkeypatch.setattr(ai_module, "try_conversation_answer", lambda *_a, **_k: None)
    monkeypatch.setattr(ai_module, "try_language_switch_acknowledgment", lambda *_a, **_k: None)
    response = _run(ExplanationRequest(song_number=16, prompt="explain the deeper meaning of this song"))
    assert response.headers["x-error-code"] == "quota_exceeded"


def test_rate_limit_error_carries_a_code() -> None:
    request = FakeRequest()
    with pytest.raises(HTTPException) as caught:
        for _ in range(200):
            security.require_public_quota(request, bucket="code-test", limit=2)  # type: ignore[arg-type]
    assert caught.value.status_code == 429
    assert caught.value.headers == {"X-Error-Code": "rate_limited"}
