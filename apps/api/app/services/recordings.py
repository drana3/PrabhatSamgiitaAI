"""Publishing and moderation of Kiirtan and Bhajan recordings (docs/kiirtan-publishing.md).

The model is publish first, review after:

* `create_recording` publishes the moment the file is stored and checked (type, size, exact
  duplicate).
* Members and visitors can report a recording; enough reports (or any copyright report) flag it.
* The team removes a recording WITH a reason; the author gets a notice with that reason and how
  to appeal.
"""

from __future__ import annotations

import tempfile
from collections import defaultdict, deque
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from time import monotonic
from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.models.recordings import (
    BHAJAN_TYPES,
    KIRTAN_TYPES,
    AuthorBlock,
    MemberNotice,
    Recording,
    RecordingReport,
)
from app.schemas.recordings import (
    AdminRecordingOut,
    DuplicateDetail,
    RecordingBrief,
    RecordingCreate,
    RecordingOut,
)
from app.services.recording_fingerprint import (
    SIMILAR_THRESHOLD,
    compute_fingerprint,
    decode_fingerprint,
    sha256_of_file,
    similarity,
)
from app.services.recording_storage import (
    RecordingStorage,
    StorageError,
    key_belongs_to,
    sniff_audio,
)

VISIBLE = ("published", "flagged")
KIND_WORD = {"kiirtan": "Kiirtan", "bhajan": "Bhajan"}
APPEAL_LINE = (
    "If you think this was a mistake, write to us from the app (Contact us) and we will look "
    "again. "
    "You can also upload a corrected version."
)


def now_utc() -> datetime:
    return datetime.now(UTC)


# --------------------------------------------------------------------------- rate limits


class RateLimiter:
    """A small in-process sliding window, one per API instance. Stops a script, not a botnet."""

    def __init__(self) -> None:
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def hit(self, bucket: str, key: str, *, limit: int, window_seconds: int) -> None:
        now = monotonic()
        hits = self._hits[f"{bucket}:{key}"]
        while hits and hits[0] <= now - window_seconds:
            hits.popleft()
        if len(hits) >= limit:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Please wait a little before trying again.",
            )
        hits.append(now)

    def reset(self) -> None:
        self._hits.clear()


limiter = RateLimiter()


# --------------------------------------------------------------------------- views


def _brief(recording: Recording) -> RecordingBrief:
    return RecordingBrief(
        id=str(recording.id),
        kind=recording.kind,  # type: ignore[arg-type]
        title=recording.title,
        author=recording.author,
        audio_url=recording.audio_url,
    )


def recording_out(recording: Recording, *, owner: bool = False) -> RecordingOut:
    return RecordingOut(
        id=str(recording.id),
        kind=recording.kind,  # type: ignore[arg-type]
        type=recording.type,
        title=recording.title,
        author=recording.author,
        added_by=recording.added_by,
        author_id=str(recording.author_id) if recording.author_id else None,
        by_author=recording.by_author,
        status=recording.status,  # type: ignore[arg-type]
        duration_sec=recording.duration_sec,
        plays=recording.plays,
        audio_url=recording.audio_url,
        thumbnail_url=recording.thumbnail_url,
        published_at=recording.published_at,
        created_at=recording.created_at,
        removed_reason=recording.removed_reason if owner else None,
        removed_at=recording.removed_at if owner else None,
        duplicate_of=str(recording.duplicate_of) if owner and recording.duplicate_of else None,
    )


def admin_out(recording: Recording) -> AdminRecordingOut:
    base = recording_out(recording, owner=True)
    return AdminRecordingOut(
        **base.model_dump(),
        reports_count=recording.reports_count,
        reviewed_at=recording.reviewed_at,
        reviewed_by=recording.reviewed_by,
        flagged_at=recording.flagged_at,
        removed_by=recording.removed_by,
        audio_sha256=recording.audio_sha256,
        has_fingerprint=recording.fingerprint is not None,
        terms_accepted_at=recording.terms_accepted_at,
    )


