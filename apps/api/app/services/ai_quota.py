from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, date, datetime
from threading import Lock

from fastapi import Request
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.models.ai_usage import AiDailyUsage


@dataclass(frozen=True, slots=True)
class DailyQuotaStatus:
    allowed: bool
    used: int
    limit: int
    remaining: int
    is_member: bool
    guidance: str


_lock = Lock()
_usage: dict[str, tuple[str, int]] = {}


def _today_key() -> str:
    return datetime.now(UTC).date().isoformat()


def _today_date() -> date:
    return datetime.now(UTC).date()


def client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _quota_key(*, is_member: bool, identity: str) -> str:
    prefix = "member" if is_member else "guest"
    return f"{prefix}:{identity}"


def _read_memory(key: str, today: str) -> int:
    stored = _usage.get(key)
    if not stored or stored[0] != today:
        return 0
    return stored[1]


def _write_memory(key: str, today: str, used: int) -> None:
    _usage[key] = (today, used)


def _status(*, is_member: bool, used: int, settings: Settings) -> DailyQuotaStatus:
    limit = settings.ai_daily_member_limit if is_member else settings.ai_daily_guest_limit
    remaining = max(limit - used, 0)
    allowed = used < limit
    if allowed:
        guidance = ""
    elif is_member:
        guidance = (
            f"You have reached today's signed-in limit of {limit} AI companion questions. "
            "Please come back tomorrow, or continue exploring lyrics, meanings, and recordings."
        )
    else:
        guidance = (
            f"You have reached today's guest limit of {limit} AI companion questions. "
            f"Sign in for up to {settings.ai_daily_member_limit} questions per day, "
            "or come back tomorrow."
        )
    return DailyQuotaStatus(
        allowed=allowed,
        used=used,
        limit=limit,
        remaining=remaining,
        is_member=is_member,
        guidance=guidance,
    )


def check_daily_ai_quota(
    *,
    is_member: bool,
    identity: str,
    settings: Settings | None = None,
) -> DailyQuotaStatus:
    """Memory-backed check used by unit tests and as DB fallback."""
    config = settings or get_settings()
    today = _today_key()
    key = _quota_key(is_member=is_member, identity=identity)
    with _lock:
        used = _read_memory(key, today)
    return _status(is_member=is_member, used=used, settings=config)


def record_daily_ai_question(*, is_member: bool, identity: str) -> None:
    """Memory-backed increment used by unit tests and as DB fallback."""
    today = _today_key()
    key = _quota_key(is_member=is_member, identity=identity)
    with _lock:
        used = _read_memory(key, today) + 1
        _write_memory(key, today, used)


async def check_daily_ai_quota_persisted(
    *,
    is_member: bool,
    identity: str,
    session: AsyncSession,
    settings: Settings | None = None,
) -> DailyQuotaStatus:
    """Neon-backed check with in-process cache (survives restarts / multi-replica)."""
    config = settings or get_settings()
    today = _today_key()
    key = _quota_key(is_member=is_member, identity=identity)
    used: int | None = None
    try:
        result = await session.scalar(
            select(AiDailyUsage.question_count).where(
                AiDailyUsage.identity_key == key,
                AiDailyUsage.usage_date == _today_date(),
            )
        )
        used = int(result or 0)
    except Exception:
        used = None
    with _lock:
        if used is None:
            used = _read_memory(key, today)
        else:
            _write_memory(key, today, used)
    return _status(is_member=is_member, used=used, settings=config)


async def record_daily_ai_question_persisted(
    *,
    is_member: bool,
    identity: str,
    session: AsyncSession,
) -> None:
    """Neon upsert + memory cache."""
    today = _today_key()
    key = _quota_key(is_member=is_member, identity=identity)
    db_used: int | None = None
    try:
        statement = (
            insert(AiDailyUsage)
            .values(
                identity_key=key,
                usage_date=_today_date(),
                question_count=1,
                is_member=is_member,
            )
            .on_conflict_do_update(
                constraint="uq_ai_daily_usage_identity_date",
                set_={"question_count": AiDailyUsage.question_count + 1},
            )
            .returning(AiDailyUsage.question_count)
        )
        db_used = int(await session.scalar(statement) or 1)
        await session.commit()
    except Exception:
        await session.rollback()
        db_used = None
    with _lock:
        if db_used is None:
            used = _read_memory(key, today) + 1
            _write_memory(key, today, used)
        else:
            _write_memory(key, today, db_used)


def reset_daily_ai_quota_for_tests() -> None:
    with _lock:
        _usage.clear()
