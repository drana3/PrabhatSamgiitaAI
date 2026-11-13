"""The recording of an ended broadcast (docs/broadcasts.md).

Two ways, both only after the broadcast is over:

* a LINK to a recording that already exists: the same YouTube video (it stays as the recording;
  when the YouTube look reports the end it is added by itself), a Zoom cloud recording
  (zoom.us/rec/...), Vimeo or archive.org. The address goes through the same strict reader as the
  broadcast link (`parse_broadcast_url`: https only, no user name, no port, a public domain) and
  then through an allowlist. It is stored and shown; the server never fetches it, never downloads
  a recording from YouTube or Zoom, and only YouTube is ever played inside the app.
* a FILE: an ordinary library recording made with the upload wizard (all its checks, duplicates,
  style and loudness apply), linked to the broadcast through `RecordingCreate.broadcast_id`.

The author of the broadcast and the team add a recording straight away. Any other member
SUGGESTS one; it is shown to nobody else until the team accepts it. A recording stays where it
is, with its author and in the library, whatever happens to the broadcast; an archived broadcast
(or one with an accepted recording) still shows its recording.
"""

from __future__ import annotations

from datetime import datetime
from urllib.parse import urlsplit
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import UserAccount
from app.models.broadcasts import Broadcast, BroadcastRecording
from app.models.recordings import Recording
from app.schemas.broadcasts import BroadcastOut, BroadcastRecordingOut
from app.services import broadcasts as core
from app.services.extras_common import AUTHOR_DELETED_BY
from app.services.recordings import now_utc
from app.services.video_links import VideoRefusedError

MAX_ACCEPTED = 5
MAX_PENDING = 5
MAX_PENDING_PER_MEMBER = 2
HOURLY_RECORDINGS = 10

NOT_ENDED_CODE = "broadcast_not_ended"
RECORDING_LINK_CODE = "broadcast_recording_link"
RECORDING_FULL_CODE = "broadcast_recording_full"
RECORDING_DUPLICATE_CODE = "broadcast_recording_duplicate"

# Sites that hold a recording of a talk; YouTube and Zoom are read by `parse_broadcast_url`.
OTHER_RECORDING_HOSTS = frozenset(
    {"vimeo.com", "www.vimeo.com", "player.vimeo.com", "archive.org", "www.archive.org"}
)
ALLOWED_TEXT = (
    "Paste the link of a recording: a YouTube video, a Zoom cloud recording "
    "(zoom.us/rec/...), Vimeo or archive.org."
)


def _bad(message: str) -> VideoRefusedError:
    return VideoRefusedError(RECORDING_LINK_CODE, message)


def parse_recording_url(raw: str) -> tuple[str, str, str]:
    """(provider, stored url, host) of a recording link, or `VideoRefusedError`."""
    try:
        provider, _external_id, url, host = core.parse_broadcast_url(raw)
    except VideoRefusedError as exc:
        raise _bad(exc.message) from exc
    if provider == "youtube":
        return provider, url, host
    if provider == "zoom":
        if not (urlsplit(url).path or "/").startswith("/rec/"):
            raise _bad(
                "That is the link of the meeting. Paste the link of the cloud recording "
                "(zoom.us/rec/...)."
            )
        return provider, url, host
    if host in OTHER_RECORDING_HOSTS:
        return "other", url, host
    raise _bad(ALLOWED_TEXT)


# --------------------------------------------------------------------------- reading


def _out(
    link: BroadcastRecording, title: str | None, *, viewer_id: UUID | None
) -> BroadcastRecordingOut:
    return BroadcastRecordingOut(
        id=str(link.id),
        kind=link.kind,  # type: ignore[arg-type]
        provider=link.provider,
        url=link.url,
        host=link.host,
        recording_id=str(link.recording_id) if link.recording_id else None,
        recording_title=title,
        status="accepted" if link.status == "accepted" else "pending",
        source=link.source,  # type: ignore[arg-type]
        mine=viewer_id is not None and link.member_id == viewer_id,
        created_at=core._aware(link.created_at),
    )


async def load(
    session: AsyncSession, ids: list[UUID], *, viewer_id: UUID | None, team: bool
) -> dict[UUID, list[BroadcastRecordingOut]]:
    """The recordings to show, by broadcast: the accepted ones to everybody, a pending one only to
    the member who suggested it and to the team. A library recording that was removed is left
    out."""
    found: dict[UUID, list[BroadcastRecordingOut]] = {}
    if not ids:
        return found
    rows = (
        await session.execute(
            select(BroadcastRecording, Recording.title, Recording.status)
            .outerjoin(Recording, Recording.id == BroadcastRecording.recording_id)
            .where(
                BroadcastRecording.broadcast_id.in_(ids), BroadcastRecording.status != "rejected"
            )
            .order_by(BroadcastRecording.created_at)
        )
    ).all()
    for link, title, recording_status in rows:
        if link.kind == "file" and recording_status in (None, "removed"):
            continue
        if link.status == "pending" and not (team or (viewer_id and link.member_id == viewer_id)):
            continue
        found.setdefault(link.broadcast_id, []).append(_out(link, title, viewer_id=viewer_id))
    return found


