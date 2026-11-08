"""Author profiles, their directory, reports, the team tools, and the play counter.

Three routers (docs/author-profiles.md has the table of every endpoint):

* `/authors`        the member's own page (`/me`), the public page by address, the directory.
* `/plays`          the phone reports counted listens in batches.
* `/admin/authors`  the team: look at, approve, verify, suspend.

Errors that a person can fix come back as `{"detail": {"code": "...", "message": "..."}}` so the app
shows its own sentence for each code in the member's language.
"""

from __future__ import annotations

import logging
import re
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import UTC
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.core.db import get_session
from app.models import UserAccount
from app.models.author_profiles import AuthorProfile, AuthorProfilePhoto, AuthorReport
from app.models.recordings import Recording
from app.schemas.author_profiles import (
    AdminAuthorList,
    AdminAuthorOut,
    AdminReportOut,
    AuthorLine,
    AuthorList,
    AuthorProfileCreate,
    AuthorProfileOwner,
    AuthorProfilePatch,
    AuthorProfilePublic,
    AuthorRecordingList,
    AuthorRecordingOut,
    CollectionList,
    OwnerRecordingList,
    OwnerRecordingOut,
    OwnerResponse,
    OwnerStats,
    PlayBatchIn,
    PlayBatchOut,
    ReportCreate,
    ReportResponse,
    ShownWrite,
    SlugCheck,
    SuspendRequest,
    SuspensionOut,
)
from app.services import author_profiles as service
from app.services import author_stats as stats
from app.services import song_plays as song_stats
from app.services.members import require_member_identity, sync_member, try_member_identity
from app.services.recordings import VISIBLE, is_team_member, limiter, recording_out

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/authors", tags=["authors"])
plays_router = APIRouter(prefix="/plays", tags=["authors"])
admin_router = APIRouter(prefix="/admin/authors", tags=["admin"])

DatabaseSession = Annotated[AsyncSession, Depends(get_session)]
AppSettings = Annotated[Settings, Depends(get_settings)]

# Limits that stop a script, not a person (one place each).
# Tries (a refused name is a try), not pages: finding a free name must not run into a wall.
CREATE_TRIES_PER_HOUR = 20
CREATE_TRIES_PER_DAY_PER_HOST = 60
# Making and deleting pages again and again is the abuse (it frees and re-takes addresses).
DELETES_PER_DAY = 5
STATS_PERIODS = (7, 30, 90)
EDITS_PER_HOUR = 40
SLUG_CHECKS_PER_MINUTE = 60
REPORTS_PER_HOUR = 5
PLAY_BATCHES_PER_MINUTE_PER_HOST = 120
PLAY_BATCHES_PER_HOUR_PER_LISTENER = 600
DEVICE_ID = re.compile(r"^[A-Za-z0-9_-]{8,64}$")


async def get_member(request: Request, session: DatabaseSession) -> UserAccount:
    return await sync_member(session, require_member_identity(request))


async def get_optional_member(request: Request, session: DatabaseSession) -> UserAccount | None:
    identity = try_member_identity(request)
    return await sync_member(session, identity) if identity else None


Member = Annotated[UserAccount, Depends(get_member)]
OptionalMember = Annotated[UserAccount | None, Depends(get_optional_member)]


async def get_team_member(member: Member, settings: AppSettings) -> UserAccount:
    if not is_team_member(member, settings):
        raise HTTPException(status_code=403, detail="Team members only")
    return member


Team = Annotated[UserAccount, Depends(get_team_member)]


def client_host(request: Request) -> str:
    return request.client.host if request.client else "unknown"


@contextmanager
def errors() -> Iterator[None]:
    try:
        yield
    except service.AuthorError as exc:
        raise HTTPException(
            status_code=exc.status, detail={"code": exc.code, "message": exc.message}
        ) from exc


async def own_profile(session: AsyncSession, member: UserAccount) -> AuthorProfile:
    profile = await service.profile_of_member(session, member.id)
    if profile is None:
        raise HTTPException(
            status_code=404, detail={"code": "no_profile", "message": "You have no author page yet"}
        )
    return profile


