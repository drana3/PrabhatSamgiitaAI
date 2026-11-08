"""Chord proposals: members offer guitar or harmonium chords for a Prabhat Samgiita song.

Reading the published charts is open to everyone. Offering needs a signed-in member. A team member
(`is_team_member`, the same rule as the Kiirtan uploads) publishes at once; everybody else's chart
waits in the review queue. The queue is served two ways: with the admin key (`/admin/song-chords`,
like `/admin/recordings`) and to signed-in team members (`/song-chords/review`, for the app).
Design and guarantees: apps/mobile/docs/chord-proposals.md.
"""

from __future__ import annotations

import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Request, Response, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.core.db import get_session
from app.core.security import require_admin
from app.models import UserAccount
from app.models.recordings import PS_SONG_COUNT
from app.models.song_chords import SongChordProposal
from app.schemas.song_chords import (
    AdminChordProposalList,
    AdminChordProposalOut,
    AdminFilter,
    ChordProposalCreate,
    ChordProposalList,
    ChordProposalOut,
    ChordReportCreate,
    ChordReportResponse,
    Instrument,
    RejectRequest,
    ReviewRequest,
)
from app.services import song_chords as service
from app.services.members import require_member_identity, sync_member, try_member_identity
from app.services.recordings import is_team_member

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/song-chords", tags=["song-chords"])
admin_router = APIRouter(prefix="/admin/song-chords", tags=["admin"])

DatabaseSession = Annotated[AsyncSession, Depends(get_session)]
AppSettings = Annotated[Settings, Depends(get_settings)]
AdminIdentity = Annotated[str, Depends(require_admin)]
SongNumber = Annotated[int, Path(ge=1, le=PS_SONG_COUNT)]


async def get_member(request: Request, session: DatabaseSession) -> UserAccount:
    return await sync_member(session, require_member_identity(request))


async def get_optional_member(request: Request, session: DatabaseSession) -> UserAccount | None:
    identity = try_member_identity(request)
    return await sync_member(session, identity) if identity else None


Member = Annotated[UserAccount, Depends(get_member)]
OptionalMember = Annotated[UserAccount | None, Depends(get_optional_member)]


async def get_team_member(member: Member, settings: AppSettings) -> UserAccount:
    if not is_team_member(member, settings):
        raise HTTPException(status_code=403, detail="Only the team can review charts.")
    return member


TeamMember = Annotated[UserAccount, Depends(get_team_member)]


def client_host(request: Request) -> str:
    return request.client.host if request.client else "unknown"


async def get_proposal(session: AsyncSession, proposal_id: UUID) -> SongChordProposal:
    proposal = await session.get(SongChordProposal, proposal_id)
    if proposal is None:
        raise HTTPException(status_code=404, detail="Chart not found")
    return proposal


async def _author(session: AsyncSession, proposal: SongChordProposal) -> UserAccount | None:
    return await session.get(UserAccount, proposal.member_id)


# --------------------------------------------------------------------------- reading


@router.get("/songs/{song_id}", response_model=ChordProposalList)
async def list_for_song(
    song_id: SongNumber,
    response: Response,
    session: DatabaseSession,
    member: OptionalMember,
    settings: AppSettings,
    instrument: Instrument | None = None,
) -> ChordProposalList:
    """The published charts of a song (oldest first), plus the viewer's own waiting ones."""
    rows = await service.list_for_song(
        session,
        song_id,
        viewer_id=member.id if member else None,
        instrument=instrument,
    )
    team = bool(member) and is_team_member(member, settings)  # type: ignore[arg-type]
    items = [
        service.public_out(p, a, viewer_id=member.id if member else None, team=team)
        for p, a in rows
    ]
    # The answer depends on who asks (own pending charts): never share it between viewers.
    response.headers["Cache-Control"] = "private, no-store"
    return ChordProposalList(items=items, total=len(items))


