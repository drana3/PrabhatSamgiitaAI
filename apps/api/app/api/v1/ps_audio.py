# ruff: noqa: E501
"""`GET /api/v1/ps-audio/{file}`: the colleagues' PS recordings from the private bucket (docs/ps-audio.md).

Answers with a redirect to a short-lived signed link, so the audio bytes never pass through the API and the
bucket stays private. Only files that a `media` row names are served.
"""

from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse

from app.config import Settings, get_settings
from app.services import ps_audio
from app.services.catalog import media_by_song_number
from app.services.recording_storage import StorageError

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ps-audio", tags=["ps-audio"])

AppSettings = Annotated[Settings, Depends(get_settings)]


@router.api_route("/{filename}", methods=["GET", "HEAD"])
async def play_ps_audio(filename: str, request: Request, settings: AppSettings) -> RedirectResponse:
    if not ps_audio.ps_audio_file_ok(filename):
        raise HTTPException(status_code=404, detail="Recording not found")
    number = int(filename.split(" ", 1)[0])
    if not ps_audio.is_registered(filename, media_by_song_number().get(number, ())):
        raise HTTPException(status_code=404, detail="Recording not found")
    try:
        url = ps_audio.signed_get_url(settings, filename, method=request.method)
    except StorageError as exc:
        logger.warning("PS audio link not available: %s", exc)
        raise HTTPException(status_code=503, detail="Recording storage is not available") from exc
    return RedirectResponse(url, status_code=302, headers={"Cache-Control": "private, max-age=300"})
