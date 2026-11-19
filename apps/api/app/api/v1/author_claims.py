"""Claiming recordings that somebody else added (docs/author-profiles.md, "Claiming recordings").

* `/authors/me/claims...`   the owner of a page: suggestions by name, the "Find my recordings"
                            search, making and taking back claims, "also known as" names.
* `/admin/authors/claims`   the team desk: look at, approve, reject, revoke, in bulk by page.

Errors a person can fix come back as `{"detail": {"code": ..., "message": ...}}`, as everywhere in
the author API.
"""

from __future__ import annotations

from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, Response, status

from app.api.v1.author_profiles import (
    DatabaseSession,
    Member,
    Team,
    _by,
    errors,
    own_profile,
)
from app.models.author_profiles import AuthorClaim, AuthorProfile
from app.schemas.author_claims import (
    AdminBulk,
    AdminBulkResult,
    AdminClaimList,
    AdminDecision,
    AliasIn,
    AliasList,
    ClaimList,
    ClaimsCreate,
    ClaimsCreated,
    ClaimSearch,
    ClaimSuggestions,
    ClaimSummary,
    DeskSummary,
    ShownOnPagesList,
)
from app.schemas.author_proofs import (
    AdminProofList,
    AdminProofOut,
    AskMore,
    CodeIn,
    CodeSent,
    PageDetail,
    ProofDecision,
    ProofIn,
    ProofOut,
    RequestState,
)
from app.services import author_claims as service
from app.services import author_profiles as author_service
from app.services import author_proofs as proofs
from app.services.recordings import limiter

router = APIRouter(prefix="/authors", tags=["authors"])
# "My uploads": which of the member's own recordings sit on someone else's author page
uploads_router = APIRouter(prefix="/recordings/mine", tags=["authors"])
admin_router = APIRouter(prefix="/admin/authors/claims", tags=["admin"])

# Limits that stop a script, not a person (one place each).
SEARCHES_PER_MINUTE = 30
CLAIM_CALLS_PER_HOUR = 40
ALIAS_EDITS_PER_HOUR = 20
PROOF_CALLS_PER_HOUR = 20
CODE_TRIES_PER_HOUR = 20


def _ids(raw: list[str]) -> list[UUID]:
    try:
        return [UUID(r) for r in raw]
    except ValueError as exc:
        raise HTTPException(
            status_code=422, detail={"code": "bad_id", "message": "Not a recording"}
        ) from exc


@router.get("/me/claims/summary", response_model=ClaimSummary)
async def claim_summary(session: DatabaseSession, member: Member) -> ClaimSummary:
    return await service.summary(session, await own_profile(session, member))


@router.get("/me/claims/suggestions", response_model=ClaimSuggestions)
async def claim_suggestions(session: DatabaseSession, member: Member) -> ClaimSuggestions:
    profile = await own_profile(session, member)
    limiter.hit("author-claim-search", str(member.id), limit=SEARCHES_PER_MINUTE, window_seconds=60)
    names, found = await service.suggestions(session, profile)
    return ClaimSuggestions(
        names=names,
        same=[c for c in found if c.level == "same"],
        alike=[c for c in found if c.level != "same"],
        total=len(found),
    )


