"""Broadcasts: a link to a live or announced Zoom, YouTube Live, Facebook or Instagram Live.

Reading is open to everyone. Posting needs a signed-in member. The address is read, never
fetched (`services/broadcasts.parse_broadcast_url`); only a YouTube broadcast is looked at, after
the answer, through the existing oEmbed layer. Anyone may report; the author ends or deletes their
own; the team keeps, hides and removes (with a reason the author reads) and sees the history. A
YouTube broadcast is asked about at the YouTube Data API (key from the environment only; without
it the organizer's clock rules). The recording of an ended broadcast is a link or a library
recording. Design and guarantees: docs/broadcasts.md.
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
from app.models.broadcasts import Broadcast, BroadcastRecording
from app.schemas.broadcasts import (
    BroadcastCreate,
    BroadcastDecisionList,
    BroadcastList,
    BroadcastOut,
    BroadcastRecordingCreate,
    BroadcastRecordingOut,
    BroadcastRemove,
    BroadcastReportCreate,
    BroadcastReviewList,
    RecordingSuggestionList,
    RecordingSuggestionOut,
)
from app.schemas.recording_extras import ReportResponse
from app.services import broadcast_recordings as recordings
from app.services import broadcast_review as review_service
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
    rows = await service.list_public(session, which=which, limit=limit, settings=settings)
    items = await recordings.present(session, rows, viewer_id=viewer, team=team)
    return BroadcastList(items=items, total=len(items))


@router.get("/mine", response_model=BroadcastList)
async def my_broadcasts(
    response: Response, session: DatabaseSession, member: Member, settings: AppSettings
) -> BroadcastList:
    """Everything the member posted, ended and archived ones too."""
    _private(response)
    team = is_team_member(member, settings)
    rows = await service.list_mine(session, member.id, settings=settings)
    items = await recordings.present(session, rows, viewer_id=member.id, team=team)
    return BroadcastList(items=items, total=len(items))


@router.get("/review", response_model=BroadcastReviewList)
async def review(
    response: Response,
    session: DatabaseSession,
    team_member: TeamMember,
    which: Annotated[Literal["queue", "reported", "hidden", "removed"], Query()] = "queue",
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> BroadcastReviewList:
    """The team's queue: `queue` (reports not yet judged, the ones hidden by them first; `reported`
    is the old name), `hidden` (by the team), `removed`. Team only, checked here on the server."""
    _private(response)
    rows, total = await review_service.queue(session, which=which, limit=limit, offset=offset)
    return BroadcastReviewList(
        items=await review_service.present(session, rows, viewer_id=team_member.id), total=total
    )


@router.get("/decisions", response_model=BroadcastDecisionList)
async def decisions(
    response: Response,
    session: DatabaseSession,
    team_member: TeamMember,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> BroadcastDecisionList:
    """The history of the team's verdicts, newest first."""
    del team_member
    _private(response)
    items, total = await review_service.history(session, limit=limit, offset=offset)
    return BroadcastDecisionList(items=items, total=total)


@router.get("/recording-suggestions", response_model=RecordingSuggestionList)
async def recording_suggestions(
    response: Response,
    session: DatabaseSession,
    team_member: TeamMember,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> RecordingSuggestionList:
    """Recordings that members suggested for ended broadcasts, waiting for the team."""
    _private(response)
    rows, total = await recordings.suggestions(session, limit=limit, offset=offset)
    items = []
    for link, b, title in rows:
        shown = await recordings.load(session, [b.id], viewer_id=team_member.id, team=True)
        mine = next((r for r in shown.get(b.id, []) if r.id == str(link.id)), None)
        if mine is None:  # a library recording that was removed since
            continue
        del title
        items.append(
            RecordingSuggestionOut(
                id=str(link.id), broadcast_id=str(b.id), broadcast_title=b.title, recording=mine
            )
        )
    return RecordingSuggestionList(items=items, total=total)


async def _suggestion(session: AsyncSession, link_id: UUID) -> BroadcastRecording:
    link = await session.get(BroadcastRecording, link_id)
    if link is None:
        raise HTTPException(status_code=404, detail="Recording not found")
    return link


@router.post("/recording-suggestions/{link_id}/accept", status_code=status.HTTP_204_NO_CONTENT)
async def accept_recording(
    link_id: UUID, session: DatabaseSession, team_member: TeamMember
) -> Response:
    link = await _suggestion(session, link_id)
    await recordings.decide(session, link, accept=True, by=display_name(team_member))
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/recording-suggestions/{link_id}/reject", status_code=status.HTTP_204_NO_CONTENT)
async def reject_recording(
    link_id: UUID, session: DatabaseSession, team_member: TeamMember
) -> Response:
    link = await _suggestion(session, link_id)
    await recordings.decide(session, link, accept=False, by=display_name(team_member))
    return Response(status_code=status.HTTP_204_NO_CONTENT)


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
    await service.refresh_status(session, [row], settings)
    has_recording = await recordings.has_accepted(session, row.id)
    if not service.can_see(row, owner=owner, team=team, has_recording=has_recording):
        raise HTTPException(status_code=404, detail="Broadcast not found")
    viewer = member.id if member else None
    return (await recordings.present(session, [row], viewer_id=viewer, team=team))[0]


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
    ends_at = service.resolve_end(payload.ends_at, payload.timezone, starts_at=starts_at)
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
            ends_at=ends_at,
        )
    except SQLAlchemyError as exc:
        await session.rollback()
        logger.exception("Broadcast could not be stored")
        raise HTTPException(
            status_code=503, detail="Broadcasts are temporarily unavailable"
        ) from exc
    if provider == "youtube":
        background.add_task(service.enrich_safely, factory, row.id)
    return (await recordings.present(session, [row], viewer_id=member.id, team=team))[0]