@router.get("/mine", response_model=ChordProposalList)
async def my_proposals(session: DatabaseSession, member: Member) -> ChordProposalList:
    """The member's own charts in every state, with the reason of a rejection. A chart that a newer
    version replaced comes with `archived: true` and `replaced_by`."""
    rows = await service.list_mine(session, member.id)
    replaced = await service.replaced_by_map(session, [p.id for p, _ in rows if p.archived_at])
    items = [
        service.public_out(p, a, viewer_id=member.id, team=False, replaced_by=replaced.get(p.id))
        for p, a in rows
    ]
    return ChordProposalList(items=items, total=len(items))


# --------------------------------------------------------------------------- offering


@router.post("", response_model=ChordProposalOut, status_code=status.HTTP_201_CREATED)
async def offer_chart(
    payload: ChordProposalCreate,
    session: DatabaseSession,
    member: Member,
    settings: AppSettings,
) -> ChordProposalOut:
    """Offer a chart. A team member's is live at once (`status: published`); anyone else's is
    `pending` until the team looks at it."""
    team = is_team_member(member, settings)
    try:
        proposal = await service.create_proposal(session, member=member, payload=payload, team=team)
    except SQLAlchemyError as exc:
        await session.rollback()
        logger.exception("Chord chart could not be stored")
        raise HTTPException(status_code=503, detail="Storage is temporarily unavailable") from exc
    return service.public_out(proposal, member, viewer_id=member.id, team=team)


@router.put("/{proposal_id}", response_model=ChordProposalOut)
async def update_own(
    proposal_id: UUID,
    payload: ChordProposalCreate,
    session: DatabaseSession,
    member: Member,
    settings: AppSettings,
) -> ChordProposalOut:
    """The author fixes a waiting or rejected chart and sends it again (a live one cannot be
    changed: offer a changed copy). The reason of an earlier rejection is cleared."""
    proposal = await get_proposal(session, proposal_id)
    if proposal.member_id != member.id:
        # Same answer as for a chart that does not exist: strangers learn nothing about ids.
        raise HTTPException(status_code=404, detail="Chart not found")
    team = is_team_member(member, settings)
    try:
        proposal = await service.update_proposal(session, proposal, payload=payload, team=team)
    except SQLAlchemyError as exc:
        await session.rollback()
        logger.exception("Chord chart could not be updated")
        raise HTTPException(status_code=503, detail="Storage is temporarily unavailable") from exc
    return service.public_out(proposal, member, viewer_id=member.id, team=team)


