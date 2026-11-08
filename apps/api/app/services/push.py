"""Push notifications for replies to comments (docs/comment-replies.md, "Push").

When somebody answers a member's comment the server already writes a `comment_reply` notice
(`services/comment_threads.add_reply_notice`). This module also wakes the member's phones with a
push through the Expo push service, after the reply is safely committed.

What it promises:

* Off unless `PUSH_ENABLED` is true in the environment. Off means no queue, no task, no network:
  the comment code behaves exactly as before. `EXPO_ACCESS_TOKEN` is sent as a bearer key when set
  (needed when "enhanced security" is on in the Expo project).
* A push never carries the text of a comment. It says "New reply" and who answered, by name; an
  anonymous reply says "Someone", never a name. The data riding with it holds only ids, so a tap
  opens the conversation.
* Nobody is woken about their own reply, or when they switched "replies" off.
* Throttle: one push per discussion per ten minutes (more replies fold into the one already sent;
  the notice is in the bell anyway) and at most six different notices an hour for one member.
* A failure never reaches the person who wrote the reply: delivery runs as a background task after
  the commit and swallows its own errors (logged without tokens).
* A token Expo says is dead (`DeviceNotRegistered`, at once or in the receipt a quarter of an hour
  later) is deleted.
"""

from __future__ import annotations

import asyncio
import logging
import os
import re
from collections.abc import Sequence
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from time import monotonic
from typing import Any
from uuid import UUID, uuid4

import httpx
from sqlalchemy import delete, event, func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from sqlalchemy.orm import Session

from app.models.push import PushDelivery, PushDevice, PushPreference
from app.models.recordings import MemberNotice

logger = logging.getLogger(__name__)

EXPO_SEND_URL = "https://exp.host/--/api/v2/push/send"
EXPO_RECEIPTS_URL = "https://exp.host/--/api/v2/push/getReceipts"

# ---- the knobs (one place each) ------------------------------------------------------------
GROUP_WINDOW = timedelta(minutes=10)  # one push per discussion in this time
HOURLY_MAX = 6  # different notices per member in an hour
MAX_DEVICES_PER_MEMBER = 10
CHUNK = 100  # Expo takes at most 100 messages in a call
RECEIPT_AFTER = timedelta(minutes=15)  # Expo makes receipts ready after about this long
RECEIPT_GIVE_UP = timedelta(hours=24)
PURGE_AFTER = timedelta(days=7)
RECEIPT_EVERY_SECONDS = 15 * 60
HTTP_TIMEOUT = 10.0
NAME_MAX = 40

LANGUAGES = ("en", "ru", "es")
TOKEN_RE = re.compile(r"^(?:Expo|Exponent)PushToken\[[A-Za-z0-9_\-]{8,200}\]$")
_CONTROL = re.compile(r"[\x00-\x1f\x7f]")

# The words of the push, in the language the app reported. No comment text ever goes in here.
TITLE = {"en": "New reply", "ru": "Новый ответ", "es": "Nueva respuesta"}
BODY_NAMED = {
    "en": "{name} replied to your comment.",
    "ru": "{name}: ответ на ваш комментарий.",
    "es": "{name} respondió a tu comentario.",
}
BODY_ANONYMOUS = {
    "en": "Someone replied to your comment.",
    "ru": "Кто-то ответил на ваш комментарий.",
    "es": "Alguien respondió a tu comentario.",
}

PENDING_KEY = "push_after_commit"


# --------------------------------------------------------------------------- configuration


@dataclass(frozen=True)
class PushConfig:
    enabled: bool
    access_token: str | None
    send_url: str
    receipts_url: str


def config() -> PushConfig:
    """Read from the environment on every call, so a restart is the only thing a change needs."""
    flag = (os.environ.get("PUSH_ENABLED") or "").strip().lower() in {"1", "true", "yes", "on"}
    return PushConfig(
        enabled=flag,
        access_token=(os.environ.get("EXPO_ACCESS_TOKEN") or "").strip() or None,
        send_url=os.environ.get("EXPO_PUSH_URL") or EXPO_SEND_URL,
        receipts_url=os.environ.get("EXPO_PUSH_RECEIPTS_URL") or EXPO_RECEIPTS_URL,
    )


