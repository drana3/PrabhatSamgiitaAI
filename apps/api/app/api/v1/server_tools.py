"""Admin page: which helper programs the server has (docs/launch-readiness.md)."""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends

from app.config import Settings, get_settings
from app.core.security import require_admin
from app.services.server_tools import tools_report

router = APIRouter(prefix="/admin/server-tools", tags=["admin"])


@router.get("")
async def server_tools(
    _admin: Annotated[str, Depends(require_admin)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> dict[str, Any]:
    """ffmpeg, fpcalc, ClamAV and time zone data: present or not, with the version line.

    No secret, address or file path is returned.
    """
    return await tools_report(settings)
