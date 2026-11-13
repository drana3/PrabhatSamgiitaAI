"""The team's queue of words authors added to a recording (a main instrument, a style, a language).

Mounted under `/recordings` by `recordings.py` (before its `/{recording_id}` routes). Design:
docs/kiirtan-recording-info.md, "Add your own".
"""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.extras_common import TeamMember
from app.core.db import get_session
from app.models.recordings import ValueSuggestion
from app.schemas.value_suggestions import (
    AcceptedWord,
    Decision,
    MergeTarget,
    SuggestionList,
    SuggestionOut,
    ValueOptions,
)
from app.services import value_suggestions as words

router = APIRouter(tags=["recordings"])
DatabaseSession = Annotated[AsyncSession, Depends(get_session)]


def suggestion_out(
    row: ValueSuggestion, *, first_by: str | None = None, with_targets: bool = False
) -> SuggestionOut:
    return SuggestionOut(
        id=str(row.id),
        field=row.field,  # type: ignore[arg-type]
        label=row.label,
        key=row.key,
        status=row.status,  # type: ignore[arg-type]
        similar_to=row.similar_to,
        merged_into=row.merged_into,
        recordings_count=row.recordings_count,
        people_count=row.people_count,
        created_at=row.created_at,
        decided_by=row.decided_by,
        decided_at=row.decided_at,
        first_by=first_by,
        merge_targets=(
            [MergeTarget(code=c, label=n) for c, n in words.merge_targets(row.field)]
            if with_targets
            else []
        ),
    )


@router.get("/value-options", response_model=ValueOptions)
async def value_options(
    session: DatabaseSession,
    field: Annotated[str, Query(pattern="^(instrument|style|mood|language|mantra)$")],
) -> ValueOptions:
    """The words the team accepted: the form offers them next to the fixed list."""
    rows = await words.accepted_words(session, field)
    return ValueOptions(
        field=field,  # type: ignore[arg-type]
        accepted=[AcceptedWord(key=r.key, label=r.label) for r in rows],
        new_words_per_week=words.NEW_WORDS_PER_WEEK,
    )


@router.get("/value-suggestions", response_model=SuggestionList)
async def list_value_suggestions(
    _team: TeamMember,
    session: DatabaseSession,
    status: Annotated[
        str | None, Query(pattern="^(pending|accepted|merged|rejected)$")
    ] = "pending",
    field: Annotated[str | None, Query(pattern="^(instrument|style|mood|language|mantra)$")] = None,
) -> SuggestionList:
    rows = await words.list_suggestions(session, status=status, field=field)
    by = await words.first_authors(session, rows)
    return SuggestionList(
        items=[suggestion_out(r, first_by=by.get(r.id), with_targets=True) for r in rows],
        total=len(rows),
    )


@router.post("/value-suggestions/{suggestion_id}/decision", response_model=SuggestionOut)
async def decide_value_suggestion(
    suggestion_id: UUID, body: Decision, team: TeamMember, session: DatabaseSession
) -> SuggestionOut:
    row = await session.scalar(select(ValueSuggestion).where(ValueSuggestion.id == suggestion_id))
    if row is None:
        raise HTTPException(status_code=404, detail="This word was not found.")
    await words.decide(
        session,
        row,
        action=body.action,
        by=team.display_name or team.email or str(team.id),
        merge_into=body.merge_into,
        label=body.label,
    )
    await session.refresh(row)
    return suggestion_out(row)
