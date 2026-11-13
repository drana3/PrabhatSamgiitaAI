"""The daily AI allowance is reported to the app: X-RateLimit-* on /ai/explain and GET /ai/quota."""

from __future__ import annotations

import asyncio
import os
from datetime import UTC, datetime

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://test:test@localhost/test")

import httpx
import pytest
from fastapi import FastAPI

from app.api.v1 import ai as ai_module
from app.core.db import get_session
from app.models.song import Song
from app.schemas.song import ExplanationRequest
from app.services.ai_quota import (
    DailyQuotaStatus,
    record_daily_ai_question,
    reset_daily_ai_quota_for_tests,
)
from app.services.ai_quota_report import (
    EXPOSED_HEADERS,
    LIMIT_HEADER,
    REMAINING_HEADER,
    RESET_HEADER,
    quota_headers,
    report_from_status,
    seconds_until_reset,
)

SONG = Song(number=16, title="AJI", english_meaning="Deep in dream.", theme="Mysticism")


def status(*, used: int, limit: int = 15, is_member: bool = False) -> DailyQuotaStatus:
    return DailyQuotaStatus(
        allowed=used < limit,
        used=used,
        limit=limit,
        remaining=max(limit - used, 0),
        is_member=is_member,
        guidance="" if used < limit else "You have reached today's limit.",
    )


# --------------------------------------------------------------------------- pure helpers


def test_reset_is_the_seconds_to_the_next_utc_midnight() -> None:
    assert seconds_until_reset(datetime(2026, 11, 6, 23, 59, 30, tzinfo=UTC)) == 30
    assert seconds_until_reset(datetime(2026, 11, 6, 0, 0, 0, tzinfo=UTC)) == 86_400
    assert seconds_until_reset(datetime(2026, 12, 31, 12, 0, 0, tzinfo=UTC)) == 12 * 3600
    assert seconds_until_reset() >= 1


def test_report_counts_down_and_never_goes_below_zero() -> None:
    now = datetime(2026, 11, 6, 12, 0, tzinfo=UTC)
    report = report_from_status(status(used=4), now=now)
    assert report is not None
    assert (report.limit, report.remaining, report.used) == (15, 11, 4)
    assert report.reset_seconds == 43_200

    def remaining(used: int, charged: int = 0) -> int:
        again = report_from_status(status(used=used), charged=charged, now=now)
        assert again is not None
        return again.remaining

    assert remaining(4, charged=1) == 10
    assert remaining(15, charged=1) == 0
    assert remaining(99) == 0


def test_a_status_without_numbers_gives_no_report_and_no_headers() -> None:
    fake = type("Q", (), {"allowed": True, "guidance": ""})()
    assert report_from_status(fake) is None
    assert quota_headers(None) == {}
    assert report_from_status(type("Q", (), {"limit": 0, "used": 0})()) is None
    assert report_from_status(type("Q", (), {"limit": True, "used": 0})()) is None
    assert report_from_status(type("Q", (), {"limit": 15, "used": -1})()) is None


def test_headers_are_plain_integers() -> None:
    report = report_from_status(status(used=2, limit=50, is_member=True))
    headers = quota_headers(report)
    assert set(headers) == set(EXPOSED_HEADERS)
    assert headers[LIMIT_HEADER] == "50"
    assert headers[REMAINING_HEADER] == "48"
    assert headers[RESET_HEADER].isdigit()


def test_the_browser_may_read_the_headers() -> None:
    from app.main import app

    cors = next(m for m in app.user_middleware if m.cls.__name__ == "CORSMiddleware")
    exposed = {h.casefold() for h in cors.kwargs["expose_headers"]}
    assert {h.casefold() for h in EXPOSED_HEADERS} <= exposed
    assert "x-error-code" in exposed


# --------------------------------------------------------------------------- /ai/explain


class FakeRequest:
    client = type("Client", (), {"host": "203.0.113.20"})()
    headers = type("Headers", (), {"get": lambda _self, _key, _default=None: None})()


def patch_route(
    monkeypatch: pytest.MonkeyPatch,
    current: object,
    *,
    cached: list[str] | None = None,
    structured: str | None = None,
) -> list[str]:
    calls: list[str] = []

    class FakeCatalog:
        async def get_song(self, number: int) -> Song | None:
            return SONG

        async def related_songs(self, _song: Song) -> list[Song]:
            return []

    async def cache_get(_key: str) -> list[str] | None:
        return cached

    async def cache_set(_key: str, _value: list[str]) -> None:
        return None

    async def check(**_kwargs: object) -> object:
        calls.append("check")
        return current

    async def record(**_kwargs: object) -> None:
        calls.append("record")

    class FakeRag:
        def __init__(self, *_a: object, **_k: object) -> None:
            pass

        async def build_grounded_answer(self, *_a: object, **_k: object) -> tuple[str, list]:
            calls.append("llm")
            return ("A grounded answer about the song.", [])

    monkeypatch.setattr(ai_module, "CatalogService", lambda _session: FakeCatalog())
    monkeypatch.setattr(ai_module, "try_member_identity", lambda _request: None)
    monkeypatch.setattr(ai_module, "require_public_quota", lambda *_a, **_k: None)
    monkeypatch.setattr(ai_module.explanation_cache, "get", cache_get)
    monkeypatch.setattr(ai_module.explanation_cache, "set", cache_set)
    monkeypatch.setattr(ai_module, "check_daily_ai_quota_persisted", check)
    monkeypatch.setattr(ai_module, "record_daily_ai_question_persisted", record)
    monkeypatch.setattr(ai_module, "select_provider", lambda _settings: object())
    monkeypatch.setattr(ai_module, "RAGService", FakeRag)
    monkeypatch.setattr(ai_module, "try_conversation_answer", lambda *_a, **_k: None)
    monkeypatch.setattr(ai_module, "try_language_switch_acknowledgment", lambda *_a, **_k: None)
    monkeypatch.setattr(ai_module, "try_direct_answer", lambda *_a, **_k: None)
    monkeypatch.setattr(
        ai_module, "try_structured_answer", lambda *_a, **_k: structured
    )
    return calls