def edit_limit(member: UserAccount) -> None:
    limiter.hit("author-edit", str(member.id), limit=EDITS_PER_HOUR, window_seconds=3600)


async def public_profile(session: AsyncSession, slug: str) -> AuthorProfile:
    """The published page of an address, or the right error (404 unknown, 410 deleted)."""
    resolved = await service.resolve_slug(session, slug)
    if resolved.kind == "profile" and resolved.profile is not None:
        return resolved.profile
    if resolved.kind == "gone":
        raise HTTPException(
            status_code=410, detail={"code": "gone", "message": "This page was deleted"}
        )
    if resolved.kind == "redirect" and resolved.slug:
        raise HTTPException(
            status_code=301,
            detail={"code": "moved", "message": "This page moved", "slug": resolved.slug},
            headers={"Location": f"/api/v1/authors/{resolved.slug}"},
        )
    raise HTTPException(status_code=404, detail={"code": "not_found", "message": "Page not found"})


# --------------------------------------------------------------------------- the member's own page


@router.get("/slug-check", response_model=SlugCheck)
async def slug_check(
    request: Request,
    session: DatabaseSession,
    member: OptionalMember,
    slug: Annotated[str, Query(min_length=1, max_length=80)],
) -> SlugCheck:
    limiter.hit(
        "author-slug", client_host(request), limit=SLUG_CHECKS_PER_MINUTE, window_seconds=60
    )
    own = await service.profile_of_member(session, member.id) if member else None
    return SlugCheck(**await service.check_slug(session, slug, own=own))


@router.get("/me", response_model=OwnerResponse)
async def read_own(session: DatabaseSession, member: Member) -> OwnerResponse:
    profile = await service.profile_of_member(session, member.id)
    suspension = await service.suspension_of(session, member.id)
    return OwnerResponse(
        profile=await service.owner_out(session, profile) if profile else None,
        can_create=profile is None and suspension is None,
        suspended_reason=suspension.reason if suspension else None,
    )


@router.post("/me", response_model=AuthorProfileOwner, status_code=status.HTTP_201_CREATED)
async def create_own(
    payload: AuthorProfileCreate, request: Request, session: DatabaseSession, member: Member
) -> AuthorProfileOwner:
    limiter.hit("author-create", str(member.id), limit=CREATE_TRIES_PER_HOUR, window_seconds=3600)
    limiter.hit(
        "author-create-ip",
        client_host(request),
        limit=CREATE_TRIES_PER_DAY_PER_HOST,
        window_seconds=86400,
    )
    with errors():
        profile = await service.create_profile(session, member, payload)
    return await service.owner_out(session, profile)


@router.patch("/me", response_model=AuthorProfileOwner)
async def update_own(
    payload: AuthorProfilePatch, session: DatabaseSession, member: Member
) -> AuthorProfileOwner:
    edit_limit(member)
    profile = await own_profile(session, member)
    with errors():
        profile = await service.update_profile(session, profile, payload)
    return await service.owner_out(session, profile)


@router.post("/me/publish", response_model=AuthorProfileOwner)
async def publish_own(session: DatabaseSession, member: Member) -> AuthorProfileOwner:
    edit_limit(member)
    profile = await own_profile(session, member)
    with errors():
        profile = await service.publish_profile(session, profile)
    return await service.owner_out(session, profile)


@router.post("/me/unpublish", response_model=AuthorProfileOwner)
async def unpublish_own(session: DatabaseSession, member: Member) -> AuthorProfileOwner:
    edit_limit(member)
    profile = await own_profile(session, member)
    with errors():
        profile = await service.unpublish_profile(session, profile)
    return await service.owner_out(session, profile)


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_own(session: DatabaseSession, member: Member) -> Response:
    limiter.hit("author-delete", str(member.id), limit=DELETES_PER_DAY, window_seconds=86400)
    profile = await own_profile(session, member)
    await service.delete_profile(session, profile)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/me/export")
async def export_own(session: DatabaseSession, member: Member) -> dict[str, object]:
    return await service.export_member(session, member)


