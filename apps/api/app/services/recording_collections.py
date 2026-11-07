"""Playlists from an event: create, edit, order, limits, moderation (docs/kiirtan-sets.md).

A set is a container. Its tracks are ordinary recordings (`recordings.collection_id`) published by
the same `create_recording`, so the hash check, the fingerprint warning and the content rules are
the same as for a single file. What a set adds: the title, the date or range, the place, the order,
its own daily allowance (a retreat is many files at once) and one-step removal by the team.

Numbers (settings, all can be changed by environment variables), with the reasoning:

* 60 tracks per set (200 for the team): a retreat day holds 3 to 5 hours of Kiirtan, about 30 to 50
  tracks, so one weekend fits; 60 also keeps one screen of the queue usable.
* 60 tracks a day into sets for a member (no limit for the team): one big event can go up in one
  evening, while a script cannot fill the library. Standalone uploads keep their own 20 a day, and
  the two are counted apart, so a retreat upload does not lock the member out of a single upload.
* 3 new sets a day and 5 sets with no visible track at a time: stops litter, never a real event.
"""

from __future__ import annotations

import hashlib
from datetime import timedelta
from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import delete, exists, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.models import UserAccount
from app.models.recording_collections import RecordingCollection, RecordingCollectionCover
from app.models.recordings import MemberNotice, Recording
from app.schemas.recording_collections import SetDetail, SetOut, SetPatch, SetState, first_day
from app.schemas.recordings import RecordingCreate, kind_field_problem
from app.services import recordings as rec
from app.services.image_clean import ImageError, clean_image
from app.services.song_comments import strip_invisible

SET_DAILY_LIMIT_CODE = "set_daily_limit"
SET_FULL_CODE = "set_full"
HOURLY_SET_UPLOADS = 120
HOURLY_SET_UPLOADS_TEAM = 600


def clean_set_text(value: str | None, limit: int) -> str:
    """Text a person typed for a playlist (title, place, description): the characters that draw
    nothing (zero-width, bidi overrides) are dropped first, then spaces are folded. The same helper
    the comments use (`song_comments.strip_invisible`)."""
    return rec.clean_text(strip_invisible(value or ""), limit)


def clean_optional(value: str | None, limit: int) -> str | None:
    return clean_set_text(value, limit) or None


# --------------------------------------------------------------------------- reading


async def get_set(session: AsyncSession, set_id: UUID) -> RecordingCollection:
    found = await session.get(RecordingCollection, set_id)
    if found is None:
        raise HTTPException(status_code=404, detail="Playlist not found")
    return found


def require_owner(collection: RecordingCollection, member: UserAccount) -> None:
    if collection.owner_id != member.id:
        raise HTTPException(status_code=403, detail="This playlist is not yours.")


def require_active(collection: RecordingCollection) -> None:
    if collection.status == "removed":
        raise HTTPException(status_code=409, detail="This playlist was removed by the team.")


async def count_visible(session: AsyncSession, set_id: UUID) -> int:
    total = await session.scalar(
        select(func.count())
        .select_from(Recording)
        .where(Recording.collection_id == set_id, Recording.status.in_(rec.VISIBLE))
    )
    return int(total or 0)


async def tracks_of(
    session: AsyncSession, set_id: UUID, *, include_removed: bool = False
) -> list[Recording]:
    conditions: list[Any] = [Recording.collection_id == set_id]
    if not include_removed:
        conditions.append(Recording.status.in_(rec.VISIBLE))
    rows = (
        await session.scalars(
            select(Recording)
            .where(*conditions)
            .order_by(
                Recording.position.asc().nulls_last(),
                Recording.created_at.asc(),
            )
        )
    ).all()
    return list(rows)


def state_of(collection: RecordingCollection, visible: int) -> SetState:
    """removed | draft (nothing visible) | uploading (more are coming) | published."""
    if collection.status == "removed":
        return "removed"
    if visible == 0:
        return "draft"
    if collection.finished_at is None and collection.tracks_expected > visible:
        return "uploading"
    return "published"


def cover_url_of(collection: RecordingCollection) -> str | None:
    """The picture to show: the one the member uploaded, else the link the team set by hand."""
    if collection.cover_version:
        return f"/api/v1/recording-sets/{collection.id}/cover?v={collection.cover_version}"
    return collection.cover_url


