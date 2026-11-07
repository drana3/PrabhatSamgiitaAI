"""Chord sheets of recordings: members offer a plain-text chord chart (guitar or harmonium).

Reading the published sheets is open to everyone. Offering needs a signed-in member. A team member
publishes at once; everybody else's sheet waits in the review queue (`/recording-chords/review/*`,
signed-in team members, like `/song-chords/review/*`). Design and guarantees:
docs/recording-extras.md.
"""

from __future__ import annotations

import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, Request, Response, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.extras_common import (
    AppSettings,
    DatabaseSession,
    Member,
    OptionalMember,
    TeamMember,
    client_host,
    get_member,  # noqa: F401  (re-exported: tests override it)
    get_optional_member,  # noqa: F401
    get_team_member,  # noqa: F401
)
from app.models import UserAccount
from app.models.recording_extras import RecordingChordSheet
from app.schemas.recording_extras import (
    AdminSheetList,
    AdminSheetOut,
    ReportResponse,
    SheetCreate,
    SheetFilter,
    SheetInstrument,
    SheetList,
    SheetOut,
    SheetRejectRequest,
    SheetReportCreate,
)
from app.services import recording_chords as service
from app.services.extras_common import display_name, visible_recording
from app.services.recordings import is_team_member

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/recording-chords", tags=["recording-chords"])


async def get_sheet(session: AsyncSession, sheet_id: UUID) -> RecordingChordSheet:
    sheet = await session.get(RecordingChordSheet, sheet_id)
    if sheet is None:
        raise HTTPException(status_code=404, detail="Chart not found")
    return sheet


async def _author(session: AsyncSession, sheet: RecordingChordSheet) -> UserAccount | None:
    return await session.get(UserAccount, sheet.member_id)


# --------------------------------------------------------------------------- reading


@router.get("/recordings/{recording_id}", response_model=SheetList)
async def list_for_recording(
    recording_id: UUID,
    response: Response,
    session: DatabaseSession,
    member: OptionalMember,
    settings: AppSettings,
    instrument: SheetInstrument | None = None,
) -> SheetList:
    """The published charts of a recording (oldest first), plus the viewer's own waiting ones."""
    await visible_recording(session, recording_id)
    rows = await service.list_for_recording(
        session, recording_id, viewer_id=member.id if member else None, instrument=instrument
    )
    team = member is not None and is_team_member(member, settings)
    items = [
        service.public_out(s, a, viewer_id=member.id if member else None, team=team)
        for s, a in rows
    ]
    # The answer depends on who asks (own pending charts): never share it between viewers.
    response.headers["Cache-Control"] = "private, no-store"
    return SheetList(items=items, total=len(items))


@router.get("/mine", response_model=SheetList)
async def my_sheets(session: DatabaseSession, member: Member) -> SheetList:
    """The member's own charts in every state, with the reason of a rejection."""
    rows = await service.list_mine(session, member.id)
    items = []
    for sheet, recording in rows:
        out = service.public_out(sheet, member, viewer_id=member.id, team=False)
        out.recording_title = recording.title if recording else None
        items.append(out)
    return SheetList(items=items, total=len(items))


# --------------------------------------------------------------------------- offering


@router.post(
    "/recordings/{recording_id}", response_model=SheetOut, status_code=status.HTTP_201_CREATED
)
async def offer_sheet(
    recording_id: UUID,
    payload: SheetCreate,
    session: DatabaseSession,
    member: Member,
    settings: AppSettings,
) -> SheetOut:
    """Offer a chart. A team member's is live at once (`status: published`); anyone else's is
    `pending` until the team looks at it."""
    team = is_team_member(member, settings)
    await visible_recording(session, recording_id)
    try:
        sheet = await service.create_sheet(
            session, member=member, recording_id=recording_id, payload=payload, team=team
        )
    except SQLAlchemyError as exc:
        await session.rollback()
        logger.exception("Recording chord sheet could not be stored")
        raise HTTPException(status_code=503, detail="Storage is temporarily unavailable") from exc
    return service.public_out(sheet, member, viewer_id=member.id, team=team)


