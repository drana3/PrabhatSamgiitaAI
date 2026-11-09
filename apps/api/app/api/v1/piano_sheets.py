"""Piano notes: members offer the keys of a melody for a recording or a Prabhat Samgiita song.

Reading the published sheets is open to everyone. Offering needs a signed-in member. A team member
and the author of the recording go live at once; everybody else's sheet waits in the review queue
(`/piano-notes/review/*`, signed-in team members). Design and decisions: docs/piano-notation.md.
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
    SongNumber,
    TeamMember,
    client_host,
    get_member,  # noqa: F401  (re-exported: tests override it)
    get_optional_member,  # noqa: F401
    get_team_member,  # noqa: F401
)
from app.models import UserAccount
from app.models.piano_sheets import PianoSheet
from app.schemas.piano_sheets import (
    AdminPianoSheetList,
    AdminPianoSheetOut,
    PianoFilter,
    PianoRecordingIds,
    PianoRejectRequest,
    PianoReportCreate,
    PianoReportResponse,
    PianoSheetCreate,
    PianoSheetList,
    PianoSheetOut,
)
from app.services import piano_sheets as service
from app.services.extras_common import display_name, visible_recording
from app.services.recording_chords import NO_CHORD_KINDS
from app.services.recordings import is_team_member

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/piano-notes", tags=["piano-notes"])


async def get_sheet(session: AsyncSession, sheet_id: UUID) -> PianoSheet:
    sheet = await session.get(PianoSheet, sheet_id)
    if sheet is None:
        raise HTTPException(status_code=404, detail="Notes not found")
    return sheet


async def _admin(session: AsyncSession, sheet: PianoSheet) -> AdminPianoSheetOut:
    credits = await service.credit_map(session, [sheet])
    return service.admin_out(
        sheet, await session.get(UserAccount, sheet.member_id), credits=credits
    )


# --------------------------------------------------------------------------- reading


@router.get("/recordings", response_model=PianoRecordingIds)
async def recordings_with_notes(response: Response, session: DatabaseSession) -> PianoRecordingIds:
    """The recordings that have live piano notes: the phone's shelf "Kiirtan for piano" reads it."""
    response.headers["Cache-Control"] = "public, max-age=120"
    return PianoRecordingIds(recording_ids=await service.recording_ids_with_sheets(session))


@router.get("/recordings/{recording_id}", response_model=PianoSheetList)
async def list_for_recording(
    recording_id: UUID,
    response: Response,
    session: DatabaseSession,
    member: OptionalMember,
    settings: AppSettings,
) -> PianoSheetList:
    """The live sheets of a recording (oldest first), plus the viewer's own waiting ones."""
    await visible_recording(session, recording_id)
    return await _listing(
        session,
        response,
        service.recording_key(recording_id),
        member,
        is_team=_team(member, settings),
    )


@router.get("/songs/{song_number}", response_model=PianoSheetList)
async def list_for_song(
    song_number: SongNumber,
    response: Response,
    session: DatabaseSession,
    member: OptionalMember,
    settings: AppSettings,
) -> PianoSheetList:
    return await _listing(
        session, response, service.song_key(song_number), member, is_team=_team(member, settings)
    )


def _team(member: UserAccount | None, settings: AppSettings) -> bool:
    return member is not None and is_team_member(member, settings)


async def _listing(
    session: AsyncSession,
    response: Response,
    target_key: str,
    member: UserAccount | None,
    *,
    is_team: bool,
) -> PianoSheetList:
    rows = await service.list_for_target(
        session, target_key, viewer_id=member.id if member else None
    )
    items = await service.present(
        session, rows, viewer_id=member.id if member else None, team=is_team
    )
    # The answer depends on who asks (own pending sheets): never share it between viewers.
    response.headers["Cache-Control"] = "private, no-store"
    return PianoSheetList(items=items, total=len(items))


@router.get("/mine", response_model=PianoSheetList)
async def my_sheets(session: DatabaseSession, member: Member) -> PianoSheetList:
    """The member's own sheets in every state, with the reason of a rejection."""
    rows = await service.list_mine(session, member.id)
    items = await service.present(
        session, [(sheet, member) for sheet, _ in rows], viewer_id=member.id, team=False
    )
    for out, (_, recording) in zip(items, rows, strict=True):
        out.recording_title = recording.title if recording else None
    return PianoSheetList(items=items, total=len(items))


# --------------------------------------------------------------------------- offering


async def _offer(
    session: AsyncSession,
    member: UserAccount,
    settings: AppSettings,
    payload: PianoSheetCreate,
    *,
    recording_id: UUID | None,
    song_number: int | None,
) -> PianoSheetOut:
    team = is_team_member(member, settings)
    try:
        sheet = await service.create_sheet(
            session,
            member=member,
            recording_id=recording_id,
            song_number=song_number,
            payload=payload,
            team=team,
        )
    except SQLAlchemyError as exc:
        await session.rollback()
        logger.exception("Piano sheet could not be stored")
        raise HTTPException(status_code=503, detail="Storage is temporarily unavailable") from exc
    return (await service.present(session, [(sheet, member)], viewer_id=member.id, team=team))[0]


