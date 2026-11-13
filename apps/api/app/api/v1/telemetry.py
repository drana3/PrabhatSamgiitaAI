"""Product events and feature flags (docs/analytics-flags.md).

Public:
  POST /events   a batch of allow-listed events, no account, no text
  GET  /flags    the flags for this install (headers X-Install-Id, X-App-Version, X-Platform)
Team (X-Admin-Key):
  GET    /admin/flags, PUT /admin/flags/{key}, DELETE /admin/flags/{key}
  GET    /admin/events/summary, GET /admin/experiments/{key}, POST /admin/events/purge
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, Response
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.core.db import get_session
from app.core.security import require_admin
from app.models.app_telemetry import FeatureFlag
from app.services import feature_flags as flags
from app.services import telemetry
from app.services.author_profiles import pepper
from app.services.recordings import limiter

router = APIRouter(tags=["telemetry"])
admin_router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])

DatabaseSession = Annotated[AsyncSession, Depends(get_session)]
AppSettings = Annotated[Settings, Depends(get_settings)]
EVENT_BATCHES_PER_MINUTE = 30
FLAG_READS_PER_MINUTE = 60
FLAGS_TTL_SECONDS = 600


class EventIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    name: str = Field(max_length=48)
    props: dict[str, Any] = Field(default_factory=dict)


class EventBatch(BaseModel):
    model_config = ConfigDict(extra="ignore")
    # "anonymous" (the default) sends no install id; "shared" adds one, stored only as a hash.
    mode: Literal["anonymous", "shared"] = "anonymous"
    session_id: str | None = Field(default=None, max_length=36)
    install_id: str | None = Field(default=None, max_length=64)
    app_version: str | None = Field(default=None, max_length=20)
    platform: str | None = Field(default=None, max_length=10)
    language: str | None = Field(default=None, max_length=8)
    events: list[EventIn] = Field(default_factory=list, max_length=telemetry.MAX_BATCH)


class EventBatchResult(BaseModel):
    accepted: int
    rejected: int


class FlagState(BaseModel):
    enabled: bool
    variant: str


class FlagsOut(BaseModel):
    flags: dict[str, FlagState]
    ttl_seconds: int = FLAGS_TTL_SECONDS


def _host(request: Request) -> str:
    return request.client.host if request.client else "unknown"


@router.post("/events", response_model=EventBatchResult)
async def post_events(
    payload: EventBatch, request: Request, session: DatabaseSession, settings: AppSettings
) -> EventBatchResult:
    limiter.hit("events", _host(request), limit=EVENT_BATCHES_PER_MINUTE, window_seconds=60)
    batch = await telemetry.record_events(
        session,
        events=[e.model_dump() for e in payload.events],
        mode=payload.mode,
        session_id=payload.session_id,
        install_id=payload.install_id,
        app_version=payload.app_version,
        platform=payload.platform,
        language=payload.language,
        pepper=pepper(settings),
    )
    return EventBatchResult(accepted=batch.accepted, rejected=batch.rejected)


@router.get("/flags", response_model=FlagsOut)
async def get_flags(
    request: Request,
    response: Response,
    session: DatabaseSession,
    x_install_id: Annotated[str | None, Header(max_length=64)] = None,
    x_app_version: Annotated[str | None, Header(max_length=20)] = None,
    x_platform: Annotated[str | None, Header(max_length=10)] = None,
) -> FlagsOut:
    limiter.hit("flags", _host(request), limit=FLAG_READS_PER_MINUTE, window_seconds=60)
    rows = (await session.scalars(select(FeatureFlag).order_by(FeatureFlag.key))).all()
    ctx = flags.Context(
        install_id=x_install_id,
        app_version=x_app_version,
        platform=(x_platform or "").lower() or None,
    )
    # The answer depends on the install, so it is private: no shared cache may keep it.
    response.headers["Cache-Control"] = "private, max-age=300"
    return FlagsOut(flags={k: FlagState(**v) for k, v in flags.evaluate_all(rows, ctx).items()})


# ----------------------------------------------------------------------------- team


class FlagOut(BaseModel):
    key: str
    description: str
    enabled: bool
    rollout_percent: int
    min_app_version: str | None
    max_app_version: str | None
    platforms: list[str] | None
    variants: list[dict[str, Any]] | None
    include_ids: list[str]
    exclude_ids: list[str]
    updated_at: datetime
    updated_by: str | None


def _out(row: FeatureFlag) -> FlagOut:
    return FlagOut(
        key=row.key,
        description=row.description,
        enabled=row.enabled,
        rollout_percent=row.rollout_percent,
        min_app_version=row.min_app_version,
        max_app_version=row.max_app_version,
        platforms=row.platforms,
        variants=row.variants,
        include_ids=list(row.include_ids or []),
        exclude_ids=list(row.exclude_ids or []),
        updated_at=row.updated_at,
        updated_by=row.updated_by,
    )


@admin_router.get("/flags", response_model=list[FlagOut])
async def list_flags(session: DatabaseSession) -> list[FlagOut]:
    rows = (await session.scalars(select(FeatureFlag).order_by(FeatureFlag.key))).all()
    return [_out(r) for r in rows]


@admin_router.put("/flags/{key}", response_model=FlagOut)
async def put_flag(
    key: str,
    body: dict[str, Any],
    session: DatabaseSession,
    admin: Annotated[str, Depends(require_admin)],
) -> FlagOut:
    """Create or change a flag. Send only the fields to change; a new flag starts switched off."""
    if not flags.KEY_PATTERN.fullmatch(key):
        raise HTTPException(status_code=422, detail="key: lowercase letters, digits and _")
    try:
        clean = flags.validate_flag_fields(body)
    except flags.FlagError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    row = await session.get(FeatureFlag, key)
    if row is None:
        row = FeatureFlag(
            key=key,
            description="",
            enabled=False,
            rollout_percent=0,
            include_ids=[],
            exclude_ids=[],
            updated_at=datetime.now(UTC),
        )
        session.add(row)
    for field, value in clean.items():
        setattr(row, field, value)
    row.updated_at = datetime.now(UTC)
    row.updated_by = str(admin)[:80]
    await session.commit()
    return _out(row)


@admin_router.delete("/flags/{key}", status_code=204)
async def delete_flag(key: str, session: DatabaseSession) -> Response:
    row = await session.get(FeatureFlag, key)
    if row is None:
        raise HTTPException(status_code=404, detail="No such flag")
    await session.delete(row)
    await session.commit()
    return Response(status_code=204)


@admin_router.get("/events/summary")
async def events_summary(
    session: DatabaseSession, days: Annotated[int, Query(ge=1, le=180)] = 7
) -> dict[str, Any]:
    return {"days": days, "events": await telemetry.event_summary(session, days)}


@admin_router.get("/experiments/{key}")
async def experiment(
    key: str,
    session: DatabaseSession,
    goal: Annotated[str | None, Query(max_length=48)] = None,
    days: Annotated[int, Query(ge=1, le=180)] = 14,
) -> dict[str, Any]:
    if goal is not None and goal not in telemetry.EVENTS:
        raise HTTPException(status_code=422, detail="goal must be a known event name")
    return await telemetry.experiment_results(session, key, goal=goal, days=days)


@admin_router.post("/events/purge")
async def purge_events(
    session: DatabaseSession,
    older_than_days: Annotated[int, Query(ge=30, le=730)] = telemetry.RETENTION_DAYS,
) -> dict[str, int]:
    return {"deleted": await telemetry.purge_older_than(session, older_than_days)}
