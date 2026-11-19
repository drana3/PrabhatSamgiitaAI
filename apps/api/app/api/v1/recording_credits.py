"""Several performers on one recording (docs/co-performers.md).

* `/recordings/{id}/credits`          who is on a recording; the uploader (or team) adds and removes
* `/authors/me/credit-invites...`     the invited page's owner says yes or no, takes themselves off
* `/authors/me/credit-settings`       who may add this page, and the blocked people
* `/credit-links/accept`              a person with no account yet opens the uploader's link
* `/admin/recordings/{id}/credits`    the team adds a credit (a page run by the team)

Errors a person can fix come back as `{"detail": {"code": ..., "message": ...}}`.
"""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, HTTPException, Response, status
from sqlalchemy import select

from app.api.v1.author_profiles import (
    AppSettings,
    DatabaseSession,
    Member,
    OptionalMember,
    Team,
    _by,
    errors,
    own_profile,
)
from app.models import UserAccount
from app.models.author_profiles import AuthorProfile
from app.models.recording_credits import RecordingCredit
from app.models.recordings import Recording
from app.schemas.recording_credits import (
    BlockList,
    BlockOut,
    CreditAdd,
    CreditList,
    CreditOut,
    CreditPage,
    CreditRecording,
    CreditSettings,
    CreditSummary,
    DeclineIn,
    InviteLink,
    InviteList,
    InviteOut,
    MyCreditList,
    MyCreditOut,
    RoleIn,
    TokenIn,
)
from app.services import author_profiles as author_service
from app.services import recording_credits as service
from app.services.recordings import VISIBLE, is_team_member, limiter

router = APIRouter(tags=["credits"])
admin_router = APIRouter(prefix="/admin", tags=["admin"])

# Limits that stop a script, not a person (one place each).
CREDIT_ADDS_PER_HOUR = 30
ANSWERS_PER_HOUR = 60
TOKEN_TRIES_PER_HOUR = 20


def _uuid(raw: str, code: str = "bad_id") -> UUID:
    try:
        return UUID(raw)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail={"code": code, "message": "Not valid"}) from exc


def _recording_view(recording: Recording) -> CreditRecording:
    return CreditRecording(
        id=str(recording.id),
        kind=recording.kind,
        title=recording.title,
        author=recording.author,
    )


async def _out(
    session: DatabaseSession, credits: list[RecordingCredit], *, full: bool
) -> list[CreditOut]:
    page_ids = {c.profile_id for c in credits if c.profile_id is not None}
    pages: dict[UUID, AuthorProfile] = {}
    if page_ids:
        rows = await session.scalars(select(AuthorProfile).where(AuthorProfile.id.in_(page_ids)))
        pages = {p.id: p for p in rows.all()}
    items: list[CreditOut] = []
    for c in credits:
        if not full and c.status not in ("text", "invited", "accepted"):
            continue
        page = pages.get(c.profile_id) if c.profile_id else None
        shown = c.status
        link: CreditPage | None = None
        if c.status == "accepted" and page is not None and page.status == "published":
            link = CreditPage(slug=page.slug, display_name=page.display_name)
        if not full and shown == "invited":
            shown = "text"  # the public never sees that somebody was asked
        items.append(
            CreditOut(
                id=str(c.id),
                name=c.name,
                role=c.role,  # type: ignore[arg-type]
                status=shown,  # type: ignore[arg-type]
                page=link,
            )
        )
    return items


def _summary(credits: list[RecordingCredit]) -> CreditSummary:
    return CreditSummary(
        confirmed=sum(1 for c in credits if c.status == "accepted"),
        waiting=sum(1 for c in credits if c.status == "invited"),
    )


@router.get("/recordings/{recording_id}/credits", response_model=CreditList)
async def recording_credits(
    recording_id: UUID,
    session: DatabaseSession,
    settings: AppSettings,
    member: OptionalMember = None,
) -> CreditList:
    recording = await session.get(Recording, recording_id)
    if recording is None or recording.status not in VISIBLE:
        owner = member is not None and recording is not None and recording.author_id == member.id
        if not owner:
            raise HTTPException(
                status_code=404,
                detail={"code": "recording_not_found", "message": "Recording not found"},
            )
    assert recording is not None
    manage = member is not None and (
        recording.author_id == member.id or is_team_member(member, settings)
    )
    credits = await service.credits_of(session, recording_id)
    visible = [c for c in credits if manage or c.status != "removed"]
    # the public never learns that somebody was asked or left: its summary counts confirmed only
    summary = (
        _summary(credits)
        if manage
        else CreditSummary(confirmed=sum(1 for c in credits if c.status == "accepted"), waiting=0)
    )
    return CreditList(
        credits=await _out(session, visible, full=manage),
        can_manage=manage,
        summary=summary,
    )


