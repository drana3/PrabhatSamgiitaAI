"""Moods of recordings: read, suggest, vote and the team's override
(docs/search-menu.md, section 6).

* `GET  /recording-moods/confirmed`                       what the search menu needs, no sign-in
* `GET  /recording-moods/recordings/{id}`                 the six moods of one recording
* `PUT  /recording-moods/recordings/{id}/suggest`         the uploader names one or two moods
* `PUT  /recording-moods/recordings/{id}/votes/{mood}`    a listener: yes, no or clear
* `PUT  /admin/recording-moods/recordings/{id}/{mood}`    the team: confirmed, rejected or clear
"""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, HTTPException, Response

from app.api.v1.author_profiles import (
    AppSettings,
    DatabaseSession,
    Member,
    OptionalMember,
    Team,
    _by,
)
from app.schemas.recording_moods import (
    ConfirmedItem,
    ConfirmedMoods,
    DecisionIn,
    RecordingMoods,
    SuggestIn,
    VoteIn,
)
from app.services import recording_moods as service
from app.services.recordings import is_team_member, limiter

router = APIRouter(prefix="/recording-moods", tags=["recording-moods"])
admin_router = APIRouter(prefix="/admin/recording-moods", tags=["admin"])

VOTE_CALLS_PER_MINUTE = 20  # stops a script; the daily number of votes is in the service


def _fail(exc: service.MoodError) -> HTTPException:
    # The message as `detail` and the code in `X-Error-Code`, like the recording extras.
    return HTTPException(
        status_code=exc.status, detail=exc.message, headers={"X-Error-Code": exc.code}
    )


@router.get("/confirmed", response_model=ConfirmedMoods)
async def confirmed(session: DatabaseSession, response: Response) -> ConfirmedMoods:
    response.headers["Cache-Control"] = "public, max-age=300"
    found = await service.confirmed_moods(session)
    return ConfirmedMoods(
        items=[ConfirmedItem(recording_id=rid, moods=moods) for rid, moods in found.items()]
    )


@router.get("/recordings/{recording_id}", response_model=RecordingMoods)
async def recording_moods(
    recording_id: UUID, session: DatabaseSession, settings: AppSettings, member: OptionalMember
) -> dict[str, object]:
    try:
        recording = await service.visible(session, recording_id)
        team = member is not None and is_team_member(member, settings)
        return await service.page(session, settings, recording, member, team=team)
    except service.MoodError as exc:
        raise _fail(exc) from exc


@router.put("/recordings/{recording_id}/suggest", status_code=204)
async def suggest(
    recording_id: UUID, body: SuggestIn, session: DatabaseSession, who: Member
) -> Response:
    try:
        recording = await service.visible(session, recording_id)
        await service.suggest(session, recording, who, body.moods)
    except service.MoodError as exc:
        raise _fail(exc) from exc
    return Response(status_code=204)


@router.put("/recordings/{recording_id}/votes/{mood}", status_code=204)
async def vote(
    recording_id: UUID,
    mood: str,
    body: VoteIn,
    session: DatabaseSession,
    settings: AppSettings,
    who: Member,
) -> Response:
    limiter.hit("mood-vote", str(who.id), limit=VOTE_CALLS_PER_MINUTE, window_seconds=60)
    try:
        recording = await service.visible(session, recording_id)
        await service.vote(session, settings, recording, who, mood, body.vote)
    except service.MoodError as exc:
        raise _fail(exc) from exc
    return Response(status_code=204)


@admin_router.put("/recordings/{recording_id}/{mood}", status_code=204)
async def decide(
    recording_id: UUID, mood: str, body: DecisionIn, session: DatabaseSession, team: Team
) -> Response:
    try:
        recording = await service.visible(session, recording_id)
        await service.team_decide(session, recording, mood, body.decision, _by(team))
    except service.MoodError as exc:
        raise _fail(exc) from exc
    return Response(status_code=204)


@admin_router.post("/recompute")
async def recompute(session: DatabaseSession, team: Team) -> dict[str, int]:
    """After accounts were deleted: counters and status from the votes that are left."""
    return {"rows": await service.recompute_all(session)}
