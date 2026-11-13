"""Fixture of the piano notes tests: the piano router only, three members, two recordings.

Same idea as `extras_support` (in-memory SQLite, members picked by the X-Test-Member header) but a
file of its own, so the piano tests need no change in the shared fixture. What PostgreSQL does is
NOT covered here.
"""

from __future__ import annotations

import os
from collections.abc import AsyncIterator
from datetime import UTC, datetime
from typing import cast
from uuid import UUID

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://test:test@localhost/test")

import httpx
import pytest_asyncio
from fastapi import FastAPI, HTTPException, Request
from sqlalchemy import Table
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.api.v1 import extras_common
from app.api.v1.piano_sheets import router as piano_router
from app.config import Settings, get_settings
from app.core.db import get_session
from app.models import Base, UserAccount
from app.models.piano_sheets import PianoSheet, PianoSheetReport
from app.models.recording_collections import RecordingCollection
from app.models.recordings import MemberNotice, Recording
from app.services import piano_sheets
from tests.extras_support import (
    MEMBER_A,
    MEMBER_B,
    NAMES,
    REC,
    REC_REMOVED,
    TEAM,
    World,
    recording,
)

TABLES = (
    UserAccount,
    RecordingCollection,
    Recording,
    PianoSheet,
    PianoSheetReport,
    MemberNotice,
)


def build_app(sessions: async_sessionmaker[AsyncSession], members: dict[str, UUID]) -> FastAPI:
    settings = Settings.model_validate({"_env_file": None, "NEXT_PUBLIC_API_BASE_URL": "http://t"})
    app = FastAPI()
    app.include_router(piano_router, prefix="/api/v1")

    async def override_session() -> AsyncIterator[AsyncSession]:
        async with sessions() as session:
            yield session

    async def lookup(request: Request) -> UserAccount | None:
        who = request.headers.get("X-Test-Member")
        if who not in members:
            return None
        async with sessions() as session:
            return await session.get(UserAccount, members[who])

    async def override_member(request: Request) -> UserAccount:
        member = await lookup(request)
        if member is None:
            raise HTTPException(status_code=401, detail="Sign in is required")
        return member

    app.dependency_overrides[get_session] = override_session
    app.dependency_overrides[extras_common.get_member] = override_member
    app.dependency_overrides[extras_common.get_optional_member] = lookup
    app.dependency_overrides[get_settings] = lambda: settings
    return app


@pytest_asyncio.fixture(name="world")
async def world_fixture() -> AsyncIterator[World]:
    engine = create_async_engine(
        "sqlite+aiosqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False}
    )
    tables = [cast(Table, m.__table__) for m in TABLES]
    async with engine.begin() as conn:
        await conn.run_sync(lambda c: Base.metadata.create_all(c, tables=tables))
    sessions = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with sessions() as session:
        for member_id, name in NAMES.items():
            session.add(
                UserAccount(
                    id=member_id,
                    external_subject=f"test:{name}",
                    identity_provider="test",
                    display_name=name,
                    email=f"{name.lower()}@example.org",
                    is_admin=member_id == TEAM,
                    last_seen_at=datetime.now(UTC),
                )
            )
        await session.commit()
        for row in (recording(REC, "Baba Nam Kevalam"), recording(REC_REMOVED, "Gone", "removed")):
            session.add(row)
            await session.commit()

    app = build_app(sessions, {"a": MEMBER_A, "b": MEMBER_B, "team": TEAM})
    piano_sheets.limiter.reset()
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://t"
    ) as client:
        yield World(client, sessions)
    await engine.dispose()
