"""Song translations: official, poetic and literal.

Reading is open to everyone and serves only what a reader may see (see `service.publicly_visible`):
published texts that are official, checked or read by an editor; a literal translation only when it
is checked. Members do NOT offer translations. The team adds them, puts "Checked" on them and runs
the import of the official texts. The team's calls are served two ways, like the chord proposals:
with the admin key (`/admin/song-translations`) and, for the list and the "Checked" step, to
signed-in team members (`/song-translations/review`, for a future team screen in the app).
Design: docs/ps-translations.md.
"""

from __future__ import annotations

import hashlib
import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Request, Response, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.core.db import get_session
from app.core.security import require_admin
from app.models import UserAccount
from app.models.recordings import PS_SONG_COUNT
from app.schemas.song_translations import (
    AdminFilter,
    AdminTranslationList,
    AdminTranslationOut,
    Availability,
    ImportReport,
    Kind,
    TranslationCreate,
    TranslationList,
    VerifyRequest,
)
from app.services import song_translations as service
from app.services.members import require_member_identity, sync_member
from app.services.recordings import is_team_member

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/song-translations", tags=["song-translations"])
admin_router = APIRouter(prefix="/admin/song-translations", tags=["admin"])

DatabaseSession = Annotated[AsyncSession, Depends(get_session)]
AppSettings = Annotated[Settings, Depends(get_settings)]
AdminIdentity = Annotated[str, Depends(require_admin)]
SongNumber = Annotated[int, Path(ge=1, le=PS_SONG_COUNT)]
Language = Annotated[
    str, Query(min_length=2, max_length=12, pattern=r"^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$")
]


async def get_member(request: Request, session: DatabaseSession) -> UserAccount:
    return await sync_member(session, require_member_identity(request))


Member = Annotated[UserAccount, Depends(get_member)]


async def get_team_member(member: Member, settings: AppSettings) -> UserAccount:
    if not is_team_member(member, settings):
        raise HTTPException(status_code=403, detail="Only the team can do this.")
    return member


TeamMember = Annotated[UserAccount, Depends(get_team_member)]


def _name(member: UserAccount) -> str:
    name = (member.display_name or "").strip()
    return name if name and "@" not in name else "Team"


# --------------------------------------------------------------------------- reading


@router.get("/songs/{song_id}", response_model=TranslationList)
async def list_for_song(
    song_id: SongNumber,
    request: Request,
    response: Response,
    session: DatabaseSession,
    language: Language = "en",
) -> TranslationList | Response:
    """The translations of a song a reader may see, in the order the page shows them. ETag-aware."""
    rows = await service.list_for_song(session, song_id, language)
    items = [service.public_out(row) for row in rows]
    kinds: list[Kind] = []
    for item in items:
        if item.kind not in kinds:
            kinds.append(item.kind)
    body = TranslationList(song_id=song_id, language=language, kinds=kinds, items=items)
    stamp = "|".join(f"{r.id}:{r.updated_at}:{r.trust}:{r.status}" for r in rows) or "none"
    etag = f'W/"{hashlib.sha256(stamp.encode()).hexdigest()[:24]}"'
    if request.headers.get("if-none-match") == etag:
        return Response(status_code=status.HTTP_304_NOT_MODIFIED, headers={"ETag": etag})
    response.headers["ETag"] = etag
    response.headers["Cache-Control"] = "public, max-age=300"
    return body


@router.get("/availability", response_model=Availability)
async def availability(
    response: Response, session: DatabaseSession, language: Language = "en"
) -> Availability:
    """Which songs have which kind (for search and the marks in lists)."""
    response.headers["Cache-Control"] = "public, max-age=600"
    return await service.availability(session, language)


# --------------------------------------------------------------------------- the team, in the app