def clean_text(value: str | None, limit: int) -> str:
    return " ".join((value or "").split())[:limit]


def validate_type(kind: str, type_id: str) -> str:
    allowed = KIRTAN_TYPES if kind == "kiirtan" else BHAJAN_TYPES
    return type_id if type_id in allowed else "other"


# --------------------------------------------------------------------------- duplicates


async def exact_duplicate(session: AsyncSession, sha256: str) -> Recording | None:
    """Any recording with the same bytes. A removed one counts: removed files must not come back."""
    found: Recording | None = await session.scalar(
        select(Recording)
        .where(Recording.audio_sha256 == sha256.lower())
        .order_by(Recording.created_at.desc())
        .limit(1)
    )
    return found


def duplicate_detail(existing: Recording) -> DuplicateDetail:
    kind = KIND_WORD.get(existing.kind, "recording")
    if existing.status == "removed":
        return DuplicateDetail(
            code="removed_duplicate",
            message=(
                "This file was removed by the team earlier, so it cannot be published again. "
                "If you have a corrected version, upload that. "
                "If you think it was a mistake, contact us."
            ),
            duplicate_of=None,
        )
    return DuplicateDetail(
        code="duplicate",
        message=f"This {kind} is already in the app. Open the existing recording instead.",
        duplicate_of=_brief(existing),
    )


async def similar_recordings(
    session: AsyncSession, fingerprint: str, *, limit: int = 3
) -> list[tuple[Recording, float]]:
    """Visible recordings whose audio fingerprint is close to this one, best first."""
    mine = decode_fingerprint(fingerprint)
    rows = (
        await session.scalars(
            select(Recording).where(
                Recording.fingerprint.is_not(None), Recording.status.in_(VISIBLE)
            )
        )
    ).all()
    scored: list[tuple[Recording, float]] = []
    for row in rows:
        if not row.fingerprint:
            continue
        score = similarity(mine, decode_fingerprint(row.fingerprint))
        if score >= SIMILAR_THRESHOLD:
            scored.append((row, score))
    scored.sort(key=lambda pair: pair[1], reverse=True)
    return scored[:limit]


# --------------------------------------------------------------------------- publish


@dataclass(frozen=True)
class StoredFile:
    sha256: str
    size: int
    extension: str
    fingerprint: str | None
    duration_sec: int | None


async def inspect_stored_file(
    storage: RecordingStorage, key: str, settings: Settings
) -> StoredFile:
    """Pull the object to a temp file; read its size, type, hash and fingerprint."""
    stored_size = await storage.size(key)
    if stored_size is None:
        raise HTTPException(status_code=422, detail="The audio file was not uploaded yet.")
    if stored_size > settings.recording_max_bytes:
        await storage.delete(key)
        raise HTTPException(status_code=413, detail="The audio file is too large.")
    with tempfile.TemporaryDirectory(prefix="recording-") as folder:
        local = Path(folder) / "audio"
        try:
            await storage.materialize(key, local)
        except StorageError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        with local.open("rb") as handle:
            head = handle.read(16)
        extension = sniff_audio(head)
        if extension is None:
            await storage.delete(key)
            raise HTTPException(
                status_code=422, detail="This does not look like an audio file (MP3, M4A, WAV)."
            )
        fingerprint = await compute_fingerprint(local, settings.recording_fpcalc_path)
        return StoredFile(
            sha256=sha256_of_file(local),
            size=local.stat().st_size,
            extension=extension,
            fingerprint=fingerprint.data if fingerprint else None,
            duration_sec=fingerprint.duration_sec if fingerprint else None,
        )