def enabled() -> bool:
    return config().enabled


# --------------------------------------------------------------------------- devices


def valid_token(token: str) -> bool:
    return bool(TOKEN_RE.match(token or ""))


def clean_language(language: str | None) -> str:
    base = (language or "en").lower().replace("_", "-").split("-")[0]
    return base if base in LANGUAGES else "en"


async def register_device(
    session: AsyncSession, member_id: UUID, token: str, platform: str, language: str | None
) -> PushDevice:
    """Remember a phone for a member. The same token again only refreshes it; a token that was
    another member's moves to this one (the phone changed hands). At most MAX_DEVICES_PER_MEMBER
    phones per member: the longest unused goes first."""
    row = await session.scalar(select(PushDevice).where(PushDevice.token == token))
    if row is None:
        row = PushDevice(id=uuid4(), member_id=member_id, token=token, platform=platform)
        session.add(row)
    row.member_id = member_id
    row.platform = platform
    row.language = clean_language(language)
    row.updated_at = datetime.now(UTC)
    await session.flush()
    rows = (
        await session.scalars(
            select(PushDevice)
            .where(PushDevice.member_id == member_id)
            .order_by(PushDevice.updated_at.desc(), PushDevice.id)
        )
    ).all()
    for old in rows[MAX_DEVICES_PER_MEMBER:]:
        await session.delete(old)
    await session.commit()
    return row


async def unregister_device(session: AsyncSession, member_id: UUID, token: str) -> bool:
    result = await session.execute(
        delete(PushDevice).where(PushDevice.token == token, PushDevice.member_id == member_id)
    )
    await session.commit()
    return bool(getattr(result, "rowcount", 0))


async def replies_on(session: AsyncSession, member_id: UUID) -> bool:
    row = await session.get(PushPreference, member_id)
    return True if row is None else bool(row.replies)


async def set_replies(session: AsyncSession, member_id: UUID, value: bool) -> bool:
    row = await session.get(PushPreference, member_id)
    if row is None:
        row = PushPreference(member_id=member_id, replies=value)
        session.add(row)
    row.replies = value
    row.updated_at = datetime.now(UTC)
    await session.commit()
    return value


# --------------------------------------------------------------------------- the job


@dataclass
class ReplyPush:
    """Everything the push needs, as plain values (read after the commit, when the session's own
    objects are no longer safe to touch)."""

    notice_id: UUID
    member_id: UUID  # who is woken
    sender_id: UUID  # who wrote the reply
    group_key: str  # the top-level comment
    from_name: str | None  # None when the reply is anonymous
    ids: dict[str, str] = field(default_factory=dict)  # song_id / recording_id, parent_id


def queue_reply_push(session: AsyncSession, notice: MemberNotice, *, sender_id: UUID) -> None:
    """Called while the reply is being added. Nothing happens unless push is on; the push is sent
    after the commit (see `_after_commit`) and dropped if the commit is rolled back."""
    if not enabled() or notice.kind != "comment_reply":
        return
    if notice.id is None:
        notice.id = uuid4()
    payload = notice.payload or {}
    ids = {"parent_id": str(payload.get("parent_id", ""))}
    for key in ("song_id", "recording_id"):
        if payload.get(key) is not None:
            ids[key] = str(payload[key])
    job = ReplyPush(
        notice_id=notice.id,
        member_id=notice.user_id,
        sender_id=sender_id,
        group_key=ids["parent_id"][:64],
        from_name=_clean_name(payload.get("from_name")),
        ids=ids,
    )
    session.sync_session.info.setdefault(PENDING_KEY, []).append(job)