@router.delete("/{proposal_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_own(proposal_id: UUID, session: DatabaseSession, member: Member) -> Response:
    """The author takes their chart back, for good, in any state. A chart that still waits for the
    review gives its place in the daily allowance back; a live or rejected one does not."""
    proposal = await get_proposal(session, proposal_id)
    if proposal.member_id != member.id:
        raise HTTPException(status_code=404, detail="Chart not found")
    await service.delete_proposal(session, proposal)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/{proposal_id}/report",
    response_model=ChordReportResponse,
    status_code=status.HTTP_201_CREATED,
)
async def report_chart(
    proposal_id: UUID,
    payload: ChordReportCreate,
    request: Request,
    session: DatabaseSession,
    member: OptionalMember,
) -> ChordReportResponse:
    """Anyone may report a published chart. One report per person; rate limited."""
    host = client_host(request)
    service.limiter.hit("report", host, limit=30, window_seconds=3600)
    if member is not None:
        service.limiter.hit("report-member", str(member.id), limit=20, window_seconds=3600)
        reporter_key = f"member:{member.id}"
    else:
        reporter_key = f"anon:{host}"[:80]
    proposal = await get_proposal(session, proposal_id)
    if proposal.status != "published" or proposal.archived_at is not None:
        return ChordReportResponse(status="received", message="Thank you. This chart is not live.")
    if member is not None and proposal.member_id == member.id:
        raise HTTPException(status_code=422, detail="This is your own chart. You can delete it.")
    try:
        created = await service.add_report(
            session,
            proposal=proposal,
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
        return ChordReportResponse(
            status="already_reported",
            message="You already reported this chart. The team will look at it.",
        )
    logger.warning(
        "Chord chart %s reported (%s), %s reports so far",
        proposal.id,
        payload.reason,
        proposal.reports_count,
    )
    return ChordReportResponse(
        status="received", message="Thank you. The team will look at this chart."
    )


# --------------------------------------------------------------------------- review, in the app


async def _queue(
    session: AsyncSession, which: str, limit: int, offset: int
) -> AdminChordProposalList:
    rows, total = await service.admin_queue(session, which=which, limit=limit, offset=offset)
    return AdminChordProposalList(items=[service.admin_out(p, a) for p, a in rows], total=total)


@router.get("/review/queue", response_model=AdminChordProposalList)
async def review_list(
    team: TeamMember,
    session: DatabaseSession,
    filter: AdminFilter = "pending",
    limit: Annotated[int, Query(ge=1, le=100)] = 30,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> AdminChordProposalList:
    return await _queue(session, filter, limit, offset)


@router.post("/review/{proposal_id}/approve", response_model=AdminChordProposalOut)
async def review_approve(
    proposal_id: UUID, team: TeamMember, session: DatabaseSession
) -> AdminChordProposalOut:
    proposal = await get_proposal(session, proposal_id)
    await service.approve(session, proposal, by=service.display_name(team))
    return service.admin_out(proposal, await _author(session, proposal))


@router.post("/review/{proposal_id}/reject", response_model=AdminChordProposalOut)
async def review_reject(
    proposal_id: UUID, payload: RejectRequest, team: TeamMember, session: DatabaseSession
) -> AdminChordProposalOut:
    proposal = await get_proposal(session, proposal_id)
    await service.reject(session, proposal, reason=payload.reason, by=service.display_name(team))
    return service.admin_out(proposal, await _author(session, proposal))


@router.post("/review/{proposal_id}/restore", response_model=AdminChordProposalOut)
async def review_restore(
    proposal_id: UUID, team: TeamMember, session: DatabaseSession
) -> AdminChordProposalOut:
    proposal = await get_proposal(session, proposal_id)
    await service.restore(session, proposal, by=service.display_name(team))
    return service.admin_out(proposal, await _author(session, proposal))


# --------------------------------------------------------------------------- admin key


@admin_router.get("", response_model=AdminChordProposalList)
async def admin_list(
    admin: AdminIdentity,
    session: DatabaseSession,
    filter: AdminFilter = "pending",
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> AdminChordProposalList:
    """The queue: pending (waiting for a first look), reported, published, rejected."""
    return await _queue(session, filter, limit, offset)


@admin_router.post("/{proposal_id}/approve", response_model=AdminChordProposalOut)
async def admin_approve(
    proposal_id: UUID, payload: ReviewRequest, admin: AdminIdentity, session: DatabaseSession
) -> AdminChordProposalOut:
    proposal = await get_proposal(session, proposal_id)
    await service.approve(session, proposal, by=payload.reviewer or admin)
    return service.admin_out(proposal, await _author(session, proposal))


@admin_router.post("/{proposal_id}/reject", response_model=AdminChordProposalOut)
async def admin_reject(
    proposal_id: UUID, payload: RejectRequest, admin: AdminIdentity, session: DatabaseSession
) -> AdminChordProposalOut:
    """Reject (or take down) a chart. The reason is required: the author receives it in a notice."""
    proposal = await get_proposal(session, proposal_id)
    await service.reject(session, proposal, reason=payload.reason, by=payload.reviewer or admin)
    return service.admin_out(proposal, await _author(session, proposal))


@admin_router.post("/{proposal_id}/restore", response_model=AdminChordProposalOut)
async def admin_restore(
    proposal_id: UUID, payload: ReviewRequest, admin: AdminIdentity, session: DatabaseSession
) -> AdminChordProposalOut:
    proposal = await get_proposal(session, proposal_id)
    await service.restore(session, proposal, by=payload.reviewer or admin)
    return service.admin_out(proposal, await _author(session, proposal))
