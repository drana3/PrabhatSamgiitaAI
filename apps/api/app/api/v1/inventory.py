from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.schemas.inventory import InventoryItemOut
from app.services.catalog import CatalogService

router = APIRouter(prefix="/inventory", tags=["inventory"])


@router.get("", response_model=list[InventoryItemOut])
async def inventory(
    session: Annotated[AsyncSession, Depends(get_session)],
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> list[InventoryItemOut]:
    items = await CatalogService(session).inventory(limit=limit, offset=offset)
    return [InventoryItemOut.model_validate(item, from_attributes=True) for item in items]