def ask(prompt: str):
    return asyncio.run(
        ai_module.explain(
            ExplanationRequest(song_number=16, prompt=prompt),
            FakeRequest(),  # type: ignore[arg-type]
            session=None,  # type: ignore[arg-type]
        )
    )


DEEP = "explain the deeper meaning of this song"


def test_charged_answer_reports_one_less(monkeypatch: pytest.MonkeyPatch) -> None:
    calls = patch_route(monkeypatch, status(used=4))
    response = ask(DEEP)
    assert "llm" in calls and "record" in calls
    assert response.headers[LIMIT_HEADER.lower()] == "15"
    assert response.headers[REMAINING_HEADER.lower()] == "10"  # 15 - 4 - this one
    assert int(response.headers[RESET_HEADER.lower()]) >= 1
    assert "x-error-code" not in response.headers


def test_a_free_answer_reports_the_allowance_unchanged(monkeypatch: pytest.MonkeyPatch) -> None:
    calls = patch_route(monkeypatch, status(used=4), structured="A short structured reply.")
    response = ask("who wrote this song")
    assert "record" not in calls and "llm" not in calls
    assert response.headers[REMAINING_HEADER.lower()] == "11"


def test_a_cached_answer_reports_the_allowance_unchanged(monkeypatch: pytest.MonkeyPatch) -> None:
    calls = patch_route(monkeypatch, status(used=7), cached=["Cached reply."])
    response = ask(DEEP)
    assert "record" not in calls
    assert response.headers[REMAINING_HEADER.lower()] == "8"


def test_the_limit_notice_keeps_its_code_and_reports_zero(monkeypatch: pytest.MonkeyPatch) -> None:
    calls = patch_route(monkeypatch, status(used=15))
    response = ask(DEEP)
    assert "record" not in calls and "llm" not in calls
    assert response.headers["x-error-code"] == "quota_exceeded"
    assert response.headers[REMAINING_HEADER.lower()] == "0"
    assert response.headers[LIMIT_HEADER.lower()] == "15"


def test_members_report_their_own_limit(monkeypatch: pytest.MonkeyPatch) -> None:
    patch_route(monkeypatch, status(used=10, limit=50, is_member=True))
    response = ask(DEEP)
    assert response.headers[LIMIT_HEADER.lower()] == "50"
    assert response.headers[REMAINING_HEADER.lower()] == "39"


def test_nothing_is_reported_when_the_count_is_unknown(monkeypatch: pytest.MonkeyPatch) -> None:
    patch_route(monkeypatch, type("Q", (), {"allowed": True, "guidance": ""})())
    response = ask(DEEP)
    assert LIMIT_HEADER.lower() not in response.headers
    assert REMAINING_HEADER.lower() not in response.headers
    assert RESET_HEADER.lower() not in response.headers


def test_a_refused_question_asks_nothing_of_the_counter(monkeypatch: pytest.MonkeyPatch) -> None:
    calls = patch_route(monkeypatch, status(used=1))
    response = ask("djcvjcvhjcvhjc")
    assert response.headers["x-error-code"] == "question_not_allowed"
    assert "check" not in calls


# --------------------------------------------------------------------------- GET /ai/quota


async def get_quota(monkeypatch: pytest.MonkeyPatch) -> httpx.Response:
    app = FastAPI()
    app.include_router(ai_module.router, prefix="/api/v1")

    async def no_session() -> None:
        return None

    app.dependency_overrides[get_session] = no_session
    monkeypatch.setattr(ai_module, "require_public_quota", lambda *_a, **_k: None)
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://t") as c:
        return await c.get("/api/v1/ai/quota")


async def test_quota_endpoint_counts_the_questions_asked(monkeypatch: pytest.MonkeyPatch) -> None:
    reset_daily_ai_quota_for_tests()
    # the guest is the test client's address; read the identity the route will use
    monkeypatch.setattr(ai_module, "client_ip", lambda _request: "198.51.100.7")
    for _ in range(3):
        record_daily_ai_question(is_member=False, identity="198.51.100.7")
    response = await get_quota(monkeypatch)
    assert response.status_code == 200
    body = response.json()
    assert body["scope"] == "guest"
    assert body["limit"] == 15
    assert body["used"] == 3
    assert body["remaining"] == 12
    assert body["resets_in_seconds"] >= 1
    assert response.headers[REMAINING_HEADER.lower()] == "12"
    reset_daily_ai_quota_for_tests()


async def test_quota_endpoint_is_503_when_the_count_is_unknown(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def unknown(**_kwargs: object) -> object:
        return type("Q", (), {"allowed": True})()

    monkeypatch.setattr(ai_module, "check_daily_ai_quota_persisted", unknown)
    response = await get_quota(monkeypatch)
    assert response.status_code == 503
    assert REMAINING_HEADER.lower() not in response.headers