async def create_recording(
    session: AsyncSession,
    *,
    storage: RecordingStorage,
    settings: Settings,
    member_id: UUID,
    member_name: str,
    payload: RecordingCreate,
) -> tuple[Recording, list[tuple[Recording, float]]]:
    """Publish a recording at once. Returns it with the similar recordings the author confirmed."""
    if not payload.terms_accepted:
        raise HTTPException(status_code=422, detail="Please accept the content rules first.")
    if not key_belongs_to(payload.key, str(member_id)):
        raise HTTPException(status_code=403, detail="This upload does not belong to you.")
    if await session.scalar(select(Recording.id).where(Recording.audio_key == payload.key)):
        raise HTTPException(status_code=409, detail="This upload was already published.")
    title = clean_text(payload.title, 200)
    if not title:
        raise HTTPException(status_code=422, detail="Add a title.")

    info = await inspect_stored_file(storage, payload.key, settings)
    existing = await exact_duplicate(session, info.sha256)
    if existing is not None:
        await storage.delete(payload.key)
        raise HTTPException(status_code=409, detail=duplicate_detail(existing).model_dump())

    similar: list[tuple[Recording, float]] = []
    if info.fingerprint:
        similar = await similar_recordings(session, info.fingerprint)
    if similar and not payload.confirm_similar:
        detail = DuplicateDetail(
            code="similar_recording",
            message="A similar recording exists. Is yours different?",
            similar=[_brief(row) for row, _ in similar],
        )
        raise HTTPException(status_code=409, detail=detail.model_dump())

    moment = now_utc()
    recording = Recording(
        kind=payload.kind,
        type=validate_type(payload.kind, payload.type),
        title=title,
        author=clean_text(payload.author, 200),
        added_by=member_name,
        author_id=member_id,
        by_author=payload.by_author,
        status="published",
        duration_sec=payload.duration_sec or info.duration_sec,
        audio_key=payload.key,
        audio_url=storage.public_url(payload.key),
        audio_mime=f"audio/{info.extension}",
        audio_bytes=info.size,
        audio_sha256=info.sha256,
        fingerprint=info.fingerprint,
        terms_accepted_at=moment,
        terms_version=payload.terms_version,
        published_at=moment,
        duplicate_of=similar[0][0].id if similar else None,
    )
    session.add(recording)
    await session.commit()
    await session.refresh(recording)
    return recording, similar


# --------------------------------------------------------------------------- reading


async def blocked_author_ids(session: AsyncSession, member_id: UUID | None) -> list[UUID]:
    if member_id is None:
        return []
    return list(
        (
            await session.scalars(
                select(AuthorBlock.blocked_id).where(AuthorBlock.blocker_id == member_id)
            )
        ).all()
    )


