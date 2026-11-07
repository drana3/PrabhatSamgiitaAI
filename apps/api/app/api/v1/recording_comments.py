"""Comments of members under a recording (Kiirtan, Bhajan, Spiritual song, Dance song, Prabhat
Samgiita recording).

The same behaviour as `api/v1/song_comments.py`, aimed at a recording id instead of a song number:
reading is open to everyone, posting needs a signed-in member, anyone may report, the team removes,
the author deletes. Design and guarantees: docs/recording-extras.md.
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
    client_host,
    get_member,  # noqa: F401  (re-exported: tests override it)
    get_optional_member,  # noqa: F401
)
from app.models.recording_extras import RecordingComment
from app.schemas.recording_extras import (
    AdminRecordingCommentList,
    RecordingCommentList,
    RecordingCommentOut,
    RemoveRequest,
    ReportResponse,
)
from app.schemas.song_comments import CommentReportCreate, SongCommentCreate
from app.services import recording_comments as service
from app.services.extras_common import visible_recording
from app.services.recordings import is_team_member

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/recording-comments", tags=["recording-comments"])


async def get_comment(session: AsyncSession, comment_id: UUID) -> RecordingComment:
    comment = await session.get(RecordingComment, comment_id)
    if comment is None:
        raise HTTPException(status_code=404, detail="Comment not found")
    return comment


@router.get("/recordings/{recording_id}", response_model=RecordingCommentList)
async def list_comments(
    recording_id: UUID,
    response: Response,
    session: DatabaseSession,
    member: OptionalMember,
    settings: AppSettings,
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> RecordingCommentList:
    """Comments of one recording, newest first, with a tombstone (`deleted: true`, no text, no author)
    where the author deleted theirs. An anonymous comment has `author: null`: no id, name or avatar,
    for any reader."""
    # The answer depends on who asks (`mine`, `can_remove`): never share it between readers.
    response.headers["Cache-Control"] = "private, no-store"
    await visible_recording(session, recording_id)
    rows, total, live = await service.list_published(
        session, recording_id, limit=limit, offset=offset
    )
    team = member is not None and is_team_member(member, settings)
    viewer = member.id if member else None
    return RecordingCommentList(
        items=[service.public_out(c, a, viewer_id=viewer, team=team) for c, a in rows],
        total=total,
        live_total=live,
        limit=limit,
        offset=offset,
        has_more=offset + len(rows) < total,
    )


@router.post(
    "/recordings/{recording_id}",
    response_model=RecordingCommentOut,
    status_code=status.HTTP_201_CREATED,
)
async def post_comment(
    recording_id: UUID,
    payload: SongCommentCreate,
    session: DatabaseSession,
    member: Member,
    settings: AppSettings,
) -> RecordingCommentOut:
    """Share a comment. Live at once. Signed-in members only."""
    team = is_team_member(member, settings)
    # A post refused for its content (empty, too many links) or for its target costs nothing: it
    # must not use up the hourly allowance (QA-009).
    body = service.validate_body(payload.body)
    await visible_recording(session, recording_id)
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
            recording_id=recording_id,
            body=body,
            is_anonymous=payload.is_anonymous,
            team=team,
        )
    except SQLAlchemyError as exc:
        await session.rollback()
        logger.exception("Recording comment could not be stored")
        raise HTTPException(status_code=503, detail="Comments are temporarily unavailable") from exc
    return service.public_out(comment, member, viewer_id=member.id, team=team)


@router.get("/reported", response_model=AdminRecordingCommentList)
async def reported(
    session: DatabaseSession,
    member: Member,
    settings: AppSettings,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> AdminRecordingCommentList:
    """Team only: comments somebody reported, most reported first. Shows the author, also of an
    anonymous comment (the team needs it to deal with abuse)."""
    if not is_team_member(member, settings):
        raise HTTPException(status_code=403, detail="Only the team can see this.")
    rows, total = await service.reported_queue(session, limit=limit, offset=offset)
    return AdminRecordingCommentList(items=[service.admin_out(c, a) for c, a in rows], total=total)


@router.delete("/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_comment(
    comment_id: UUID,
    session: DatabaseSession,
    member: Member,
    settings: AppSettings,
    payload: RemoveRequest | None = None,
) -> Response:
    """The author deletes their own comment (also an anonymous one): its text is wiped and readers
    see a tombstone, but the row stays and still counts toward the daily allowance. The team
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
    "/{comment_id}/report", response_model=ReportResponse, status_code=status.HTTP_201_CREATED
)
async def report_comment(
    comment_id: UUID,
    payload: CommentReportCreate,
    request: Request,
    session: DatabaseSession,
    member: OptionalMember,
) -> ReportResponse:
    """Anyone may report, signed in or not (as under a song). Nobody reports their own comment: they
    delete it. One report per person per comment; rate limited."""
    host = client_host(request)
    service.limiter.hit("report-recording", host, limit=30, window_seconds=3600)
    if member is not None:
        service.limiter.hit(
            "report-recording-member", str(member.id), limit=20, window_seconds=3600
        )
        reporter_key = f"member:{member.id}"
    else:
        reporter_key = f"anon:{host}"[:80]
    comment = await get_comment(session, comment_id)
    if comment.status == "removed":
        return ReportResponse(
            status="received", message="Thank you. This comment is already removed."
        )
    if member is not None and comment.member_id == member.id:
        raise HTTPException(status_code=422, detail="This is your own comment. You can delete it.")
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
        return ReportResponse(
            status="already_reported",
            message="You already reported this one. The team will look at it.",
        )
    logger.warning(
        "Recording comment %s reported (%s), %s reports so far",
        comment.id,
        payload.reason,
        comment.reports_count,
    )
    return ReportResponse(
        status="received", message="Thank you. The team will look at this comment."
    )