def set_out(collection: RecordingCollection, visible: int, *, owner: bool = False) -> SetOut:
    return SetOut(
        id=str(collection.id),
        title=collection.title,
        description=collection.description,
        place=collection.place,
        event_year=collection.event_year or collection.starts_on.year,
        event_month=(
            collection.event_month if collection.event_year else collection.starts_on.month
        ),
        starts_on=collection.starts_on,
        ends_on=collection.ends_on,
        cover_url=cover_url_of(collection),
        owner_id=str(collection.owner_id) if collection.owner_id else None,
        owner_name=collection.owner_name,
        default_kind=collection.default_kind,  # type: ignore[arg-type]
        default_language=collection.default_language,
        default_language_other=collection.default_language_other,
        default_dance=collection.default_dance,
        tracks_expected=collection.tracks_expected,
        tracks_count=visible,
        state=state_of(collection, visible),
        finished_at=collection.finished_at,
        created_at=collection.created_at,
        removed_reason=collection.removed_reason if owner else None,
        removed_at=collection.removed_at if owner else None,
    )


async def set_detail(
    session: AsyncSession, collection: RecordingCollection, *, owner: bool
) -> SetDetail:
    # The owner sees removed tracks too (with the reason); everyone else only what is live.
    tracks = await tracks_of(session, collection.id, include_removed=owner)
    visible = sum(1 for t in tracks if t.status in rec.VISIBLE)
    base = set_out(collection, visible, owner=owner)
    return SetDetail(
        **base.model_dump(),
        tracks=[rec.recording_out(t, owner=owner) for t in tracks],
    )


async def list_sets(
    session: AsyncSession,
    *,
    viewer_id: UUID | None,
    owner_id: UUID | None,
    query: str | None,
    limit: int,
    offset: int,
) -> tuple[list[SetOut], int]:
    """Sets people can see: active, with at least one live track, newest event first."""
    live = exists().where(
        Recording.collection_id == RecordingCollection.id, Recording.status.in_(rec.VISIBLE)
    )
    conditions: list[Any] = [RecordingCollection.status == "active", live]
    blocked = await rec.blocked_author_ids(session, viewer_id)
    if blocked:
        conditions.append(
            or_(
                RecordingCollection.owner_id.is_(None), RecordingCollection.owner_id.not_in(blocked)
            )
        )
    if owner_id:
        conditions.append(RecordingCollection.owner_id == owner_id)
    if query:
        like = f"%{query.strip().lower()}%"
        conditions.append(
            or_(
                func.lower(RecordingCollection.title).like(like),
                func.lower(func.coalesce(RecordingCollection.place, "")).like(like),
            )
        )
    total = await session.scalar(
        select(func.count()).select_from(RecordingCollection).where(*conditions)
    )
    rows = (
        await session.scalars(
            select(RecordingCollection)
            .where(*conditions)
            .order_by(RecordingCollection.starts_on.desc(), RecordingCollection.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
    ).all()
    return [set_out(r, await count_visible(session, r.id)) for r in rows], int(total or 0)


async def my_sets(session: AsyncSession, member_id: UUID) -> list[SetOut]:
    rows = (
        await session.scalars(
            select(RecordingCollection)
            .where(RecordingCollection.owner_id == member_id)
            .order_by(RecordingCollection.created_at.desc())
        )
    ).all()
    return [set_out(r, await count_visible(session, r.id), owner=True) for r in rows]


# --------------------------------------------------------------------------- limits


async def sets_started_in_last_day(session: AsyncSession, member_id: UUID) -> int:
    since = rec.now_utc() - timedelta(hours=24)
    total = await session.scalar(
        select(func.count())
        .select_from(RecordingCollection)
        .where(RecordingCollection.owner_id == member_id, RecordingCollection.created_at >= since)
    )
    return int(total or 0)


async def empty_drafts(session: AsyncSession, member_id: UUID) -> int:
    live = exists().where(
        Recording.collection_id == RecordingCollection.id, Recording.status.in_(rec.VISIBLE)
    )
    total = await session.scalar(
        select(func.count())
        .select_from(RecordingCollection)
        .where(
            RecordingCollection.owner_id == member_id,
            RecordingCollection.status == "active",
            ~live,
        )
    )
    return int(total or 0)


async def ensure_can_start_set(
    session: AsyncSession, member_id: UUID, settings: Settings, *, team: bool
) -> None:
    if team:
        return
    if await sets_started_in_last_day(session, member_id) >= settings.recording_sets_per_day:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                f"You can start up to {settings.recording_sets_per_day} playlists a day. "
                "Please come back tomorrow."
            ),
            headers={"X-Error-Code": "set_start_limit"},
        )
    if await empty_drafts(session, member_id) >= settings.recording_set_empty_drafts:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"You have {settings.recording_set_empty_drafts} playlists with no recording yet. "
                "Upload into one of them, or delete one, before starting another."
            ),
        )


async def set_tracks_in_last_day(session: AsyncSession, member_id: UUID) -> int:
    since = rec.now_utc() - timedelta(hours=24)
    total = await session.scalar(
        select(func.count())
        .select_from(Recording)
        .where(
            Recording.author_id == member_id,
            Recording.collection_id.is_not(None),
            Recording.published_at >= since,
        )
    )
    return int(total or 0)


