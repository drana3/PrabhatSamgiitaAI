"""The team's desks for takedown requests and suspicious play counts, for a signed-in team member.

`/admin/takedowns` and `/admin/play-flags` answer to the admin API key only, which the app never
holds. These routes put the same actions behind the team gate the other review screens use
(`TeamMember`, as `/recordings/value-suggestions` and the author claims desk do), so the phone's
team screens (app/team-takedowns.tsx, app/team-play-flags.tsx) can work. They call the same
services as the admin routes: no rule is repeated here, and the audit trail records the team
member's name or e-mail where the admin route records "api-key-admin".

* `GET  /team/takedowns?status=new,taken_down&limit&offset`   the queue (several statuses allowed)
* `POST /team/takedowns/{id}/link|take-down|reject|forward|restore|close`
* `GET  /team/play-flags?status=open|cleared|confirmed`       days whose play count looks inflated
* `POST /team/play-flags/{recording_id}/{day}/clear|confirm|unconfirm`

Docs: docs/takedown-process.md, docs/play-fraud.md, docs/team-desks.md.
"""

from __future__ import annotations

from datetime import date
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, select

from app.api.v1.extras_common import DatabaseSession, TeamMember
from app.api.v1.play_flags import PlayFlagOut
from app.api.v1.play_flags import _out as flag_out
from app.api.v1.takedown import ReasonBody, RestoreBody, TakeDownBody, TakedownList, TakedownOut
from app.api.v1.takedown import _out as takedown_out
from app.models.play_flag import PLAY_FLAG_STATUSES, PlayFlag
from app.models.recordings import Recording
from app.models.takedown import TAKEDOWN_STATUSES, TakedownRequest
from app.services import play_fraud
from app.services import takedowns as service

router = APIRouter(prefix="/team", tags=["team"])


def _by(team: TeamMember) -> str:
    return team.display_name or team.email or str(team.id)


# --------------------------------------------------------------------------- takedown requests


