"""Playlists from an event: one person uploads all the recordings of a retreat as a set.

Design, flows and limits: docs/kiirtan-sets.md. The tracks are ordinary recordings, uploaded with
`POST /recordings/uploads` and `POST /recordings` carrying `collection_id`; this router makes and
edits the set around them.
"""

from __future__ import annotations

from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, Request, Response, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.recordings import (
    AdminIdentity,
    AppSettings,
    DatabaseSession,
    Member,
    OptionalMember,
)
from app.models.recording_collections import RecordingCollection, RecordingCollectionCover
from app.models.recordings import Recording
from app.schemas.recording_collections import (
    AdminSetFilter,
    SetCreate,
    SetDetail,
    SetList,
    SetOrder,
    SetOut,
    SetPatch,
    SetRemove,
    SetRestore,
    TrackAttach,
    TrackPatch,
)
from app.schemas.recordings import RecordingOut
from app.services import recording_collections as sets
from app.services import recordings as service
from app.services.image_clean import PHOTO_MAX_BYTES

router = APIRouter(prefix="/recording-sets", tags=["recording-sets"])
admin_router = APIRouter(prefix="/admin/recording-sets", tags=["admin"])


async def _own_set(
    session: AsyncSession, set_id: UUID, member: Member, *, allow_removed: bool = False
) -> RecordingCollection:
    collection = await sets.get_set(session, set_id)
    sets.require_owner(collection, member)
    if not allow_removed:
        sets.require_active(collection)
    return collection


async def _owner_out(session: AsyncSession, collection: RecordingCollection) -> SetOut:
    return sets.set_out(collection, await sets.count_visible(session, collection.id), owner=True)


# --------------------------------------------------------------------------- reading


