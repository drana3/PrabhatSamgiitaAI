from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.schemas.notation import NotationSourceResponse, TransposedNotationResponse
from app.services.catalog import CatalogService
from app.services.harmonium import load_song_notation, normalize_tonic, transpose_notation

router = APIRouter(prefix="/songs", tags=["notation"])


@router.get("/{number}/notation/source", response_model=NotationSourceResponse)
async def get_notation_source(
    number: int,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> NotationSourceResponse:
    service = CatalogService(session)
    song = await service.get_song(number)
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")
    notation = await service.get_notation(number)
    if not notation or not notation.source_url:
        raise HTTPException(status_code=404, detail="Notation source not available")
    machine_readable = bool(
        notation.notation_text and notation.notation_text.strip().startswith("{")
    )
    return NotationSourceResponse(
        song_number=number,
        source_url=notation.source_url,
        verification_status=notation.verification_status,
        machine_readable=machine_readable,
        transposition_available=machine_readable,
    )


@router.get("/{number}/notation", response_model=TransposedNotationResponse)
async def get_notation(
    number: int,
    session: Annotated[AsyncSession, Depends(get_session)],
    scale: str = Query(default="C"),
    system: str = Query(default="sargam"),
) -> TransposedNotationResponse:
    if system.lower() not in {"sargam", "western", "numeric"}:
        raise HTTPException(status_code=400, detail="Unsupported notation system")
    song = await CatalogService(session).get_song(number)
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")
    notation = await load_song_notation(session, song)
    if not notation:
        raise HTTPException(status_code=404, detail="Notation not available")
    target_scale = normalize_tonic(scale)
    transposed = transpose_notation(notation, target_scale)
    if system.lower() == "western":
        # Keep the canonical schema but expose western notes in-place.
        pass
    return TransposedNotationResponse(
        song_number=number,
        source_scale=notation.source_scale,
        target_scale=target_scale,
        verification_status=song.canonical_source_status,
        notation=transposed,
    )
