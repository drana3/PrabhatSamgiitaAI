"""The team's pins for the phone's search menu: a tiny admin-editable list (docs/search-menu.md).

`GET  /search-menu/pins`        public: the pinned shelf ids, in order (read once a day).
`PUT  /admin/search-menu/pins`  team only: replace the whole list (empty list = no pins).
"""

from __future__ import annotations

import re
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.security import require_admin
from app.models.search_menu import SearchMenuPin

router = APIRouter(prefix="/search-menu", tags=["search-menu"])
admin_router = APIRouter(prefix="/admin/search-menu", tags=["admin"])

DatabaseSession = Annotated[AsyncSession, Depends(get_session)]
AdminIdentity = Annotated[str, Depends(require_admin)]

# Shelves a menu can hold at the top at once (the phone shows at most this many pinned shelves).
MAX_PINS = 4
_SHELF_ID = re.compile(r"^[a-z0-9][a-z0-9:_-]{0,79}$")


class PinsOut(BaseModel):
    pins: list[str]


class PinsIn(BaseModel):
    pins: list[str] = Field(default_factory=list, max_length=MAX_PINS)

    @field_validator("pins")
    @classmethod
    def _clean(cls, value: list[str]) -> list[str]:
        seen: list[str] = []
        for raw in value:
            shelf = raw.strip().lower()
            if not _SHELF_ID.match(shelf):
                raise ValueError("A shelf id is lowercase letters, digits, ':', '_' or '-'.")
            if shelf not in seen:
                seen.append(shelf)
        return seen


async def read_pins(session: AsyncSession) -> list[str]:
    rows = await session.scalars(
        select(SearchMenuPin.shelf_id).order_by(SearchMenuPin.position, SearchMenuPin.shelf_id)
    )
    return list(rows)


@router.get("/pins", response_model=PinsOut)
async def get_pins(session: DatabaseSession) -> PinsOut:
    return PinsOut(pins=await read_pins(session))


@admin_router.put("/pins", response_model=PinsOut)
async def put_pins(payload: PinsIn, admin: AdminIdentity, session: DatabaseSession) -> PinsOut:
    await session.execute(delete(SearchMenuPin))
    for position, shelf in enumerate(payload.pins):
        session.add(SearchMenuPin(shelf_id=shelf, position=position, pinned_by=admin[:120]))
    await session.commit()
    return PinsOut(pins=await read_pins(session))