def recording_action(
    b: Broadcast, *, viewer_id: UUID | None, team: bool, accepted: int, now: datetime
) -> str | None:
    """What this viewer may do about the recording: nothing before the end, for a visitor, for a
    removed broadcast, or when the list is full."""
    if viewer_id is None or b.status != "published" or core.phase(b, now=now) != "ended":
        return None
    if accepted >= MAX_ACCEPTED:
        return None
    return "add" if (team or b.member_id == viewer_id) else "suggest"


async def present(
    session: AsyncSession,
    rows: list[Broadcast],
    *,
    viewer_id: UUID | None,
    team: bool,
    now: datetime | None = None,
) -> list[BroadcastOut]:
    """The answers of a list, with the recordings loaded in one query."""
    moment = now or now_utc()
    shown = await load(session, [b.id for b in rows], viewer_id=viewer_id, team=team)
    out = []
    for b in rows:
        mine = shown.get(b.id, [])
        accepted = sum(1 for r in mine if r.status == "accepted")
        out.append(
            core.public_out(
                b,
                viewer_id=viewer_id,
                team=team,
                now=moment,
                recordings=mine,
                recording_action=recording_action(
                    b, viewer_id=viewer_id, team=team, accepted=accepted, now=moment
                ),
            )
        )
    return out


async def has_accepted(session: AsyncSession, broadcast_id: UUID) -> bool:
    return (
        await session.scalar(
            select(BroadcastRecording.id)
            .outerjoin(Recording, Recording.id == BroadcastRecording.recording_id)
            .where(
                BroadcastRecording.broadcast_id == broadcast_id,
                BroadcastRecording.status == "accepted",
                (BroadcastRecording.kind == "link") | (Recording.status != "removed"),
            )
            .limit(1)
        )
    ) is not None


async def from_broadcast(session: AsyncSession, recording_id: UUID) -> dict[str, object] | None:
    """The mark on a recording page: "From a live broadcast: <title>, <date>". Not for a
    broadcast the team removed or its author deleted."""
    b = await session.scalar(
        select(Broadcast)
        .join(BroadcastRecording, BroadcastRecording.broadcast_id == Broadcast.id)
        .where(
            BroadcastRecording.recording_id == recording_id,
            BroadcastRecording.status == "accepted",
            Broadcast.status == "published",
            Broadcast.removed_by.is_(None) | (Broadcast.removed_by != AUTHOR_DELETED_BY),
        )
        .order_by(BroadcastRecording.created_at)
        .limit(1)
    )
    if b is None or not b.title:
        return None
    return {"id": str(b.id), "title": b.title, "date": core.begins_at(b).date()}


# --------------------------------------------------------------------------- writing


def _may_decide(b: Broadcast, member: UserAccount, team: bool) -> bool:
    return team or b.member_id == member.id


async def _check_open(session: AsyncSession, b: Broadcast, member: UserAccount, team: bool) -> bool:
    """Raise when no recording can be added now; True when this member adds it straight away."""
    owner = b.member_id == member.id
    if not core.can_see(b, owner=owner, team=team, has_recording=await has_accepted(session, b.id)):
        raise HTTPException(status_code=404, detail="Broadcast not found")
    if b.status != "published":
        raise HTTPException(status_code=409, detail="This broadcast is removed.")
    if core.phase(b) != "ended":
        raise HTTPException(
            status_code=409,
            detail="The broadcast is not over yet. Add the recording when it ends.",
            headers={"X-Error-Code": NOT_ENDED_CODE},
        )
    direct = _may_decide(b, member, team)
    counts = dict(
        (
            await session.execute(
                select(BroadcastRecording.status, func.count())
                .where(BroadcastRecording.broadcast_id == b.id)
                .group_by(BroadcastRecording.status)
            )
        ).all()
    )
    if counts.get("accepted", 0) >= MAX_ACCEPTED or (
        not direct and counts.get("pending", 0) >= MAX_PENDING
    ):
        raise HTTPException(
            status_code=409,
            detail="This broadcast already has as many recordings as can be added.",
            headers={"X-Error-Code": RECORDING_FULL_CODE},
        )
    if not direct:
        mine = await session.scalar(
            select(func.count())
            .select_from(BroadcastRecording)
            .where(
                BroadcastRecording.broadcast_id == b.id,
                BroadcastRecording.member_id == member.id,
                BroadcastRecording.status == "pending",
            )
        )
        if (mine or 0) >= MAX_PENDING_PER_MEMBER:
            raise HTTPException(
                status_code=409,
                detail="Your earlier suggestions are still waiting for the team.",
                headers={"X-Error-Code": RECORDING_FULL_CODE},
            )
    return direct


