"""Shared fixture for the member session tests: an in-memory SQLite database and a small app.

The app has the real token routes (`/members/session/*`), the real local login, and three probe
routes that go through the same functions the real routers use:
`sync_member(require_member_identity(request))`, `require_admin_member` and `is_team_member`.
"""

# ruff: noqa: B008

from __future__ import annotations

import base64
import json
import os
from collections.abc import AsyncIterator
from datetime import UTC, datetime
from typing import Any, cast
from uuid import UUID, uuid4

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://test:test@localhost/test")
os.environ.setdefault("APP_ENV", "test")

import httpx
import pytest
import pytest_asyncio
from fastapi import APIRouter, Depends, FastAPI, Request
from sqlalchemy import Table, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.api.v1.auth import router as auth_router
from app.api.v1.member_sessions import router as sessions_router
from app.api.v1.members import router as members_router
from app.config import Settings
from app.core.db import get_session
from app.models import Base, UserAccount, UserCredential, UserFavorite
from app.models.member_session import MemberSession
from app.models.rate_limit import RateLimitCounter
from app.services import (
    admin_members,
    local_auth,
    member_tokens,
    members,
    provider_tokens,
    rate_limit,
    recordings,
)
from app.services.admin_members import require_admin_member
from app.services.members import require_member_identity, sync_member
from app.services.recordings import is_team_member

SECRET = "unit-test-session-secret-0123456789abcdef"
PROXY_KEY = "shared-key-that-ships-in-every-app"
WEB_KEY = "web-only-key-never-in-an-app"
OWNER_EMAIL = "owner@example.org"
GOOGLE_CLIENT = "google-client-123.apps.example"

ADMIN_ID = UUID("00000000-0000-0000-0000-0000000000ad")
PLAIN_ID = UUID("00000000-0000-0000-0000-0000000000b1")
OTHER_ID = UUID("00000000-0000-0000-0000-0000000000b2")

TABLES = (UserAccount, UserCredential, UserFavorite, MemberSession, RateLimitCounter)


def make_settings(**overrides: Any) -> Settings:
    values: dict[str, Any] = {
        "_env_file": None,
        "NEXT_PUBLIC_API_BASE_URL": "http://t",
        "MEMBER_SESSION_SECRET": SECRET,
        "MEMBER_PROXY_KEY": PROXY_KEY,
        "WEB_PROXY_KEY": WEB_KEY,
        "DEFAULT_ADMIN_EMAILS": OWNER_EMAIL,
        "GOOGLE_OAUTH_CLIENT_IDS": GOOGLE_CLIENT,
        "RATE_LIMIT_ENABLED": "false",
    }
    values.update(overrides)
    return Settings.model_validate(values)


def principal(subject: str, *, email: str | None = None, name: str = "Someone") -> str:
    claims = [{"typ": "oid", "val": subject}, {"typ": "name", "val": name}]
    if email:
        claims.append({"typ": "email", "val": email})
    return base64.b64encode(json.dumps({"auth_typ": "google", "claims": claims}).encode()).decode()


def legacy_headers(subject: str, *, email: str | None = None) -> dict[str, str]:
    return {
        "X-Member-Proxy-Key": PROXY_KEY,
        "X-MS-CLIENT-PRINCIPAL": principal(subject, email=email),
    }


def web_headers(subject: str, *, email: str | None = None) -> dict[str, str]:
    return {"X-Web-Proxy-Key": WEB_KEY, "X-MS-CLIENT-PRINCIPAL": principal(subject, email=email)}


