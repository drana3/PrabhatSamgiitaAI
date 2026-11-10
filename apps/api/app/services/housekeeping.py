"""Daily housekeeping: delete what piles up in the database and on the disk without limit.

Plain words (docs/housekeeping.md): once a day the server removes rows that nobody can use any more
(expired sign-in sessions, old one-time codes, finished rate-limit counters, raw play and usage rows
that are already counted elsewhere, read notices) and upload files that never became a recording.

Rules that hold for every cleanup:

* Member content is never touched: no song, recording, comment, favourite, playlist, chat or
  profile. The tables below are the whole list.
* Rows go in batches of at most BATCH_SIZE (1000) per DELETE, each batch in its own commit, so one
  run never holds a long lock and never trips the database statement timeout.
* One cleanup failing (database down, a table missing) is logged and recorded; the others still run.
  Nothing here raises into the scheduler: the loop in `housekeeping_loop` only stops when cancelled.
* Retention comes from the environment (`HOUSEKEEPING_*`, defaults in `HousekeepingConfig`), is read
  at each run, and has a floor, so a typo cannot delete today's rows.
* No table of its own and no migration: the last report lives in memory (`last_report`) and in the
  log. After a restart the admin page says "no run yet" until the next run.
"""

from __future__ import annotations

import asyncio
import contextlib
import logging
import os
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from typing import Any

from sqlalchemy import ColumnElement, delete, inspect, select, tuple_
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

logger = logging.getLogger(__name__)

BATCH_SIZE = 1000
# A run that still finds rows after this many batches (one million rows) stops and says so; the
# next day's run carries on. Keeps one cleanup from monopolising the database.
MAX_BATCHES = 1000

TRUE_WORDS = {"1", "true", "yes", "on"}
FALSE_WORDS = {"0", "false", "no", "off"}


def _env_bool(name: str, default: bool) -> bool:
    raw = os.environ.get(name)
    if raw is None or not raw.strip():
        return default
    word = raw.strip().lower()
    if word in TRUE_WORDS:
        return True
    if word in FALSE_WORDS:
        return False
    return default


def _env_int(name: str, default: int, *, minimum: int) -> int:
    """An integer from the environment. Junk gives the default; below `minimum` gives `minimum`."""
    raw = os.environ.get(name)
    if raw is None or not raw.strip():
        return default
    try:
        value = int(raw.strip())
    except ValueError:
        logger.warning("%s is not a whole number; using %s", name, default)
        return default
    return max(minimum, value)


@dataclass(frozen=True)
class HousekeepingConfig:
    enabled: bool = True
    interval_hours: int = 24
    initial_delay_minutes: int = 10
    sessions_grace_days: int = 7
    codes_grace_days: int = 7
    reset_tokens_grace_days: int = 7
    rate_limit_grace_hours: int = 1
    play_event_days: int = 400
    telemetry_days: int = 180
    notice_days: int = 180
    orphan_file_hours: int = 48

    @classmethod
    def from_env(cls) -> HousekeepingConfig:
        return cls(
            enabled=_env_bool("HOUSEKEEPING_ENABLED", True),
            interval_hours=_env_int("HOUSEKEEPING_INTERVAL_HOURS", 24, minimum=1),
            initial_delay_minutes=_env_int("HOUSEKEEPING_INITIAL_DELAY_MINUTES", 10, minimum=0),
            sessions_grace_days=_env_int("HOUSEKEEPING_SESSIONS_GRACE_DAYS", 7, minimum=1),
            codes_grace_days=_env_int("HOUSEKEEPING_CODES_GRACE_DAYS", 7, minimum=1),
            reset_tokens_grace_days=_env_int("HOUSEKEEPING_RESET_TOKENS_GRACE_DAYS", 7, minimum=1),
            rate_limit_grace_hours=_env_int("HOUSEKEEPING_RATE_LIMIT_GRACE_HOURS", 1, minimum=1),
            play_event_days=_env_int("HOUSEKEEPING_PLAY_EVENT_DAYS", 400, minimum=90),
            telemetry_days=_env_int("HOUSEKEEPING_TELEMETRY_DAYS", 180, minimum=30),
            notice_days=_env_int("HOUSEKEEPING_NOTICE_DAYS", 180, minimum=30),
            orphan_file_hours=_env_int("HOUSEKEEPING_ORPHAN_FILE_HOURS", 48, minimum=48),
        )

    def describe(self) -> dict[str, Any]:
        """The numbers that decide what is deleted (no secret in it) for the admin page."""
        return {
            "interval_hours": self.interval_hours,
            "sessions_grace_days": self.sessions_grace_days,
            "codes_grace_days": self.codes_grace_days,
            "reset_tokens_grace_days": self.reset_tokens_grace_days,
            "rate_limit_grace_hours": self.rate_limit_grace_hours,
            "play_event_days": self.play_event_days,
            "telemetry_days": self.telemetry_days,
            "notice_days": self.notice_days,
            "orphan_file_hours": self.orphan_file_hours,
        }


