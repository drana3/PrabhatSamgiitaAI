"""Daily housekeeping (docs/housekeeping.md): what is deleted, what is never touched, batching,
failure isolation, the scheduler hook and the admin page. SQLite in memory like the neighbours."""

from __future__ import annotations

import asyncio
import os
from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any, cast
from uuid import UUID, uuid4

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://test:test@localhost/test")
os.environ.setdefault("APP_ENV", "test")

import httpx
import pytest
import pytest_asyncio
from fastapi import FastAPI, HTTPException
from sqlalchemy import Table, func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.api.v1 import server_tools as server_tools_api
from app.core.security import require_admin
from app.models import Base, UserAccount
from app.models.announcements import PasswordResetToken
from app.models.app_telemetry import AppEvent
from app.models.author_profiles import PlayEvent
from app.models.member import PhoneVerificationCode
from app.models.member_session import MemberSession
from app.models.rate_limit import RateLimitCounter
from app.models.recordings import MemberNotice, Recording
from app.models.song_plays import SongPlayDaily, SongPlayEvent
from app.services import housekeeping
from app.services.housekeeping import (
    HousekeepingConfig,
    clean_app_events,
    clean_member_sessions,
    clean_orphan_uploads,
    clean_phone_codes,
    clean_play_events,
    clean_rate_limit_counters,
    clean_read_notices,
    clean_reset_tokens,
    delete_in_batches,
    run_once,
)

NOW = datetime(2026, 11, 10, 12, 0, tzinfo=UTC)
CFG = HousekeepingConfig()
USER = UUID("00000000-0000-0000-0000-0000000000a1")

TABLES = (
    UserAccount,
    MemberSession,
    PhoneVerificationCode,
    PasswordResetToken,
    RateLimitCounter,
    PlayEvent,
    SongPlayEvent,
    SongPlayDaily,
    AppEvent,
    MemberNotice,
    Recording,
)


@pytest_asyncio.fixture(name="sessions")
async def sessions_fixture() -> AsyncIterator[async_sessionmaker[AsyncSession]]:
    engine = create_async_engine(
        "sqlite+aiosqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False}
    )
    tables = [cast(Table, m.__table__) for m in TABLES]
    async with engine.begin() as conn:
        await conn.run_sync(lambda c: Base.metadata.create_all(c, tables=tables))
    maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with maker() as session:
        session.add(
            UserAccount(
                id=USER,
                external_subject="google:hk",
                identity_provider="google",
                display_name="Keeper",
                last_seen_at=NOW,
            )
        )
        await session.commit()
    housekeeping.reset_housekeeping_state()
    yield maker
    await engine.dispose()


async def count(session: AsyncSession, model: Any) -> int:
    return int(await session.scalar(select(func.count()).select_from(model)) or 0)


def days(n: float) -> timedelta:
    return timedelta(days=n)


# --------------------------------------------------------------------------- sign-in material


async def test_sessions_are_kept_for_seven_days_after_expiry(
    sessions: async_sessionmaker[AsyncSession],
) -> None:
    async with sessions() as s:
        for name, expires, revoked in (
            ("live", NOW + days(5), None),
            ("expired-yesterday", NOW - days(1), None),
            ("expired-long-ago", NOW - days(8), None),
            ("revoked-long-ago", NOW + days(5), NOW - days(9)),
            ("revoked-today", NOW + days(5), NOW - days(1)),
        ):
            s.add(
                MemberSession(
                    user_id=USER,
                    refresh_hash=name,
                    expires_at=expires,
                    revoked_at=revoked,
                )
            )
        await s.commit()
        assert await clean_member_sessions(s, NOW, CFG) == 2
        left = set((await s.scalars(select(MemberSession.refresh_hash))).all())
    assert left == {"live", "expired-yesterday", "revoked-today"}