@router.get("", response_model=SetList)
async def list_public_sets(
    session: DatabaseSession,
    member: OptionalMember,
    owner_id: UUID | None = None,
    q: Annotated[str | None, Query(max_length=100)] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 30,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> SetList:
    """Playlists people can open: not removed, at least one live track, newest event first."""
    items, total = await sets.list_sets(
        session,
        viewer_id=member.id if member else None,
        owner_id=owner_id,
        query=q,
        limit=limit,
        offset=offset,
    )
    return SetList(items=items, total=total)


@router.get("/mine", response_model=SetList)
async def my_sets(session: DatabaseSession, member: Member) -> SetList:
    """The member's own playlists in every state: draft, uploading, published, removed."""
    items = await sets.my_sets(session, member.id)
    return SetList(items=items, total=len(items))


@router.get("/{set_id}/cover")
async def read_cover(set_id: UUID, session: DatabaseSession, member: OptionalMember) -> Response:
    """The cover picture. Anyone sees it while the playlist is visible; its owner always."""
    collection = await sets.get_set(session, set_id)
    owner = member is not None and collection.owner_id == member.id
    if not owner and (
        collection.status == "removed" or await sets.count_visible(session, set_id) == 0
    ):
        raise HTTPException(status_code=404, detail="No picture")
    cover = await session.get(RecordingCollectionCover, set_id)
    if cover is None or not collection.cover_version:
        raise HTTPException(status_code=404, detail="No picture")
    return Response(
        content=cover.data,
        media_type=cover.mime,
        headers={
            "Cache-Control": "private, max-age=60" if owner else "public, max-age=86400",
            "ETag": f'"{cover.sha256[:16]}"',
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.get("/{set_id}", response_model=SetDetail)
async def read_set(set_id: UUID, session: DatabaseSession, member: OptionalMember) -> SetDetail:
    collection = await sets.get_set(session, set_id)
    owner = member is not None and collection.owner_id == member.id
    if collection.status == "removed" and not owner:
        raise HTTPException(status_code=404, detail="Playlist not found")
    detail = await sets.set_detail(session, collection, owner=owner)
    if not owner and detail.tracks_count == 0:
        # A draft is the owner's business until a track is live.
        raise HTTPException(status_code=404, detail="Playlist not found")
    return detail


# --------------------------------------------------------------------------- making and editing


@router.post("", response_model=SetOut, status_code=status.HTTP_201_CREATED)
async def create_set(
    payload: SetCreate,
    response: Response,
    session: DatabaseSession,
    member: Member,
    settings: AppSettings,
) -> SetOut:
    """Start a playlist. Sending the same `id` again returns the playlist that exists (200)."""
    if payload.id is not None:
        existing = await session.get(RecordingCollection, payload.id)
        if existing is not None:
            if existing.owner_id != member.id:
                raise HTTPException(status_code=409, detail="This playlist id is taken.")
            response.status_code = status.HTTP_200_OK
            return await _owner_out(session, existing)
    team = service.is_team_member(member, settings)
    await sets.ensure_can_start_set(session, member.id, settings, team=team)
    title = sets.clean_set_text(payload.title, 200)
    if not title:
        raise HTTPException(status_code=422, detail="Add a title.")
    collection = RecordingCollection(
        owner_id=member.id,
        owner_name=member.display_name,
        title=title,
        description=sets.clean_optional(payload.description, 1000),
        place=sets.clean_optional(payload.place, 200),
        event_year=payload.event_year,
        event_month=payload.event_month,
        starts_on=payload.starts_on,
        ends_on=payload.ends_on,
        cover_url=payload.cover_url,
        default_kind=payload.default_kind,
        default_language=payload.default_language,
        default_language_other=payload.default_language_other,
        default_dance=payload.default_dance,
        tracks_expected=payload.tracks_expected,
        status="active",
    )
    if payload.id is not None:
        collection.id = payload.id
    session.add(collection)
    await session.commit()
    await session.refresh(collection)
    return await _owner_out(session, collection)


@router.patch("/{set_id}", response_model=SetOut)
async def patch_set(
    set_id: UUID, payload: SetPatch, session: DatabaseSession, member: Member
) -> SetOut:
    """Rename it, change the date, place or description, or say how many files are coming."""
    collection = await _own_set(session, set_id, member)
    await sets.apply_patch(session, collection, payload)
    return await _owner_out(session, collection)


@router.put("/{set_id}/cover", response_model=SetOut)
async def put_cover(
    set_id: UUID, request: Request, session: DatabaseSession, member: Member
) -> SetOut:
    """The body is the picture itself (JPEG, PNG or WebP, at most 300 KB). The phone makes it
    small; the server cuts the metadata out whatever the phone did."""
    collection = await _own_set(session, set_id, member)
    declared = request.headers.get("content-length")
    if declared and declared.isdigit() and int(declared) > PHOTO_MAX_BYTES * 2:
        raise HTTPException(
            status_code=413, detail={"code": "photo_too_big", "message": "The picture is too big."}
        )
    await sets.set_cover(session, collection, await request.body())
    return await _owner_out(session, collection)


@router.delete("/{set_id}/cover", response_model=SetOut)
async def delete_cover(set_id: UUID, session: DatabaseSession, member: Member) -> SetOut:
    collection = await _own_set(session, set_id, member)
    await sets.remove_cover(session, collection)
    return await _owner_out(session, collection)


@router.post("/{set_id}/finish", response_model=SetOut)
async def finish_set(set_id: UUID, session: DatabaseSession, member: Member) -> SetOut:
    """The upload is over (some files may have failed): the playlist is complete as it is."""
    collection = await _own_set(session, set_id, member)
    await sets.mark_finished(session, collection)
    return await _owner_out(session, collection)


@router.put("/{set_id}/order", response_model=SetDetail)
async def reorder_set(
    set_id: UUID, payload: SetOrder, session: DatabaseSession, member: Member
) -> SetDetail:
    """The tracks in the order the member wants. The list must hold every live track once."""
    collection = await _own_set(session, set_id, member)
    live = await sets.tracks_of(session, collection.id)
    wanted = [str(i) for i in payload.recording_ids]
    if len(set(wanted)) != len(wanted) or set(wanted) != {str(t.id) for t in live}:
        raise HTTPException(
            status_code=422,
            detail="The list does not match the playlist. Reload it and try again.",
        )
    by_id = {str(t.id): t for t in live}
    for index, ident in enumerate(wanted, start=1):
        by_id[ident].position = index
    hidden = [
        t
        for t in await sets.tracks_of(session, collection.id, include_removed=True)
        if str(t.id) not in by_id
    ]
    for offset, track in enumerate(hidden, start=len(wanted) + 1):
        track.position = offset
    await session.commit()
    return await sets.set_detail(session, collection, owner=True)


@router.post("/{set_id}/tracks", response_model=SetDetail, status_code=status.HTTP_201_CREATED)
async def attach_track(
    set_id: UUID,
    payload: TrackAttach,
    session: DatabaseSession,
    member: Member,
    settings: AppSettings,
) -> SetDetail:
    """Put one of the member's own published recordings into the playlist."""
    team = service.is_team_member(member, settings)
    collection = await _own_set(session, set_id, member)
    recording = await session.get(Recording, payload.recording_id)
    if recording is None or recording.author_id != member.id:
        raise HTTPException(status_code=404, detail="Recording not found")
    if recording.status not in service.VISIBLE:
        raise HTTPException(status_code=409, detail="Only a published recording can be added.")
    if recording.collection_id == collection.id:
        return await sets.set_detail(session, collection, owner=True)
    if recording.collection_id is not None:
        raise HTTPException(
            status_code=409,
            detail="This recording is in another playlist. Take it out there first.",
        )
    await sets.ensure_room(session, collection, settings, team=team)
    recording.collection_id = collection.id
    recording.position = payload.position or await sets.next_position(session, collection.id)
    await session.commit()
    if payload.position:
        await sets.renumber(session, collection.id)
        await session.commit()
    return await sets.set_detail(session, collection, owner=True)


@router.patch("/{set_id}/tracks/{recording_id}", response_model=RecordingOut)
async def patch_track(
    set_id: UUID,
    recording_id: UUID,
    payload: TrackPatch,
    session: DatabaseSession,
    member: Member,
) -> RecordingOut:
    """Change a track's title or the day it was recorded."""
    collection = await _own_set(session, set_id, member)
    recording = await session.get(Recording, recording_id)
    if recording is None or recording.collection_id != collection.id:
        raise HTTPException(status_code=404, detail="Recording not found")
    sent = payload.model_fields_set
    if "title" in sent and payload.title is not None:
        title = sets.clean_set_text(payload.title, 200)
        if not title:
            raise HTTPException(status_code=422, detail="Add a title.")
        recording.title = title
    if "recorded_on" in sent:
        recording.recorded_on = payload.recorded_on
    await session.commit()
    return service.recording_out(recording, owner=True)


@router.delete("/{set_id}/tracks/{recording_id}", response_model=SetDetail)
async def remove_track(
    set_id: UUID,
    recording_id: UUID,
    session: DatabaseSession,
    member: Member,
    remove: Literal["false", "true"] = "false",
) -> SetDetail:
    """Take a track out of the playlist. It stays in the library on its own, unless `remove=true`
    (then it is removed from the library as well, as its author's own choice)."""
    collection = await _own_set(session, set_id, member)
    recording = await session.get(Recording, recording_id)
    if recording is None or recording.collection_id != collection.id:
        raise HTTPException(status_code=404, detail="Recording not found")
    if remove == "true" and recording.status in service.VISIBLE:
        await sets.author_removes(session, recording)
    else:
        sets.detach(recording)
    await session.commit()
    await sets.renumber(session, collection.id)
    await session.commit()
    return await sets.set_detail(session, collection, owner=True)


@router.delete("/{set_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_set(
    set_id: UUID,
    session: DatabaseSession,
    member: Member,
    tracks: Literal["keep", "remove"] = "keep",
) -> Response:
    """Delete the playlist. `tracks=keep` (default): the recordings stay in the library on their
    own. `tracks=remove`: they are taken out of the library too."""
    collection = await _own_set(session, set_id, member, allow_removed=True)
    for track in await sets.tracks_of(session, collection.id, include_removed=True):
        if tracks == "remove" and track.status in service.VISIBLE:
            await sets.author_removes(session, track)
        sets.detach(track)
    await session.flush()
    await session.execute(
        delete(RecordingCollectionCover).where(RecordingCollectionCover.collection_id == set_id)
    )
    await session.delete(collection)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --------------------------------------------------------------------------- the team


@admin_router.get("", response_model=SetList)
async def admin_list_sets(
    admin: AdminIdentity,
    session: DatabaseSession,
    filter: AdminSetFilter = "all",
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> SetList:
    conditions = [] if filter == "all" else [RecordingCollection.status == filter]
    rows = (
        await session.scalars(
            select(RecordingCollection)
            .where(*conditions)
            .order_by(RecordingCollection.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
    ).all()
    items = [sets.set_out(r, await sets.count_visible(session, r.id), owner=True) for r in rows]
    return SetList(items=items, total=len(items))


@admin_router.post("/{set_id}/remove", response_model=SetOut)
async def admin_remove_set(
    set_id: UUID, payload: SetRemove, admin: AdminIdentity, session: DatabaseSession
) -> SetOut:
    """Take the whole playlist down with a reason; every live track goes with it and the owner
    gets one notice. A single track is removed with the recordings endpoint instead."""
    collection = await sets.get_set(session, set_id)
    if collection.status == "removed":
        raise HTTPException(status_code=409, detail="Already removed")
    await sets.remove_set(session, collection, reason=payload.reason, by=payload.reviewer or admin)
    return await _owner_out(session, collection)


@admin_router.post("/{set_id}/restore", response_model=SetOut)
async def admin_restore_set(
    set_id: UUID, payload: SetRestore, admin: AdminIdentity, session: DatabaseSession
) -> SetOut:
    collection = await sets.get_set(session, set_id)
    if collection.status != "removed":
        raise HTTPException(status_code=409, detail="Only a removed playlist can be restored")
    await sets.restore_set(session, collection, by=payload.reviewer or admin)
    return await _owner_out(session, collection)