def _clean_name(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    name = _CONTROL.sub(" ", value).strip()
    return name[:NAME_MAX].strip() or None


_tasks: set[asyncio.Task[None]] = set()


@event.listens_for(Session, "after_commit")
def _after_commit(sync_session: Session) -> None:
    jobs: list[ReplyPush] = sync_session.info.pop(PENDING_KEY, None) or []
    if not jobs:
        return
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:  # no event loop (a script): nothing to send from
        return
    for job in jobs:
        task = loop.create_task(deliver(job))
        _tasks.add(task)
        task.add_done_callback(_tasks.discard)


@event.listens_for(Session, "after_rollback")
def _after_rollback(sync_session: Session) -> None:
    sync_session.info.pop(PENDING_KEY, None)


async def drain() -> None:
    """Wait for the pushes in flight (tests, and a clean shutdown)."""
    while _tasks:
        await asyncio.gather(*list(_tasks), return_exceptions=True)


# --------------------------------------------------------------------------- the message


def build_message(job: ReplyPush, device: PushDevice) -> dict[str, Any]:
    language = clean_language(device.language)
    body = (
        BODY_NAMED[language].format(name=job.from_name)
        if job.from_name
        else BODY_ANONYMOUS[language]
    )
    return {
        "to": device.token,
        "title": TITLE[language],
        "body": body,
        "sound": "default",
        "channelId": "replies",
        "priority": "default",
        "ttl": 86_400,
        "data": {"kind": "comment_reply", "notice_id": str(job.notice_id), **job.ids},
    }


def _headers(cfg: PushConfig) -> dict[str, str]:
    headers = {"Accept": "application/json", "Content-Type": "application/json"}
    if cfg.access_token:
        headers["Authorization"] = f"Bearer {cfg.access_token}"
    return headers


# --------------------------------------------------------------------------- sending


def _new_client() -> httpx.AsyncClient:
    """The one place an HTTP client is made (tests put a mock transport here)."""
    return httpx.AsyncClient(timeout=HTTP_TIMEOUT)


def _sessions() -> async_sessionmaker[AsyncSession]:
    from app.core.db import SessionLocal  # the real database, only when something is sent

    return SessionLocal


async def throttled(session: AsyncSession, job: ReplyPush, now: datetime) -> bool:
    """True when this push should be folded into one already sent."""
    same_discussion = await session.scalar(
        select(func.count())
        .select_from(PushDelivery)
        .where(
            PushDelivery.member_id == job.member_id,
            PushDelivery.group_key == job.group_key,
            PushDelivery.sent_at >= now - GROUP_WINDOW,
        )
    )
    if same_discussion:
        return True
    notices = await session.scalar(
        select(func.count(func.distinct(PushDelivery.notice_id))).where(
            PushDelivery.member_id == job.member_id,
            PushDelivery.sent_at >= now - timedelta(hours=1),
        )
    )
    return int(notices or 0) >= HOURLY_MAX


async def deliver(
    job: ReplyPush,
    *,
    sessions: async_sessionmaker[AsyncSession] | None = None,
    client: httpx.AsyncClient | None = None,
) -> int:
    """Send the push for one reply. Returns how many phones were handed to Expo. Never raises."""
    try:
        return await _deliver(job, sessions or _sessions(), client)
    except Exception:  # a push must never break, or show up as, anything else
        logger.warning("push delivery failed", exc_info=True)
        return 0


async def _deliver(
    job: ReplyPush, sessions: async_sessionmaker[AsyncSession], client: httpx.AsyncClient | None
) -> int:
    cfg = config()
    if not cfg.enabled or job.member_id == job.sender_id:
        return 0
    now = datetime.now(UTC)
    async with sessions() as session:
        if not await replies_on(session, job.member_id):
            return 0
        devices = list(
            (
                await session.scalars(
                    select(PushDevice)
                    .where(PushDevice.member_id == job.member_id)
                    .order_by(PushDevice.created_at, PushDevice.id)
                )
            ).all()
        )
        if not devices or await throttled(session, job, now):
            return 0
        messages = [build_message(job, d) for d in devices]
        tickets = await _post(cfg, messages, client)
        sent = 0
        dead: list[str] = []
        for device, ticket in zip(devices, tickets, strict=False):
            ok = ticket.get("status") == "ok"
            if not ok and _error_of(ticket) == "DeviceNotRegistered":
                dead.append(device.token)
            session.add(
                PushDelivery(
                    id=uuid4(),
                    member_id=job.member_id,
                    notice_id=job.notice_id,
                    group_key=job.group_key,
                    token=device.token,
                    ticket_id=str(ticket["id"])[:80] if ok and ticket.get("id") else None,
                    status="sent" if ok else "error",
                    sent_at=now,
                )
            )
            sent += 1 if ok else 0
        if dead:
            await session.execute(delete(PushDevice).where(PushDevice.token.in_(dead)))
        await session.commit()
    await maybe_check_receipts(sessions, client)
    return sent


def _error_of(item: dict[str, Any]) -> str | None:
    details = item.get("details")
    return details.get("error") if isinstance(details, dict) else None


async def _post(
    cfg: PushConfig, messages: Sequence[dict[str, Any]], client: httpx.AsyncClient | None
) -> list[dict[str, Any]]:
    """The tickets for the messages, in order. A call that fails gives an `error` ticket for each
    message in it (nothing is retried: the notice is in the bell anyway)."""
    out: list[dict[str, Any]] = []
    owned = client is None
    http = client or _new_client()
    try:
        for start in range(0, len(messages), CHUNK):
            chunk = list(messages[start : start + CHUNK])
            try:
                response = await http.post(cfg.send_url, json=chunk, headers=_headers(cfg))
                response.raise_for_status()
                data = response.json().get("data")
                tickets = (
                    [t if isinstance(t, dict) else {} for t in data]
                    if isinstance(data, list)
                    else []
                )
            except (httpx.HTTPError, ValueError):
                logger.warning("expo push call failed", exc_info=True)
                tickets = []
            tickets += [{"status": "error"}] * (len(chunk) - len(tickets))
            out.extend(tickets[: len(chunk)])
    finally:
        if owned:
            await http.aclose()
    return out


# --------------------------------------------------------------------------- receipts

_last_receipt_check = 0.0


async def maybe_check_receipts(
    sessions: async_sessionmaker[AsyncSession], client: httpx.AsyncClient | None = None
) -> None:
    global _last_receipt_check
    if monotonic() - _last_receipt_check < RECEIPT_EVERY_SECONDS and _last_receipt_check:
        return
    _last_receipt_check = monotonic()
    try:
        await check_receipts(sessions, client)
    except Exception:
        logger.warning("push receipt check failed", exc_info=True)


async def check_receipts(
    sessions: async_sessionmaker[AsyncSession], client: httpx.AsyncClient | None = None
) -> int:
    """Ask Expo how the pushes of 15 minutes to a day ago went. A phone that is gone loses its
    token. Rows older than a week are deleted. Returns how many receipts were read."""
    cfg = config()
    if not cfg.enabled:
        return 0
    now = datetime.now(UTC)
    read = 0
    async with sessions() as session:
        rows = list(
            (
                await session.scalars(
                    select(PushDelivery)
                    .where(
                        PushDelivery.status == "sent",
                        PushDelivery.ticket_id.is_not(None),
                        PushDelivery.sent_at <= now - RECEIPT_AFTER,
                        PushDelivery.sent_at >= now - RECEIPT_GIVE_UP,
                    )
                    .limit(1000)
                )
            ).all()
        )
        if rows:
            owned = client is None
            http = client or _new_client()
            try:
                response = await http.post(
                    cfg.receipts_url,
                    json={"ids": [r.ticket_id for r in rows]},
                    headers=_headers(cfg),
                )
                response.raise_for_status()
                receipts = response.json().get("data") or {}
            finally:
                if owned:
                    await http.aclose()
            dead: list[str] = []
            for row in rows:
                receipt = receipts.get(row.ticket_id) if isinstance(receipts, dict) else None
                if not isinstance(receipt, dict):
                    continue
                read += 1
                row.checked_at = now
                row.status = "ok" if receipt.get("status") == "ok" else "error"
                if row.status == "error" and _error_of(receipt) == "DeviceNotRegistered":
                    dead.append(row.token)
            if dead:
                await session.execute(delete(PushDevice).where(PushDevice.token.in_(dead)))
        await session.execute(
            delete(PushDelivery)
            .where(PushDelivery.sent_at < now - PURGE_AFTER)
            .execution_options(synchronize_session=False)
        )
        await session.commit()
    return read