@router.put("/{sheet_id}", response_model=SheetOut)
async def update_own(
    sheet_id: UUID,
    payload: SheetCreate,
    session: DatabaseSession,
    member: Member,
    settings: AppSettings,
) -> SheetOut:
    """The author fixes a waiting or rejected chart and sends it again (a live one cannot be
    changed: offer a changed copy). The reason of an earlier rejection is cleared."""
    sheet = await get_sheet(session, sheet_id)
    if sheet.member_id != member.id:
        # Same answer as for a chart that does not exist: strangers learn nothing about ids.
        raise HTTPException(status_code=404, detail="Chart not found")
    team = is_team_member(member, settings)
    try:
        sheet = await service.update_sheet(session, sheet, payload=payload, team=team)
    except SQLAlchemyError as exc:
        await session.rollback()
        logger.exception("Recording chord sheet could not be updated")
        raise HTTPException(status_code=503, detail="Storage is temporarily unavailable") from exc
    return service.public_out(sheet, member, viewer_id=member.id, team=team)


@router.delete("/{sheet_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_own(sheet_id: UUID, session: DatabaseSession, member: Member) -> Response:
    """The author takes their chart back, for good, in any state. The offer stays in the daily
    ledger, so deleting does not give its place in the day back."""
    sheet = await get_sheet(session, sheet_id)
    if sheet.member_id != member.id:
        raise HTTPException(status_code=404, detail="Chart not found")
    await service.delete_sheet(session, sheet)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/{sheet_id}/report", response_model=ReportResponse, status_code=status.HTTP_201_CREATED
)
async def report_sheet(
    sheet_id: UUID,
    payload: SheetReportCreate,
    request: Request,
    session: DatabaseSession,
    member: OptionalMember,
) -> ReportResponse:
    """Anyone may report a published chart, signed in or not. Nobody reports their own chart: they delete
    it. One report per person; rate limited."""
    host = client_host(request)
    service.limiter.hit("report-sheet", host, limit=30, window_seconds=3600)
    if member is not None:
        service.limiter.hit("report-sheet-member", str(member.id), limit=20, window_seconds=3600)
        reporter_key = f"member:{member.id}"
    else:
        reporter_key = f"anon:{host}"[:80]
    sheet = await get_sheet(session, sheet_id)
    if sheet.status != "published":
        return ReportResponse(status="received", message="Thank you. This chart is not live.")
    if member is not None and sheet.member_id == member.id:
        raise HTTPException(status_code=422, detail="This is your own chart. You can delete it.")
    try:
        created = await service.add_report(
            session,
            sheet=sheet,
            reporter_key=reporter_key,
            reporter_id=member.id if member else None,
            reason=payload.reason,
            note=payload.note,
        )
    except SQLAlchemyError as exc:
        await session.rollback()
        raise HTTPException(
            status_code=503, detail="Report storage temporarily unavailable"
        ) from exc
    if not created:
        return ReportResponse(
            status="already_reported",
            message="You already reported this chart. The team will look at it.",
        )
    logger.warning(
        "Recording chord sheet %s reported (%s), %s reports so far",
        sheet.id,
        payload.reason,
        sheet.reports_count,
    )
    return ReportResponse(status="received", message="Thank you. The team will look at this chart.")


# --------------------------------------------------------------------------- review, in the app


@router.get("/review/queue", response_model=AdminSheetList)
async def review_list(
    team: TeamMember,
    session: DatabaseSession,
    filter: SheetFilter = "pending",
    limit: Annotated[int, Query(ge=1, le=100)] = 30,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> AdminSheetList:
    rows, total = await service.admin_queue(session, which=filter, limit=limit, offset=offset)
    return AdminSheetList(items=[service.admin_out(s, a) for s, a in rows], total=total)


@router.post("/review/{sheet_id}/approve", response_model=AdminSheetOut)
async def review_approve(
    sheet_id: UUID, team: TeamMember, session: DatabaseSession
) -> AdminSheetOut:
    sheet = await get_sheet(session, sheet_id)
    await service.approve(session, sheet, by=display_name(team))
    return service.admin_out(sheet, await _author(session, sheet))


@router.post("/review/{sheet_id}/reject", response_model=AdminSheetOut)
async def review_reject(
    sheet_id: UUID, payload: SheetRejectRequest, team: TeamMember, session: DatabaseSession
) -> AdminSheetOut:
    sheet = await get_sheet(session, sheet_id)
    await service.reject(session, sheet, reason=payload.reason, by=display_name(team))
    return service.admin_out(sheet, await _author(session, sheet))


@router.post("/review/{sheet_id}/restore", response_model=AdminSheetOut)
async def review_restore(
    sheet_id: UUID, team: TeamMember, session: DatabaseSession
) -> AdminSheetOut:
    sheet = await get_sheet(session, sheet_id)
    await service.restore(session, sheet, by=display_name(team))
    return service.admin_out(sheet, await _author(session, sheet))
