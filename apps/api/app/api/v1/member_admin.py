from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.models import UserAccount, UserFeedback
from app.schemas.admin import AdminFeedbackItem, AdminFeedbackListResponse, AdminFeedbackUpdate
from app.schemas.member import AdminGrantWrite, AdminMemberItem
from app.services.admin_members import (
    grant_admin,
    is_protected_admin,
    list_admin_members,
    require_admin_member,
    revoke_admin,
)
from app.services.feedback_triage import feedback_is_priority
from app.services.members import require_member_identity, sync_member

router = APIRouter(prefix="/members/admin", tags=["member-admin"])
DatabaseSession = Annotated[AsyncSession, Depends(get_session)]


def _admin_item(member: UserAccount) -> AdminMemberItem:
    return AdminMemberItem(
        id=member.id,
        display_name=member.display_name,
        email=member.email,
        is_admin=member.is_admin,
        is_protected=is_protected_admin(member),
    )


async def admin_member(request: Request, session: DatabaseSession) -> UserAccount:
    member = await sync_member(session, require_member_identity(request))
    return await require_admin_member(session, member)


@router.get("/users", response_model=list[AdminMemberItem])
async def admin_users(
    request: Request,
    session: DatabaseSession,
    q: str | None = Query(default=None, max_length=320),
) -> list[AdminMemberItem]:
    await admin_member(request, session)
    if q and q.strip():
        needle = q.strip().casefold()
        rows = list(
            (
                await session.execute(
                    select(UserAccount)
                    .where(
                        UserAccount.deleted_at.is_(None),
                        func.lower(UserAccount.email).contains(needle),
                    )
                    .order_by(UserAccount.is_admin.desc(), UserAccount.display_name.asc())
                    .limit(20)
                )
            ).scalars()
        )
        return [_admin_item(row) for row in rows]
    return [_admin_item(row) for row in await list_admin_members(session)]


@router.post("/grant", response_model=AdminMemberItem)
async def admin_grant(
    payload: AdminGrantWrite, request: Request, session: DatabaseSession
) -> AdminMemberItem:
    await admin_member(request, session)
    member = await grant_admin(session, payload.email)
    return _admin_item(member)


@router.delete("/users/{user_id}", response_model=AdminMemberItem)
async def admin_revoke(
    user_id: UUID, request: Request, session: DatabaseSession
) -> AdminMemberItem:
    actor = await admin_member(request, session)
    member = await revoke_admin(session, user_id, actor)
    return _admin_item(member)


@router.get("/feedback", response_model=AdminFeedbackListResponse)
async def admin_feedback_list(
    request: Request,
    session: DatabaseSession,
    status: str | None = Query(default="new"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> AdminFeedbackListResponse:
    await admin_member(request, session)
    statement = select(UserFeedback)
    count_statement = select(func.count()).select_from(UserFeedback)
    if status and status != "all":
        statement = statement.where(UserFeedback.status == status)
        count_statement = count_statement.where(UserFeedback.status == status)
    total = await session.scalar(count_statement)
    result = await session.execute(
        statement.order_by(UserFeedback.created_at.desc()).offset(offset).limit(limit)
    )
    items = [
        AdminFeedbackItem(
            feedback_id=str(item.id),
            category=item.category,
            rating=item.rating,
            comment=item.comment,
            page_path=item.page_path,
            contact=item.contact,
            status=item.status,
            created_at=(item.created_at.isoformat() if item.created_at else ""),
            priority=feedback_is_priority(item.category, item.rating),
        )
        for item in result.scalars().all()
    ]
    return AdminFeedbackListResponse(total=int(total or 0), items=items)


@router.patch("/feedback/{feedback_id}", response_model=AdminFeedbackItem)
async def admin_feedback_update(
    feedback_id: UUID,
    payload: AdminFeedbackUpdate,
    request: Request,
    session: DatabaseSession,
) -> AdminFeedbackItem:
    await admin_member(request, session)
    feedback = await session.get(UserFeedback, feedback_id)
    if feedback is None:
        raise HTTPException(status_code=404, detail="Feedback not found")
    feedback.status = payload.status
    await session.commit()
    await session.refresh(feedback)
    return AdminFeedbackItem(
        feedback_id=str(feedback.id),
        category=feedback.category,
        rating=feedback.rating,
        comment=feedback.comment,
        page_path=feedback.page_path,
        contact=feedback.contact,
        status=feedback.status,
        created_at=feedback.created_at.isoformat(),
        priority=feedback_is_priority(feedback.category, feedback.rating),
    )
