"""Account deletion (DELETE /members/me): what goes, what stays.

Dada's decision, pinned here so nobody changes it by accident:

* A member's recordings STAY in the library with the name they were uploaded under
  (`recordings.author` and `recordings.added_by` are plain text); only the link to the account
  (`author_id`) is cut.
* Everything personal goes: the account row (e-mail, name, phone, avatar), the password hash,
  every signed-in device (session and refresh tokens), push tokens, favourites, the author page
  and the raw listening rows.
* Comments are different from recordings: the current rule is that they go with the account
  (`song_comments.member_id` and `recording_comments.member_id` are ON DELETE CASCADE, and a
  reply hangs under its parent with CASCADE as well). This test describes that rule as it is.
  Whether comments should stay under a name is a product question, see docs/account-deletion.md.

SQLite does not enforce foreign keys unless asked, so the engine here turns them on; without
that the cascade (which the production Postgres does) would not be exercised.
"""

from __future__ import annotations

import os

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://test:test@localhost/test")

from collections.abc import AsyncIterator
from datetime import UTC, datetime
from typing import Any, cast
from uuid import UUID, uuid4

import httpx
import pytest
import pytest_asyncio
from sqlalchemy import Table, event, func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.config import get_settings
from app.models import (
    Base,
    RecordingComment,
    SongComment,
    UserAccount,
    UserCredential,
    UserFavorite,
)
from app.models.author_profiles import (
    AuthorAlias,
    AuthorClaim,
    AuthorClaimEvent,
    AuthorProfile,
    AuthorProfilePhoto,
    AuthorRecordingLink,
    AuthorReport,
    AuthorSlugHistory,
    AuthorStatsSnapshot,
    AuthorSuspension,
    PlayDaily,
    PlayEvent,
)
from app.models.member_session import MemberSession
from app.models.play_flag import PlayFlag
from app.models.push import PushDevice
from app.models.recording_collections import RecordingCollection
from app.models.recordings import AuthorBlock, MemberNotice, Recording
from app.models.song_plays import SongPlayDaily, SongPlayEvent
from app.services import author_stats, member_tokens
from app.services.author_profiles import pepper
from tests.member_session_support import build_app, make_settings, use_settings

LEAVING = UUID("00000000-0000-0000-0000-00000000de01")
STAYING = UUID("00000000-0000-0000-0000-00000000de02")

TABLES = (
    UserAccount,
    UserCredential,
    UserFavorite,
    MemberSession,
    PushDevice,
    RecordingCollection,
    Recording,
    RecordingComment,
    SongComment,
    AuthorBlock,
    AuthorProfile,
    AuthorProfilePhoto,
    AuthorSlugHistory,
    AuthorRecordingLink,
    AuthorReport,
    PlayEvent,
    PlayDaily,
    PlayFlag,
    SongPlayEvent,
    SongPlayDaily,
    AuthorStatsSnapshot,
    AuthorSuspension,
    AuthorClaim,
    AuthorClaimEvent,
    AuthorAlias,
    MemberNotice,
)


class World:
    def __init__(self, client: httpx.AsyncClient, sessions: async_sessionmaker[AsyncSession]):
        self.client = client
        self.sessions = sessions

    async def count(self, model: Any, *where: Any) -> int:
        async with self.sessions() as session:
            return int(await session.scalar(select(func.count()).select_from(model).where(*where)))

    def bearer(self, pair: member_tokens.TokenPair) -> dict[str, str]:
        return {"Authorization": f"Bearer {pair.access_token}"}

    async def sign_in(self, account_id: UUID) -> member_tokens.TokenPair:
        async with self.sessions() as session:
            row = await session.get(UserAccount, account_id)
            assert row is not None
            return await member_tokens.start_session(
                session, row, device_label="phone", settings=make_settings()
            )


