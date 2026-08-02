from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from threading import Lock

from fastapi import Request

from app.config import Settings, get_settings


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


def client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _quota_key(*, is_member: bool, identity: str) -> str:
    prefix = "member" if is_member else "guest"
    return f"{prefix}:{identity}"


def _read_usage(key: str, today: str) -> int:
    stored = _usage.get(key)
    if not stored or stored[0] != today:
        return 0
    return stored[1]


def check_daily_ai_quota(*, is_member: bool, identity: str, settings: Settings | None = None) -> DailyQuotaStatus:
    config = settings or get_settings()
    limit = config.ai_daily_member_limit if is_member else config.ai_daily_guest_limit
    today = _today_key()
    key = _quota_key(is_member=is_member, identity=identity)
    with _lock:
        used = _read_usage(key, today)
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
            f"Sign in for up to {config.ai_daily_member_limit} questions per day, "
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


def record_daily_ai_question(*, is_member: bool, identity: str) -> None:
    today = _today_key()
    key = _quota_key(is_member=is_member, identity=identity)
    with _lock:
        used = _read_usage(key, today)
        _usage[key] = (today, used + 1)


def reset_daily_ai_quota_for_tests() -> None:
    with _lock:
        _usage.clear()