async def _request(session: DatabaseSession, request_id: UUID) -> TakedownRequest:
    row = await session.get(TakedownRequest, request_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Request not found")
    return row


@router.get("/takedowns", response_model=TakedownList)
async def team_takedowns(
    _team: TeamMember,
    session: DatabaseSession,
    status: Annotated[str | None, Query(max_length=120)] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 30,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> TakedownList:
    """The queue, newest first. `status` may list several statuses, separated by commas."""
    wanted = [part.strip() for part in (status or "").split(",") if part.strip()]
    unknown = [part for part in wanted if part not in TAKEDOWN_STATUSES]
    if unknown:
        raise HTTPException(status_code=422, detail=f"Unknown status: {unknown[0]}")
    conditions = [TakedownRequest.status.in_(wanted)] if wanted else []
    total = await session.scalar(
        select(func.count()).select_from(TakedownRequest).where(*conditions)
    )
    rows = (
        await session.scalars(
            select(TakedownRequest)
            .where(*conditions)
            .order_by(TakedownRequest.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
    ).all()
    return TakedownList(total=int(total or 0), items=[takedown_out(r) for r in rows])


class TeamLinkBody(BaseModel):
    # An address from the app or the website, or the recording's id: the id inside is used.
    recording: str = Field(min_length=3, max_length=500)


@router.post("/takedowns/{request_id}/link", response_model=TakedownOut)
async def team_link(
    request_id: UUID, body: TeamLinkBody, _team: TeamMember, session: DatabaseSession
) -> TakedownOut:
    """Point a request at its recording when the sender's text did not hold the id."""
    found = service.find_recording_id(body.recording)
    if found is None:
        raise HTTPException(status_code=422, detail="No recording id found in that text.")
    row = await _request(session, request_id)
    await service.link_recording(session, row, found)
    await session.commit()
    return takedown_out(row)


@router.post("/takedowns/{request_id}/take-down", response_model=TakedownOut)
async def team_take_down(
    request_id: UUID, body: TakeDownBody, team: TeamMember, session: DatabaseSession
) -> TakedownOut:
    """Hide the recording (the record is kept), block its file, tell the uploader."""
    row = await _request(session, request_id)
    return takedown_out(await service.take_down(session, row, by=_by(team), note=body.note))


@router.post("/takedowns/{request_id}/reject", response_model=TakedownOut)
async def team_reject(
    request_id: UUID, body: ReasonBody, team: TeamMember, session: DatabaseSession
) -> TakedownOut:
    row = await _request(session, request_id)
    return takedown_out(await service.reject(session, row, by=_by(team), reason=body.reason))


@router.post("/takedowns/{request_id}/forward", response_model=TakedownOut)
async def team_forward(request_id: UUID, team: TeamMember, session: DatabaseSession) -> TakedownOut:
    row = await _request(session, request_id)
    return takedown_out(await service.forward_counter_notice(session, row, by=_by(team)))


@router.post("/takedowns/{request_id}/restore", response_model=TakedownOut)
async def team_restore(
    request_id: UUID, body: RestoreBody, team: TeamMember, session: DatabaseSession
) -> TakedownOut:
    """Put the recording back (from its counter-notice), after the waiting time or if withdrawn."""
    row = await _request(session, request_id)
    return takedown_out(
        await service.restore(session, row, by=_by(team), claimant_withdrew=body.claimant_withdrew)
    )


@router.post("/takedowns/{request_id}/close", response_model=TakedownOut)
async def team_close(
    request_id: UUID, body: ReasonBody, team: TeamMember, session: DatabaseSession
) -> TakedownOut:
    row = await _request(session, request_id)
    return takedown_out(await service.close(session, row, by=_by(team), reason=body.reason))


# --------------------------------------------------------------------------- play flags


@router.get("/play-flags", response_model=list[PlayFlagOut])
async def team_play_flags(
    _team: TeamMember,
    session: DatabaseSession,
    status: Annotated[str | None, Query(max_length=12)] = "open",
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
) -> list[PlayFlagOut]:
    """Counts and a reason, never a listener key or an address (docs/play-fraud.md)."""
    if status and status not in PLAY_FLAG_STATUSES:
        raise HTTPException(status_code=422, detail=f"Unknown status: {status}")
    query = (
        select(PlayFlag, Recording.title)
        .join(Recording, Recording.id == PlayFlag.recording_id, isouter=True)
        .order_by(PlayFlag.day.desc(), PlayFlag.held.desc())
        .limit(limit)
    )
    if status:
        query = query.where(PlayFlag.status == status)
    return [flag_out(flag, title) for flag, title in (await session.execute(query)).all()]


async def _decide_flag(
    session: DatabaseSession, recording_id: UUID, day: date, verdict: str, by: str
) -> PlayFlagOut:
    flag = await play_fraud.review(session, recording_id, day, verdict=verdict, by=by)
    if flag is None:
        raise HTTPException(status_code=404, detail="No flag for that recording and day")
    title = await session.scalar(select(Recording.title).where(Recording.id == recording_id))
    return flag_out(flag, title)


@router.post("/play-flags/{recording_id}/{day}/clear", response_model=PlayFlagOut)
async def team_clear_flag(
    recording_id: UUID, day: date, team: TeamMember, session: DatabaseSession
) -> PlayFlagOut:
    """The plays were real: nothing is held back any more."""
    return await _decide_flag(session, recording_id, day, "cleared", _by(team))


@router.post("/play-flags/{recording_id}/{day}/confirm", response_model=PlayFlagOut)
async def team_confirm_flag(
    recording_id: UUID, day: date, team: TeamMember, session: DatabaseSession
) -> PlayFlagOut:
    """The plays were inflated: they stay held back for good."""
    return await _decide_flag(session, recording_id, day, "confirmed", _by(team))


@router.post("/play-flags/{recording_id}/{day}/unconfirm", response_model=PlayFlagOut)
async def team_unconfirm_flag(
    recording_id: UUID, day: date, team: TeamMember, session: DatabaseSession
) -> PlayFlagOut:
    """Take back a "confirmed" decision made by mistake. 409 when nothing was confirmed."""
    try:
        flag = await play_fraud.unconfirm(session, recording_id, day, by=_by(team))
    except play_fraud.NothingConfirmedError:
        raise HTTPException(
            status_code=409, detail="Nothing was confirmed as inflated that day"
        ) from None
    if flag is None:
        raise HTTPException(status_code=404, detail="No flag for that recording and day")
    title = await session.scalar(select(Recording.title).where(Recording.id == recording_id))
    return flag_out(flag, title)