async def ensure_set_allowance(
    session: AsyncSession, member_id: UUID, settings: Settings, *, team: bool
) -> None:
    """The daily allowance of tracks that go into playlists (apart from single uploads)."""
    if team:
        return
    limit = settings.recording_set_tracks_per_day
    if await set_tracks_in_last_day(session, member_id) >= limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                f"You can add up to {limit} playlist tracks a day. "
                "Please come back tomorrow to add the rest. Thank you for sharing."
            ),
            headers={"X-Error-Code": SET_DAILY_LIMIT_CODE},
        )


async def ensure_room(
    session: AsyncSession, collection: RecordingCollection, settings: Settings, *, team: bool
) -> None:
    cap = settings.recording_set_max_tracks_team if team else settings.recording_set_max_tracks
    if await count_visible(session, collection.id) >= cap:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": SET_FULL_CODE,
                "message": (
                    f"A playlist holds up to {cap} recordings. "
                    "Start a second playlist for the rest."
                ),
            },
        )


async def check_upload_into_set(
    session: AsyncSession,
    *,
    set_id: UUID,
    member: UserAccount,
    settings: Settings,
    team: bool,
) -> RecordingCollection:
    """Everything that decides, before any bytes travel, whether a file may go into this set."""
    collection = await get_set(session, set_id)
    require_owner(collection, member)
    require_active(collection)
    await ensure_room(session, collection, settings, team=team)
    await ensure_set_allowance(session, member.id, settings, team=team)
    return collection


# --------------------------------------------------------------------------- tracks


async def next_position(session: AsyncSession, set_id: UUID) -> int:
    top = await session.scalar(
        select(func.max(Recording.position)).where(Recording.collection_id == set_id)
    )
    return int(top or 0) + 1


def with_set_defaults(payload: RecordingCreate, collection: RecordingCollection) -> RecordingCreate:
    """The track as it will be stored: what the track did not say comes from the playlist.

    Kind, language and dance are filled from the playlist only when the request left them out; the
    category rules are then checked on the result, so a spiritual song without any language, or a
    dance music without a dance, is a 422 even inside a playlist.
    """
    sent = payload.model_fields_set
    merged = payload.model_dump()
    merged["collection_id"] = collection.id
    if "kind" not in sent:
        merged["kind"] = collection.default_kind
    # An empty value counts as "not said": the RecordingCreate validator may have set it to None.
    if payload.language is None and collection.default_language:
        merged["language"] = collection.default_language
        merged["language_other"] = collection.default_language_other
    if payload.dance is None and merged["kind"] == "dance_song":
        merged["dance"] = collection.default_dance
    result = RecordingCreate.model_validate(merged)
    problem = kind_field_problem(
        result.kind,
        language=result.language,
        language_other=result.language_other,
        dance=result.dance,
        ps_song_number=result.ps_song_number,
    )
    if problem:
        raise HTTPException(status_code=422, detail=problem)
    return result


async def renumber(session: AsyncSession, set_id: UUID) -> None:
    """Positions 1..n in the current order, live tracks first, hidden ones after them."""
    rows = await tracks_of(session, set_id, include_removed=True)
    rows.sort(key=lambda r: (r.status not in rec.VISIBLE, r.position or 10**6))
    for index, row in enumerate(rows, start=1):
        row.position = index


# --------------------------------------------------------------------------- editing


async def apply_patch(
    session: AsyncSession, collection: RecordingCollection, patch: SetPatch
) -> None:
    sent = patch.model_fields_set
    if "title" in sent and patch.title is not None:
        title = clean_set_text(patch.title, 200)
        if not title:
            raise HTTPException(status_code=422, detail="Add a title.")
        collection.title = title
    if "description" in sent:
        collection.description = clean_optional(patch.description, 1000)
    if "place" in sent:
        collection.place = clean_optional(patch.place, 200)
    if "event_year" in sent and patch.event_year is not None:
        year = patch.event_year
        month = patch.event_month if "event_month" in sent else collection.event_month
        collection.event_year, collection.event_month = year, month
        collection.starts_on = first_day(year, month)
        collection.ends_on = None
    elif "event_month" in sent:
        year = collection.event_year or collection.starts_on.year
        collection.event_year, collection.event_month = year, patch.event_month
        collection.starts_on = first_day(year, patch.event_month)
        collection.ends_on = None
    elif "starts_on" in sent and patch.starts_on:
        # an older app: the day it sent is the date; the year and month follow it
        ends = patch.ends_on if "ends_on" in sent else collection.ends_on
        if ends is not None and ends < patch.starts_on:
            raise HTTPException(
                status_code=422, detail="The last day cannot be before the first day."
            )
        collection.starts_on = patch.starts_on
        collection.ends_on = ends
        collection.event_year, collection.event_month = patch.starts_on.year, patch.starts_on.month
    elif "ends_on" in sent:
        ends = patch.ends_on
        if ends is not None and ends < collection.starts_on:
            raise HTTPException(
                status_code=422, detail="The last day cannot be before the first day."
            )
        collection.ends_on = ends
    if "cover_url" in sent:
        collection.cover_url = patch.cover_url
    if "default_kind" in sent and patch.default_kind:
        collection.default_kind = patch.default_kind
    if "tracks_expected" in sent and patch.tracks_expected is not None:
        collection.tracks_expected = patch.tracks_expected
    await session.commit()