async def test_phone_codes_and_reset_tokens_wait_seven_days(
    sessions: async_sessionmaker[AsyncSession],
) -> None:
    async with sessions() as s:
        s.add_all(
            [
                PhoneVerificationCode(
                    user_id=USER, phone_e164="+1", code_hash="a", expires_at=NOW + days(1)
                ),
                PhoneVerificationCode(
                    user_id=USER, phone_e164="+2", code_hash="b", expires_at=NOW - days(2)
                ),
                PhoneVerificationCode(
                    user_id=USER, phone_e164="+3", code_hash="c", expires_at=NOW - days(30)
                ),
                PasswordResetToken(user_id=USER, token_hash="fresh", expires_at=NOW + days(1)),
                PasswordResetToken(
                    user_id=USER, token_hash="old-expired", expires_at=NOW - days(9)
                ),
                PasswordResetToken(
                    user_id=USER,
                    token_hash="old-used",
                    expires_at=NOW + days(1),
                    used_at=NOW - days(8),
                ),
                PasswordResetToken(
                    user_id=USER,
                    token_hash="just-used",
                    expires_at=NOW + days(1),
                    used_at=NOW - days(1),
                ),
            ]
        )
        await s.commit()
        assert await clean_phone_codes(s, NOW, CFG) == 1
        assert await clean_reset_tokens(s, NOW, CFG) == 2
        tokens = set((await s.scalars(select(PasswordResetToken.token_hash))).all())
        assert await count(s, PhoneVerificationCode) == 2
    assert tokens == {"fresh", "just-used"}


async def test_rate_limit_counters_go_after_their_own_expiry(
    sessions: async_sessionmaker[AsyncSession],
) -> None:
    now = int(NOW.timestamp())
    async with sessions() as s:
        s.add_all(
            [
                RateLimitCounter(key="a", window_start=1, hits=3, expires_at=now + 60),
                RateLimitCounter(key="a", window_start=2, hits=3, expires_at=now - 7200),
                RateLimitCounter(key="b", window_start=2, hits=3, expires_at=now - 7200),
                RateLimitCounter(key="b", window_start=3, hits=3, expires_at=now - 60),
            ]
        )
        await s.commit()
        # composite primary key: both (a, 2) and (b, 2) must go, and only those
        assert await clean_rate_limit_counters(s, NOW, CFG) == 2
        left = set(
            (await s.execute(select(RateLimitCounter.key, RateLimitCounter.window_start))).all()
        )
    assert left == {("a", 1), ("b", 3)}


# --------------------------------------------------------------------------- counted elsewhere


async def test_raw_play_rows_are_pruned_but_the_daily_counter_stays(
    sessions: async_sessionmaker[AsyncSession],
) -> None:
    old = (NOW - days(401)).date()
    recent = (NOW - days(399)).date()
    async with sessions() as s:
        for number, day in ((1, old), (2, recent)):
            s.add(
                SongPlayEvent(
                    song_number=number,
                    day=day,
                    listener_key="k",
                    created_at=NOW,
                    listened_sec=30,
                )
            )
            s.add(SongPlayDaily(song_number=number, day=day, plays=7))
        s.add(
            PlayEvent(
                recording_id=uuid4(),
                day=old,
                listener_key="k",
                created_at=NOW,
            )
        )
        await s.commit()
        assert await clean_play_events(s, NOW, CFG) == 2
        assert await count(s, SongPlayEvent) == 1
        assert await count(s, PlayEvent) == 0
        # the aggregate is what makes deletion safe: it is not touched
        assert await count(s, SongPlayDaily) == 2


async def test_old_usage_events_and_read_notices(
    sessions: async_sessionmaker[AsyncSession],
) -> None:
    async with sessions() as s:
        for index, day in enumerate(((NOW - days(200)).date(), (NOW - days(10)).date())):
            s.add(AppEvent(day=day, created_at=NOW, name=f"e{index}", props={}))
        for title, read in (
            ("unread-ancient", None),
            ("read-ancient", NOW - days(181)),
            ("read-recent", NOW - days(5)),
        ):
            s.add(
                MemberNotice(
                    user_id=USER,
                    kind="recording_removed",
                    title=title,
                    body="b",
                    payload={},
                    read_at=read,
                )
            )
        await s.commit()
        assert await clean_app_events(s, NOW, CFG) == 1
        assert await clean_read_notices(s, NOW, CFG) == 1
        titles = set((await s.scalars(select(MemberNotice.title))).all())
    assert titles == {"unread-ancient", "read-recent"}


# --------------------------------------------------------------------------- upload files


def _put(base: Path, member: UUID, name: str, age_hours: float) -> tuple[str, Path]:
    key = f"recordings/{member}/{name}.mp3"
    path = base / key
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(b"ID3audio")
    stamp = NOW.timestamp() - age_hours * 3600
    os.utime(path, (stamp, stamp))
    return key, path


