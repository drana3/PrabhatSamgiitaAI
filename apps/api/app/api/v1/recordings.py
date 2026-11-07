"""Kiirtan and Bhajan recordings: upload, publish at once, report, block, takedown.

Design: docs/kiirtan-publishing.md.
"""

from __future__ import annotations

import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.core.db import get_session
from app.core.security import require_admin
from app.models import UserAccount
from app.models.recordings import (
    PS_SONG_COUNT,
    AuthorBlock,
    MemberNotice,
    Recording,
    RecordingReport,
)
from app.schemas.recordings import (
    AdminFilter,
    AdminRecordingDetail,
    AdminRecordingList,
    AdminRecordingOut,
    AdminReportOut,
    BlockCreate,
    BlockList,
    DiscardRequest,
    DuplicateOfRequest,
    Kind,
    NoticeOut,
    RecordingCreate,
    RecordingList,
    RecordingOut,
    RemoveRequest,
    ReportCreate,
    ReportResponse,
    ReviewRequest,
    TermsOut,
    UploadRequest,
    UploadTargetResponse,
)
from app.services import recording_collections as sets
from app.services import recordings as service
from app.services.members import require_member_identity, sync_member, try_member_identity
from app.services.recording_storage import (
    LocalDiskStorage,
    RecordingStorage,
    StorageError,
    extension_for,
    get_recording_storage,
    key_belongs_to,
    new_key,
    sniff_audio,
    verify_upload_token,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/recordings", tags=["recordings"])
admin_router = APIRouter(prefix="/admin/recordings", tags=["admin"])

DatabaseSession = Annotated[AsyncSession, Depends(get_session)]
AppSettings = Annotated[Settings, Depends(get_settings)]
AdminIdentity = Annotated[str, Depends(require_admin)]


def get_storage(settings: AppSettings) -> RecordingStorage:
    try:
        return get_recording_storage(settings)
    except StorageError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


Storage = Annotated[RecordingStorage, Depends(get_storage)]


async def get_member(request: Request, session: DatabaseSession) -> UserAccount:
    return await sync_member(session, require_member_identity(request))


async def get_optional_member(request: Request, session: DatabaseSession) -> UserAccount | None:
    identity = try_member_identity(request)
    return await sync_member(session, identity) if identity else None


Member = Annotated[UserAccount, Depends(get_member)]
OptionalMember = Annotated[UserAccount | None, Depends(get_optional_member)]


def client_host(request: Request) -> str:
    return request.client.host if request.client else "unknown"


async def get_recording(session: AsyncSession, recording_id: UUID) -> Recording:
    recording = await session.get(Recording, recording_id)
    if recording is None:
        raise HTTPException(status_code=404, detail="Recording not found")
    return recording


# --------------------------------------------------------------------------- public reading


@router.get("/terms", response_model=TermsOut)
async def terms(settings: AppSettings) -> TermsOut:
    """The version of the content rules the app asks people to accept before the first upload."""
    return TermsOut(version=settings.recording_terms_version)


@router.get("", response_model=RecordingList)
async def list_recordings(
    session: DatabaseSession,
    member: OptionalMember,
    kind: Kind | None = None,
    song_number: Annotated[int | None, Query(ge=1, le=PS_SONG_COUNT)] = None,
    author_id: UUID | None = None,
    q: Annotated[str | None, Query(max_length=100)] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> RecordingList:
    """Published recordings, newest first. `kind` filters by category; `song_number` gives the
    recordings of one Prabhat Samgiita song (the song page).

    Removed ones never show; the viewer's blocked authors are left out.
    """
    rows, total = await service.list_visible(
        session,
        viewer_id=member.id if member else None,
        kind=kind,
        author_id=author_id,
        query=q,
        limit=limit,
        offset=offset,
        song_number=song_number,
    )
    return RecordingList(items=[service.recording_out(r) for r in rows], total=total)


@router.get("/mine", response_model=RecordingList)
async def my_recordings(session: DatabaseSession, member: Member) -> RecordingList:
    """The member's own uploads, including removed ones with the reason."""
    rows = (
        await session.scalars(
            select(Recording)
            .where(Recording.author_id == member.id)
            .order_by(Recording.created_at.desc())
        )
    ).all()
    return RecordingList(
        items=[service.recording_out(r, owner=True) for r in rows], total=len(rows)
    )


# --------------------------------------------------------------------------- blocks and notices


@router.get("/blocks", response_model=BlockList)
async def list_blocks(session: DatabaseSession, member: Member) -> BlockList:
    ids = await service.blocked_author_ids(session, member.id)
    return BlockList(author_ids=[str(i) for i in ids])


@router.post("/blocks", response_model=BlockList, status_code=status.HTTP_201_CREATED)
async def block_author(payload: BlockCreate, session: DatabaseSession, member: Member) -> BlockList:
    try:
        target = UUID(payload.author_id)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="Invalid author id") from exc
    if target == member.id:
        raise HTTPException(status_code=422, detail="You cannot block yourself.")
    if await session.get(UserAccount, target) is None:
        raise HTTPException(status_code=404, detail="Author not found")
    exists = await session.scalar(
        select(AuthorBlock.id).where(
            AuthorBlock.blocker_id == member.id, AuthorBlock.blocked_id == target
        )
    )
    if exists is None:
        session.add(AuthorBlock(blocker_id=member.id, blocked_id=target))
        await session.commit()
    return await list_blocks(session, member)


@router.delete("/blocks/{author_id}", response_model=BlockList)
async def unblock_author(author_id: UUID, session: DatabaseSession, member: Member) -> BlockList:
    row = await session.scalar(
        select(AuthorBlock).where(
            AuthorBlock.blocker_id == member.id, AuthorBlock.blocked_id == author_id
        )
    )
    if row is not None:
        await session.delete(row)
        await session.commit()
    return await list_blocks(session, member)


def _notice_out(notice: MemberNotice) -> NoticeOut:
    return NoticeOut(
        id=str(notice.id),
        kind=notice.kind,
        recording_id=str(notice.recording_id) if notice.recording_id else None,
        title=notice.title,
        body=notice.body,
        payload=dict(notice.payload or {}),
        created_at=notice.created_at,
        read_at=notice.read_at,
    )


@router.get("/notices", response_model=list[NoticeOut])
async def my_notices(
    session: DatabaseSession, member: Member, unread_only: bool = False
) -> list[NoticeOut]:
    """Notices for the bell: a takedown carries the reason and how to appeal."""
    query = select(MemberNotice).where(MemberNotice.user_id == member.id)
    if unread_only:
        query = query.where(MemberNotice.read_at.is_(None))
    rows = (await session.scalars(query.order_by(MemberNotice.created_at.desc()).limit(50))).all()
    return [_notice_out(r) for r in rows]


@router.post("/notices/{notice_id}/read", response_model=NoticeOut)
async def read_notice(notice_id: UUID, session: DatabaseSession, member: Member) -> NoticeOut:
    notice = await session.get(MemberNotice, notice_id)
    if notice is None or notice.user_id != member.id:
        raise HTTPException(status_code=404, detail="Notice not found")
    if notice.read_at is None:
        notice.read_at = service.now_utc()
        await session.commit()
    return _notice_out(notice)


# --------------------------------------------------------------------------- upload


@router.post("/uploads", response_model=UploadTargetResponse, status_code=status.HTTP_201_CREATED)
async def create_upload(
    payload: UploadRequest,
    session: DatabaseSession,
    member: Member,
    settings: AppSettings,
    storage: Storage,
) -> UploadTargetResponse:
    """Step 1: ask where to send the file.

    An exact duplicate is refused here, before the bytes travel.
    """
    team = service.is_team_member(member, settings)
    in_set = payload.collection_id is not None
    service.limiter.hit(
        "upload-set" if in_set else "upload",
        str(member.id),
        limit=(
            (sets.HOURLY_SET_UPLOADS_TEAM if team else sets.HOURLY_SET_UPLOADS)
            if in_set
            else (service.HOURLY_UPLOADS_TEAM if team else service.HOURLY_UPLOADS)
        ),
        window_seconds=3600,
    )
    if payload.collection_id is not None:
        # A track of a playlist from an event: the playlist's cap and its own daily allowance.
        await sets.check_upload_into_set(
            session, set_id=payload.collection_id, member=member, settings=settings, team=team
        )
    else:
        await service.ensure_daily_allowance(session, member.id, settings, team=team)
    extension = extension_for(payload.content_type)
    if extension is None:
        raise HTTPException(status_code=415, detail="Send an MP3, M4A, WAV, OGG or FLAC file.")
    if payload.size_bytes > settings.recording_max_bytes:
        limit_mb = settings.recording_max_bytes // (1024 * 1024)
        raise HTTPException(status_code=413, detail=f"The file is larger than {limit_mb} MB.")
    if payload.sha256:
        existing = await service.exact_duplicate(session, payload.sha256)
        if existing is not None:
            raise HTTPException(
                status_code=409, detail=service.duplicate_detail(existing).model_dump()
            )
    key = new_key(str(member.id), extension)
    target = storage.presign_upload(
        key,
        payload.content_type.split(";")[0].strip().lower(),
        max_bytes=settings.recording_max_bytes,
        expires_in=settings.recording_upload_ttl_seconds,
    )
    return UploadTargetResponse(
        key=target.key,
        method=target.method,
        url=target.url,
        headers=target.headers,
        expires_at=target.expires_at,
        max_bytes=target.max_bytes,
    )


@router.post("/uploads/discard", status_code=status.HTTP_204_NO_CONTENT)
async def discard_upload(
    payload: DiscardRequest, session: DatabaseSession, member: Member, storage: Storage
) -> Response:
    """The author said "Cancel" at the similar-recording question: drop the stored file.

    Only the owner's own file, and only while it is not a published recording.
    """
    if not key_belongs_to(payload.key, str(member.id)):
        raise HTTPException(status_code=403, detail="This upload does not belong to you.")
    if await session.scalar(select(Recording.id).where(Recording.audio_key == payload.key)):
        raise HTTPException(status_code=409, detail="This recording is already published.")
    try:
        await storage.delete(payload.key)
    except StorageError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.put("/uploads/{token}", status_code=status.HTTP_204_NO_CONTENT)
async def put_local_upload(token: str, request: Request, storage: Storage) -> Response:
    """Development only: the local disk adapter takes the bytes itself (R2 takes them directly)."""
    if not isinstance(storage, LocalDiskStorage):
        raise HTTPException(status_code=404, detail="Not found")
    try:
        claims = verify_upload_token(storage.secret, token)
    except StorageError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    limit = int(claims["m"])  # type: ignore[call-overload]
    content_type = request.headers.get("content-type", "").split(";")[0].strip().lower()
    if content_type != claims["c"]:
        raise HTTPException(status_code=415, detail="Wrong content type for this upload.")
    body = await request.body()
    if len(body) > limit:
        raise HTTPException(status_code=413, detail="The audio file is too large.")
    if sniff_audio(body[:16]) is None:
        raise HTTPException(status_code=422, detail="This does not look like an audio file.")
    storage.write(str(claims["k"]), body)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/media/{key:path}")
async def local_media(key: str, session: DatabaseSession, storage: Storage) -> FileResponse:
    """Development only: serve a stored file. A removed recording is not served."""
    if not isinstance(storage, LocalDiskStorage):
        raise HTTPException(status_code=404, detail="Not found")
    try:
        path = storage.path_for(key)
    except StorageError as exc:
        raise HTTPException(status_code=404, detail="Not found") from exc
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Not found")
    state = await session.scalar(select(Recording.status).where(Recording.audio_key == key))
    if state == "removed":
        raise HTTPException(status_code=404, detail="Not found")
    return FileResponse(path)


@router.post("", response_model=RecordingOut, status_code=status.HTTP_201_CREATED)
async def publish_recording(
    payload: RecordingCreate,
    session: DatabaseSession,
    member: Member,
    settings: AppSettings,
    storage: Storage,
) -> RecordingOut:
    """Step 2: the file is stored; publish it. It is live the moment this returns."""
    team = service.is_team_member(member, settings)
    in_set = payload.collection_id is not None
    service.limiter.hit(
        "publish-set" if in_set else "publish",
        str(member.id),
        limit=(
            (sets.HOURLY_SET_UPLOADS_TEAM if team else sets.HOURLY_SET_UPLOADS)
            if in_set
            else (service.HOURLY_UPLOADS_TEAM if team else service.HOURLY_UPLOADS)
        ),
        window_seconds=3600,
    )
    if payload.terms_version != settings.recording_terms_version:
        raise HTTPException(
            status_code=422, detail="The content rules changed. Please read and accept them again."
        )
    try:
        recording, _similar = await service.create_recording(
            session,
            storage=storage,
            settings=settings,
            member_id=member.id,
            member_name=member.display_name,
            payload=payload,
            team=team,
        )
    except SQLAlchemyError as exc:
        await session.rollback()
        logger.exception("Recording could not be stored")
        raise HTTPException(status_code=503, detail="Storage is temporarily unavailable") from exc
    return service.recording_out(recording, owner=True)


# --------------------------------------------------------------------------- one recording


@router.get("/{recording_id}", response_model=RecordingOut)
async def read_recording(
    recording_id: UUID, session: DatabaseSession, member: OptionalMember
) -> RecordingOut:
    recording = await get_recording(session, recording_id)
    owner = member is not None and recording.author_id == member.id
    if recording.status == "removed" and not owner:
        raise HTTPException(status_code=404, detail="Recording not found")
    return service.recording_out(recording, owner=owner)


@router.post("/{recording_id}/play", status_code=status.HTTP_204_NO_CONTENT)
async def count_play(recording_id: UUID, request: Request, session: DatabaseSession) -> Response:
    service.limiter.hit(f"play:{recording_id}", client_host(request), limit=3, window_seconds=600)
    recording = await get_recording(session, recording_id)
    if recording.status != "removed":
        recording.plays = (recording.plays or 0) + 1
        await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/{recording_id}/report", response_model=ReportResponse, status_code=status.HTTP_201_CREATED
)
async def report_recording(
    recording_id: UUID,
    payload: ReportCreate,
    request: Request,
    session: DatabaseSession,
    member: OptionalMember,
    settings: AppSettings,
) -> ReportResponse:
    """Anyone may report, signed in or not. One report per person per recording; rate limited."""
    host = client_host(request)
    service.limiter.hit("report", host, limit=30, window_seconds=3600)
    if member is not None:
        service.limiter.hit("report-member", str(member.id), limit=20, window_seconds=3600)
        reporter_key = f"member:{member.id}"
    else:
        reporter_key = f"anon:{host}"[:80]
    recording = await get_recording(session, recording_id)
    if recording.status == "removed":
        return ReportResponse(
            status="received", message="Thank you. This recording is already removed."
        )
    try:
        created = await service.add_report(
            session,
            recording=recording,
            reporter_key=reporter_key,
            reporter_id=member.id if member else None,
            reason=payload.reason,
            comment=payload.comment,
            flag_threshold=settings.recording_flag_threshold,
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
        "Recording %s reported (%s), %s reports so far",
        recording.id,
        payload.reason,
        recording.reports_count,
    )
    return ReportResponse(
        status="received", message="Thank you. The team will look at this recording."
    )