def _source(b: Broadcast, member: UserAccount, team: bool) -> str:
    if b.member_id == member.id:
        return "author"
    return "team" if team else "member"


async def check_target(
    session: AsyncSession, broadcast_id: UUID, *, member: UserAccount, team: bool
) -> Broadcast:
    """Before a library recording is made for a broadcast: is the broadcast one it can go to?
    Raises (404, 409) so that no file is stored for nothing."""
    b = await session.get(Broadcast, broadcast_id)
    if b is None:
        raise HTTPException(status_code=404, detail="Broadcast not found")
    await _check_open(session, b, member, team)
    return b


async def add_link(
    session: AsyncSession, b: Broadcast, *, member: UserAccount, team: bool, raw_url: str
) -> BroadcastRecording:
    core.limiter.hit("recording", str(member.id), limit=HOURLY_RECORDINGS, window_seconds=3600)
    try:
        provider, url, host = parse_recording_url(raw_url)
    except VideoRefusedError as error:
        raise HTTPException(
            status_code=422, detail=error.message, headers={"X-Error-Code": error.code}
        ) from error
    direct = await _check_open(session, b, member, team)
    same = await session.scalar(
        select(BroadcastRecording.id).where(
            BroadcastRecording.broadcast_id == b.id,
            BroadcastRecording.url == url,
            BroadcastRecording.status != "rejected",
        )
    )
    if same is not None:
        raise HTTPException(
            status_code=409,
            detail="This recording is already added.",
            headers={"X-Error-Code": RECORDING_DUPLICATE_CODE},
        )
    link = BroadcastRecording(
        broadcast_id=b.id,
        member_id=member.id,
        kind="link",
        provider=provider,
        url=url,
        host=host,
        status="accepted" if direct else "pending",
        source=_source(b, member, team),
        decided_at=now_utc() if direct else None,
        decided_by=None,
    )
    session.add(link)
    await session.commit()
    return link


async def attach_file(
    session: AsyncSession,
    b: Broadcast,
    *,
    member: UserAccount,
    team: bool,
    recording_id: UUID,
) -> BroadcastRecording:
    """The library recording was made: link it. Accepted at once for the author and the team,
    pending for anybody else."""
    direct = _may_decide(b, member, team)
    link = BroadcastRecording(
        broadcast_id=b.id,
        member_id=member.id,
        kind="file",
        recording_id=recording_id,
        status="accepted" if direct else "pending",
        source=_source(b, member, team),
        decided_at=now_utc() if direct else None,
    )
    session.add(link)
    await session.commit()
    return link


async def remove_link(session: AsyncSession, link: BroadcastRecording) -> None:
    """Take a link off a broadcast. A library recording behind it stays in the library."""
    await session.delete(link)
    await session.commit()


async def suggestions(
    session: AsyncSession, *, limit: int, offset: int
) -> tuple[list[tuple[BroadcastRecording, Broadcast, str | None]], int]:
    where = (BroadcastRecording.status == "pending", Broadcast.status == "published")
    total = await session.scalar(
        select(func.count())
        .select_from(BroadcastRecording)
        .join(Broadcast, Broadcast.id == BroadcastRecording.broadcast_id)
        .where(*where)
    )
    rows = (
        await session.execute(
            select(BroadcastRecording, Broadcast, Recording.title)
            .join(Broadcast, Broadcast.id == BroadcastRecording.broadcast_id)
            .outerjoin(Recording, Recording.id == BroadcastRecording.recording_id)
            .where(*where)
            .order_by(BroadcastRecording.created_at)
            .limit(limit)
            .offset(offset)
        )
    ).all()
    return [(link, b, title) for link, b, title in rows], int(total or 0)


async def decide(session: AsyncSession, link: BroadcastRecording, *, accept: bool, by: str) -> None:
    if link.status != "pending":
        raise HTTPException(status_code=409, detail="This suggestion was already decided.")
    link.status = "accepted" if accept else "rejected"
    link.decided_by = by[:255]
    link.decided_at = now_utc()
    await session.commit()