@router.put("/me/photo", response_model=AuthorProfileOwner)
async def put_photo(
    request: Request, session: DatabaseSession, member: Member
) -> AuthorProfileOwner:
    """The body is the picture itself (JPEG, PNG or WebP, at most 300 KB). The phone makes it
    small."""
    edit_limit(member)
    profile = await own_profile(session, member)
    declared = request.headers.get("content-length")
    if declared and declared.isdigit() and int(declared) > service.PHOTO_MAX_BYTES * 2:
        raise HTTPException(status_code=413, detail={"code": "photo_too_big", "message": "Too big"})
    data = await request.body()
    with errors():
        await service.set_photo(session, profile, data)
    return await service.owner_out(session, profile)


@router.delete("/me/photo", response_model=AuthorProfileOwner)
async def delete_photo(session: DatabaseSession, member: Member) -> AuthorProfileOwner:
    edit_limit(member)
    profile = await own_profile(session, member)
    await service.remove_photo(session, profile)
    return await service.owner_out(session, profile)


@router.get("/me/recordings", response_model=OwnerRecordingList)
async def own_recordings(
    session: DatabaseSession,
    member: Member,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> OwnerRecordingList:
    profile = await own_profile(session, member)
    rows, total = await service.owner_recordings(session, profile, limit=limit, offset=offset)
    return OwnerRecordingList(
        items=[
            OwnerRecordingOut(
                recording=recording_out(r.recording, owner=True),
                shown=r.shown,
                exception=r.exception,
            )
            for r in rows
        ],
        total=total,
    )


@router.put("/me/recordings/{recording_id}", status_code=status.HTTP_204_NO_CONTENT)
async def own_recording_shown(
    recording_id: UUID, payload: ShownWrite, session: DatabaseSession, member: Member
) -> Response:
    edit_limit(member)
    profile = await own_profile(session, member)
    with errors():
        await service.set_shown(session, profile, recording_id, payload.shown)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/me/stats", response_model=OwnerStats)
async def own_stats(
    session: DatabaseSession,
    member: Member,
    days: Annotated[int, Query(description="7, 30 or 90")] = 30,
) -> OwnerStats:
    if days not in STATS_PERIODS:
        raise HTTPException(
            status_code=422, detail={"code": "period", "message": "days must be 7, 30 or 90"}
        )
    profile = await own_profile(session, member)
    return await service.owner_stats(session, profile, days=days)


# --------------------------------------------------------------------------- public reading


@router.get("", response_model=AuthorList)
async def list_authors(
    session: DatabaseSession,
    member: OptionalMember,
    q: Annotated[str | None, Query(max_length=80)] = None,
    sort: Literal["listeners", "new", "name"] = "listeners",
    kind: Annotated[
        Literal[
            "kiirtan", "bhajan", "prabhat_samgiita", "spiritual_song", "dance_song", "baba_audio"
        ]
        | None,
        Query(description="only authors who hold a recording of this kind"),
    ] = None,
    language: Annotated[
        Literal["bengali", "sanskrit", "hindi", "english", "spanish", "russian", "other"] | None,
        Query(description="only authors who list this language"),
    ] = None,
    limit: Annotated[int, Query(ge=1, le=service.DIRECTORY_MAX_LIMIT)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> AuthorList:
    items, total = await service.directory(
        session,
        viewer_id=member.id if member else None,
        query=q,
        sort=sort,
        limit=limit,
        offset=offset,
        kind=kind,
        language=language,
    )
    return AuthorList(
        items=items, total=total, limit=limit, offset=offset, has_more=offset + len(items) < total
    )


@router.get("/sitemap")
async def sitemap(session: DatabaseSession, response: Response) -> dict[str, list[dict[str, str]]]:
    """Addresses a search engine may list (the web app builds sitemap.xml from this)."""
    entries = await service.sitemap_entries(session)
    response.headers["Cache-Control"] = "public, max-age=300"
    return {
        "items": [
            {"slug": slug, "updated_at": service.aware(updated).astimezone(UTC).isoformat()}  # type: ignore[union-attr]
            for slug, updated in entries
        ]
    }


@router.get("/by-recording/{recording_id}", response_model=AuthorLine)
async def line_of_recording(recording_id: UUID, session: DatabaseSession) -> AuthorLine:
    """ "By <author>" under a recording: the published page this recording is on, or `profile:
    null`."""
    recording = await session.get(Recording, recording_id)
    if recording is None or recording.status not in VISIBLE:
        raise HTTPException(status_code=404, detail="Recording not found")
    return AuthorLine(profile=await service.line_for_recording(session, recording))


@router.get("/{slug}", response_model=AuthorProfilePublic)
async def read_public(
    slug: str, session: DatabaseSession, response: Response
) -> AuthorProfilePublic | JSONResponse:
    resolved = await service.resolve_slug(session, slug)
    if resolved.kind == "redirect" and resolved.slug:
        return JSONResponse(
            status_code=301,
            content={"code": "moved", "slug": resolved.slug},
            headers={"Location": f"/api/v1/authors/{resolved.slug}"},
        )
    profile = await public_profile(session, slug)
    response.headers["Cache-Control"] = "public, max-age=60"
    return await service.public_out(session, profile)


@router.get("/{slug}/photo")
async def read_photo(slug: str, session: DatabaseSession, member: OptionalMember) -> Response:
    resolved = await service.resolve_slug(session, slug)
    profile = resolved.profile if resolved.kind == "profile" else None
    private = False
    if profile is None and member is not None:
        mine = await service.profile_of_member(session, member.id)
        if mine is not None and slug in (mine.slug, str(mine.id)):
            profile, private = mine, True
    if profile is None or not profile.photo_version:
        raise HTTPException(status_code=404, detail="No picture")
    photo = await session.get(AuthorProfilePhoto, profile.id)
    if photo is None:
        raise HTTPException(status_code=404, detail="No picture")
    return Response(
        content=photo.data,
        media_type=photo.mime,
        headers={
            "Cache-Control": "private, max-age=60" if private else "public, max-age=86400",
            "ETag": f'"{photo.sha256[:16]}"',
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.get("/{slug}/recordings", response_model=AuthorRecordingList)
async def public_recordings(
    slug: str,
    session: DatabaseSession,
    member: OptionalMember,
    kind: Literal[
        "kiirtan", "bhajan", "prabhat_samgiita", "spiritual_song", "dance_song", "baba_audio"
    ]
    | None = None,
    collection_id: UUID | None = None,
    exclude: UUID | None = None,
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> AuthorRecordingList:
    profile = await public_profile(session, slug)
    rows, total = await service.list_recordings(
        session,
        profile,
        viewer_id=member.id if member else None,
        kind=kind,
        collection_id=collection_id,
        exclude=exclude,
        limit=limit,
        offset=offset,
    )
    return AuthorRecordingList(
        items=[
            AuthorRecordingOut(
                **{
                    **recording_out(r).model_dump(),
                    "plays": r.plays if profile.show_stats else None,
                }
            )
            for r in rows
        ],
        total=total,
        limit=limit,
        offset=offset,
        has_more=offset + len(rows) < total,
    )


@router.get("/{slug}/collections", response_model=CollectionList)
async def public_collections(slug: str, session: DatabaseSession) -> CollectionList:
    profile = await public_profile(session, slug)
    return CollectionList(items=await service.collections_of(session, profile))


@router.post("/{slug}/report", response_model=ReportResponse)
async def report_author(
    slug: str,
    payload: ReportCreate,
    request: Request,
    session: DatabaseSession,
    member: OptionalMember,
    settings: AppSettings,
) -> ReportResponse:
    profile = await public_profile(session, slug)
    key = service.reporter_key(settings, member, client_host(request))
    limiter.hit("author-report", key, limit=REPORTS_PER_HOUR, window_seconds=3600)
    with errors():
        new = await service.report_profile(
            session,
            profile,
            key=key,
            reporter_id=member.id if member else None,
            reason=payload.reason,
            comment=payload.comment,
        )
    if new:
        return ReportResponse(
            status="received", message="Thank you. The team will look at this page."
        )
    return ReportResponse(status="already_reported", message="You have already reported this page.")


# --------------------------------------------------------------------------- plays


@plays_router.post("", response_model=PlayBatchOut)
async def report_plays(
    payload: PlayBatchIn,
    request: Request,
    session: DatabaseSession,
    member: OptionalMember,
    settings: AppSettings,
) -> PlayBatchOut:
    """A batch of listens the phone counted. Each one is checked again here (length, age,
    duplicates)."""
    limiter.hit(
        "plays-host",
        client_host(request),
        limit=PLAY_BATCHES_PER_MINUTE_PER_HOST,
        window_seconds=60,
    )
    if member is not None:
        who = f"m:{member.id}"
    elif payload.device_id and DEVICE_ID.match(payload.device_id):
        who = f"d:{payload.device_id}"
    else:
        raise HTTPException(
            status_code=400,
            detail={"code": "listener_required", "message": "Send a device_id or sign in"},
        )
    limiter.hit(
        "plays-listener", who, limit=PLAY_BATCHES_PER_HOUR_PER_LISTENER, window_seconds=3600
    )
    recording_events = [e for e in payload.events if e.recording_id is not None]
    song_events = [e for e in payload.events if e.song_number is not None]
    over_limit = 0
    if song_events:
        # one batch limit for both kinds: the first MAX_EVENTS_PER_BATCH events in the order sent
        kept = payload.events[: stats.MAX_EVENTS_PER_BATCH]
        over_limit = len(payload.events) - len(kept)
        recording_events = [e for e in kept if e.recording_id is not None]
        song_events = [e for e in kept if e.song_number is not None]
    result = await stats.ingest_plays(
        session,
        pepper=service.pepper(settings),
        who=who,
        owner_member_id=member.id if member else None,
        country=payload.region,
        client=client_host(request),
        events=[
            stats.PlayIn(
                recording_id=e.recording_id,  # type: ignore[arg-type]
                played_at=e.played_at,
                listened_sec=e.listened_sec,
                duration_sec=e.duration_sec,
            )
            for e in recording_events
        ],
    )
    if song_events:
        songs = await song_stats.ingest_song_plays(
            session,
            pepper=service.pepper(settings),
            who=who,
            client=client_host(request),
            events=[
                song_stats.SongPlayIn(
                    song_number=e.song_number,  # type: ignore[arg-type]
                    played_at=e.played_at,
                    listened_sec=e.listened_sec,
                )
                for e in song_events
            ],
        )
        result.accepted += songs.accepted
        result.duplicates += songs.duplicates
        for why, n in songs.rejected.items():
            result.rejected[why] = result.rejected.get(why, 0) + n
        if over_limit:
            result.rejected["batch_limit"] = result.rejected.get("batch_limit", 0) + over_limit
    try:
        await stats.prune_play_events(session)
    except Exception:  # pruning must never fail a listener's request
        logger.exception("play_events prune failed")
    return PlayBatchOut(
        accepted=result.accepted, duplicates=result.duplicates, rejected=result.rejected
    )


# --------------------------------------------------------------------------- the team


async def _admin_profile(session: AsyncSession, profile_id: UUID) -> AuthorProfile:
    profile = await session.get(AuthorProfile, profile_id)
    if profile is None:
        raise HTTPException(status_code=404, detail="Author page not found")
    return profile


def _by(team: UserAccount) -> str:
    return team.email or str(team.id)


@admin_router.get("", response_model=AdminAuthorList)
async def admin_list(
    session: DatabaseSession,
    team: Team,
    status_filter: Annotated[
        Literal["draft", "published", "suspended"] | None, Query(alias="status")
    ] = None,
    needs_review: bool | None = None,
    reported: bool | None = None,
    q: Annotated[str | None, Query(max_length=80)] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> AdminAuthorList:
    items, total = await service.admin_list(
        session,
        status=status_filter,
        needs_review=needs_review,
        reported=reported,
        query=q,
        limit=limit,
        offset=offset,
    )
    return AdminAuthorList(items=items, total=total)


@admin_router.get("/{profile_id}/reports", response_model=list[AdminReportOut])
async def admin_reports(
    profile_id: UUID, session: DatabaseSession, team: Team
) -> list[AdminReportOut]:
    from sqlalchemy import select

    await _admin_profile(session, profile_id)
    rows = (
        await session.scalars(
            select(AuthorReport)
            .where(AuthorReport.profile_id == profile_id)
            .order_by(AuthorReport.created_at.desc())
        )
    ).all()
    return [
        AdminReportOut(
            id=str(r.id),
            reason=r.reason,  # type: ignore[arg-type]
            comment=r.comment,
            status=r.status,
            created_at=r.created_at,
        )
        for r in rows
    ]


async def _admin_out(session: AsyncSession, profile: AuthorProfile) -> AdminAuthorOut:
    await session.refresh(profile)
    return service.admin_out(profile, await service.count_recordings(session, profile))


@admin_router.post("/{profile_id}/approve", response_model=AdminAuthorOut)
async def admin_approve(profile_id: UUID, session: DatabaseSession, team: Team) -> AdminAuthorOut:
    profile = await service.admin_approve(
        session, await _admin_profile(session, profile_id), _by(team)
    )
    return await _admin_out(session, profile)


@admin_router.post("/{profile_id}/verify", response_model=AdminAuthorOut)
async def admin_verify(profile_id: UUID, session: DatabaseSession, team: Team) -> AdminAuthorOut:
    profile = await service.admin_verify(
        session, await _admin_profile(session, profile_id), _by(team), True
    )
    return await _admin_out(session, profile)


@admin_router.post("/{profile_id}/unverify", response_model=AdminAuthorOut)
async def admin_unverify(profile_id: UUID, session: DatabaseSession, team: Team) -> AdminAuthorOut:
    profile = await service.admin_verify(
        session, await _admin_profile(session, profile_id), _by(team), False
    )
    return await _admin_out(session, profile)


@admin_router.post("/{profile_id}/suspend", response_model=AdminAuthorOut)
async def admin_suspend(
    profile_id: UUID, payload: SuspendRequest, session: DatabaseSession, team: Team
) -> AdminAuthorOut:
    profile = await service.admin_suspend(
        session, await _admin_profile(session, profile_id), _by(team), payload.reason
    )
    return await _admin_out(session, profile)


@admin_router.post("/{profile_id}/unsuspend", response_model=AdminAuthorOut)
async def admin_unsuspend(profile_id: UUID, session: DatabaseSession, team: Team) -> AdminAuthorOut:
    profile = await service.admin_unsuspend(session, await _admin_profile(session, profile_id))
    return await _admin_out(session, profile)


@admin_router.get("/suspensions", response_model=list[SuspensionOut])
async def admin_suspensions(session: DatabaseSession, team: Team) -> list[SuspensionOut]:
    """Members whose author page is suspended, also those who deleted the page afterwards."""
    return [
        SuspensionOut(
            member_id=str(r.member_id),
            reason=r.reason,
            suspended_by=r.suspended_by,
            created_at=r.created_at,
            evidence=r.evidence or {},
        )
        for r in await service.list_suspensions(session)
    ]


@admin_router.post("/members/{member_id}/lift-suspension", status_code=status.HTTP_204_NO_CONTENT)
async def admin_lift_suspension(member_id: UUID, session: DatabaseSession, team: Team) -> Response:
    if not await service.lift_member_suspension(session, member_id):
        raise HTTPException(status_code=404, detail="No suspension for this member")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _register_route_words() -> None:
    """Every literal segment right under /authors ("sitemap", "slug-check", "me", ...) can never be
    an author's address, because `/authors/<slug>` would reach the route instead. Derived from the
    router itself, so a route added later is covered without anybody remembering this list."""
    prefix = router.prefix.rstrip("/") + "/"
    words: set[str] = set()
    for route in router.routes:
        path = getattr(route, "path", "")
        if not path.startswith(prefix):
            continue
        first = path[len(prefix) :].split("/", 1)[0]
        if first and not first.startswith("{"):
            words.add(first)
    service.rules.register_route_words(words)


_register_route_words()