async def list_visible(
    session: AsyncSession,
    *,
    viewer_id: UUID | None,
    kind: str | None,
    author_id: UUID | None,
    query: str | None,
    limit: int,
    offset: int,
) -> tuple[list[Recording], int]:
    conditions: list[Any] = [Recording.status.in_(VISIBLE)]
    blocked = await blocked_author_ids(session, viewer_id)
    if blocked:
        conditions.append(or_(Recording.author_id.is_(None), Recording.author_id.not_in(blocked)))
    if kind:
        conditions.append(Recording.kind == kind)
    if author_id:
        conditions.append(Recording.author_id == author_id)
    if query:
        like = f"%{query.strip().lower()}%"
        conditions.append(
            or_(func.lower(Recording.title).like(like), func.lower(Recording.author).like(like))
        )
    total = await session.scalar(select(func.count()).select_from(Recording).where(*conditions))
    rows = (
        await session.scalars(
            select(Recording)
            .where(*conditions)
            .order_by(Recording.published_at.desc().nulls_last(), Recording.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
    ).all()
    return list(rows), int(total or 0)


# --------------------------------------------------------------------------- reports


async def add_report(
    session: AsyncSession,
    *,
    recording: Recording,
    reporter_key: str,
    reporter_id: UUID | None,
    reason: str,
    comment: str | None,
    flag_threshold: int,
) -> bool:
    """Store a report. False when this reporter already reported it (one report each)."""
    already = await session.scalar(
        select(RecordingReport.id).where(
            RecordingReport.recording_id == recording.id,
            RecordingReport.reporter_key == reporter_key,
        )
    )
    if already is not None:
        return False
    session.add(
        RecordingReport(
            recording_id=recording.id,
            reporter_key=reporter_key,
            reporter_id=reporter_id,
            reason=reason,
            comment=clean_text(comment, 1500) or None,
        )
    )
    recording.reports_count = (recording.reports_count or 0) + 1
    # A copyright report flags at once (the team must look quickly); other reasons need several.
    should_flag = reason == "copyright" or recording.reports_count >= flag_threshold
    if should_flag and recording.status == "published":
        recording.status = "flagged"
        recording.flagged_at = now_utc()
    await session.commit()
    return True


# --------------------------------------------------------------------------- moderation


def removal_notice(recording: Recording, reason: str) -> tuple[str, str, dict[str, Any]]:
    """Title, body and payload of the notice to the author (the title is the bell line)."""
    word = KIND_WORD.get(recording.kind, "recording")
    title = f"Your {word} was removed: {reason}"[:300]
    body = f"“{recording.title}” was removed because: {reason}. {APPEAL_LINE}"
    payload: dict[str, Any] = {
        "recording_id": str(recording.id),
        "recording_title": recording.title,
        "kind": recording.kind,
        "reason": reason,
        "removed_at": (recording.removed_at or now_utc()).isoformat(),
        "actions": ["contact", "upload_corrected"],
    }
    return title, body, payload


async def remove_recording(
    session: AsyncSession, recording: Recording, *, reason: str, by: str
) -> MemberNotice | None:
    reason = clean_text(reason, 500)
    moment = now_utc()
    recording.status = "removed"
    recording.removed_reason = reason
    recording.removed_at = moment
    recording.removed_by = by
    recording.reviewed_at = moment
    recording.reviewed_by = by
    notice: MemberNotice | None = None
    if recording.author_id is not None:
        title, body, payload = removal_notice(recording, reason)
        notice = MemberNotice(
            user_id=recording.author_id,
            kind="recording_removed",
            recording_id=recording.id,
            title=title,
            body=body,
            payload=payload,
        )
        session.add(notice)
    await session.commit()
    return notice


async def restore_recording(
    session: AsyncSession, recording: Recording, *, by: str
) -> MemberNotice | None:
    moment = now_utc()
    recording.status = "published"
    recording.removed_reason = None
    recording.removed_at = None
    recording.removed_by = None
    recording.reviewed_at = moment
    recording.reviewed_by = by
    notice: MemberNotice | None = None
    if recording.author_id is not None:
        word = KIND_WORD.get(recording.kind, "recording")
        notice = MemberNotice(
            user_id=recording.author_id,
            kind="recording_restored",
            recording_id=recording.id,
            title=f"Your {word} is back",
            body=f"“{recording.title}” is published again. Thank you for your patience.",
            payload={"recording_id": str(recording.id), "kind": recording.kind},
        )
        session.add(notice)
    await session.commit()
    return notice


async def mark_reviewed(session: AsyncSession, recording: Recording, *, by: str) -> None:
    """The team listened and the recording stays. A flagged one goes back to plain published."""
    recording.reviewed_at = now_utc()
    recording.reviewed_by = by
    if recording.status == "flagged":
        recording.status = "published"
    await session.commit()


async def admin_queue(
    session: AsyncSession, *, which: str, limit: int, offset: int
) -> tuple[Sequence[Recording], int]:
    """New = published and not yet reviewed. Always newest first."""
    conditions: list[Any]
    if which == "new":
        conditions = [Recording.status == "published", Recording.reviewed_at.is_(None)]
    elif which == "flagged":
        conditions = [Recording.status == "flagged"]
    elif which == "removed":
        conditions = [Recording.status == "removed"]
    else:
        conditions = []
    total = await session.scalar(select(func.count()).select_from(Recording).where(*conditions))
    rows = (
        await session.scalars(
            select(Recording)
            .where(*conditions)
            .order_by(Recording.published_at.desc().nulls_last(), Recording.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
    ).all()
    return rows, int(total or 0)