async def _add(
    session: DatabaseSession,
    recording_id: UUID,
    payload: CreditAdd,
    member: UserAccount,
    *,
    is_team: bool,
) -> CreditList:
    limiter.hit("credit-add", str(member.id), limit=CREDIT_ADDS_PER_HOUR, window_seconds=3600)
    recording = await session.get(Recording, recording_id)
    if recording is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "recording_not_found", "message": "Recording not found"},
        )
    if not (is_team or (recording.author_id is not None and recording.author_id == member.id)):
        raise HTTPException(
            status_code=403,
            detail={
                "code": "not_yours",
                "message": "Only the person who added the recording can do this",
            },
        )
    pid = _uuid(payload.profile_id, "bad_page") if payload.profile_id else None
    with errors():
        await service.add_credit(
            session,
            recording,
            actor=_by(member) if is_team else f"member:{member.id}",
            name=payload.name,
            profile_id=pid,
            role=payload.role,
            source="team" if is_team else "uploader",
            uploader_id=None if is_team else member.id,
        )
    credits = await service.credits_of(session, recording_id)
    return CreditList(
        credits=await _out(session, [c for c in credits if c.status != "removed"], full=True),
        can_manage=True,
        summary=_summary(credits),
    )


@router.post(
    "/recordings/{recording_id}/credits",
    response_model=CreditList,
    status_code=status.HTTP_201_CREATED,
)
async def add_credit(
    recording_id: UUID,
    payload: CreditAdd,
    session: DatabaseSession,
    settings: AppSettings,
    member: Member,
) -> CreditList:
    return await _add(
        session, recording_id, payload, member, is_team=is_team_member(member, settings)
    )


@admin_router.post(
    "/recordings/{recording_id}/credits",
    response_model=CreditList,
    status_code=status.HTTP_201_CREATED,
)
async def admin_add_credit(
    recording_id: UUID, payload: CreditAdd, session: DatabaseSession, team: Team
) -> CreditList:
    return await _add(session, recording_id, payload, team, is_team=True)


@router.delete("/recordings/{recording_id}/credits/{credit_id}", status_code=204)
async def remove_credit(
    recording_id: UUID,
    credit_id: UUID,
    session: DatabaseSession,
    settings: AppSettings,
    member: Member,
) -> Response:
    team = is_team_member(member, settings)
    row = await session.get(RecordingCredit, credit_id)
    if row is None or row.recording_id != recording_id:
        raise HTTPException(
            status_code=404, detail={"code": "credit_not_found", "message": "Not found"}
        )
    with errors():
        await service.remove(
            session,
            member,
            credit_id,
            is_team=team,
            actor=_by(member) if team else f"member:{member.id}",
        )
    return Response(status_code=204)


@router.put("/recordings/{recording_id}/credits/{credit_id}/role", response_model=CreditOut)
async def uploader_role(
    recording_id: UUID,
    credit_id: UUID,
    payload: RoleIn,
    session: DatabaseSession,
    settings: AppSettings,
    member: Member,
) -> CreditOut:
    with errors():
        credit = await service.change_role_as_uploader(
            session, member, credit_id, payload.role, is_team=is_team_member(member, settings)
        )
    return (await _out(session, [credit], full=True))[0]


@router.post(
    "/recordings/{recording_id}/credits/{credit_id}/link",
    response_model=InviteLink,
    status_code=status.HTTP_201_CREATED,
)
async def invite_link(
    recording_id: UUID,
    credit_id: UUID,
    session: DatabaseSession,
    settings: AppSettings,
    member: Member,
) -> InviteLink:
    limiter.hit("credit-link", str(member.id), limit=CREDIT_ADDS_PER_HOUR, window_seconds=3600)
    with errors():
        token, expires = await service.make_invite_link(
            session, member, credit_id, is_team=is_team_member(member, settings)
        )
    return InviteLink(token=token, expires_at=expires)


# --------------------------------------------------------------------------- the person


@router.get("/authors/me/credit-invites", response_model=InviteList)
async def my_invites(session: DatabaseSession, member: Member) -> InviteList:
    profile = await own_profile(session, member)
    rows = await service.my_invitations(session, profile)
    return InviteList(
        items=[
            InviteOut(
                credit_id=str(c.id),
                recording=_recording_view(r),
                from_name=r.added_by,
                role=c.role,  # type: ignore[arg-type]
                created_at=c.created_at,
                expires_at=c.expires_at,
            )
            for c, r in rows
        ]
    )