async def test_orphan_uploads_older_than_48_hours_are_removed(
    sessions: async_sessionmaker[AsyncSession], tmp_path: Path
) -> None:
    fresh = _put(tmp_path, USER, str(uuid4()), 1)
    stale_orphan = _put(tmp_path, USER, str(uuid4()), 72)
    used_name = str(uuid4())
    stale_used = _put(tmp_path, USER, used_name, 500)
    stranger = tmp_path / "recordings" / "notes.txt"
    stranger.write_text("not an upload key")
    os.utime(stranger, (0, 0))

    async with sessions() as s:
        s.add(
            Recording(
                id=uuid4(),
                author_id=USER,
                title="Kept",
                added_by="Keeper",
                kind="kiirtan",
                audio_key=stale_used[0],
                audio_url="https://x/y.mp3",
                audio_sha256="0" * 64,
            )
        )
        await s.commit()
        removed = await clean_orphan_uploads(s, NOW, CFG, base_dir=tmp_path)
    assert removed == 1
    assert fresh[1].exists()
    assert stale_used[1].exists()
    assert not stale_orphan[1].exists()
    assert stranger.exists()


async def test_orphan_cleanup_does_nothing_for_a_bucket(
    sessions: async_sessionmaker[AsyncSession], monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(housekeeping, "_local_storage_dir", lambda: None)
    async with sessions() as s:
        assert await clean_orphan_uploads(s, NOW, CFG) == 0


# --------------------------------------------------------------------------- batches and failures


async def test_deletes_go_in_batches_of_at_most_the_batch_size(
    sessions: async_sessionmaker[AsyncSession],
) -> None:
    async with sessions() as s:
        s.add_all(
            [
                MemberSession(user_id=USER, refresh_hash=f"h{i}", expires_at=NOW - days(30))
                for i in range(25)
            ]
        )
        await s.commit()
        statements: list[int] = []
        original = s.execute

        async def spy(statement: Any, *a: Any, **k: Any) -> Any:
            result = await original(statement, *a, **k)
            if str(statement).startswith("DELETE"):
                statements.append(result.rowcount)
            return result

        s.execute = spy  # type: ignore[method-assign]
        removed = await delete_in_batches(
            s, MemberSession, MemberSession.expires_at < NOW, batch_size=10
        )
        assert removed == 25
        assert statements == [10, 10, 5]
        assert await count(s, MemberSession) == 0


async def test_one_failing_cleanup_does_not_stop_the_others(
    sessions: async_sessionmaker[AsyncSession], caplog: pytest.LogCaptureFixture
) -> None:
    async def boom(*_a: Any) -> int:
        raise RuntimeError("database is gone")

    async def good(s: AsyncSession, now: datetime, cfg: HousekeepingConfig) -> int:
        return await clean_member_sessions(s, now, cfg)

    async with sessions() as s:
        s.add(MemberSession(user_id=USER, refresh_hash="old", expires_at=NOW - days(30)))
        await s.commit()

    report = await run_once(
        sessions, config=CFG, now=NOW, cleanups=(("bad", boom), ("sessions", good))
    )
    assert report["failed"] == ["bad"]
    assert report["results"]["bad"] == {"deleted": 0, "error": "RuntimeError"}
    assert report["results"]["sessions"] == {"deleted": 1, "error": None}
    assert report["total_deleted"] == 1
    assert housekeeping.last_report() == report
    # the message is not copied into the report (could hold an address or a path)
    assert "database is gone" not in str(report)


async def test_run_once_with_real_cleanups_reports_every_one(
    sessions: async_sessionmaker[AsyncSession], tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(housekeeping, "_local_storage_dir", lambda: tmp_path)
    report = await run_once(sessions, config=CFG, now=NOW)
    assert set(report["results"]) == {name for name, _ in housekeeping.CLEANUPS}
    assert report["failed"] == []
    assert report["total_deleted"] == 0


async def test_a_missing_table_is_recorded_not_raised() -> None:
    engine = create_async_engine("sqlite+aiosqlite://", poolclass=StaticPool)
    maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    report = await run_once(maker, config=CFG, now=NOW)
    await engine.dispose()
    assert "member_sessions" in report["failed"]
    assert report["total_deleted"] == 0


# --------------------------------------------------------------------------- config and scheduler


def test_config_reads_the_environment_with_floors(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("HOUSEKEEPING_INTERVAL_HOURS", "0")
    monkeypatch.setenv("HOUSEKEEPING_TELEMETRY_DAYS", "1")
    monkeypatch.setenv("HOUSEKEEPING_NOTICE_DAYS", "nonsense")
    monkeypatch.setenv("HOUSEKEEPING_ORPHAN_FILE_HOURS", "5")
    monkeypatch.setenv("HOUSEKEEPING_ENABLED", "off")
    cfg = HousekeepingConfig.from_env()
    assert cfg.enabled is False
    assert cfg.interval_hours == 1
    assert cfg.telemetry_days == 30
    assert cfg.notice_days == 180
    assert cfg.orphan_file_hours == 48
    monkeypatch.delenv("HOUSEKEEPING_ENABLED")
    assert HousekeepingConfig.from_env().enabled is True


async def test_start_respects_the_switch(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("HOUSEKEEPING_ENABLED", "false")
    assert housekeeping.start_housekeeping() is None
    await housekeeping.stop_housekeeping(None)


async def test_loop_runs_then_sleeps_and_stops_when_cancelled(
    sessions: async_sessionmaker[AsyncSession], monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("HOUSEKEEPING_INITIAL_DELAY_MINUTES", "0")
    runs: list[int] = []

    async def fake_run(_sessions: Any, **_k: Any) -> dict[str, Any]:
        runs.append(1)
        if len(runs) == 1:
            raise RuntimeError("first run explodes")  # the loop must survive it
        return {}

    monkeypatch.setattr(housekeeping, "run_once", fake_run)
    real_sleep = asyncio.sleep
    sleeps: list[float] = []

    async def quick_sleep(seconds: float) -> None:
        sleeps.append(seconds)
        await real_sleep(0)

    monkeypatch.setattr(housekeeping.asyncio, "sleep", quick_sleep)
    task = asyncio.create_task(housekeeping.housekeeping_loop(sessions))
    for _ in range(50):
        await real_sleep(0)
        if len(runs) >= 3:
            break
    await housekeeping.stop_housekeeping(task)
    assert len(runs) >= 3
    assert task.done()
    assert 24 * 3600 in sleeps


# --------------------------------------------------------------------------- admin page


@pytest_asyncio.fixture(name="admin_client")
async def admin_client_fixture() -> AsyncIterator[httpx.AsyncClient]:
    app = FastAPI()
    app.include_router(server_tools_api.router, prefix="/api/v1")
    state = {"admin": True}

    def admin() -> str:
        if not state["admin"]:
            raise HTTPException(status_code=401, detail="Invalid admin credentials")
        return "api-key-admin"

    app.dependency_overrides[require_admin] = admin
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://t"
    ) as client:
        client.state = state  # type: ignore[attr-defined]
        yield client


async def test_admin_page_before_and_after_a_run(
    admin_client: httpx.AsyncClient, sessions: async_sessionmaker[AsyncSession]
) -> None:
    first = (await admin_client.get("/api/v1/admin/housekeeping")).json()
    assert first["last_run"] is None
    assert first["enabled"] is True
    assert first["retention"]["telemetry_days"] == 180
    assert "orphan_uploads" in first["cleanups"]

    async with sessions() as s:
        s.add(MemberSession(user_id=USER, refresh_hash="old", expires_at=NOW - days(30)))
        await s.commit()
    await run_once(
        sessions, config=CFG, now=NOW, cleanups=(("member_sessions", clean_member_sessions),)
    )
    second = (await admin_client.get("/api/v1/admin/housekeeping")).json()
    assert second["last_run"]["total_deleted"] == 1
    assert second["last_run"]["results"]["member_sessions"]["deleted"] == 1
    assert "path" not in str(second).lower()


async def test_admin_page_needs_the_admin_key(admin_client: httpx.AsyncClient) -> None:
    admin_client.state["admin"] = False  # type: ignore[attr-defined]
    assert (await admin_client.get("/api/v1/admin/housekeeping")).status_code == 401
    assert (await admin_client.get("/api/v1/admin/server-tools")).status_code == 401


async def test_the_real_app_mounts_it_behind_the_admin_key() -> None:
    from app.config import get_settings
    from app.core.security import hash_admin_api_key
    from app.main import app as real_app

    os.environ["ADMIN_API_KEY_HASH"] = hash_admin_api_key("right-key")
    get_settings.cache_clear()
    try:
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=real_app), base_url="http://testserver"
        ) as client:
            url = "/api/v1/admin/housekeeping"
            assert (await client.get(url)).status_code in (401, 403)
            ok = await client.get(url, headers={"X-Admin-Key": "right-key"})
            assert ok.status_code == 200
            assert "last_run" in ok.json()
    finally:
        os.environ.pop("ADMIN_API_KEY_HASH", None)
        get_settings.cache_clear()