# --------------------------------------------------------------------------- batched delete


async def delete_in_batches(
    session: AsyncSession,
    model: Any,
    condition: ColumnElement[bool],
    *,
    batch_size: int = BATCH_SIZE,
    max_batches: int = MAX_BATCHES,
) -> int:
    """Delete the rows of `model` matching `condition`, `batch_size` per statement.

    Each batch is: read the primary keys of up to `batch_size` matching rows, delete exactly those
    rows, commit. Works on PostgreSQL and SQLite and with a composite primary key.
    """
    pk = list(inspect(model).primary_key)
    total = 0
    for _ in range(max_batches):
        rows = (await session.execute(select(*pk).where(condition).limit(batch_size))).all()
        if not rows:
            return total
        if len(pk) == 1:
            ids = [row[0] for row in rows]
            statement = delete(model).where(pk[0].in_(ids))
        else:
            statement = delete(model).where(tuple_(*pk).in_([tuple(row) for row in rows]))
        await session.execute(statement.execution_options(synchronize_session=False))
        await session.commit()
        total += len(rows)
        if len(rows) < batch_size:
            return total
    logger.warning(
        "housekeeping: %s still has rows after %s batches; the next run continues",
        getattr(model, "__tablename__", model),
        max_batches,
    )
    return total


# --------------------------------------------------------------------------- the cleanups

CleanupFn = Callable[[AsyncSession, datetime, HousekeepingConfig], Awaitable[int]]


async def clean_member_sessions(
    session: AsyncSession, now: datetime, cfg: HousekeepingConfig
) -> int:
    """Sign-in sessions (refresh tokens) expired or revoked more than the grace period ago."""
    from app.models.member_session import MemberSession

    cutoff = now - timedelta(days=cfg.sessions_grace_days)
    return await delete_in_batches(
        session,
        MemberSession,
        (MemberSession.expires_at < cutoff)
        | (MemberSession.revoked_at.is_not(None) & (MemberSession.revoked_at < cutoff)),
    )


async def clean_phone_codes(session: AsyncSession, now: datetime, cfg: HousekeepingConfig) -> int:
    """One-time phone codes that expired more than the grace period ago."""
    from app.models.member import PhoneVerificationCode

    cutoff = now - timedelta(days=cfg.codes_grace_days)
    return await delete_in_batches(
        session, PhoneVerificationCode, PhoneVerificationCode.expires_at < cutoff
    )


async def clean_reset_tokens(session: AsyncSession, now: datetime, cfg: HousekeepingConfig) -> int:
    """Password-reset tokens expired, or used, more than the grace period ago."""
    from app.models.announcements import PasswordResetToken

    cutoff = now - timedelta(days=cfg.reset_tokens_grace_days)
    return await delete_in_batches(
        session,
        PasswordResetToken,
        (PasswordResetToken.expires_at < cutoff)
        | (PasswordResetToken.used_at.is_not(None) & (PasswordResetToken.used_at < cutoff)),
    )


async def clean_rate_limit_counters(
    session: AsyncSession, now: datetime, cfg: HousekeepingConfig
) -> int:
    """Counters of the request limiter whose own `expires_at` (unix seconds) has passed."""
    from app.models.rate_limit import RateLimitCounter

    cutoff = int(now.timestamp()) - cfg.rate_limit_grace_hours * 3600
    return await delete_in_batches(session, RateLimitCounter, RateLimitCounter.expires_at < cutoff)