async def set_cover(session: AsyncSession, collection: RecordingCollection, data: bytes) -> None:
    """Keep the picture the member chose: JPEG, PNG or WebP, at most 300 KB, metadata cut out."""
    try:
        mime, clean = clean_image(data)
    except ImageError as problem:
        raise HTTPException(
            status_code=problem.status,
            detail={"code": problem.code, "message": problem.message},
        ) from problem
    digest = hashlib.sha256(clean).hexdigest()
    row = await session.get(RecordingCollectionCover, collection.id)
    if row is None:
        session.add(
            RecordingCollectionCover(
                collection_id=collection.id,
                mime=mime,
                data=clean,
                sha256=digest,
                updated_at=rec.now_utc(),
            )
        )
    else:
        row.mime, row.data, row.sha256, row.updated_at = mime, clean, digest, rec.now_utc()
    collection.cover_version = digest[:16]
    await session.commit()


async def remove_cover(session: AsyncSession, collection: RecordingCollection) -> None:
    await session.execute(
        delete(RecordingCollectionCover).where(
            RecordingCollectionCover.collection_id == collection.id
        )
    )
    collection.cover_version = None
    await session.commit()


async def mark_finished(session: AsyncSession, collection: RecordingCollection) -> None:
    visible = await count_visible(session, collection.id)
    collection.tracks_expected = visible
    collection.finished_at = rec.now_utc()
    await session.commit()


def detach(recording: Recording) -> None:
    recording.collection_id = None
    recording.position = None


async def author_removes(session: AsyncSession, recording: Recording) -> None:
    """The author takes their own track out of the library (no notice: they did it themselves)."""
    moment = rec.now_utc()
    recording.status = "removed"
    recording.removed_reason = "Removed by its author."
    recording.removed_at = moment
    recording.removed_by = "author"


# --------------------------------------------------------------------------- moderation


def set_removal_notice(collection: RecordingCollection, reason: str) -> MemberNotice | None:
    if collection.owner_id is None:
        return None
    return MemberNotice(
        user_id=collection.owner_id,
        kind="recording_set_removed",
        recording_id=None,
        title=f"Your playlist was removed: {reason}"[:300],
        body=(
            f"“{collection.title}” and its recordings were removed because: {reason}. "
            f"{rec.APPEAL_LINE}"
        ),
        payload={
            "set_id": str(collection.id),
            "set_title": collection.title,
            "reason": reason,
            "actions": ["contact"],
        },
    )


async def remove_set(
    session: AsyncSession, collection: RecordingCollection, *, reason: str, by: str
) -> None:
    """The team takes the whole playlist down: every live track goes with it, with one notice."""
    reason = rec.clean_text(reason, 500)
    moment = rec.now_utc()
    collection.status = "removed"
    collection.removed_reason = reason
    collection.removed_at = moment
    collection.removed_by = by
    for track in await tracks_of(session, collection.id):
        track.status = "removed"
        track.removed_reason = f"Part of the playlist “{collection.title}”: {reason}"[:500]
        track.removed_at = moment
        track.removed_by = by
        track.reviewed_at = moment
        track.reviewed_by = by
    notice = set_removal_notice(collection, reason)
    if notice is not None:
        session.add(notice)
    await session.commit()


async def restore_set(session: AsyncSession, collection: RecordingCollection, *, by: str) -> None:
    """Back in: the playlist and the tracks that went down WITH it (not ones removed one by one)."""
    moment = rec.now_utc()
    went_with_it = collection.removed_at
    collection.status = "active"
    collection.removed_reason = None
    collection.removed_at = None
    collection.removed_by = None
    if went_with_it is not None:
        for track in await tracks_of(session, collection.id, include_removed=True):
            if track.status == "removed" and track.removed_at == went_with_it:
                track.status = "published"
                track.removed_reason = None
                track.removed_at = None
                track.removed_by = None
                track.reviewed_at = moment
                track.reviewed_by = by
    await session.commit()
