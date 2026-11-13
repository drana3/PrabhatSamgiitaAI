"""Admin pages: which helper programs the server has (docs/launch-readiness.md) and the last
daily cleanup (docs/housekeeping.md)."""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends

from app.config import Settings, get_settings
from app.core.security import require_admin
from app.services import housekeeping
from app.services.server_tools import tools_report

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/server-tools")
async def server_tools(
    _admin: Annotated[str, Depends(require_admin)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> dict[str, Any]:
    """ffmpeg, fpcalc, ClamAV and time zone data: present or not, with the version line.

    No secret, address or file path is returned.
    """
    return await tools_report(settings)


@router.get("/housekeeping")
async def housekeeping_status(
    _admin: Annotated[str, Depends(require_admin)],
) -> dict[str, Any]:
    """The daily cleanup: on or off, how long each kind of row is kept, and the last run.

    `last_run` is null until the first run since the server started. Counts only; no row content,
    address or file path.
    """
    return housekeeping.status()
