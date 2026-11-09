"""Broadcasts: a link to a live or announced Zoom, YouTube Live, Facebook or Instagram Live.

Reading is open to everyone. Posting needs a signed-in member. The address is read, never
fetched (`services/broadcasts.parse_broadcast_url`); only a YouTube broadcast is looked at, after
the answer, through the existing oEmbed layer. Anyone may report; the author ends or deletes their
own; the team removes and keeps. Design and guarantees: docs/broadcasts.md.
"""

from __future__ import annotations

import logging
from typing import Annotated, Literal
from uuid import UUID

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    HTTPException,
    Query,
    Request,
    Response,
    status,
)
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.api.v1.extras_common import (
    AppSettings,
    DatabaseSession,
    Member,
    OptionalMember,
    TeamMember,
    client_host,
)
from app.core.db import SessionLocal
from app.models.broadcasts import Broadcast
from app.schemas.broadcasts import (
    BroadcastCreate,
    BroadcastList,
    BroadcastOut,
    BroadcastRemove,
    BroadcastReportCreate,
)
from app.schemas.recording_extras import ReportResponse
from app.services import broadcasts as service
from app.services.extras_common import display_name
from app.services.recordings import is_team_member
from app.services.video_links import VideoRefusedError

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/broadcasts", tags=["broadcasts"])


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    """Where the background look at a YouTube link gets its own session. A test overrides it."""
    return SessionLocal


SessionFactory = Annotated[async_sessionmaker[AsyncSession], Depends(get_session_factory)]


