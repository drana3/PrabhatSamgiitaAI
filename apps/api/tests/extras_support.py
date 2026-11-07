"""Shared fixture of the recording extras tests (comments, chord sheets, video links).

An in-memory SQLite database and one FastAPI app with the three routers, three members (two plain
ones and a team member) and two recordings. What PostgreSQL does is NOT covered here.
"""

from __future__ import annotations

import os
from collections.abc import AsyncIterator
from datetime import UTC, datetime
from typing import Any, cast
from uuid import UUID, uuid4

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://test:test@localhost/test")

import httpx
import pytest_asyncio
from fastapi import FastAPI, HTTPException, Request
from sqlalchemy import Select, Table, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.api.v1 import extras_common
from app.api.v1.recording_chords import router as chords_router
from app.api.v1.recording_comments import router as comments_router
from app.api.v1.video_links import router as videos_router
from app.config import Settings, get_settings
from app.core.db import get_session
from app.models import Base, UserAccount
from app.models.recording_collections import RecordingCollection
from app.models.recording_extras import (
    RecordingChordReport,
    RecordingChordSheet,
    RecordingComment,
    RecordingCommentReport,
    VideoLink,
    VideoLinkReport,
)
from app.models.recordings import MemberNotice, Recording
from app.models.song_chords import SongChordOffer, SongChordProposal, SongChordReport
from app.models.song_comments import SongComment, SongCommentReport
from app.services import recording_chords, recording_comments, video_links

MEMBER_A = UUID("00000000-0000-0000-0000-0000000000a1")
MEMBER_B = UUID("00000000-0000-0000-0000-0000000000b2")
TEAM = UUID("00000000-0000-0000-0000-0000000000c3")
NAMES = {MEMBER_A: "Ananda", MEMBER_B: "Bhakti", TEAM: "Carya"}
AVATAR = "https://img.example/ananda-secret-avatar.png"
# Ids carry a letter on purpose: an all-digit hex id is read back as a number by SQLite.
REC = UUID("1111111a-1111-1111-1111-11111111111b")
REC_REMOVED = UUID("2222222a-2222-2222-2222-22222222222b")

TABLES = (
    UserAccount,
    RecordingCollection,
    Recording,
    RecordingComment,
    RecordingCommentReport,
    RecordingChordSheet,
    RecordingChordReport,
    VideoLink,
    VideoLinkReport,
    SongComment,
    SongCommentReport,
    SongChordProposal,
    SongChordOffer,
    SongChordReport,
    MemberNotice,
)


def recording(recording_id: UUID, title: str, status: str = "published") -> Recording:
    return Recording(
        id=recording_id,
        kind="kiirtan",
        type="bnk",
        title=title,
        author="Test choir",
        added_by="Test",
        status=status,
        audio_key=f"k/{recording_id}",
        audio_url=f"https://audio.example/{recording_id}.mp3",
        audio_sha256=recording_id.hex * 2,
    )


class World:
    def __init__(self, client: httpx.AsyncClient, sessions: async_sessionmaker[AsyncSession]):
        self.client = client
        self.sessions = sessions

    def headers(self, who: str | None) -> dict[str, str]:
        return {"X-Test-Member": who} if who else {}

    async def call(
        self, method: str, path: str, who: str | None = None, **kwargs: Any
    ) -> httpx.Response:
        return await self.client.request(method, path, headers=self.headers(who), **kwargs)

    async def rows(self, model: type[Any]) -> list[Any]:
        async with self.sessions() as session:
            return list((await session.scalars(select(model))).all())

    async def scalar(self, statement: Select[Any]) -> Any:
        async with self.sessions() as session:
            return await session.scalar(statement)

    async def update(self, model: type[Any], row_id: UUID, **values: Any) -> None:
        async with self.sessions() as session:
            row = await session.get(model, row_id)
            assert row is not None
            for key, value in values.items():
                setattr(row, key, value)
            await session.commit()


def build_app(sessions: async_sessionmaker[AsyncSession], members: dict[str, UUID]) -> FastAPI:
    settings = Settings.model_validate({"_env_file": None, "NEXT_PUBLIC_API_BASE_URL": "http://t"})
    app = FastAPI()
    for router in (comments_router, chords_router, videos_router):
        app.include_router(router, prefix="/api/v1")

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
                    avatar_url=AVATAR if member_id == MEMBER_A else None,
                    is_admin=member_id == TEAM,
                    last_seen_at=datetime.now(UTC),
                )
            )
        await session.commit()
        # one at a time: SQLAlchemy's batched insert of rows with client-set UUIDs trips on SQLite
        for row in (recording(REC, "Baba Nam Kevalam"), recording(REC_REMOVED, "Gone", "removed")):
            session.add(row)
            await session.commit()

    app = build_app(sessions, {"a": MEMBER_A, "b": MEMBER_B, "team": TEAM})
    for limiter in (
        recording_comments.limiter,
        recording_chords.limiter,
        video_links.limiter,
    ):
        limiter.reset()
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://t"
    ) as client:
        yield World(client, sessions)
    await engine.dispose()


def new_id() -> UUID:
    return uuid4()