async def clean_play_events(session: AsyncSession, now: datetime, cfg: HousekeepingConfig) -> int:
    """Raw listen rows (recordings and catalogue songs) past the retention window.

    Safe because every counted listen is also added to `play_daily` / `song_play_daily`, which stay
    (services/author_stats.py, services/song_plays.py). Same default as `PLAY_EVENT_RETENTION_DAYS`.
    """
    from app.models.author_profiles import PlayEvent
    from app.models.song_plays import SongPlayEvent

    cutoff: date = (now - timedelta(days=cfg.play_event_days)).date()
    removed = await delete_in_batches(session, PlayEvent, PlayEvent.day < cutoff)
    removed += await delete_in_batches(session, SongPlayEvent, SongPlayEvent.day < cutoff)
    return removed


async def clean_app_events(session: AsyncSession, now: datetime, cfg: HousekeepingConfig) -> int:
    """Anonymous usage events past 180 days (the rule written in docs/analytics-flags.md)."""
    from app.models.app_telemetry import AppEvent

    cutoff: date = (now - timedelta(days=cfg.telemetry_days)).date()
    return await delete_in_batches(session, AppEvent, AppEvent.day < cutoff)


async def clean_read_notices(session: AsyncSession, now: datetime, cfg: HousekeepingConfig) -> int:
    """Notices (a recording was removed, restored) that the member has read, older than 180 days.

    Unread notices stay however old they are.
    """
    from app.models.recordings import MemberNotice

    cutoff = now - timedelta(days=cfg.notice_days)
    return await delete_in_batches(
        session,
        MemberNotice,
        MemberNotice.read_at.is_not(None) & (MemberNotice.read_at < cutoff),
    )


def _local_storage_dir() -> Path | None:
    """The folder of the local disk storage, or None when the audio lives in a bucket."""
    from app.config import get_settings

    settings = get_settings()
    if settings.recording_storage_backend.lower() != "local":
        return None
    return Path(settings.recording_local_dir).resolve()


def _stale_upload_files(base: Path, older_than: float) -> list[tuple[str, Path]]:
    """(key, path) of audio files under `recordings/` last written before `older_than` (epoch)."""
    from app.services.recording_storage import KEY_PATTERN

    found: list[tuple[str, Path]] = []
    root = base / "recordings"
    if not root.is_dir():
        return found
    for path in root.glob("*/*"):
        try:
            if not path.is_file() or path.is_symlink() or path.stat().st_mtime >= older_than:
                continue
        except OSError:
            continue
        key = path.relative_to(base).as_posix()
        if KEY_PATTERN.fullmatch(key):
            found.append((key, path))
    return found


async def clean_orphan_uploads(
    session: AsyncSession,
    now: datetime,
    cfg: HousekeepingConfig,
    *,
    base_dir: Path | None = None,
) -> int:
    """Audio files on the server disk that no recording points at and that are 48+ hours old.

    An upload that was started but never published (the app closed, the person pressed Cancel
    after the file was sent) leaves a file and no row. A file that a recording row names is never
    touched, whatever its status. A bucket (R2/S3) is not listed here: use a lifecycle rule there
    (docs/housekeeping.md). The browser/phone upload is one PUT, so there are no chunk files.
    """
    from app.models.recordings import Recording

    base = base_dir if base_dir is not None else _local_storage_dir()
    if base is None:
        return 0
    older_than = now.timestamp() - cfg.orphan_file_hours * 3600
    stale = await asyncio.to_thread(_stale_upload_files, base, older_than)
    removed = 0
    for start in range(0, len(stale), 500):
        chunk = stale[start : start + 500]
        used = set(
            (
                await session.scalars(
                    select(Recording.audio_key).where(
                        Recording.audio_key.in_([k for k, _ in chunk])
                    )
                )
            ).all()
        )
        for key, path in chunk:
            if key in used:
                continue
            try:
                await asyncio.to_thread(path.unlink, True)
                removed += 1
            except OSError:
                logger.warning(
                    "housekeeping: could not remove an orphan upload file", exc_info=True
                )
    return removed


CLEANUPS: tuple[tuple[str, CleanupFn], ...] = (
    ("member_sessions", clean_member_sessions),
    ("phone_codes", clean_phone_codes),
    ("password_reset_tokens", clean_reset_tokens),
    ("rate_limit_counters", clean_rate_limit_counters),
    ("play_events", clean_play_events),
    ("app_events", clean_app_events),
    ("read_notices", clean_read_notices),
    ("orphan_uploads", clean_orphan_uploads),
)