@pytest_asyncio.fixture(name="world")
async def world_fixture(monkeypatch: pytest.MonkeyPatch) -> AsyncIterator[World]:
    use_settings(monkeypatch, make_settings())
    engine = create_async_engine(
        "sqlite+aiosqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False}
    )

    @event.listens_for(engine.sync_engine, "connect")
    def _foreign_keys_on(dbapi_connection: Any, _record: Any) -> None:
        dbapi_connection.execute("PRAGMA foreign_keys=ON")

    tables = [cast(Table, m.__table__) for m in TABLES]
    async with engine.begin() as conn:
        await conn.run_sync(lambda c: Base.metadata.create_all(c, tables=tables))
    sessions = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with sessions() as session:
        for account_id, name in ((LEAVING, "Leaving"), (STAYING, "Staying")):
            session.add(
                UserAccount(
                    id=account_id,
                    external_subject=f"google:{name.lower()}-sub",
                    identity_provider="google",
                    display_name=name,
                    email=f"{name.lower()}@example.net",
                    phone_e164="+48600100200" if account_id == LEAVING else None,
                    avatar_url="https://img.example/leaving.jpg" if account_id == LEAVING else None,
                    last_seen_at=datetime.now(UTC),
                )
            )
        await session.commit()
    app = build_app(sessions)
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://t"
    ) as client:
        yield World(client, sessions)
    await engine.dispose()


async def make_recording(world: World, owner: UUID, *, author: str, added_by: str) -> UUID:
    rid = uuid4()
    async with world.sessions() as session:
        session.add(
            Recording(
                id=rid,
                kind="kiirtan",
                type="other",
                title="Baba Nam Kevalam",
                author=author,
                added_by=added_by,
                author_id=owner,
                status="published",
                duration_sec=300,
                audio_key=f"k/{rid}",
                audio_url=f"https://audio.example/{rid}.mp3",
                audio_sha256=uuid4().hex + uuid4().hex,
                published_at=datetime.now(UTC),
            )
        )
        await session.commit()
    return rid


async def fill_account(world: World, owner: UUID) -> UUID:
    """Give one account a bit of everything it can own. Returns the recording id."""
    rid = await make_recording(world, owner, author="Leaving Kiirtan Group", added_by="Leaving")
    today = datetime.now(UTC).date()
    key = author_stats.listener_key(pepper(get_settings()), f"m:{owner}", today)
    async with world.sessions() as session:
        session.add(UserCredential(user_id=owner, email="leaving@example.net", password_hash="x"))
        session.add(UserFavorite(user_id=owner, song_number=7))
        session.add(
            PushDevice(member_id=owner, token=f"ExpoPushToken[{uuid4().hex}]", platform="ios")
        )
        session.add(
            AuthorProfile(member_id=owner, slug="leaving-group", display_name="Leaving Group")
        )
        session.add(SongComment(song_id=7, member_id=owner, body="Lovely song"))
        session.add(RecordingComment(recording_id=rid, member_id=owner, body="Lovely recording"))
        session.add(
            PlayEvent(
                recording_id=rid,
                day=today,
                listener_key=key,
                country="PL",
                listened_sec=60,
                created_at=datetime.now(UTC),
            )
        )
        await session.commit()
    return rid


