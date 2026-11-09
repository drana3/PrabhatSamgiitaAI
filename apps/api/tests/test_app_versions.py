"""Forced and recommended app updates (docs/forced-update.md)."""

import os
from collections.abc import AsyncIterator
from datetime import UTC, datetime
from typing import Any, cast
from uuid import uuid4

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://test:test@localhost/test")
os.environ.setdefault("APP_ENV", "test")

import httpx
import pytest
import pytest_asyncio
from fastapi import FastAPI
from sqlalchemy import Table
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.api.v1 import app_versions as api
from app.core.db import get_session
from app.models import Base, UserAccount
from app.models.app_version import AppVersionPolicy
from app.services import app_versions as service


def policy(minimum: str | None, recommended: str | None = None) -> AppVersionPolicy:
    return AppVersionPolicy(
        platform="ios", minimum_version=minimum, recommended_version=recommended, store_url=None
    )


@pytest.mark.parametrize(
    ("version", "expected"),
    [
        ("1.9.9", "required"),
        ("2.0.0", "recommended"),
        ("2.0", "recommended"),
        ("2.1.9", "recommended"),
        ("2.2.0", "ok"),
        ("3.0.0", "ok"),
        ("2.2.0-beta.1", "ok"),
    ],
)
def test_status_by_version(version: str, expected: str) -> None:
    assert service.evaluate("ios", version, policy("2.0.0", "2.2.0")).status == expected


def test_exact_minimum_is_allowed_and_one_below_is_not() -> None:
    assert service.evaluate("ios", "2.0.0", policy("2.0.0")).status == "ok"
    assert service.evaluate("ios", "1.99.99", policy("2.0.0")).status == "required"
    assert service.evaluate("ios", "2.0", policy("2.0.0")).status == "ok"  # missing parts are zero


def test_recommended_is_a_soft_warning_above_the_minimum() -> None:
    result = service.evaluate("ios", "2.1.0", policy("2.0.0", "2.3.0"))
    assert result.status == "recommended"
    assert service.evaluate("ios", "2.3.0", policy("2.0.0", "2.3.0")).status == "ok"


@pytest.mark.parametrize("version", [None, "", "abc", "unknown"])
def test_an_unreadable_version_is_never_blocked(version: str | None) -> None:
    assert service.evaluate("ios", version, policy("9.0.0")).status == "ok"


@pytest.mark.parametrize("platform", [None, "", "web", "windows", "IOS "])
def test_other_platforms_and_no_policy_are_ok(platform: str | None) -> None:
    result = service.evaluate(platform, "0.0.1", None)
    assert result.status == "ok"
    if (platform or "").strip().lower() != "ios":
        assert service.evaluate(platform, "0.0.1", policy("9.0.0")).status == "ok"


def test_platform_is_case_insensitive() -> None:
    assert service.evaluate(" IOS", "1.0.0", policy("2.0.0")).status == "required"


def test_validation_of_what_the_team_types() -> None:
    assert service.clean_version(" 2.1.0 ", "x") == "2.1.0"
    assert service.clean_version("", "x") is None
    for bad in ("two", "2.x", "2.1.0.0.0", "-1", "2..1", "2.1; drop"):
        with pytest.raises(service.PolicyError):
            service.clean_version(bad, "x")
    assert service.clean_store_url("https://apps.apple.com/app/id123") is not None
    for bad in (
        "http://apps.apple.com/app/id1",
        "https://evil.example/apps.apple.com",
        "https://apps.apple.com.evil.example/x",
        "https://user@apps.apple.com/x",
        "javascript:alert(1)",
    ):
        with pytest.raises(service.PolicyError):
            service.clean_store_url(bad)
    with pytest.raises(service.PolicyError):
        service.check_pair("2.5.0", "2.0.0")