# --------------------------------------------------------------------------- one run, the loop

_last_report: dict[str, Any] | None = None
_run_lock = asyncio.Lock()


def last_report() -> dict[str, Any] | None:
    return _last_report


def reset_housekeeping_state() -> None:
    """Test helper: forget the last report."""
    global _last_report
    _last_report = None


async def run_once(
    sessions: async_sessionmaker[AsyncSession] | Callable[[], Any],
    *,
    config: HousekeepingConfig | None = None,
    now: datetime | None = None,
    cleanups: tuple[tuple[str, CleanupFn], ...] | None = None,
) -> dict[str, Any]:
    """Run every cleanup once. Never raises (apart from cancellation); returns the report."""
    global _last_report
    cfg = config or HousekeepingConfig.from_env()
    moment = now or datetime.now(UTC)
    started = time.monotonic()
    results: dict[str, dict[str, Any]] = {}
    async with _run_lock:
        for name, cleanup in cleanups or CLEANUPS:
            try:
                async with sessions() as session:
                    try:
                        count = await cleanup(session, moment, cfg)
                    except BaseException:
                        with contextlib.suppress(Exception):
                            await session.rollback()
                        raise
                results[name] = {"deleted": count, "error": None}
                if count:
                    logger.info("housekeeping: %s deleted %s", name, count)
            except asyncio.CancelledError:
                raise
            except Exception as exc:  # noqa: BLE001 - one cleanup must not stop the others
                logger.exception("housekeeping: %s failed", name)
                results[name] = {"deleted": 0, "error": type(exc).__name__}
        report: dict[str, Any] = {
            "started_at": moment.isoformat(),
            "duration_ms": int((time.monotonic() - started) * 1000),
            "total_deleted": sum(item["deleted"] for item in results.values()),
            "failed": sorted(name for name, item in results.items() if item["error"]),
            "results": results,
        }
        _last_report = report
    logger.info(
        "housekeeping: done, %s rows/files removed, %s failed",
        report["total_deleted"],
        len(report["failed"]),
    )
    return report


async def housekeeping_loop(
    sessions: async_sessionmaker[AsyncSession] | Callable[[], Any] | None = None,
) -> None:
    """Background loop: wait, run, sleep one interval, repeat. Stops only when cancelled."""
    if sessions is None:
        from app.core.db import SessionLocal

        sessions = SessionLocal
    cfg = HousekeepingConfig.from_env()
    try:
        await asyncio.sleep(cfg.initial_delay_minutes * 60)
    except asyncio.CancelledError:
        raise
    while True:
        try:
            await run_once(sessions)
        except asyncio.CancelledError:
            raise
        except Exception:  # noqa: BLE001 - belt and braces; run_once already catches
            logger.exception("housekeeping run failed")
        await asyncio.sleep(HousekeepingConfig.from_env().interval_hours * 3600)


def start_housekeeping() -> asyncio.Task[None] | None:
    """Start the daily loop unless HOUSEKEEPING_ENABLED is off. Returns the task (or None)."""
    if not HousekeepingConfig.from_env().enabled:
        logger.info("housekeeping: off (HOUSEKEEPING_ENABLED)")
        return None
    return asyncio.create_task(housekeeping_loop(), name="housekeeping")


async def stop_housekeeping(task: asyncio.Task[None] | None) -> None:
    if task is None:
        return
    task.cancel()
    with contextlib.suppress(asyncio.CancelledError):
        await task


def status() -> dict[str, Any]:
    """What GET /admin/housekeeping returns: the switch, the numbers, and the last report."""
    cfg = HousekeepingConfig.from_env()
    return {
        "enabled": cfg.enabled,
        "retention": cfg.describe(),
        "cleanups": [name for name, _ in CLEANUPS],
        "last_run": _last_report,
    }


__all__ = [
    "BATCH_SIZE",
    "CLEANUPS",
    "HousekeepingConfig",
    "delete_in_batches",
    "housekeeping_loop",
    "last_report",
    "run_once",
    "start_housekeeping",
    "status",
    "stop_housekeeping",
]
