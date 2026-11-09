"""Forced and recommended updates (docs/forced-update.md).

`GET /app/version-status` is open: the app asks it at launch, before anyone has signed in.
The team sets the limits with `GET/PUT /admin/app-versions`.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, Field

from app.api.v1.extras_common import DatabaseSession, Member
from app.models import UserAccount
from app.models.app_version import AppVersionPolicy
from app.services import app_versions as service
from app.services.admin_members import require_admin_member

router = APIRouter(tags=["app-versions"])


class VersionStatusOut(BaseModel):
    status: str
    platform: str | None = None
    minimum_version: str | None = None
    recommended_version: str | None = None
    store_url: str | None = None


class PolicyOut(BaseModel):
    platform: str
    minimum_version: str | None = None
    recommended_version: str | None = None
    store_url: str | None = None
    note: str | None = None
    updated_by: str | None = None


class PolicyWrite(BaseModel):
    minimum_version: str | None = Field(default=None, max_length=20)
    recommended_version: str | None = Field(default=None, max_length=20)
    store_url: str | None = Field(default=None, max_length=300)
    note: str | None = Field(default=None, max_length=300)


@router.get("/app/version-status", response_model=VersionStatusOut)
async def version_status(
    response: Response,
    session: DatabaseSession,
    platform: Annotated[str | None, Query(max_length=10)] = None,
    version: Annotated[str | None, Query(max_length=32)] = None,
) -> VersionStatusOut:
    response.headers["Cache-Control"] = "public, max-age=60"
    clean = (platform or "").strip().lower()
    policy = await service.get_policy(session, clean) if clean in service.PLATFORMS else None
    result = service.evaluate(clean, version, policy)
    return VersionStatusOut(
        status=result.status,
        platform=result.platform,
        minimum_version=result.minimum_version,
        recommended_version=result.recommended_version,
        store_url=result.store_url,
    )


async def get_admin(member: Member, session: DatabaseSession) -> UserAccount:
    return await require_admin_member(session, member)


Admin = Annotated[UserAccount, Depends(get_admin)]


@router.get("/admin/app-versions", response_model=list[PolicyOut])
async def list_policies(session: DatabaseSession, _admin: Admin) -> list[PolicyOut]:
    rows = await service.list_policies(session)
    return [PolicyOut.model_validate(row, from_attributes=True) for row in rows]


@router.put("/admin/app-versions/{platform}", response_model=PolicyOut)
async def set_policy(
    platform: str,
    body: PolicyWrite,
    session: DatabaseSession,
    admin: Admin,
) -> PolicyOut:
    key = platform.strip().lower()
    if key not in service.PLATFORMS:
        raise HTTPException(status_code=404, detail="Unknown platform")
    try:
        minimum = service.clean_version(body.minimum_version, "The minimum version")
        recommended = service.clean_version(body.recommended_version, "The recommended version")
        store_url = service.clean_store_url(body.store_url)
        service.check_pair(minimum, recommended)
    except service.PolicyError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    row = await service.get_policy(session, key)
    if row is None:
        row = AppVersionPolicy(platform=key)
        session.add(row)
    row.minimum_version = minimum
    row.recommended_version = recommended
    row.store_url = store_url
    row.note = (body.note or "").strip() or None
    row.updated_by = admin.email or str(admin.id)
    await session.commit()
    await session.refresh(row)
    return PolicyOut.model_validate(row, from_attributes=True)
