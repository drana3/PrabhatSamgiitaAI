"""Video links on a recording or on a Prabhat Samgiita song.

Reading is open to everyone. Adding needs a signed-in member. The address is checked and rebuilt by
`services/video_links.parse_video_url` (https, an allow-list of sites, one video); the server never
opens it. Anyone may report; the team removes and restores; the author deletes their own.
Design and guarantees: docs/recording-extras.md.
"""

from __future__ import annotations

import logging
from typing import Annotated
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
    SongNumber,
    TeamMember,
    client_host,
    get_member,  # noqa: F401  (re-exported: tests override it)
    get_optional_member,  # noqa: F401
    get_team_member,  # noqa: F401
)
from app.core.db import SessionLocal
from app.models import UserAccount
from app.models.recording_extras import VideoLink
from app.schemas.recording_extras import (
    AdminVideoList,
    AdminVideoOut,
    RemoveRequest,
    ReportResponse,
    VideoCreate,
    VideoFilter,
    VideoList,
    VideoOut,
    VideoReportCreate,
)
from app.services import video_checks
from app.services import video_links as service
from app.services.extras_common import display_name, visible_recording
from app.services.recordings import is_team_member

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/video-links", tags=["video-links"])


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    """Where the background look at a link gets its own database session (the request's closes with
    the answer). A test overrides it."""
    return SessionLocal


SessionFactory = Annotated[async_sessionmaker[AsyncSession], Depends(get_session_factory)]


async def _look_at_target(factory: async_sessionmaker[AsyncSession], target_key: str) -> None:
    """After the answer: look at the links of this page that are due. Never raises: a failed look
    is no reason to disturb anyone."""
    try:
        async with factory() as session:
            await video_checks.check_target_if_due(session, target_key)
    except Exception:  # noqa: BLE001
        logger.warning("Video link check failed for %s", target_key, exc_info=True)


async def _look_at_one(factory: async_sessionmaker[AsyncSession], video_id: UUID) -> None:
    try:
        async with factory() as session:
            await video_checks.check_one(session, video_id)
    except Exception:  # noqa: BLE001
        logger.warning("Video link check failed for %s", video_id, exc_info=True)


async def get_video(session: AsyncSession, video_id: UUID) -> VideoLink:
    video = await session.get(VideoLink, video_id)
    if video is None:
        raise HTTPException(status_code=404, detail="Video not found")
    return video


async def _list(
    session: AsyncSession,
    response: Response,
    member: UserAccount | None,
    settings: AppSettings,
    target_key: str,
    background: BackgroundTasks,
    factory: async_sessionmaker[AsyncSession],
) -> VideoList:
    # The answer depends on who asks (`mine`, `can_remove`): never share it between readers.
    response.headers["Cache-Control"] = "private, no-store"
    rows = await service.list_published(session, target_key)
    team = member is not None and is_team_member(member, settings)
    viewer = member.id if member else None
    items = [service.public_out(v, a, viewer_id=viewer, team=team) for v, a in rows]
    # links whose last look is old are looked at after the answer (the next reader sees the result)
    if any(video_checks.is_due(v) for v, _ in rows):
        background.add_task(_look_at_target, factory, target_key)
    return VideoList(
        items=items, total=len(items), room=max(0, service.MAX_PER_TARGET - len(items))
    )


async def _add(
    session: AsyncSession,
    member: UserAccount,
    settings: AppSettings,
    payload: VideoCreate,
    *,
    target_key: str,
    song_id: int | None,
    recording_id: UUID | None,
    background: BackgroundTasks,
    factory: async_sessionmaker[AsyncSession],
) -> VideoOut:
    team = is_team_member(member, settings)
    # What is wrong with the link or the title is said before anything is counted.
    try:
        provider, external_id, url = service.parse_video_url(payload.url)
    except service.VideoRefusedError as error:
        raise service.refusal(error) from error
    title = service.clean_title(payload.title)
    try:
        video = await service.create_video(
            session,
            member=member,
            target_key=target_key,
            song_id=song_id,
            recording_id=recording_id,
            provider=provider,
            external_id=external_id,
            url=url,
            title=title,
            is_anonymous=payload.is_anonymous,
            team=team,
        )
    except SQLAlchemyError as exc:
        await session.rollback()
        logger.exception("Video link could not be stored")
        raise HTTPException(status_code=503, detail="Videos are temporarily unavailable") from exc
    # a link that was just added is looked at after the answer: is it alive, may it be shown here?
    background.add_task(_look_at_one, factory, video.id)
    return service.public_out(video, member, viewer_id=member.id, team=team)


# --------------------------------------------------------------------------- reading


@router.get("/songs/{song_id}", response_model=VideoList)
async def list_for_song(
    song_id: SongNumber,
    response: Response,
    session: DatabaseSession,
    member: OptionalMember,
    settings: AppSettings,
    background: BackgroundTasks,
    factory: SessionFactory,
) -> VideoList:
    return await _list(
        session,
        response,
        member,
        settings,
        service.target_key_song(song_id),
        background,
        factory,
    )


@router.get("/recordings/{recording_id}", response_model=VideoList)
async def list_for_recording(
    recording_id: UUID,
    response: Response,
    session: DatabaseSession,
    member: OptionalMember,
    settings: AppSettings,
    background: BackgroundTasks,
    factory: SessionFactory,
) -> VideoList:
    await visible_recording(session, recording_id)
    return await _list(
        session,
        response,
        member,
        settings,
        service.target_key_recording(recording_id),
        background,
        factory,
    )