@router.post("/{broadcast_id}/end", response_model=BroadcastOut)
async def end_broadcast(
    broadcast_id: UUID, session: DatabaseSession, member: Member, settings: AppSettings
) -> BroadcastOut:
    """ "It is over": the author (or the team) closes it before its end."""
    row = await _get(session, broadcast_id)
    team = is_team_member(member, settings)
    if row.member_id != member.id and not team:
        raise HTTPException(status_code=403, detail="Only the person who posted it can do this.")
    await service.end_now(session, row)
    await session.refresh(row)
    return (await recordings.present(session, [row], viewer_id=member.id, team=team))[0]


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
    report per person (or per network, when anonymous) per broadcast. Every report reaches the
    team's queue, but only reports of established members count towards hiding: two of them (or
    one from the team) hide the broadcast from the lists until the team looks."""
    host = client_host(request)
    service.limiter.hit("report", host, limit=30, window_seconds=3600)
    if member is not None:
        service.limiter.hit("report-member", str(member.id), limit=20, window_seconds=3600)
        reporter_key = f"member:{member.id}"
    else:
        reporter_key = service.anonymous_key(host)
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
            weight=service.report_weight(member=member, team=team),
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
        "Broadcast %s reported (%s), counted weight %s", row.id, payload.reason, row.reports_count
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
    """Remove it for everybody but the team. The reason is required: the author reads it in their
    notifications."""
    row = await _get(session, broadcast_id)
    await review_service.remove(session, row, reason=payload.reason, by=display_name(team_member))
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{broadcast_id}/hide", status_code=status.HTTP_204_NO_CONTENT)
async def hide_broadcast(
    broadcast_id: UUID,
    payload: BroadcastRemove,
    session: DatabaseSession,
    team_member: TeamMember,
) -> Response:
    """Take it off the lists; the author and the team still read it. Needs a reason."""
    row = await _get(session, broadcast_id)
    await review_service.hide(session, row, reason=payload.reason, by=display_name(team_member))
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{broadcast_id}/keep", status_code=status.HTTP_204_NO_CONTENT)
async def keep_broadcast(
    broadcast_id: UUID, session: DatabaseSession, team_member: TeamMember
) -> Response:
    """ "The reports were not right": clears them, remembers who looked and how many people had
    reported, shows the broadcast again if it was hidden."""
    row = await _get(session, broadcast_id)
    await review_service.keep(session, row, by=display_name(team_member))
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --------------------------------------------------------------------------- the recording


@router.post(
    "/{broadcast_id}/recordings",
    response_model=BroadcastRecordingOut,
    status_code=status.HTTP_201_CREATED,
)
async def add_recording(
    broadcast_id: UUID,
    payload: BroadcastRecordingCreate,
    session: DatabaseSession,
    member: Member,
    settings: AppSettings,
) -> BroadcastRecordingOut:
    """Add (the author, the team) or suggest (any other member: the team decides) the LINK of the
    recording of an ended broadcast. A library recording goes through the upload wizard instead
    (`broadcast_id` of the recording payload)."""
    row = await _get(session, broadcast_id)
    team = is_team_member(member, settings)
    link = await recordings.add_link(session, row, member=member, team=team, raw_url=payload.url)
    shown = await recordings.load(session, [row.id], viewer_id=member.id, team=team)
    return next(r for r in shown[row.id] if r.id == str(link.id))


@router.delete("/{broadcast_id}/recordings/{link_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_recording(
    broadcast_id: UUID,
    link_id: UUID,
    session: DatabaseSession,
    member: Member,
    settings: AppSettings,
) -> Response:
    """Take a recording off the broadcast (its author, the team, or the member who suggested it).
    A library recording itself stays in the library."""
    row = await _get(session, broadcast_id)
    link = await session.get(BroadcastRecording, link_id)
    if link is None or link.broadcast_id != row.id:
        raise HTTPException(status_code=404, detail="Recording not found")
    allowed = (
        row.member_id == member.id
        or is_team_member(member, settings)
        or (link.member_id == member.id and link.status == "pending")
    )
    if not allowed:
        raise HTTPException(status_code=403, detail="Only the person who posted it can do this.")
    await recordings.remove_link(session, link)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