# --------------------------------------------------------------------------- admin


@admin_router.get("", response_model=AdminRecordingList)
async def admin_list(
    admin: AdminIdentity,
    session: DatabaseSession,
    filter: AdminFilter = "new",
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> AdminRecordingList:
    """The daily queue: new (not reviewed yet), flagged, removed. Newest first, with counts."""
    rows, total = await service.admin_queue(session, which=filter, limit=limit, offset=offset)
    return AdminRecordingList(items=[service.admin_out(r) for r in rows], total=total)


@admin_router.get("/{recording_id}", response_model=AdminRecordingDetail)
async def admin_detail(
    recording_id: UUID, admin: AdminIdentity, session: DatabaseSession
) -> AdminRecordingDetail:
    recording = await get_recording(session, recording_id)
    reports = (
        await session.scalars(
            select(RecordingReport)
            .where(RecordingReport.recording_id == recording.id)
            .order_by(RecordingReport.created_at.desc())
        )
    ).all()
    base = service.admin_out(recording)
    return AdminRecordingDetail(
        **base.model_dump(),
        reports=[
            AdminReportOut(
                id=str(r.id),
                reason=r.reason,  # type: ignore[arg-type]
                comment=r.comment,
                reporter_is_member=r.reporter_id is not None,
                created_at=r.created_at,
            )
            for r in reports
        ],
    )


@admin_router.post("/{recording_id}/remove", response_model=AdminRecordingOut)
async def admin_remove(
    recording_id: UUID,
    payload: RemoveRequest,
    admin: AdminIdentity,
    session: DatabaseSession,
) -> AdminRecordingOut:
    """Take a recording down. The reason is required: the author receives it in a notice."""
    recording = await get_recording(session, recording_id)
    if recording.status == "removed":
        raise HTTPException(status_code=409, detail="Already removed")
    await service.remove_recording(
        session, recording, reason=payload.reason, by=payload.reviewer or admin
    )
    return service.admin_out(recording)


@admin_router.post("/{recording_id}/duplicate-of", response_model=AdminRecordingOut)
async def admin_mark_duplicate(
    recording_id: UUID,
    payload: DuplicateOfRequest,
    admin: AdminIdentity,
    session: DatabaseSession,
) -> AdminRecordingOut:
    """Mark a recording as a duplicate of another: it is removed and the author is told which one
    to listen to instead. Its plays move to the original.
    """
    recording = await get_recording(session, recording_id)
    await service.remove_as_duplicate(
        session, recording, original_id=payload.original_id, by=payload.reviewer or admin
    )
    return service.admin_out(recording)


@admin_router.post("/{recording_id}/restore", response_model=AdminRecordingOut)
async def admin_restore(
    recording_id: UUID,
    payload: ReviewRequest,
    admin: AdminIdentity,
    session: DatabaseSession,
) -> AdminRecordingOut:
    recording = await get_recording(session, recording_id)
    if recording.status != "removed":
        raise HTTPException(status_code=409, detail="Only a removed recording can be restored")
    await service.restore_recording(session, recording, by=payload.reviewer or admin)
    return service.admin_out(recording)


@admin_router.post("/{recording_id}/reviewed", response_model=AdminRecordingOut)
async def admin_reviewed(
    recording_id: UUID,
    payload: ReviewRequest,
    admin: AdminIdentity,
    session: DatabaseSession,
) -> AdminRecordingOut:
    """The team listened and the recording stays (clears the flag)."""
    recording = await get_recording(session, recording_id)
    await service.mark_reviewed(session, recording, by=payload.reviewer or admin)
    return service.admin_out(recording)