class World:
    def __init__(self, client: httpx.AsyncClient, sessions: async_sessionmaker[AsyncSession]):
        self.client = client
        self.sessions = sessions

    async def account(self, account_id: UUID) -> UserAccount:
        async with self.sessions() as session:
            row = await session.get(UserAccount, account_id)
            assert row is not None
            return row

    async def set_account(self, account_id: UUID, **values: Any) -> None:
        async with self.sessions() as session:
            row = await session.get(UserAccount, account_id)
            assert row is not None
            for key, value in values.items():
                setattr(row, key, value)
            await session.commit()

    async def all_accounts(self) -> list[UserAccount]:
        async with self.sessions() as session:
            return list((await session.scalars(select(UserAccount))).all())

    async def tokens_for(self, account_id: UUID) -> member_tokens.TokenPair:
        async with self.sessions() as session:
            row = await session.get(UserAccount, account_id)
            assert row is not None
            return await member_tokens.start_session(
                session, row, device_label="test phone", settings=make_settings()
            )

    def bearer(self, pair: member_tokens.TokenPair) -> dict[str, str]:
        return {"Authorization": f"Bearer {pair.access_token}"}


def _probe_router() -> APIRouter:
    router = APIRouter(prefix="/t")

    async def get_db(session: AsyncSession = Depends(get_session)) -> AsyncSession:
        return session

    @router.get("/me")
    async def me(request: Request, session: AsyncSession = Depends(get_db)) -> dict[str, Any]:
        member = await sync_member(session, require_member_identity(request))
        return {"id": str(member.id), "is_admin": member.is_admin}

    @router.get("/admin")
    async def admin(request: Request, session: AsyncSession = Depends(get_db)) -> dict[str, str]:
        member = await sync_member(session, require_member_identity(request))
        await require_admin_member(session, member)
        return {"id": str(member.id)}

    @router.get("/team")
    async def team(request: Request, session: AsyncSession = Depends(get_db)) -> dict[str, bool]:
        member = await sync_member(session, require_member_identity(request))
        return {"team": is_team_member(member, members.get_settings())}

    return router


def build_app(sessions: async_sessionmaker[AsyncSession]) -> FastAPI:
    app = FastAPI()
    for router in (auth_router, sessions_router, members_router, _probe_router()):
        app.include_router(
            router, prefix="/api/v1" if router is not None and router.prefix != "/t" else ""
        )

    async def override_session() -> AsyncIterator[AsyncSession]:
        async with sessions() as session:
            yield session

    app.dependency_overrides[get_session] = override_session
    return app


def use_settings(monkeypatch: pytest.MonkeyPatch, settings: Settings) -> None:
    for module in (members, member_tokens, provider_tokens, admin_members, rate_limit, recordings):
        monkeypatch.setattr(module, "get_settings", lambda: settings, raising=False)
    monkeypatch.setattr(
        local_auth, "owner_admin_emails", lambda: admin_members.owner_admin_emails(settings)
    )


@pytest_asyncio.fixture(name="world")
async def world_fixture(monkeypatch: pytest.MonkeyPatch) -> AsyncIterator[World]:
    use_settings(monkeypatch, make_settings())
    engine = create_async_engine(
        "sqlite+aiosqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False}
    )
    tables = [cast(Table, m.__table__) for m in TABLES]
    async with engine.begin() as conn:
        await conn.run_sync(lambda c: Base.metadata.create_all(c, tables=tables))
    sessions = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with sessions() as session:
        for account_id, name, admin in (
            (ADMIN_ID, "Admin", True),
            (PLAIN_ID, "Plain", False),
            (OTHER_ID, "Other", False),
        ):
            session.add(
                UserAccount(
                    id=account_id,
                    external_subject=f"google:{name.lower()}-sub",
                    identity_provider="google",
                    display_name=name,
                    email=f"{name.lower()}@example.net",
                    is_admin=admin,
                    last_seen_at=datetime.now(UTC),
                )
            )
            await session.commit()
    rate_limit.limiter.configure(None)
    rate_limit.limiter.fallback.reset()
    app = build_app(sessions)
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://t"
    ) as client:
        yield World(client, sessions)
    await engine.dispose()


def new_id() -> UUID:
    return uuid4()
