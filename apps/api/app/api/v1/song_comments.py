"""Comments of members under a Prabhat Samgiita song.

Reading is open to everyone. Posting needs a signed-in member. The same publish-first, report,
team-removal model as the Kiirtan recordings (api/v1/recordings.py); the anonymity rule is in
services/song_comments.py (`public_out`). Design and guarantees: apps/mobile/docs/song-comments.md.
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
from app.models import UserAccount
from app.models.recordings import PS_SONG_COUNT
from app.models.song_comments import SongComment
from app.schemas.song_comments import (
    AdminSongCommentList,
    CommentRemoveRequest,
    CommentReportCreate,
    CommentReportResponse,
    SongCommentCreate,
    SongCommentList,
    SongCommentOut,
)
from app.services import song_comments as service
from app.services.members import require_member_identity, sync_member, try_member_identity
from app.services.recordings import is_team_member

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/song-comments", tags=["song-comments"])

DatabaseSession = Annotated[AsyncSession, Depends(get_session)]
AppSettings = Annotated[Settings, Depends(get_settings)]
SongNumber = Annotated[int, Path(ge=1, le=PS_SONG_COUNT)]


async def get_member(request: Request, session: DatabaseSession) -> UserAccount:
    return await sync_member(session, require_member_identity(request))


async def get_optional_member(request: Request, session: DatabaseSession) -> UserAccount | None:
    identity = try_member_identity(request)
    return await sync_member(session, identity) if identity else None


Member = Annotated[UserAccount, Depends(get_member)]
OptionalMember = Annotated[UserAccount | None, Depends(get_optional_member)]


def client_host(request: Request) -> str:
    return request.client.host if request.client else "unknown"


async def get_comment(session: AsyncSession, comment_id: UUID) -> SongComment:
    comment = await session.get(SongComment, comment_id)
    if comment is None:
        raise HTTPException(status_code=404, detail="Comment not found")
    return comment


# --------------------------------------------------------------------------- reading


@router.get("/songs/{song_id}", response_model=SongCommentList)
async def list_comments(
    song_id: SongNumber,
    response: Response,
    session: DatabaseSession,
    member: OptionalMember,
    settings: AppSettings,
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> SongCommentList:
    """Published comments of one song, newest first.

    An anonymous comment has `author: null`: no id, name or avatar, for any reader.
    """
    # The answer depends on who asks (`mine`, `can_remove`): never share it between readers.
    response.headers["Cache-Control"] = "private, no-store"
    rows, total = await service.list_published(session, song_id, limit=limit, offset=offset)
    team = member is not None and is_team_member(member, settings)
    viewer = member.id if member else None
    return SongCommentList(
        items=[service.public_out(c, a, viewer_id=viewer, team=team) for c, a in rows],
        total=total,
        limit=limit,
        offset=offset,
        has_more=offset + len(rows) < total,
    )


# --------------------------------------------------------------------------- posting


@router.post("/songs/{song_id}", response_model=SongCommentOut, status_code=status.HTTP_201_CREATED)
async def post_comment(
    song_id: SongNumber,
    payload: SongCommentCreate,
    session: DatabaseSession,
    member: Member,
    settings: AppSettings,
) -> SongCommentOut:
    """Share a comment. Live at once. Signed-in members only."""
    team = is_team_member(member, settings)
    # A post refused for its content (empty, too many links) costs nothing: it must not use up the
    # hourly allowance.
    body = service.validate_body(payload.body)
    service.limiter.hit(
        "post",
        str(member.id),
        limit=service.HOURLY_COMMENTS_TEAM if team else service.HOURLY_COMMENTS,
        window_seconds=3600,
    )
    try:
        comment = await service.create_comment(
            session,
            member=member,
            song_id=song_id,
            body=body,
            is_anonymous=payload.is_anonymous,
            team=team,
        )
    except SQLAlchemyError as exc:
        await session.rollback()
        logger.exception("Song comment could not be stored")
        raise HTTPException(status_code=503, detail="Comments are temporarily unavailable") from exc
    return service.public_out(comment, member, viewer_id=member.id, team=team)


# --------------------------------------------------------------------------- moderation


@router.get("/reported", response_model=AdminSongCommentList)
async def reported(
    session: DatabaseSession,
    member: Member,
    settings: AppSettings,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> AdminSongCommentList:
    """Team only: comments somebody reported, most reported first. Shows the author, also of an
    anonymous comment (the team needs it to deal with abuse)."""
    if not is_team_member(member, settings):
        raise HTTPException(status_code=403, detail="Only the team can see this.")
    rows, total = await service.reported_queue(session, limit=limit, offset=offset)
    return AdminSongCommentList(items=[service.admin_out(c, a) for c, a in rows], total=total)


@router.delete("/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_comment(
    comment_id: UUID,
    session: DatabaseSession,
    member: Member,
    settings: AppSettings,
    payload: CommentRemoveRequest | None = None,
) -> Response:
    """The author deletes their own comment (also an anonymous one): it disappears for everybody and
    its text is wiped, but the row stays and still counts toward the daily allowance. A comment the
    team already removed is kept as it is for the record; the author gets the same answer. The team
    removes any comment; that keeps the text and carries a reason."""
    comment = await get_comment(session, comment_id)
    if comment.member_id == member.id:
        if not await service.delete_by_author(session, comment):
            raise HTTPException(status_code=404, detail="Comment not found")
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    if comment.status == "removed" or not is_team_member(member, settings):
        # a stranger learns nothing: a removed or foreign comment looks the same as a missing one
        raise HTTPException(status_code=404, detail="Comment not found")
    await service.remove_by_team(
        session,
        comment,
        reason=payload.reason if payload else "",
        by=member.display_name or str(member.id),
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/{comment_id}/report",
    response_model=CommentReportResponse,
    status_code=status.HTTP_201_CREATED,
)
async def report_comment(
    comment_id: UUID,
    payload: CommentReportCreate,
    request: Request,
    session: DatabaseSession,
    member: OptionalMember,
) -> CommentReportResponse:
    """Anyone may report, signed in or not. One report per person per comment; rate limited."""
    host = client_host(request)
    service.limiter.hit("report", host, limit=30, window_seconds=3600)
    if member is not None:
        service.limiter.hit("report-member", str(member.id), limit=20, window_seconds=3600)
        reporter_key = f"member:{member.id}"
    else:
        reporter_key = f"anon:{host}"[:80]
    comment = await get_comment(session, comment_id)
    if comment.status == "removed":
        return CommentReportResponse(
            status="received", message="Thank you. This comment is already removed."
        )
    try:
        created = await service.add_report(
            session,
            comment=comment,
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
        return CommentReportResponse(
            status="already_reported",
            message="You already reported this one. The team will look at it.",
        )
    logger.warning(
        "Song comment %s reported (%s), %s reports so far",
        comment.id,
        payload.reason,
        comment.reports_count,
    )
    return CommentReportResponse(
        status="received", message="Thank you. The team will look at this comment."
    )