async def test_deleting_an_account_removes_the_person_and_keeps_the_recording(
    world: World,
) -> None:
    rid = await fill_account(world, LEAVING)
    pair = await world.sign_in(LEAVING)
    other = await world.sign_in(STAYING)
    assert await world.count(MemberSession, MemberSession.user_id == LEAVING) == 1

    reply = await world.client.delete("/api/v1/members/me", headers=world.bearer(pair))
    assert reply.status_code == 204

    # the recording stays, under the name it was uploaded with; only the account link is cut
    async with world.sessions() as session:
        recording = await session.get(Recording, rid)
    assert recording is not None
    assert recording.status == "published"
    assert recording.author == "Leaving Kiirtan Group"
    assert recording.added_by == "Leaving"
    assert recording.author_id is None

    # the personal data is gone: account (e-mail, phone, avatar), password, devices, push tokens,
    # favourites, the author page and the raw listening rows
    assert await world.count(UserAccount, UserAccount.id == LEAVING) == 0
    assert await world.count(UserCredential, UserCredential.user_id == LEAVING) == 0
    assert await world.count(MemberSession, MemberSession.user_id == LEAVING) == 0
    assert await world.count(PushDevice, PushDevice.member_id == LEAVING) == 0
    assert await world.count(UserFavorite, UserFavorite.user_id == LEAVING) == 0
    assert await world.count(AuthorProfile, AuthorProfile.member_id == LEAVING) == 0
    assert await world.count(PlayEvent) == 0

    # another member is untouched and still signed in
    assert await world.count(UserAccount, UserAccount.id == STAYING) == 1
    assert await world.count(MemberSession, MemberSession.user_id == STAYING) == 1
    still = await world.client.get("/t/me", headers=world.bearer(other))
    assert still.status_code == 200


async def test_the_token_of_a_deleted_account_stops_working_and_cannot_be_refreshed(
    world: World,
) -> None:
    await fill_account(world, LEAVING)
    pair = await world.sign_in(LEAVING)
    assert (
        await world.client.delete("/api/v1/members/me", headers=world.bearer(pair))
    ).status_code == 204

    # the access token is still a well-formed, unexpired JWT, but its session row is gone
    after = await world.client.get("/t/me", headers=world.bearer(pair))
    assert after.status_code == 401

    refreshed = await world.client.post(
        "/api/v1/members/session/refresh", json={"refresh_token": pair.refresh_token}
    )
    assert refreshed.status_code == 401


async def test_comments_go_with_the_account_today(world: World) -> None:
    """The current rule, written down: comments are deleted with the account (they are not kept
    under a name the way recordings are). A reply to someone else's comment goes too."""
    rid = await fill_account(world, LEAVING)
    async with world.sessions() as session:
        theirs = SongComment(song_id=9, member_id=STAYING, body="Their top-level comment")
        session.add(theirs)
        await session.flush()
        session.add(
            SongComment(
                song_id=9,
                member_id=LEAVING,
                body="My reply",
                parent_id=theirs.id,
                reply_to_id=theirs.id,
            )
        )
        session.add(RecordingComment(recording_id=rid, member_id=STAYING, body="Stays"))
        await session.commit()
    pair = await world.sign_in(LEAVING)

    assert (
        await world.client.delete("/api/v1/members/me", headers=world.bearer(pair))
    ).status_code == 204

    assert await world.count(SongComment, SongComment.member_id == LEAVING) == 0
    assert await world.count(RecordingComment, RecordingComment.member_id == LEAVING) == 0
    # other people's comments are not touched
    assert await world.count(SongComment, SongComment.member_id == STAYING) == 1
    assert await world.count(RecordingComment, RecordingComment.member_id == STAYING) == 1


async def test_signing_in_again_after_deletion_makes_a_new_empty_account(world: World) -> None:
    """The sign-in provider still knows the person, so a later sign-in starts from scratch; none
    of the old data comes back."""
    rid = await fill_account(world, LEAVING)
    pair = await world.sign_in(LEAVING)
    assert (
        await world.client.delete("/api/v1/members/me", headers=world.bearer(pair))
    ).status_code == 204

    async with world.sessions() as session:
        again = UserAccount(
            external_subject="google:leaving-sub",
            identity_provider="google",
            display_name="Leaving",
            last_seen_at=datetime.now(UTC),
        )
        session.add(again)
        await session.commit()
        assert again.id != LEAVING
        assert (
            await session.scalar(
                select(func.count())
                .select_from(UserFavorite)
                .where(UserFavorite.user_id == again.id)
            )
            == 0
        )
        recording = await session.get(Recording, rid)
    assert recording is not None and recording.author_id is None
