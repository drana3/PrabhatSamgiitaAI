"""Crash-report hygiene (docs/observability.md): nothing personal leaves the server, and Sentry
stays off without a DSN."""

from __future__ import annotations

import logging
import os

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://test:test@localhost/test")

from app import observability as obs
from app.config import Settings

JWT = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dBjftJeZ4CVPmB92K27uhbUJU1p1r_wW1gFWFOEjXk"


def _settings(**extra: object) -> Settings:
    return Settings(_env_file=None, **extra)  # type: ignore[call-arg]


def test_scrub_text_masks_email_tokens_and_signatures() -> None:
    cleaned = obs.scrub_text(
        f"user dada@example.com sent Bearer abcdef123456789 and {JWT} to "
        "https://r2.example/b/k.mp3?X-Amz-Signature=deadbeef&X-Amz-Credential=AKIA%2F2026"
    )
    assert "dada@example.com" not in cleaned and "[email]" in cleaned
    assert "abcdef123456789" not in cleaned and JWT not in cleaned
    assert "deadbeef" not in cleaned and "AKIA" not in cleaned
    assert obs.scrub_text("PS 123 sings in Bengali") == "PS 123 sings in Bengali"


def test_scrub_text_masks_upload_tokens_and_long_hashes() -> None:
    token = "a" * 30 + "." + "b" * 30
    assert token not in obs.scrub_text(f"PUT /api/v1/recordings/uploads/{token}")
    assert "c" * 64 not in obs.scrub_text("key " + "c" * 64)


def test_scrub_event_removes_body_cookies_query_headers_ip_and_email() -> None:
    event = {
        "message": "failed for kurtaew@gmail.com",
        "request": {
            "url": "https://api.example/api/v1/ai/explain?q=my%20private%20question&token=zzz",
            "query_string": "q=my private question",
            "data": {"question": "what is my karma", "password": "hunter2"},
            "cookies": {"session": "abc"},
            "env": {"REMOTE_ADDR": "203.0.113.9"},
            "headers": {
                "Authorization": "Bearer secretsecretsecret",
                "X-Admin-Key": "adminkey",
                "User-Agent": "okhttp/4",
            },
        },
        "user": {"id": "member-1", "email": "kurtaew@gmail.com", "ip_address": "203.0.113.9"},
        "exception": {
            "values": [
                {
                    "value": "cannot mail dada@example.com",
                    "stacktrace": {"frames": [{"function": "f", "vars": {"password": "x"}}]},
                }
            ]
        },
        "breadcrumbs": {"values": [{"message": "GET /x?email=a@b.co", "data": {"to": "a@b.co"}}]},
    }
    out = obs.scrub_event(event)
    flat = repr(out)
    for secret in (
        "kurtaew@gmail.com",
        "my%20private",
        "my private question",
        "hunter2",
        "203.0.113.9",
        "secretsecretsecret",
        "adminkey",
        "dada@example.com",
        "a@b.co",
        "what is my karma",
        "'vars'",
    ):
        assert secret not in flat, secret
    assert out["request"]["headers"]["User-Agent"] == "okhttp/4"
    assert out["user"] == {"id": "member-1"}
    assert out["request"]["url"] == "https://api.example/api/v1/ai/explain"


def test_scrub_event_survives_odd_shapes() -> None:
    assert obs.scrub_event({}) == {}
    assert obs.scrub_event({"request": None, "user": None, "breadcrumbs": None}) is not None
    assert obs.scrub_event({"user": {"email": "x@y.zz"}})["user"] == {}


def test_sentry_is_off_without_a_dsn_and_never_raises() -> None:
    assert obs.sentry_options(_settings()) is None
    assert obs.init_sentry(_settings()) is False
    assert obs.init_sentry(_settings(SENTRY_DSN="   ")) is False


def test_sentry_options_are_private_by_default() -> None:
    options = obs.sentry_options(
        _settings(SENTRY_DSN="https://key@o1.ingest.sentry.io/1", APP_ENV="production")
    )
    assert options is not None
    assert options["send_default_pii"] is False
    assert options["include_local_variables"] is False
    assert options["environment"] == "production"
    assert options["release"].startswith("prabhat-samgiita-api@")
    assert options["traces_sample_rate"] == 0.0
    assert options["before_send"] is obs.scrub_event


def test_a_bad_dsn_does_not_stop_the_api() -> None:
    assert obs.init_sentry(_settings(SENTRY_DSN="not-a-dsn")) is False


def test_log_filter_redacts_and_quiets_libraries(caplog) -> None:
    record = logging.LogRecord(
        "x", logging.INFO, __file__, 1, "mail %s %s", ("a@b.co", "Bearer abcdefgh12345"), None
    )
    assert obs.RedactingFilter().filter(record)
    assert "a@b.co" not in record.getMessage() and "abcdefgh12345" not in record.getMessage()
    obs.harden_logging()
    assert logging.getLogger("httpx").level == logging.WARNING


async def test_deep_health_is_200_when_the_database_answers_and_503_when_not() -> None:
    import httpx
    from fastapi import FastAPI
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

    from app.api.v1.health import router
    from app.core.db import get_session

    app = FastAPI()
    app.include_router(router, prefix="/api/v1")
    good = create_async_engine("sqlite+aiosqlite://")
    sessions = async_sessionmaker(good, expire_on_commit=False)

    async def ok_session():
        async with sessions() as s:
            yield s

    class Broken:
        async def execute(self, *_a, **_k):
            raise RuntimeError("db down")

    async def bad_session():
        yield Broken()

    app.dependency_overrides[get_session] = ok_session
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://t") as client:
        up = await client.get("/api/v1/health/deep")
        assert up.status_code == 200 and up.json()["checks"]["database"] == "ok"
        assert set(up.json()) == {"status", "version", "environment", "checks", "tools"}
        assert all(isinstance(v, bool) for v in up.json()["tools"].values())
        app.dependency_overrides[get_session] = bad_session
        down = await client.get("/api/v1/health/deep")
        assert down.status_code == 503 and down.json()["status"] == "down"
        assert "db down" not in down.text
        assert (await client.get("/api/v1/health")).json() == {"status": "ok"}
    await good.dispose()
