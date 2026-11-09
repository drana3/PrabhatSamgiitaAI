"""The team's side of broadcasts: the queue, "Keep", "Hide", "Remove" and the history.

What a verdict does (docs/broadcasts.md):

* every verdict CLEARS the reports that were open: they stay in the table (nothing is deleted),
  stop counting, and still stop the same person from sending the same reason again
* Keep    "the reports were not right": the broadcast is marked reviewed (who, when, how many
          people had reported) and is shown again if it was hidden. Reports sent LATER by other
          people count on their own, from zero: like the play counts, what was confirmed, what
          was cleared and what is new are kept apart and nothing is frozen
* Hide    off every public list, the author and the team still read it; the author is told why
* Remove  gone for everybody but the team; the author is told why
* every verdict is written to the history, with the numbers at that moment
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.broadcasts import Broadcast, BroadcastDecision, BroadcastReport
from app.models.recordings import MemberNotice
from app.schemas.broadcasts import (
    BroadcastDecisionOut,
    BroadcastReviewOut,
    ReportsSummary,
)
from app.services import broadcasts as core
from app.services.extras_common import AUTHOR_DELETED_BY, one_line, team_removed_by
from app.services.recordings import now_utc

NOTICE_REMOVED = "broadcast_removed"
NOTICE_HIDDEN = "broadcast_hidden"
NOTICE_RESTORED = "broadcast_restored"
REASON_CODE = "broadcast_reason_needed"
MAX_NOTES = 5


def reason_text(raw: str | None) -> str:
    """The reason the author will read: at least a few words, one line."""
    text = one_line(raw, 500)
    if len(text) < 3:
        raise HTTPException(
            status_code=422,
            detail="Write the reason: the author will read it.",
            headers={"X-Error-Code": REASON_CODE},
        )
    return text


async def summaries(session: AsyncSession, rows: list[Broadcast]) -> dict[UUID, ReportsSummary]:
    """What the reports of each broadcast add up to, without who sent them."""
    ids = [b.id for b in rows]
    found: dict[UUID, list[BroadcastReport]] = {}
    if ids:
        reports = (
            await session.scalars(
                select(BroadcastReport)
                .where(BroadcastReport.broadcast_id.in_(ids))
                .order_by(BroadcastReport.created_at)
            )
        ).all()
        for report in reports:
            found.setdefault(report.broadcast_id, []).append(report)
    out: dict[UUID, ReportsSummary] = {}
    for b in rows:
        mine = found.get(b.id, [])
        open_ones = [r for r in mine if r.cleared_at is None]
        best: dict[str, int] = {}
        for r in open_ones:
            best[r.reporter_key] = max(best.get(r.reporter_key, 0), r.weight or 0)
        by_reason: dict[str, int] = {}
        for r in open_ones:
            by_reason[r.reason] = by_reason.get(r.reason, 0) + 1
        notes = [one_line(r.note, 300) for r in open_ones if r.note][-MAX_NOTES:]
        out[b.id] = ReportsSummary(
            counted=sum(best.values()),
            open=len(best),
            anonymous=sum(1 for key in best if key.startswith("anon:")),
            cleared=len({r.reporter_key for r in mine if r.cleared_at is not None}),
            by_reason=by_reason,
            notes=notes,
        )
    return out


def state_of(b: Broadcast, summary: ReportsSummary) -> str:
    if b.status == "removed":
        return "removed"
    if b.hidden_at is not None:
        return "hidden"
    if core.hidden_by_reports(b):
        return "auto_hidden"
    return "reported" if summary.open else "kept"


async def present(
    session: AsyncSession, rows: list[Broadcast], *, viewer_id: UUID | None
) -> list[BroadcastReviewOut]:
    moment = now_utc()
    sums = await summaries(session, rows)
    out = []
    for b in rows:
        base = core.public_out(b, viewer_id=viewer_id, team=True, now=moment)
        out.append(
            BroadcastReviewOut(
                **base.model_dump(),
                state=state_of(b, sums[b.id]),  # type: ignore[arg-type]
                reports=sums[b.id],
                reviewed_at=core._aware(b.reviewed_at) if b.reviewed_at else None,
                reviewed_by=b.reviewed_by,
                reviewed_reports=b.reviewed_reports or 0,
                hidden_at=core._aware(b.hidden_at) if b.hidden_at else None,
                hidden_by=b.hidden_by,
                hidden_reason=b.hidden_reason,
                removed_at=core._aware(b.removed_at) if b.removed_at else None,
                removed_by=b.removed_by,
                removed_reason=b.removed_reason,
            )
        )
    return out


async def queue(
    session: AsyncSession, *, which: str, limit: int, offset: int
) -> tuple[list[Broadcast], int]:
    """`queue`: published, not hidden, with reports the team has not judged (the ones hidden by the
    reports themselves are in it, first). `hidden`: hidden by the team. `removed`: removed by the
    team."""
    open_report = select(BroadcastReport.id).where(
        BroadcastReport.broadcast_id == Broadcast.id, BroadcastReport.cleared_at.is_(None)
    )
    if which == "hidden":
        where = [Broadcast.status == "published", Broadcast.hidden_at.is_not(None)]
        order = [Broadcast.hidden_at.desc()]
    elif which == "removed":
        where = [Broadcast.status == "removed", Broadcast.removed_by != AUTHOR_DELETED_BY]
        order = [Broadcast.removed_at.desc()]
    else:
        where = [
            Broadcast.status == "published",
            Broadcast.hidden_at.is_(None),
            open_report.exists(),
        ]
        order = [Broadcast.reports_count.desc(), Broadcast.created_at.desc()]
    total = await session.scalar(select(func.count()).select_from(Broadcast).where(*where))
    rows = (
        await session.scalars(
            select(Broadcast).where(*where).order_by(*order).limit(limit).offset(offset)
        )
    ).all()
    return list(rows), int(total or 0)


async def history(
    session: AsyncSession, *, limit: int, offset: int
) -> tuple[list[BroadcastDecisionOut], int]:
    total = await session.scalar(select(func.count()).select_from(BroadcastDecision))
    rows = (
        await session.execute(
            select(BroadcastDecision, Broadcast.title)
            .join(Broadcast, Broadcast.id == BroadcastDecision.broadcast_id)
            .order_by(BroadcastDecision.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
    ).all()
    items = [
        BroadcastDecisionOut(
            id=str(d.id),
            broadcast_id=str(d.broadcast_id),
            broadcast_title=title or "",
            action=d.action,  # type: ignore[arg-type]
            reason=d.reason,
            decided_by=d.decided_by,
            reports_total=d.reports_total,
            reports_counted=d.reports_counted,
            created_at=core._aware(d.created_at),
        )
        for d, title in rows
    ]
    return items, int(total or 0)


async def _decide(
    session: AsyncSession, row: Broadcast, *, action: str, reason: str | None, by: str
) -> datetime:
    """Write the verdict to the history and clear the reports that were open."""
    moment = now_utc()
    summary = (await summaries(session, [row]))[row.id]
    session.add(
        BroadcastDecision(
            broadcast_id=row.id,
            action=action,
            reason=reason,
            decided_by=by[:255],
            reports_total=summary.open,
            reports_counted=summary.counted,
        )
    )
    await session.execute(
        update(BroadcastReport)
        .where(BroadcastReport.broadcast_id == row.id, BroadcastReport.cleared_at.is_(None))
        .values(cleared_at=moment, cleared_by=by[:255])
    )
    row.reports_count = 0
    return moment


def _notice(
    row: Broadcast, *, kind: str, title: str, body: str, reason: str | None
) -> MemberNotice:
    return MemberNotice(
        user_id=row.member_id,
        kind=kind,
        recording_id=None,
        title=title[:300],
        body=body,
        payload={"broadcast_id": str(row.id), "reason": reason, "broadcast_title": row.title},
    )


async def keep(session: AsyncSession, row: Broadcast, *, by: str) -> None:
    if row.status != "published":
        raise HTTPException(status_code=409, detail="Only a live broadcast can be kept.")
    was_hidden = row.hidden_at is not None
    moment = await _decide(session, row, action="keep", reason=None, by=by)
    await session.flush()
    row.reviewed_at = moment
    row.reviewed_by = by[:255]
    row.reviewed_reports = int(
        await session.scalar(
            select(func.count(func.distinct(BroadcastReport.reporter_key))).where(
                BroadcastReport.broadcast_id == row.id, BroadcastReport.cleared_at.is_not(None)
            )
        )
        or 0
    )
    row.hidden_at = row.hidden_by = row.hidden_reason = None
    if was_hidden:
        session.add(
            _notice(
                row,
                kind=NOTICE_RESTORED,
                title="Your broadcast is shown again",
                body=f"The team looked again: “{row.title}” is back on the lists.",
                reason=None,
            )
        )
    await session.commit()


async def hide(session: AsyncSession, row: Broadcast, *, reason: str, by: str) -> None:
    if row.status != "published":
        raise HTTPException(status_code=409, detail="This broadcast is removed.")
    text = reason_text(reason)
    moment = await _decide(session, row, action="hide", reason=text, by=by)
    row.hidden_at, row.hidden_by, row.hidden_reason = moment, by[:255], text
    session.add(
        _notice(
            row,
            kind=NOTICE_HIDDEN,
            title="Your broadcast is hidden",
            body=f"The team hid “{row.title}” from the lists. Reason: {text}",
            reason=text,
        )
    )
    await session.commit()


async def remove(session: AsyncSession, row: Broadcast, *, reason: str, by: str) -> None:
    if row.status == "removed":
        return
    text = reason_text(reason)
    moment = await _decide(session, row, action="remove", reason=text, by=by)
    row.status = "removed"
    row.removed_reason = text
    row.removed_at = moment
    row.removed_by = team_removed_by(by)
    session.add(
        _notice(
            row,
            kind=NOTICE_REMOVED,
            title="Your broadcast was removed",
            body=f"The team removed “{row.title}”. Reason: {text}",
            reason=text,
        )
    )
    await session.commit()