async def _get(session: AsyncSession, broadcast_id: UUID) -> Broadcast:
    row = await session.get(Broadcast, broadcast_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Broadcast not found")
    return row


def _private(response: Response) -> None:
    # the answer depends on who asks (`mine`, `can_remove`): never share it between readers
    response.headers["Cache-Control"] = "private, no-store"


# --------------------------------------------------------------------------- reading


@router.get("", response_model=BroadcastList)
async def list_broadcasts(
    response: Response,
    session: DatabaseSession,
    member: OptionalMember,
    settings: AppSettings,
    which: Annotated[Literal["shelf", "recent"], Query()] = "shelf",
    limit: Annotated[int, Query(ge=1, le=100)] = 40,
) -> BroadcastList:
    """`shelf`: live and upcoming (the Kiirtan screen's shelf). `recent`: those and the ones that
    ended in the last week."""
    _private(response)
    team = member is not None and is_team_member(member, settings)
    viewer = member.id if member else None
    rows = await service.list_public(session, which=which, limit=limit)
    items = [service.public_out(b, viewer_id=viewer, team=team) for b in rows]
    return BroadcastList(items=items, total=len(items))


@router.get("/mine", response_model=BroadcastList)
async def my_broadcasts(
    response: Response, session: DatabaseSession, member: Member, settings: AppSettings
) -> BroadcastList:
    """Everything the member posted, ended and archived ones too."""
    _private(response)
    team = is_team_member(member, settings)
    rows = await service.list_mine(session, member.id)
    items = [service.public_out(b, viewer_id=member.id, team=team) for b in rows]
    return BroadcastList(items=items, total=len(items))


@router.get("/review", response_model=BroadcastList)
async def review(
    response: Response,
    session: DatabaseSession,
    team_member: TeamMember,
    which: Annotated[Literal["reported", "removed"], Query()] = "reported",
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> BroadcastList:
    _private(response)
    rows, total = await service.review_queue(session, which=which, limit=limit, offset=offset)
    return BroadcastList(
        items=[service.public_out(b, viewer_id=team_member.id, team=True) for b in rows],
        total=total,
    )


@router.get("/{broadcast_id}", response_model=BroadcastOut)
async def get_broadcast(
    broadcast_id: UUID,
    response: Response,
    session: DatabaseSession,
    member: OptionalMember,
    settings: AppSettings,
) -> BroadcastOut:
    _private(response)
    row = await _get(session, broadcast_id)
    team = member is not None and is_team_member(member, settings)
    owner = member is not None and row.member_id == member.id
    if not service.can_see(row, owner=owner, team=team):
        raise HTTPException(status_code=404, detail="Broadcast not found")
    return service.public_out(row, viewer_id=member.id if member else None, team=team)


# --------------------------------------------------------------------------- writing


@router.post("", response_model=BroadcastOut, status_code=status.HTTP_201_CREATED)
async def post_broadcast(
    payload: BroadcastCreate,
    session: DatabaseSession,
    member: Member,
    settings: AppSettings,
    background: BackgroundTasks,
    factory: SessionFactory,
) -> BroadcastOut:
    """Post a broadcast. Live at once. Signed-in members only."""
    team = is_team_member(member, settings)
    # what is wrong with the link, the texts or the start is said before anything is counted
    try:
        provider, external_id, url, host = service.parse_broadcast_url(payload.url)
    except VideoRefusedError as error:
        raise service.refusal(error) from error
    title = service.clean_title(payload.title)
    description = service.clean_description(payload.description)
    organizer = service.clean_organizer(payload.organizer)
    starts_at, zone = service.resolve_start(payload.starts_at, payload.timezone)
    try:
        row = await service.create(
            session,
            member=member,
            team=team,
            provider=provider,
            external_id=external_id,
            url=url,
            host=host,
            title=title,
            description=description,
            organizer=organizer,
            starts_at=starts_at,
            zone=zone,
        )
    except SQLAlchemyError as exc:
        await session.rollback()
        logger.exception("Broadcast could not be stored")
        raise HTTPException(
            status_code=503, detail="Broadcasts are temporarily unavailable"
        ) from exc
    if provider == "youtube":
        background.add_task(service.enrich_safely, factory, row.id)
    return service.public_out(row, viewer_id=member.id, team=team)


@router.post("/{broadcast_id}/end", response_model=BroadcastOut)
async def end_broadcast(
    broadcast_id: UUID, session: DatabaseSession, member: Member, settings: AppSettings
) -> BroadcastOut:
    """ "It is over": the author (or the team) closes it before the assumed end."""
    row = await _get(session, broadcast_id)
    team = is_team_member(member, settings)
    if row.member_id != member.id and not team:
        raise HTTPException(status_code=403, detail="Only the person who posted it can do this.")
    await service.end_now(session, row)
    await session.refresh(row)
    return service.public_out(row, viewer_id=member.id, team=team)


@router.delete("/{broadcast_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_broadcast(
    broadcast_id: UUID, session: DatabaseSession, member: Member, settings: AppSettings
) -> Response:
    row = await _get(session, broadcast_id)
    if row.member_id != member.id:
        raise HTTPException(status_code=403, detail="Only the person who posted it can do this.")
    await service.delete_by_author(session, row)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/{broadcast_id}/report", response_model=ReportResponse, status_code=status.HTTP_201_CREATED
)
async def report_broadcast(
    broadcast_id: UUID,
    payload: BroadcastReportCreate,
    request: Request,
    session: DatabaseSession,
    member: OptionalMember,
    settings: AppSettings,
) -> ReportResponse:
    """Anyone may report a link, signed in or not (a broken link, not a broadcast, spam ...). One
    report per person per broadcast. Three reports hide it from the lists until the team looks."""
    host = client_host(request)
    service.limiter.hit("report", host, limit=30, window_seconds=3600)
    if member is not None:
        service.limiter.hit("report-member", str(member.id), limit=20, window_seconds=3600)
        reporter_key = f"member:{member.id}"
    else:
        reporter_key = f"anon:{host}"[:80]
    row = await _get(session, broadcast_id)
    owner = member is not None and row.member_id == member.id
    team = member is not None and is_team_member(member, settings)
    if not service.can_see(row, owner=owner, team=team):
        raise HTTPException(status_code=404, detail="Broadcast not found")
    if row.status == "removed":
        return ReportResponse(
            status="received", message="Thank you. This broadcast is already removed."
        )
    if owner:
        raise HTTPException(
            status_code=422, detail="This is your own broadcast. You can delete it."
        )
    try:
        created = await service.add_report(
            session,
            row=row,
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
            message="You already reported this one. The team will look at it.",
        )
    logger.warning(
        "Broadcast %s reported (%s), %s reports so far", row.id, payload.reason, row.reports_count
    )
    return ReportResponse(
        status="received", message="Thank you. The team will look at this broadcast."
    )


@router.post("/{broadcast_id}/remove", status_code=status.HTTP_204_NO_CONTENT)
async def remove_broadcast(
    broadcast_id: UUID,
    payload: BroadcastRemove,
    session: DatabaseSession,
    team_member: TeamMember,
) -> Response:
    row = await _get(session, broadcast_id)
    await service.remove_by_team(session, row, reason=payload.reason, by=display_name(team_member))
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{broadcast_id}/keep", status_code=status.HTTP_204_NO_CONTENT)
async def keep_broadcast(
    broadcast_id: UUID, session: DatabaseSession, team_member: TeamMember
) -> Response:
    del team_member
    row = await _get(session, broadcast_id)
    await service.keep(session, row)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
