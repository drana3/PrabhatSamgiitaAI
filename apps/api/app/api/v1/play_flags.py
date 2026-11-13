"""The team's view of suspicious play counts (docs/play-fraud.md). Admin key only.

Shows counts and a reason, never a listener key or an address: the team can decide whether the
plays look real without being able to find out who played.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select

from app.api.v1.extras_common import DatabaseSession
from app.core.security import require_admin
from app.models.play_flag import PlayFlag
from app.models.recordings import Recording
from app.services import play_fraud

router = APIRouter(prefix="/admin/play-flags", tags=["admin"])
AdminIdentity = Annotated[str, Depends(require_admin)]


class PlayFlagOut(BaseModel):
    recording_id: str
    recording_title: str | None
    day: date
    plays: int
    held: int
    confirmed_held: int
    last_decision: str | None
    baseline: float
    reason: str
    status: str
    created_at: datetime
    reviewed_by: str | None
    reviewed_at: datetime | None


def _out(flag: PlayFlag, title: str | None) -> PlayFlagOut:
    return PlayFlagOut(
        recording_id=str(flag.recording_id),
        recording_title=title,
        day=flag.day,
        plays=flag.plays,
        held=flag.held,
        confirmed_held=flag.confirmed_held,
        last_decision=flag.last_decision,
        baseline=flag.baseline,
        reason=flag.reason,
        status=flag.status,
        created_at=flag.created_at,
        reviewed_by=flag.reviewed_by,
        reviewed_at=flag.reviewed_at,
    )


@router.get("", response_model=list[PlayFlagOut])
async def list_flags(
    session: DatabaseSession,
    _: AdminIdentity,
    status: Literal["open", "cleared", "confirmed"] | None = Query(default="open"),
    limit: int = Query(default=100, ge=1, le=500),
) -> list[PlayFlagOut]:
    query = (
        select(PlayFlag, Recording.title)
        .join(Recording, Recording.id == PlayFlag.recording_id, isouter=True)
        .order_by(PlayFlag.day.desc(), PlayFlag.held.desc())
        .limit(limit)
    )
    if status:
        query = query.where(PlayFlag.status == status)
    return [_out(flag, title) for flag, title in (await session.execute(query)).all()]


async def _decide(
    session: DatabaseSession, recording_id: UUID, day: date, verdict: str, admin: str
) -> PlayFlagOut:
    flag = await play_fraud.review(session, recording_id, day, verdict=verdict, by=admin)
    if flag is None:
        raise HTTPException(status_code=404, detail="No flag for that recording and day")
    title = await session.scalar(select(Recording.title).where(Recording.id == recording_id))
    return _out(flag, title)


@router.post("/{recording_id}/{day}/clear", response_model=PlayFlagOut)
async def clear_flag(
    recording_id: UUID, day: date, session: DatabaseSession, admin: AdminIdentity
) -> PlayFlagOut:
    """The plays were real: nothing is held back any more."""
    return await _decide(session, recording_id, day, "cleared", admin)


@router.post("/{recording_id}/{day}/confirm", response_model=PlayFlagOut)
async def confirm_flag(
    recording_id: UUID, day: date, session: DatabaseSession, admin: AdminIdentity
) -> PlayFlagOut:
    """The plays were inflated: they stay held back for good."""
    return await _decide(session, recording_id, day, "confirmed", admin)


@router.post("/{recording_id}/{day}/unconfirm", response_model=PlayFlagOut)
async def unconfirm_flag(
    recording_id: UUID, day: date, session: DatabaseSession, admin: AdminIdentity
) -> PlayFlagOut:
    """Take back a "confirmed" decision made by mistake: the confirmed plays count again.

    409 when nothing was confirmed on that day. Who did it and when stays on the flag.
    """
    try:
        flag = await play_fraud.unconfirm(session, recording_id, day, by=admin)
    except play_fraud.NothingConfirmedError:
        raise HTTPException(
            status_code=409, detail="Nothing was confirmed as inflated that day"
        ) from None
    if flag is None:
        raise HTTPException(status_code=404, detail="No flag for that recording and day")
    title = await session.scalar(select(Recording.title).where(Recording.id == recording_id))
    return _out(flag, title)