@pytest_asyncio.fixture(name="client")
async def client_fixture() -> AsyncIterator[tuple[httpx.AsyncClient, dict[str, bool]]]:
    engine = create_async_engine(
        "sqlite+aiosqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False}
    )
    async with engine.begin() as conn:
        tables = [cast(Table, m.__table__) for m in (AppVersionPolicy, UserAccount)]
        await conn.run_sync(lambda c: Base.metadata.create_all(c, tables=tables))
    sessions = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    app = FastAPI()
    app.include_router(api.router, prefix="/api/v1")

    async def get_db() -> AsyncIterator[AsyncSession]:
        async with sessions() as session:
            yield session

    is_admin = {"value": True}
    admin = UserAccount(
        id=uuid4(),
        external_subject="google:a",
        identity_provider="google",
        display_name="Admin",
        email="admin@example.net",
        is_admin=True,
        last_seen_at=datetime.now(UTC),
    )

    async def get_admin() -> UserAccount:
        if not is_admin["value"]:
            from fastapi import HTTPException

            raise HTTPException(status_code=403, detail="Admin access is required")
        return admin

    app.dependency_overrides[get_session] = get_db
    app.dependency_overrides[api.get_admin] = get_admin
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://t") as http:
        yield http, cast(dict[str, bool], is_admin)
    await engine.dispose()


async def put(http: httpx.AsyncClient, platform: str, **body: Any) -> httpx.Response:
    return await http.put(f"/api/v1/admin/app-versions/{platform}", json=body)


async def status(http: httpx.AsyncClient, platform: str, version: str) -> dict[str, Any]:
    response = await http.get(
        "/api/v1/app/version-status", params={"platform": platform, "version": version}
    )
    assert response.status_code == 200
    return cast(dict[str, Any], response.json())


async def test_no_policy_means_everything_is_fine(client: Any) -> None:
    http, _ = client
    assert (await status(http, "ios", "0.0.1"))["status"] == "ok"


async def test_team_sets_a_minimum_and_old_apps_are_blocked(client: Any) -> None:
    http, _ = client
    response = await put(
        http,
        "ios",
        minimum_version="2.0.0",
        recommended_version="2.1.0",
        store_url="https://apps.apple.com/app/id123",
    )
    assert response.status_code == 200
    assert (await status(http, "ios", "1.5.0"))["status"] == "required"
    assert (await status(http, "ios", "2.0.5"))["status"] == "recommended"
    answer = await status(http, "ios", "2.1.0")
    assert answer["status"] == "ok"
    assert answer["store_url"] == "https://apps.apple.com/app/id123"
    # the other platform has no policy
    assert (await status(http, "android", "1.0.0"))["status"] == "ok"


async def test_policy_can_be_lifted_again(client: Any) -> None:
    http, _ = client
    await put(http, "android", minimum_version="3.0.0")
    assert (await status(http, "android", "2.0.0"))["status"] == "required"
    await put(http, "android")
    assert (await status(http, "android", "2.0.0"))["status"] == "ok"


async def test_only_an_admin_can_change_the_limits(client: Any) -> None:
    http, is_admin = client
    is_admin["value"] = False
    assert (await put(http, "ios", minimum_version="9.0.0")).status_code == 403
    assert (await http.get("/api/v1/admin/app-versions")).status_code == 403
    is_admin["value"] = True
    assert (await status(http, "ios", "1.0.0"))["status"] == "ok"


async def test_bad_input_is_refused_and_changes_nothing(client: Any) -> None:
    http, _ = client
    assert (await put(http, "ios", minimum_version="soon")).status_code == 422
    assert (await put(http, "ios", store_url="https://evil.example/x")).status_code == 422
    assert (
        await put(http, "ios", minimum_version="2.5.0", recommended_version="2.0.0")
    ).status_code == 422
    assert (await put(http, "windows", minimum_version="1.0.0")).status_code == 404
    assert (await http.get("/api/v1/admin/app-versions")).json() == []


async def test_status_endpoint_is_open_and_tolerates_junk(client: Any) -> None:
    http, is_admin = client
    is_admin["value"] = False
    await_ok = await http.get("/api/v1/app/version-status")
    assert await_ok.status_code == 200
    assert await_ok.json()["status"] == "ok"
    junk = await http.get(
        "/api/v1/app/version-status", params={"platform": "ios", "version": "x" * 20}
    )
    assert junk.status_code == 200
    assert "max-age" in junk.headers["cache-control"]