@router.get("/review/queue", response_model=AdminTranslationList)
async def review_list(
    team: TeamMember,
    session: DatabaseSession,
    filter: AdminFilter = "unchecked",
    song_id: Annotated[int | None, Query(ge=1, le=PS_SONG_COUNT)] = None,
    kind: Kind | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 30,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> AdminTranslationList:
    return await _list(session, filter, song_id, kind, limit, offset)


@router.post("/review/{translation_id}/verify", response_model=AdminTranslationOut)
async def review_verify(
    translation_id: UUID, payload: VerifyRequest, team: TeamMember, session: DatabaseSession
) -> AdminTranslationOut:
    row = await service.get_row(session, translation_id)
    row = await service.verify(session, row, by=_name(team), note=payload.note)
    return service.admin_out(row)


@router.post("/review/{translation_id}/unverify", response_model=AdminTranslationOut)
async def review_unverify(
    translation_id: UUID, team: TeamMember, session: DatabaseSession
) -> AdminTranslationOut:
    row = await service.get_row(session, translation_id)
    return service.admin_out(await service.unverify(session, row))


# --------------------------------------------------------------------------- the team, admin key


async def _list(
    session: AsyncSession,
    which: AdminFilter,
    song_id: int | None,
    kind: str | None,
    limit: int,
    offset: int,
) -> AdminTranslationList:
    rows, total = await service.admin_list(
        session, which=which, song_id=song_id, kind=kind, limit=limit, offset=offset
    )
    return AdminTranslationList(items=[service.admin_out(r) for r in rows], total=total)


@admin_router.get("", response_model=AdminTranslationList)
async def admin_list(
    admin: AdminIdentity,
    session: DatabaseSession,
    filter: AdminFilter = "all",
    song_id: Annotated[int | None, Query(ge=1, le=PS_SONG_COUNT)] = None,
    kind: Kind | None = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> AdminTranslationList:
    """Every text, including the ones readers do not see (not checked yet, archived)."""
    return await _list(session, filter, song_id, kind, limit, offset)


@admin_router.post("", response_model=AdminTranslationOut, status_code=status.HTTP_201_CREATED)
async def admin_create(
    payload: TranslationCreate, admin: AdminIdentity, session: DatabaseSession
) -> AdminTranslationOut:
    """The team adds a text (poetic, literal or another official version). Never `verified`: that is
    its own step."""
    try:
        row = await service.create_translation(
            session, payload, by=(payload.reviewer or admin).strip() or admin
        )
    except SQLAlchemyError as exc:
        await session.rollback()
        logger.exception("Translation could not be stored")
        raise HTTPException(status_code=503, detail="Storage is temporarily unavailable") from exc
    return service.admin_out(row)


@admin_router.post("/{translation_id}/verify", response_model=AdminTranslationOut)
async def admin_verify(
    translation_id: UUID, payload: VerifyRequest, admin: AdminIdentity, session: DatabaseSession
) -> AdminTranslationOut:
    """Put "Checked" on a published text: a named checker, the time and an optional note."""
    row = await service.get_row(session, translation_id)
    row = await service.verify(session, row, by=(payload.reviewer or admin), note=payload.note)
    return service.admin_out(row)


@admin_router.post("/{translation_id}/unverify", response_model=AdminTranslationOut)
async def admin_unverify(
    translation_id: UUID, admin: AdminIdentity, session: DatabaseSession
) -> AdminTranslationOut:
    row = await service.get_row(session, translation_id)
    return service.admin_out(await service.unverify(session, row))


@admin_router.post("/{translation_id}/archive", response_model=AdminTranslationOut)
async def admin_archive(
    translation_id: UUID, admin: AdminIdentity, session: DatabaseSession
) -> AdminTranslationOut:
    row = await service.get_row(session, translation_id)
    return service.admin_out(await service.archive(session, row))


@admin_router.post("/{translation_id}/restore", response_model=AdminTranslationOut)
async def admin_restore(
    translation_id: UUID, admin: AdminIdentity, session: DatabaseSession
) -> AdminTranslationOut:
    row = await service.get_row(session, translation_id)
    return service.admin_out(await service.restore(session, row))


@admin_router.post("/import", response_model=ImportReport)
async def admin_import(
    admin: AdminIdentity, session: DatabaseSession, dry_run: bool = True
) -> ImportReport:
    """Import the official English translations from `songs.english_meaning`. A dry run is the
    default: the report, nothing written. Run again with `dry_run=false` to write. Safe to
    repeat."""
    try:
        return await service.import_official(session, dry_run=dry_run)
    except SQLAlchemyError as exc:
        await session.rollback()
        logger.exception("Official translations could not be imported")
        raise HTTPException(status_code=503, detail="Storage is temporarily unavailable") from exc