@router.post("/authors/me/credit-invites/{credit_id}/accept", response_model=CreditOut)
async def accept_invite(credit_id: UUID, session: DatabaseSession, member: Member) -> CreditOut:
    profile = await own_profile(session, member)
    limiter.hit("credit-answer", str(member.id), limit=ANSWERS_PER_HOUR, window_seconds=3600)
    with errors():
        credit = await service.accept(session, member, profile, credit_id)
    return (await _out(session, [credit], full=True))[0]


@router.post("/authors/me/credit-invites/{credit_id}/decline", response_model=CreditOut)
async def decline_invite(
    credit_id: UUID, session: DatabaseSession, member: Member, payload: DeclineIn | None = None
) -> CreditOut:
    profile = await own_profile(session, member)
    limiter.hit("credit-answer", str(member.id), limit=ANSWERS_PER_HOUR, window_seconds=3600)
    with errors():
        credit = await service.decline(
            session, member, profile, credit_id, block=bool(payload and payload.block)
        )
    return (await _out(session, [credit], full=True))[0]


@router.get("/authors/me/credits", response_model=MyCreditList)
async def my_credits(session: DatabaseSession, member: Member) -> MyCreditList:
    profile = await own_profile(session, member)
    rows = await service.my_credits(session, profile)
    hidden = await service.hidden_ids(session, profile)
    return MyCreditList(
        items=[
            MyCreditOut(
                credit_id=str(c.id),
                recording=_recording_view(r),
                role=c.role,  # type: ignore[arg-type]
                shown=r.id not in hidden,
            )
            for c, r in rows
        ]
    )


@router.post("/authors/me/credits/{credit_id}/leave", response_model=CreditOut)
async def leave_credit(credit_id: UUID, session: DatabaseSession, member: Member) -> CreditOut:
    profile = await own_profile(session, member)
    limiter.hit("credit-answer", str(member.id), limit=ANSWERS_PER_HOUR, window_seconds=3600)
    with errors():
        credit = await service.leave(session, member, profile, credit_id)
    return (await _out(session, [credit], full=True))[0]


@router.put("/authors/me/credits/{credit_id}/role", response_model=CreditOut)
async def person_role(
    credit_id: UUID, payload: RoleIn, session: DatabaseSession, member: Member
) -> CreditOut:
    profile = await own_profile(session, member)
    with errors():
        credit = await service.set_role(session, member, profile, credit_id, payload.role)
    return (await _out(session, [credit], full=True))[0]


@router.get("/authors/me/credit-settings", response_model=CreditSettings)
async def get_settings_(session: DatabaseSession, member: Member) -> CreditSettings:
    profile = await own_profile(session, member)
    return CreditSettings(credit_invites=profile.credit_invites)  # type: ignore[arg-type]


@router.put("/authors/me/credit-settings", response_model=CreditSettings)
async def put_settings(
    payload: CreditSettings, session: DatabaseSession, member: Member
) -> CreditSettings:
    profile = await own_profile(session, member)
    with errors():
        await service.set_invites(session, profile, payload.credit_invites)
    return CreditSettings(credit_invites=profile.credit_invites)  # type: ignore[arg-type]


@router.get("/authors/me/credit-blocks", response_model=BlockList)
async def my_blocks(session: DatabaseSession, member: Member) -> BlockList:
    profile = await own_profile(session, member)
    blocks = await service.blocks_of(session, profile)
    names: dict[UUID, str] = {}
    if blocks:
        rows = await session.execute(
            select(UserAccount.id, UserAccount.display_name).where(
                UserAccount.id.in_([b.blocked_member_id for b in blocks])
            )
        )
        names = {i: n for i, n in rows.all()}
    return BlockList(
        items=[BlockOut(id=str(b.id), name=names.get(b.blocked_member_id, "")) for b in blocks]
    )


@router.delete("/authors/me/credit-blocks/{block_id}", status_code=204)
async def remove_block(block_id: UUID, session: DatabaseSession, member: Member) -> Response:
    profile = await own_profile(session, member)
    with errors():
        await service.unblock(session, profile, block_id)
    return Response(status_code=204)


@router.post("/credit-links/accept", response_model=CreditOut)
async def accept_link(payload: TokenIn, session: DatabaseSession, member: Member) -> CreditOut:
    limiter.hit("credit-token", str(member.id), limit=TOKEN_TRIES_PER_HOUR, window_seconds=3600)
    profile = await author_service.profile_of_member(session, member.id)
    with errors():
        credit = await service.claim_by_token(session, member, profile, payload.token)
    return (await _out(session, [credit], full=True))[0]
