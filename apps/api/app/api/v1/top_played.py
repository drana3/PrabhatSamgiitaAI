"""`GET /top-played`: the most played recordings and Prabhat Samgiita songs, with counted plays.

Public (no sign-in): the same numbers an author page shows. Query: `period` (all | 30d | 7d),
`kind` (repeat it for several kinds; none = every kind), `limit` (1..100) and `offset`.
The phone's Top Played screen and the Radio's popularity boost both read it (docs/radio-mixing.md).
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.schemas.top_played import Period, TopPlayedPage
from app.services import top_played as service
from app.services.recordings import limiter

router = APIRouter(prefix="/top-played", tags=["top-played"])

DatabaseSession = Annotated[AsyncSession, Depends(get_session)]
REQUESTS_PER_MINUTE_PER_HOST = 60
CACHE_SECONDS = 300


@router.get("", response_model=TopPlayedPage)
async def get_top_played(
    request: Request,
    response: Response,
    session: DatabaseSession,
    period: Period = "all",
    kind: Annotated[list[str] | None, Query(max_length=8)] = None,
    limit: Annotated[int, Query(ge=1, le=service.MAX_LIMIT)] = 30,
    offset: Annotated[int, Query(ge=0, le=1000)] = 0,
) -> TopPlayedPage:
    limiter.hit(
        "top-played",
        request.client.host if request.client else "unknown",
        limit=REQUESTS_PER_MINUTE_PER_HOST,
        window_seconds=60,
    )
    response.headers["Cache-Control"] = f"public, max-age={CACHE_SECONDS}"
    return await service.top_played(session, period=period, kinds=kind, limit=limit, offset=offset)