# --------------------------------------------------------------------------- adding


@router.post("/songs/{song_id}", response_model=VideoOut, status_code=status.HTTP_201_CREATED)
async def add_to_song(
    song_id: SongNumber,
    payload: VideoCreate,
    session: DatabaseSession,
    member: Member,
    settings: AppSettings,
    background: BackgroundTasks,
    factory: SessionFactory,
) -> VideoOut:
    """Add a video to a song. Live at once. Signed-in members only."""
    return await _add(
        session,
        member,
        settings,
        payload,
        target_key=service.target_key_song(song_id),
        song_id=song_id,
        recording_id=None,
        background=background,
        factory=factory,
    )


@router.post(
    "/recordings/{recording_id}", response_model=VideoOut, status_code=status.HTTP_201_CREATED
)
async def add_to_recording(
    recording_id: UUID,
    payload: VideoCreate,
    session: DatabaseSession,
    member: Member,
    settings: AppSettings,
    background: BackgroundTasks,
    factory: SessionFactory,
) -> VideoOut:
    """Add a video to a recording. Live at once. Signed-in members only."""
    await visible_recording(session, recording_id)
    return await _add(
        session,
        member,
        settings,
        payload,
        target_key=service.target_key_recording(recording_id),
        song_id=None,
        recording_id=recording_id,
        background=background,
        factory=factory,
    )


# --------------------------------------------------------------------------- moderation


@router.get("/review", response_model=AdminVideoList)
async def review_list(
    team: TeamMember,
    session: DatabaseSession,
    filter: VideoFilter = "reported",
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> AdminVideoList:
    """Team only: reported links, or the ones the team removed (to restore one). Shows the author,
    also of an anonymous link."""
    rows, total = await service.review_queue(session, which=filter, limit=limit, offset=offset)
    return AdminVideoList(items=[service.admin_out(v, a) for v, a in rows], total=total)


@router.post("/review/recheck")
async def recheck(
    team: TeamMember,
    session: DatabaseSession,
    everything: bool = False,
) -> dict[str, int]:
    """Team only: look at the links that are due now (all of them with `everything=true`; at most
    25 per call). Returns how many were found ok, not embeddable, gone, or unknown."""
    return await video_checks.recheck_due(session, everything=everything)


@router.post("/{video_id}/keep", response_model=AdminVideoOut)
async def keep(video_id: UUID, team: TeamMember, session: DatabaseSession) -> AdminVideoOut:
    """Team only: the reports were looked at and the link stays (the reports leave the queue)."""
    video = await get_video(session, video_id)
    await service.keep(session, video)
    return service.admin_out(video, await session.get(UserAccount, video.member_id))


@router.post("/{video_id}/restore", response_model=AdminVideoOut)
async def restore(video_id: UUID, team: TeamMember, session: DatabaseSession) -> AdminVideoOut:
    video = await get_video(session, video_id)
    await service.restore(session, video)
    return service.admin_out(video, await session.get(UserAccount, video.member_id))


@router.delete("/{video_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_video(
    video_id: UUID,
    session: DatabaseSession,
    member: Member,
    settings: AppSettings,
    payload: RemoveRequest | None = None,
) -> Response:
    """The author deletes their own link (also an anonymous one): it disappears for everybody and
    the row stays so the daily allowance is not given back. The team removes any link, with a
    reason."""
    video = await get_video(session, video_id)
    if video.member_id == member.id:
        if not await service.delete_by_author(session, video):
            raise HTTPException(status_code=404, detail="Video not found")
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    if video.status == "removed" or not is_team_member(member, settings):
        # a stranger learns nothing: a removed or foreign link looks the same as a missing one
        raise HTTPException(status_code=404, detail="Video not found")
    await service.remove_by_team(
        session,
        video,
        reason=payload.reason if payload else "",
        by=display_name(member) if member.display_name else str(member.id),
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/{video_id}/report", response_model=ReportResponse, status_code=status.HTTP_201_CREATED
)
async def report_video(
    video_id: UUID,
    payload: VideoReportCreate,
    request: Request,
    session: DatabaseSession,
    member: OptionalMember,
    background: BackgroundTasks,
    factory: SessionFactory,
) -> ReportResponse:
    """Anyone may report, signed in or not. Nobody reports their own link: they delete it. One
    report per person per link; rate limited."""
    host = client_host(request)
    service.limiter.hit("report", host, limit=30, window_seconds=3600)
    if member is not None:
        service.limiter.hit("report-member", str(member.id), limit=20, window_seconds=3600)
        reporter_key = f"member:{member.id}"
    else:
        reporter_key = f"anon:{host}"[:80]
    video = await get_video(session, video_id)
    if video.status == "removed":
        return ReportResponse(
            status="received", message="Thank you. This video is already removed."
        )
    if member is not None and video.member_id == member.id:
        raise HTTPException(status_code=422, detail="This is your own video. You can delete it.")
    try:
        created = await service.add_report(
            session,
            video=video,
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
    if payload.reason == "broken":
        # "this link does not work": look at it now, so the status says so before the team reads it
        background.add_task(_look_at_one, factory, video.id)
    logger.warning(
        "Video link %s reported (%s), %s reports so far",
        video.id,
        payload.reason,
        video.reports_count,
    )
    return ReportResponse(status="received", message="Thank you. The team will look at this video.")