@router.get("/me/claims/search", response_model=ClaimSearch)
async def claim_search(
    session: DatabaseSession,
    member: Member,
    q: Annotated[str, Query(min_length=1, max_length=80)],
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> ClaimSearch:
    profile = await own_profile(session, member)
    limiter.hit("author-claim-search", str(member.id), limit=SEARCHES_PER_MINUTE, window_seconds=60)
    items, total = await service.search(session, profile, q, limit=limit, offset=offset)
    return ClaimSearch(query=q, items=items, total=total, has_more=offset + len(items) < total)


@router.get("/me/claims", response_model=ClaimList)
async def my_claims(
    session: DatabaseSession,
    member: Member,
    status_filter: Annotated[
        Literal["pending", "approved", "rejected", "withdrawn", "revoked"] | None,
        Query(alias="status"),
    ] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> ClaimList:
    profile = await own_profile(session, member)
    items, total = await service.my_claims(
        session, profile, status=status_filter, limit=limit, offset=offset
    )
    return ClaimList(items=items, total=total)


@router.post("/me/claims", response_model=ClaimsCreated, status_code=status.HTTP_201_CREATED)
async def make_claims(
    payload: ClaimsCreate, session: DatabaseSession, member: Member
) -> ClaimsCreated:
    profile = await own_profile(session, member)
    limiter.hit("author-claim", str(member.id), limit=CLAIM_CALLS_PER_HOUR, window_seconds=3600)
    with errors():
        return await service.claim(
            session, member.id, profile, _ids(payload.recording_ids), payload.note
        )


# ---- proof of identity: "My request" (one proof per page, not per recording)


@router.get("/me/claims/request", response_model=RequestState)
async def my_request(session: DatabaseSession, member: Member) -> RequestState:
    return await proofs.request_state(session, await own_profile(session, member))


@router.post("/me/claims/proofs", response_model=ProofOut, status_code=status.HTTP_201_CREATED)
async def send_proof(payload: ProofIn, session: DatabaseSession, member: Member) -> ProofOut:
    profile = await own_profile(session, member)
    limiter.hit("author-proof", str(member.id), limit=PROOF_CALLS_PER_HOUR, window_seconds=3600)
    with errors():
        return await proofs.submit(
            session, profile, member.id, kind=payload.kind, value=payload.value, note=payload.note
        )


@router.post("/me/claims/proofs/{proof_id}/code", response_model=ProofOut)
async def enter_code(
    proof_id: UUID, payload: CodeIn, session: DatabaseSession, member: Member
) -> ProofOut:
    profile = await own_profile(session, member)
    limiter.hit("author-proof-code", str(member.id), limit=CODE_TRIES_PER_HOUR, window_seconds=3600)
    with errors():
        return await proofs.confirm_code(session, profile, proof_id, payload.code)


@router.delete("/me/claims/proofs/{proof_id}", status_code=status.HTTP_204_NO_CONTENT)
async def take_back_proof(proof_id: UUID, session: DatabaseSession, member: Member) -> Response:
    profile = await own_profile(session, member)
    with errors():
        await proofs.withdraw_proof(session, profile, proof_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/me/claims/{claim_id}", status_code=status.HTTP_204_NO_CONTENT)
async def withdraw_claim(claim_id: UUID, session: DatabaseSession, member: Member) -> Response:
    profile = await own_profile(session, member)
    with errors():
        await service.withdraw(session, profile, claim_id, f"member:{member.id}")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@uploads_router.get("/author-pages", response_model=ShownOnPagesList)
async def my_uploads_on_author_pages(session: DatabaseSession, member: Member) -> ShownOnPagesList:
    return ShownOnPagesList(items=await service.pages_of_my_recordings(session, member.id))


@router.get("/me/aliases", response_model=AliasList)
async def my_aliases(session: DatabaseSession, member: Member) -> AliasList:
    profile = await own_profile(session, member)
    return AliasList(
        items=[
            {"alias": a.alias, "key": a.alias_key}  # type: ignore[misc]
            for a in await service.aliases_of(session, profile)
        ]
    )


@router.post("/me/aliases", response_model=AliasList, status_code=status.HTTP_201_CREATED)
async def add_alias(payload: AliasIn, session: DatabaseSession, member: Member) -> AliasList:
    profile = await own_profile(session, member)
    limiter.hit("author-alias", str(member.id), limit=ALIAS_EDITS_PER_HOUR, window_seconds=3600)
    with errors():
        return AliasList(items=await service.add_alias(session, profile, payload.alias))


@router.delete("/me/aliases/{key}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_alias(key: str, session: DatabaseSession, member: Member) -> Response:
    profile = await own_profile(session, member)
    limiter.hit("author-alias", str(member.id), limit=ALIAS_EDITS_PER_HOUR, window_seconds=3600)
    with errors():
        await service.remove_alias(session, profile, key)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --------------------------------------------------------------------------- the team desk


@admin_router.get("", response_model=AdminClaimList)
async def desk_list(
    session: DatabaseSession,
    team: Team,
    status_filter: Annotated[
        Literal["pending", "approved", "rejected", "withdrawn", "revoked"] | None,
        Query(alias="status"),
    ] = "pending",
    profile_id: UUID | None = None,
    reason: Annotated[str | None, Query(max_length=24)] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> AdminClaimList:
    items, total = await service.admin_list(
        session,
        status=status_filter,
        profile_id=profile_id,
        reason=reason,
        limit=limit,
        offset=offset,
    )
    return AdminClaimList(items=items, total=total)


@admin_router.get("/summary", response_model=DeskSummary)
async def desk_summary(session: DatabaseSession, team: Team) -> DeskSummary:
    summary = await service.desk_summary(session)
    summary.proofs_waiting, summary.overdue = await proofs.desk_counts(session)
    return summary


# ---- proofs on the team desk

PROOF_STATUS = Literal["waiting", "code_sent", "ok", "declined", "more_needed", "withdrawn"]


@admin_router.get("/proofs", response_model=AdminProofList)
async def desk_proofs(
    session: DatabaseSession,
    team: Team,
    status_filter: Annotated[PROOF_STATUS | None, Query(alias="status")] = "waiting",
    limit: Annotated[int, Query(ge=1, le=200)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> AdminProofList:
    items, total = await proofs.admin_list_proofs(
        session, status=status_filter, limit=limit, offset=offset
    )
    return AdminProofList(items=items, total=total)


@admin_router.get("/pages/{profile_id}", response_model=PageDetail)
async def desk_page(profile_id: UUID, session: DatabaseSession, team: Team) -> PageDetail:
    with errors():
        return await proofs.page_detail(session, profile_id)


@admin_router.post("/pages/{profile_id}/ask-more", response_model=AdminBulkResult)
async def desk_ask_more(
    profile_id: UUID, payload: AskMore, session: DatabaseSession, team: Team
) -> AdminBulkResult:
    with errors():
        await proofs.ask_more(session, profile_id, by=_by(team), note=payload.note)
    return AdminBulkResult(changed=1)


@admin_router.post("/proofs/{proof_id}/send-code", response_model=CodeSent)
async def desk_send_code(proof_id: UUID, session: DatabaseSession, team: Team) -> CodeSent:
    with errors():
        return CodeSent(sent=await proofs.send_code(session, proof_id, _by(team)))


async def _decide_proof(
    session: DatabaseSession, team: Team, proof_id: UUID, action: str, payload: ProofDecision
) -> AdminProofOut:
    with errors():
        row, _ = await proofs.decide_proof(
            session,
            proof_id,
            action=action,
            by=_by(team),
            note=payload.note,
            approve_waiting=payload.approve_waiting,
        )
    profile = await session.get(AuthorProfile, row.profile_id)
    assert profile is not None
    return proofs.admin_proof_out(row, profile)


@admin_router.post("/proofs/{proof_id}/ok", response_model=AdminProofOut)
async def desk_proof_ok(
    proof_id: UUID, payload: ProofDecision, session: DatabaseSession, team: Team
) -> AdminProofOut:
    return await _decide_proof(session, team, proof_id, "ok", payload)


@admin_router.post("/proofs/{proof_id}/decline", response_model=AdminProofOut)
async def desk_proof_decline(
    proof_id: UUID, payload: ProofDecision, session: DatabaseSession, team: Team
) -> AdminProofOut:
    return await _decide_proof(session, team, proof_id, "decline", payload)


@admin_router.post("/proofs/{proof_id}/more", response_model=AdminProofOut)
async def desk_proof_more(
    proof_id: UUID, payload: ProofDecision, session: DatabaseSession, team: Team
) -> AdminProofOut:
    return await _decide_proof(session, team, proof_id, "more", payload)


async def _decide(
    session: DatabaseSession, team: Team, claim_id: UUID, action: str, note: str | None
) -> AdminBulkResult:
    with errors():
        changed = await service.admin_decide(
            session, [claim_id], profile_id=None, action=action, by=_by(team), note=note
        )
    if not changed:
        raise HTTPException(
            status_code=409, detail={"code": "claim_closed", "message": "Nothing to change"}
        )
    return AdminBulkResult(changed=changed)


@admin_router.post("/bulk", response_model=AdminBulkResult)
async def desk_bulk(payload: AdminBulk, session: DatabaseSession, team: Team) -> AdminBulkResult:
    with errors():
        changed = await service.admin_decide(
            session,
            None if payload.ids is None else _ids(payload.ids),
            profile_id=_ids([payload.profile_id])[0] if payload.profile_id else None,
            action=payload.action,
            by=_by(team),
            note=payload.note,
        )
    return AdminBulkResult(changed=changed)


@admin_router.post("/{claim_id}/approve", response_model=AdminBulkResult)
async def desk_approve(
    claim_id: UUID, payload: AdminDecision, session: DatabaseSession, team: Team
) -> AdminBulkResult:
    result = await _decide(session, team, claim_id, "approve", payload.note)
    if payload.with_others:
        # the same recording on every page that waits for it ("both pages")
        with errors():
            others = await service.approve_with_others(session, claim_id)
            if others:
                result.changed += await service.admin_decide(
                    session,
                    others,
                    profile_id=None,
                    action="approve",
                    by=_by(team),
                    note=payload.note,
                )
    if payload.verify_page:
        row = await session.get(AuthorClaim, claim_id)
        profile = await session.get(AuthorProfile, row.profile_id) if row else None
        if profile is not None and not profile.verified:
            await author_service.admin_verify(session, profile, _by(team), True)
    return result


@admin_router.post("/{claim_id}/reject", response_model=AdminBulkResult)
async def desk_reject(
    claim_id: UUID, payload: AdminDecision, session: DatabaseSession, team: Team
) -> AdminBulkResult:
    return await _decide(session, team, claim_id, "reject", payload.note)


@admin_router.post("/{claim_id}/revoke", response_model=AdminBulkResult)
async def desk_revoke(
    claim_id: UUID, payload: AdminDecision, session: DatabaseSession, team: Team
) -> AdminBulkResult:
    return await _decide(session, team, claim_id, "revoke", payload.note)


@admin_router.post("/{claim_id}/reopen", response_model=AdminBulkResult)
async def desk_reopen(
    claim_id: UUID, payload: AdminDecision, session: DatabaseSession, team: Team
) -> AdminBulkResult:
    return await _decide(session, team, claim_id, "reopen", payload.note)