@router.post(
    "/recordings/{recording_id}", response_model=PianoSheetOut, status_code=status.HTTP_201_CREATED
)
async def offer_for_recording(
    recording_id: UUID,
    payload: PianoSheetCreate,
    session: DatabaseSession,
    member: Member,
    settings: AppSettings,
) -> PianoSheetOut:
    """Offer notes. A team member's and the recording author's are live at once (`status:
    published`); anyone else's are `pending` until the team looks at them."""
    recording = await visible_recording(session, recording_id)
    if recording.kind in NO_CHORD_KINDS:
        # a Dance music and a Baba's Audio Discourse take neither chords nor notes
        raise HTTPException(
            status_code=422, detail="Dance music and Baba's Audio Discourses take no notes."
        )
    return await _offer(
        session, member, settings, payload, recording_id=recording_id, song_number=None
    )


@router.post(
    "/songs/{song_number}", response_model=PianoSheetOut, status_code=status.HTTP_201_CREATED
)
async def offer_for_song(
    song_number: SongNumber,
    payload: PianoSheetCreate,
    session: DatabaseSession,
    member: Member,
    settings: AppSettings,
) -> PianoSheetOut:
    """Notes for a Prabhat Samgiita song: any member may offer; the team reads them first."""
    return await _offer(
        session, member, settings, payload, recording_id=None, song_number=song_number
    )


@router.put("/{sheet_id}", response_model=PianoSheetOut)
async def update_own(
    sheet_id: UUID,
    payload: PianoSheetCreate,
    session: DatabaseSession,
    member: Member,
    settings: AppSettings,
) -> PianoSheetOut:
    """The author fixes a waiting or rejected sheet and sends it again."""
    sheet = await get_sheet(session, sheet_id)
    if sheet.member_id != member.id:
        # Same answer as for notes that do not exist: strangers learn nothing about ids.
        raise HTTPException(status_code=404, detail="Notes not found")
    team = is_team_member(member, settings)
    try:
        sheet = await service.update_sheet(session, sheet, payload=payload, team=team)
    except SQLAlchemyError as exc:
        await session.rollback()
        logger.exception("Piano sheet could not be updated")
        raise HTTPException(status_code=503, detail="Storage is temporarily unavailable") from exc
    return (await service.present(session, [(sheet, member)], viewer_id=member.id, team=team))[0]


@router.delete("/{sheet_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_own(sheet_id: UUID, session: DatabaseSession, member: Member) -> Response:
    sheet = await get_sheet(session, sheet_id)
    if sheet.member_id != member.id:
        raise HTTPException(status_code=404, detail="Notes not found")
    await service.delete_sheet(session, sheet)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/{sheet_id}/report",
    response_model=PianoReportResponse,
    status_code=status.HTTP_201_CREATED,
)
async def report_sheet(
    sheet_id: UUID,
    payload: PianoReportCreate,
    request: Request,
    session: DatabaseSession,
    member: OptionalMember,
) -> PianoReportResponse:
    """Anyone may report live notes, signed in or not. One report per person; rate limited."""
    host = client_host(request)
    service.limiter.hit("report-sheet", host, limit=30, window_seconds=3600)
    if member is not None:
        service.limiter.hit("report-sheet-member", str(member.id), limit=20, window_seconds=3600)
        reporter_key = f"member:{member.id}"
    else:
        reporter_key = f"anon:{host}"[:80]
    sheet = await get_sheet(session, sheet_id)
    if sheet.status != "published":
        return PianoReportResponse(
            status="received", message="Thank you. These notes are not live."
        )
    if member is not None and sheet.member_id == member.id:
        raise HTTPException(
            status_code=422, detail="These are your own notes. You can delete them."
        )
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
        return PianoReportResponse(
            status="already_reported",
            message="You already reported these notes. The team will look at them.",
        )
    logger.warning("Piano sheet %s reported (%s)", sheet.id, payload.reason)
    return PianoReportResponse(status="received", message="Thank you. The team will look at them.")


# --------------------------------------------------------------------------- review, in the app


@router.get("/review/queue", response_model=AdminPianoSheetList)
async def review_list(
    team: TeamMember,
    session: DatabaseSession,
    filter: PianoFilter = "pending",
    limit: Annotated[int, Query(ge=1, le=100)] = 30,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> AdminPianoSheetList:
    rows, total = await service.admin_queue(session, which=filter, limit=limit, offset=offset)
    credits = await service.credit_map(session, [s for s, _ in rows])
    return AdminPianoSheetList(
        items=[service.admin_out(s, a, credits=credits) for s, a in rows], total=total
    )


@router.post("/review/{sheet_id}/approve", response_model=AdminPianoSheetOut)
async def review_approve(
    sheet_id: UUID, team: TeamMember, session: DatabaseSession
) -> AdminPianoSheetOut:
    sheet = await get_sheet(session, sheet_id)
    await service.approve(session, sheet, by=display_name(team))
    return await _admin(session, sheet)


@router.post("/review/{sheet_id}/reject", response_model=AdminPianoSheetOut)
async def review_reject(
    sheet_id: UUID, payload: PianoRejectRequest, team: TeamMember, session: DatabaseSession
) -> AdminPianoSheetOut:
    sheet = await get_sheet(session, sheet_id)
    await service.reject(session, sheet, reason=payload.reason, by=display_name(team))
    return await _admin(session, sheet)


@router.post("/review/{sheet_id}/restore", response_model=AdminPianoSheetOut)
async def review_restore(
    sheet_id: UUID, team: TeamMember, session: DatabaseSession
) -> AdminPianoSheetOut:
    sheet = await get_sheet(session, sheet_id)
    await service.restore(session, sheet, by=display_name(team))
    return await _admin(session, sheet)
