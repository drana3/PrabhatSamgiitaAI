"""Product events with no person in them (docs/analytics-flags.md).

The phone may send only the events and properties named here. Anything else is dropped, and a
string property must be a short lowercase token (letters, digits, `_ . : -`), so a question, a
title, a name or an e-mail cannot ride along even by mistake.
"""

from __future__ import annotations

import re
from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from typing import Any

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.app_telemetry import AppEvent
from app.services.author_stats import listener_key

MAX_BATCH = 50
MAX_PROPS = 6
RETENTION_DAYS = 180
TOKEN = re.compile(r"^[a-z0-9][a-z0-9_.:\-]{0,39}$")
VERSION = re.compile(r"^\d{1,3}(\.\d{1,3}){0,3}([\-+][A-Za-z0-9.]{1,12})?$")
SESSION = re.compile(r"^[0-9a-f\-]{16,36}$")
LANGUAGE = re.compile(r"^[a-zA-Z]{2,3}([\-_][A-Za-z]{2,4})?$")
PLATFORMS = {"ios", "android", "web"}
EXPOSURE = "flag_exposure"

# event name -> the property names it may carry
EVENTS: dict[str, frozenset[str]] = {
    "app_open": frozenset({"cold"}),
    "screen_view": frozenset({"screen"}),
    "search": frozenset({"mode", "has_results", "results"}),
    "song_open": frozenset({"source"}),
    "play_start": frozenset({"kind", "source"}),
    "radio_start": frozenset({"pool"}),
    "radio_stop": frozenset({"pool", "minutes"}),
    "upload_start": frozenset({"kind"}),
    "upload_step": frozenset({"wizard", "step", "n"}),
    "upload_done": frozenset({"kind"}),
    "upload_fail": frozenset({"kind", "reason"}),
    "wizard_step": frozenset({"wizard", "step"}),
    "share": frozenset({"kind", "channel"}),
    "error": frozenset({"code", "screen"}),
    "consent_change": frozenset({"mode"}),
    EXPOSURE: frozenset({"flag", "variant"}),
}


def clean_props(name: str, props: Any) -> dict[str, Any] | None:
    """The allowed properties of an event, or None when the event is not allowed at all."""
    allowed = EVENTS.get(name)
    if allowed is None:
        return None
    if not isinstance(props, Mapping):
        return {}
    out: dict[str, Any] = {}
    for key, value in props.items():
        if key not in allowed or len(out) >= MAX_PROPS:
            continue
        if isinstance(value, bool):
            out[key] = value
        elif isinstance(value, int) and -1_000_000 <= value <= 1_000_000:
            out[key] = value
        elif isinstance(value, str) and TOKEN.fullmatch(value):
            out[key] = value
    return out


@dataclass(frozen=True)
class Batch:
    accepted: int
    rejected: int


async def record_events(
    session: AsyncSession,
    *,
    events: Iterable[Mapping[str, Any]],
    mode: str,
    session_id: str | None,
    install_id: str | None,
    app_version: str | None,
    platform: str | None,
    language: str | None,
    pepper: str,
    now: datetime | None = None,
) -> Batch:
    moment = now or datetime.now(UTC)
    install_key = (
        listener_key(pepper, f"i:{install_id}") if mode == "shared" and install_id else None
    )
    rows: list[AppEvent] = []
    rejected = 0
    for item in list(events)[:MAX_BATCH]:
        name = str(item.get("name", "")) if isinstance(item, Mapping) else ""
        props = clean_props(name, item.get("props") if isinstance(item, Mapping) else None)
        if props is None:
            rejected += 1
            continue
        rows.append(
            AppEvent(
                day=moment.date(),
                created_at=moment,
                name=name,
                props=props,
                app_version=app_version if app_version and VERSION.fullmatch(app_version) else None,
                platform=platform if platform in PLATFORMS else None,
                language=language if language and LANGUAGE.fullmatch(language) else None,
                session_id=session_id if session_id and SESSION.fullmatch(session_id) else None,
                install_key=install_key,
            )
        )
    session.add_all(rows)
    await session.commit()
    return Batch(accepted=len(rows), rejected=rejected)


async def purge_older_than(session: AsyncSession, days: int = RETENTION_DAYS) -> int:
    cutoff: date = (datetime.now(UTC) - timedelta(days=days)).date()
    result = await session.execute(delete(AppEvent).where(AppEvent.day < cutoff))
    await session.commit()
    return int(getattr(result, "rowcount", 0) or 0)


async def event_summary(session: AsyncSession, days: int) -> list[dict[str, Any]]:
    since = (datetime.now(UTC) - timedelta(days=days)).date()
    rows = await session.execute(
        select(AppEvent.name, func.count(), func.count(func.distinct(AppEvent.session_id)))
        .where(AppEvent.day >= since)
        .group_by(AppEvent.name)
        .order_by(func.count().desc())
    )
    return [{"name": n, "events": int(c), "sessions": int(s)} for n, c, s in rows.all()]


async def experiment_results(
    session: AsyncSession, flag: str, *, goal: str | None, days: int
) -> dict[str, Any]:
    """Per variant: sessions that saw it (an exposure event) and, when a goal event is named,
    how many of those sessions also did the goal. Sessions are random per launch, so this works
    for people who never agreed to share usage."""
    since = (datetime.now(UTC) - timedelta(days=days)).date()
    exposures = (
        await session.execute(
            select(AppEvent.props, AppEvent.session_id).where(
                AppEvent.name == EXPOSURE, AppEvent.day >= since
            )
        )
    ).all()
    sessions_by_variant: dict[str, set[str]] = {}
    counts: dict[str, int] = {}
    for props, session_id in exposures:
        if not isinstance(props, Mapping) or props.get("flag") != flag:
            continue
        variant = str(props.get("variant", "off"))
        counts[variant] = counts.get(variant, 0) + 1
        if session_id:
            sessions_by_variant.setdefault(variant, set()).add(session_id)
    goal_sessions: set[str] = set()
    if goal and goal in EVENTS:
        goal_rows = await session.execute(
            select(AppEvent.session_id).where(AppEvent.name == goal, AppEvent.day >= since)
        )
        goal_sessions = {sid for (sid,) in goal_rows.all() if sid}
    variants = []
    for variant in sorted(set(counts) | set(sessions_by_variant)):
        seen = sessions_by_variant.get(variant, set())
        done = len(seen & goal_sessions) if goal else None
        variants.append(
            {
                "variant": variant,
                "exposures": counts.get(variant, 0),
                "sessions": len(seen),
                "goal_sessions": done,
                "conversion": (round(done / len(seen), 4) if goal and seen else None),
            }
        )
    return {"flag": flag, "goal": goal, "days": days, "variants": variants}
