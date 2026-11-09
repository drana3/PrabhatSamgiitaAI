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
import unicodedata
from collections import defaultdict, deque
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from time import monotonic
from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.models import UserAccount
from app.models.recording_moods import RecordingMood
from app.models.recordings import (
    BABA_AUTHOR,
    BHAJAN_TYPES,
    KINDS_WITH_DANCE,
    KINDS_WITH_DISCOURSE,
    KINDS_WITH_LANGUAGE,
    KIRTAN_TYPES,
    MANTRA_TYPES,
    AuthorBlock,
    MemberNotice,
    Recording,
    RecordingReport,
    RecordingSimilarConfirm,
    public_kind,
    stored_kinds,
)
from app.schemas.recordings import (
    AdminRecordingOut,
    DuplicateDetail,
    RecordingBrief,
    RecordingCreate,
    RecordingOut,
)
from app.services import blocked_hashes, upload_validation
from app.services import recording_matches as matches
from app.services import value_suggestions as words
from app.services.admin_members import normalize_member_email, owner_admin_emails
from app.services.invisible_text import strip_invisible
from app.services.recording_fingerprint import (
    SIMILAR_THRESHOLD,
    compute_fingerprint,
    decode_fingerprint,
    sha256_of_file,
    similar_matches,
    similarity,
)
from app.services.recording_info import LEGACY_RECORDING_TYPES, clean_info, keeps_by_author
from app.services.recording_instruments import keeps_instrument
from app.services.recording_languages import OTHER
from app.services.recording_loudness import Loudness, measure_loudness
from app.services.recording_storage import (
    RecordingStorage,
    StorageError,
    key_belongs_to,
)
from app.services.recording_styles import keeps_style
from app.services.recording_tags import effective_tags, legacy_single, visible_own

VISIBLE = ("published", "flagged")
ALREADY_IN_LIBRARY = "This file is already in the library."
DAILY_LIMIT_CODE = "upload_daily_limit"
KIND_WORD = {
    "kiirtan": "Kiirtan",
    "bhajan": "Bhajan",
    "devotional_song": "Bhajan",  # legacy rows: a Bhajan now
    "prabhat_samgiita": "Prabhat Samgiita recording",
    "spiritual_song": "Spiritual song",
    "dance_song": "Dance music",
    "baba_audio": "Audio discourse",
    "other_mantra": "Mantra",
}
# Bulk uploading by a team member (admin) is not held to the daily limit; the hourly brake is
# only raised for them, so a script gone wrong still stops.
HOURLY_UPLOADS = 60
HOURLY_UPLOADS_TEAM = 600
APPEAL_LINE = (
    "If you think this was a mistake, write to us from the app (Contact us) and we will look "
    "again. "
    "You can also upload a corrected version."
)


def now_utc() -> datetime:
    return datetime.now(UTC)


def title_key(text: str | None) -> str:
    """A title without case, Latin accents, spaces or punctuation: "Bábá Nám" equals "baba-nam".

    Used to tell that two titles of one author are the same title. Letters of other scripts keep
    their combining marks (Devanagari, Cyrillic); only case and punctuation go.
    """
    if not text:
        return ""
    kept: list[str] = []
    for char in unicodedata.normalize("NFKD", text).casefold():
        category = unicodedata.category(char)
        if category == "Mn" and kept and ord(kept[-1]) < 0x250 and kept[-1].isalpha():
            continue  # an accent on a Latin letter
        if category[0] in ("L", "N", "M"):
            kept.append(char)
    return unicodedata.normalize("NFC", "".join(kept))[:200]


def is_team_member(member: UserAccount, settings: Settings) -> bool:
    """Admins (the team) are not limited to N uploads a day. There is no separate "team" role:
    `is_admin` / `is_super_admin` of the account, or an email in the owner lists, is the team.
    """
    if getattr(member, "plain_member_only", False):
        return False  # the old shared key never gives team rights (docs/security-member-auth.md)
    if member.is_admin or member.is_super_admin:
        return True
    if getattr(member, "database_roles_only", False):
        return False  # a signed session: the database flags are the only source of team rights
    email = normalize_member_email(member.email)
    return bool(email) and email in owner_admin_emails(settings)


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


def _brief(recording: Recording, reasons: Sequence[str] = ()) -> RecordingBrief:
    return RecordingBrief(
        id=str(recording.id),
        kind=recording.kind,  # type: ignore[arg-type]
        title=recording.title,
        author=recording.author,
        audio_url=recording.audio_url,
        duration_sec=recording.duration_sec,
        reasons=list(reasons),
    )


def recording_out(recording: Recording, *, owner: bool = False) -> RecordingOut:
    styles, styles_other = effective_tags(
        recording.styles, recording.styles_other, recording.style, recording.style_other
    )
    moods, moods_other = effective_tags(recording.moods, recording.moods_other)
    # An own word is free text from a member: its writer sees it at once, others after the team
    # accepted it (the same rule as the main instrument below).
    old_style = recording.styles is None and recording.styles_other is None
    styles_other = visible_own(
        styles_other, recording.styles_other_ok, owner=owner, legacy=old_style
    )
    moods_other = visible_own(moods_other, recording.moods_other_ok, owner=owner)
    if owner or old_style:
        style, style_other = recording.style, recording.style_other
    else:
        style, style_other = legacy_single(styles, styles_other)
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
        year=recording.year,
        language=recording.language,  # type: ignore[arg-type]
        credits=recording.credits,
        notes=recording.notes,
        ps_song_number=recording.ps_song_number,
        place=recording.place,
        discourse=recording.discourse,
        dance=recording.dance,
        language_other=recording.language_other,
        styles=styles,
        styles_other=styles_other,
        style=style,
        style_other=style_other,
        moods=moods,
        moods_other=moods_other,
        practice=recording.practice,
        # the old "home" reads as studio (migration 0064 turned the stored ones); tempo is Dance
        # music's only, a value stored with another kind no longer shows
        recording_type=LEGACY_RECORDING_TYPES.get(
            recording.recording_type or "", recording.recording_type
        ),
        tempo=recording.tempo if recording.kind == "dance_song" else None,
        performance=recording.performance,
        lead_instrument=recording.lead_instrument,
        # the word an author wrote under "Add your own": theirs at once, everyone's once accepted
        lead_instrument_other=(
            recording.lead_instrument_other if owner or recording.lead_instrument_checked else None
        ),
        lead_instrument_checked=recording.lead_instrument_checked,
        loudness_lufs=recording.loudness_lufs,
        true_peak_db=recording.true_peak_db,
        collection_id=str(recording.collection_id) if recording.collection_id else None,
        position=recording.position,
        recorded_on=recording.recorded_on,
        removed_reason=recording.removed_reason if owner else None,
        removed_at=recording.removed_at if owner else None,
        duplicate_of=str(recording.duplicate_of) if owner and recording.duplicate_of else None,
        removed_duplicate_of=(
            str(recording.removed_duplicate_of)
            if owner and recording.removed_duplicate_of
            else None
        ),
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


def clean_line(value: str | None, limit: int) -> str | None:
    """One line a person typed (place, discourse name): zero-width and control characters dropped,
    spaces folded, cut to `limit`; None when nothing is left."""
    kept = "".join(ch for ch in strip_invisible(value or "") if ch.isprintable() or ch.isspace())
    return clean_text(kept, limit) or None


async def set_missing_language(
    session: AsyncSession,
    *,
    recording: Recording,
    member: UserAccount,
    settings: Settings,
    language: str,
    language_other: str | None,
) -> Recording:
    """Adds the language to a recording stored without one (an old Bhajan or Spiritual song).

    Only its uploader or the team may, only for a category that has a language, only while it has
    none (this adds, it never rewrites a language somebody chose), and not for a removed one.
    """
    owner = recording.author_id is not None and recording.author_id == member.id
    if not (owner or is_team_member(member, settings)):
        raise HTTPException(status_code=403, detail="Only the person who uploaded it can do this.")
    if recording.status == "removed":
        raise HTTPException(status_code=409, detail="This recording was removed.")
    if public_kind(recording.kind) not in KINDS_WITH_LANGUAGE:
        raise HTTPException(status_code=422, detail="This category has no language.")
    if recording.language:
        raise HTTPException(status_code=409, detail="This recording already has a language.")
    # The same road as an upload: a merged word becomes its code, a rejected one is refused, a new
    # one counts against the weekly three and joins the team's queue.
    custom: list[words.Resolved] = []
    if language == OTHER:
        values, custom = await _resolve_words(
            session,
            member.id,
            [(words.LANGUAGE, language_other)],
            team=is_team_member(member, settings),
        )
        language, language_other = values[words.LANGUAGE]
    recording.language = language
    recording.language_other = language_other if language == OTHER else None
    await session.flush()
    for resolved in custom:
        await words.register_use(session, resolved, member_id=member.id, recording_id=recording.id)
    await session.commit()
    await session.refresh(recording)
    return recording


async def set_practice(
    session: AsyncSession,
    *,
    recording: Recording,
    member: UserAccount,
    settings: Settings,
    practice: str | None,
) -> Recording:
    """Marks a Kiirtan as an Avarta Kiirtan, or clears the mark. Only its uploader or the team,
    only a Kiirtan, and not a removed one."""
    owner = recording.author_id is not None and recording.author_id == member.id
    if not (owner or is_team_member(member, settings)):
        raise HTTPException(status_code=403, detail="Only the person who uploaded it can do this.")
    if recording.status == "removed":
        raise HTTPException(status_code=409, detail="This recording was removed.")
    if public_kind(recording.kind) != "kiirtan":
        raise HTTPException(status_code=422, detail="Only a Kiirtan can be an Avarta Kiirtan.")
    recording.practice = practice
    await session.commit()
    await session.refresh(recording)
    return recording


def validate_type(kind: str, type_id: str) -> str:
    """The sub-type (Kiirtan: BNK, lila, festival; Bhajan: morning, evening, devotional; Other
    mantras: Guru Puja, Pitriyajina). The other categories have none."""
    if kind not in ("kiirtan", "bhajan", "other_mantra"):
        return "other"
    allowed = {"kiirtan": KIRTAN_TYPES, "bhajan": BHAJAN_TYPES, "other_mantra": MANTRA_TYPES}[kind]
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
    if found is None and await blocked_hashes.is_blocked(session, sha256):
        # A rights holder asked for this file to go (docs/takedown-process.md): it cannot return.
        detail = DuplicateDetail(code="removed_duplicate", message=blocked_hashes.BLOCKED_MESSAGE)
        raise HTTPException(status_code=409, detail=detail.model_dump())
    return found


def duplicate_detail(existing: Recording) -> DuplicateDetail:
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
        message=ALREADY_IN_LIBRARY,
        duplicate_of=_brief(existing),
    )


async def similar_recordings(
    session: AsyncSession,
    fingerprint: str,
    *,
    limit: int = 3,
    sha256: str | None = None,
) -> list[tuple[Recording, float]]:
    """Visible recordings whose audio fingerprint is close to this one, best first.

    With `sha256` (the new file's hash) the pairs the uploader already confirmed as "a different
    performance" are left out, so the same warning does not come back for the same pair.
    """
    mine = decode_fingerprint(fingerprint)
    rows = (
        await session.execute(
            select(Recording.id, Recording.fingerprint).where(
                Recording.fingerprint.is_not(None), Recording.status.in_(VISIBLE)
            )
        )
    ).all()
    confirmed = await confirmed_pairs(session, sha256) if sha256 else set()
    matches = similar_matches(
        mine,
        [(str(ident), data) for ident, data in rows if data and ident not in confirmed],
        threshold=SIMILAR_THRESHOLD,
        limit=limit,
    )
    found: list[tuple[Recording, float]] = []
    for ident, score in matches:
        row = await session.get(Recording, UUID(ident))
        if row is not None:
            found.append((row, score))
    return found


async def library_matches(
    session: AsyncSession,
    *,
    title: str,
    duration_sec: int | None,
    sound: Sequence[tuple[Recording, float]],
    sha256: str | None,
    viewer_id: UUID | None,
    limit: int = 3,
) -> list[tuple[Recording, set[str]]]:
    """The live recordings that match a new one, with the layers that matched, best first.

    `sound` is what the fingerprint found (empty when `fpcalc` is not installed). A recording the
    viewer cannot see is never offered: removed or under review ones (only `VISIBLE` statuses are
    read) and those of an author the viewer blocked. Pairs the uploader already called "different"
    are left out, the same as for the sound check.
    """
    found: dict[UUID, tuple[Recording, set[str]]] = {}
    for row, _ in sound:
        found[row.id] = (row, {matches.SOUND})
    wanted = title_key(title)
    if wanted and duration_sec:
        low, high = matches.duration_window(duration_sec)
        rows = (
            await session.scalars(
                select(Recording).where(
                    Recording.status.in_(VISIBLE),
                    Recording.duration_sec.is_not(None),
                    Recording.duration_sec.between(low, high),
                )
            )
        ).all()
        for row in rows:
            if matches.titles_close(wanted, title_key(row.title)):
                entry = found.setdefault(row.id, (row, set()))
                entry[1].update({matches.TITLE, matches.DURATION})
    blocked = set(await blocked_author_ids(session, viewer_id))
    skip = await confirmed_pairs(session, sha256) if sha256 else set()
    ranked = [
        (row, why)
        for row, why in found.values()
        if matches.is_offered(why)
        and row.id not in skip
        and (row.author_id is None or row.author_id not in blocked)
    ]
    ranked.sort(key=lambda pair: (-len(pair[1]), pair[0].title))
    return ranked[:limit]


async def confirmed_pairs(session: AsyncSession, sha256: str) -> set[UUID]:
    """Recordings the uploader of this file already called "different" (no second warning)."""
    return set(
        (
            await session.scalars(
                select(RecordingSimilarConfirm.other_id).where(
                    RecordingSimilarConfirm.audio_sha256 == sha256.lower()
                )
            )
        ).all()
    )


async def remember_confirmed(
    session: AsyncSession, *, sha256: str, member_id: UUID, others: Sequence[Recording]
) -> None:
    """Store "this file is a different performance than these" and commit it at once."""
    known = await confirmed_pairs(session, sha256)
    for other in others:
        if other.id not in known:
            session.add(
                RecordingSimilarConfirm(
                    audio_sha256=sha256.lower(), other_id=other.id, member_id=member_id
                )
            )
    await session.commit()


async def own_duplicate(
    session: AsyncSession, *, member_id: UUID, title: str, fingerprint: str
) -> Recording | None:
    """The same author's visible recording with the same title and the same sound.

    A member cannot add one performance twice under one title, whatever the file bytes are.
    Needs the fingerprint: without it (fpcalc missing) nothing is compared.
    """
    wanted = title_key(title)
    mine = decode_fingerprint(fingerprint)
    rows = (
        await session.scalars(
            select(Recording).where(
                Recording.author_id == member_id,
                Recording.status.in_(VISIBLE),
                Recording.fingerprint.is_not(None),
            )
        )
    ).all()
    for row in rows:
        if title_key(row.title) != wanted or not row.fingerprint:
            continue
        if similarity(mine, decode_fingerprint(row.fingerprint)) >= SIMILAR_THRESHOLD:
            return row
    return None


# --------------------------------------------------------------------------- daily allowance


async def uploads_in_last_day(session: AsyncSession, member_id: UUID) -> int:
    """Single uploads of the last 24 hours. Tracks of a playlist have their own allowance
    (services/recording_collections.py), so they are not counted here."""
    since = now_utc() - timedelta(hours=24)
    total = await session.scalar(
        select(func.count())
        .select_from(Recording)
        .where(
            Recording.author_id == member_id,
            Recording.collection_id.is_(None),
            Recording.published_at >= since,
        )
    )
    return int(total or 0)


async def ensure_daily_allowance(
    session: AsyncSession, member_id: UUID, settings: Settings, *, team: bool = False
) -> None:
    """At most `recording_uploads_per_day` per member in 24 hours (removed ones count).

    A team member (`is_team_member`) has no daily limit, so a bulk upload is never stopped.
    """
    if team:
        return
    limit = settings.recording_uploads_per_day
    if await uploads_in_last_day(session, member_id) >= limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                f"You can add up to {limit} recordings a day. "
                "Please come back tomorrow to add more. Thank you for sharing."
            ),
            headers={"X-Error-Code": DAILY_LIMIT_CODE},
        )


# --------------------------------------------------------------------------- publish


@dataclass(frozen=True)
class StoredFile:
    sha256: str
    size: int
    extension: str
    fingerprint: str | None
    duration_sec: int | None
    loudness: Loudness | None = None


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
        # One entry point for "may this become a recording" (services/upload_validation.py): first
        # bytes, container, declared length. Before any tool is started on the file.
        max_duration = float(settings.recording_max_duration_seconds)
        try:
            extension, _ = upload_validation.check_file(
                local, max_bytes=settings.recording_max_bytes, max_duration_sec=max_duration
            )
        except upload_validation.UploadRejected as exc:
            await storage.delete(key)
            raise HTTPException(
                status_code=exc.status_code,
                detail=exc.message,
                headers={"X-Error-Code": exc.code},
            ) from exc
        fingerprint = await compute_fingerprint(local, settings.recording_fpcalc_path)
        try:
            upload_validation.check_duration(
                fingerprint.duration_sec if fingerprint else None, max_duration_sec=max_duration
            )
        except upload_validation.UploadRejected as exc:
            await storage.delete(key)
            raise HTTPException(
                status_code=exc.status_code,
                detail=exc.message,
                headers={"X-Error-Code": exc.code},
            ) from exc
        loudness = await measure_loudness(
            local,
            settings.recording_ffmpeg_path,
            timeout=settings.recording_loudness_timeout_seconds,
        )
        return StoredFile(
            sha256=sha256_of_file(local),
            size=local.stat().st_size,
            extension=extension,
            fingerprint=fingerprint.data if fingerprint else None,
            duration_sec=fingerprint.duration_sec if fingerprint else None,
            loudness=loudness,
        )


@dataclass
class CustomValues:
    """The styles, moods, main instrument and language as they will be stored, and the words for
    the queue. A word the team merged is already swapped for its listed value."""

    styles: list[str]
    styles_other: list[str]
    moods: list[str]
    moods_other: list[str]
    # the own words above that the team accepted earlier: public at once
    styles_ok: list[str]
    moods_ok: list[str]
    lead: str | None
    lead_other: str | None
    language: str | None
    language_other: str | None
    custom: list[words.Resolved]


async def _custom_values(
    session: AsyncSession, member_id: UUID, payload: RecordingCreate, *, team: bool
) -> CustomValues:
    """Look up every written word of the upload ("Add your own": a style, a mood, a main
    instrument, a language).

    A word the team merged is swapped for its listed value; a word they rejected is refused (422);
    NEW words count against the three a week (429), all together. Nothing is written here.
    """
    styles = list(payload.styles or [])
    moods = list(payload.moods or [])
    own_styles = list(payload.styles_other or [])
    own_moods = list(payload.moods_other or [])
    lead, lead_other = payload.lead_instrument, payload.lead_instrument_other
    language, language_other = payload.language, payload.language_other
    asked: list[tuple[str, str | None]] = []
    asked += [(words.STYLE, w) for w in own_styles] if keeps_style(payload.kind) else []
    asked += [(words.MOOD, w) for w in own_moods] if keeps_style(payload.kind) else []
    if keeps_instrument(payload.kind) and lead == OTHER:
        asked.append((words.INSTRUMENT, lead_other))
    if language == OTHER:
        asked.append((words.LANGUAGE, language_other))
    resolved_all = await _resolve_many(session, member_id, asked, team=team)
    kept_styles: list[str] = []
    kept_moods: list[str] = []
    ok_styles: list[str] = []
    ok_moods: list[str] = []
    custom: list[words.Resolved] = []
    for (field, _text), resolved in zip(asked, resolved_all, strict=True):
        listed = resolved.kind in ("listed", "merged")
        if field in (words.STYLE, words.MOOD):
            ids = styles if field == words.STYLE else moods
            own = kept_styles if field == words.STYLE else kept_moods
            if listed:
                if resolved.code and resolved.code not in ids:
                    ids.append(resolved.code)
            else:
                own.append(resolved.label)
                if resolved.kind == "accepted":
                    (ok_styles if field == words.STYLE else ok_moods).append(resolved.label)
        elif field == words.INSTRUMENT:
            lead, lead_other = (resolved.code, None) if listed else (OTHER, resolved.label)
        else:
            language, language_other = (resolved.code, None) if listed else (OTHER, resolved.label)
        if not listed:
            custom.append(resolved)
    return CustomValues(
        styles,
        kept_styles,
        moods,
        kept_moods,
        ok_styles,
        ok_moods,
        lead,
        lead_other,
        language,
        language_other,
        custom,
    )


async def _resolve_many(
    session: AsyncSession,
    member_id: UUID,
    asked: list[tuple[str, str | None]],
    *,
    team: bool,
) -> list[words.Resolved]:
    """Each asked word looked up, in order. A rejected word is refused (422), the NEW ones count
    against the weekly three together (429). Nothing is written here."""
    out: list[words.Resolved] = []
    fresh = 0
    seen: set[tuple[str, str]] = set()
    for field, text in asked:
        try:
            resolved = await words.resolve_word(session, field, text)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        words.refuse_rejected(resolved)
        if resolved.kind == "new" and (field, resolved.key) not in seen:
            fresh += 1
        seen.add((field, resolved.key))
        out.append(resolved)
    await words.ensure_allowance(session, member_id, fresh, team=team)
    return out


async def _resolve_words(
    session: AsyncSession,
    member_id: UUID,
    asked: list[tuple[str, str | None]],
    *,
    team: bool,
) -> tuple[dict[str, tuple[str, str | None]], list[words.Resolved]]:
    """The ONE path of every single written word (the language PATCH): a listed or merged word
    becomes its code, a rejected one is refused (422), a NEW one counts against the weekly three
    (429). Returns {field: (code, other)} and the words to queue. Nothing is written here."""
    values: dict[str, tuple[str, str | None]] = {}
    custom: list[words.Resolved] = []
    resolved_all = await _resolve_many(session, member_id, asked, team=team)
    for (field, _text), resolved in zip(asked, resolved_all, strict=True):
        if resolved.kind in ("listed", "merged"):
            values[field] = (resolved.code or "", None)
            continue
        # the word as the queue spells it ("dilruba" is stored as the first "Dilruba")
        values[field] = (OTHER, resolved.label)
        custom.append(resolved)
    return values, custom


async def create_recording(
    session: AsyncSession,
    *,
    storage: RecordingStorage,
    settings: Settings,
    member_id: UUID,
    member_name: str,
    payload: RecordingCreate,
    team: bool = False,
) -> tuple[Recording, list[tuple[Recording, float]]]:
    """Publish a recording at once. Returns it with the similar recordings the author confirmed.

    The checks, in order: terms, ownership of the key, daily allowance, the file itself (type,
    size), the SAME file (SHA-256, blocks), the author's own copy (title + sound, blocks), a
    SIMILAR sound (Chromaprint, warns until `confirm_different`). Then the row is inserted;
    if two uploads of the same bytes race, the unique index on the hash lets only one win.
    """
    if not payload.terms_accepted:
        raise HTTPException(status_code=422, detail="Please accept the content rules first.")
    if not key_belongs_to(payload.key, str(member_id)):
        raise HTTPException(status_code=403, detail="This upload does not belong to you.")
    if await session.scalar(select(Recording.id).where(Recording.audio_key == payload.key)):
        raise HTTPException(status_code=409, detail="This upload was already published.")
    title = clean_text(payload.title, 200)
    if not title:
        raise HTTPException(status_code=422, detail="Add a title.")
    performer = clean_text(payload.author, 200)
    if payload.kind == "baba_audio":
        performer = BABA_AUTHOR  # the speaker is Baba: no performer is asked, whatever was sent
    if not performer and payload.collection_id is not None:
        performer = clean_text(member_name, 200)  # a playlist's performer is optional
    if not performer:
        raise HTTPException(status_code=422, detail="Add who performs it.")
    # Imported here: the playlist service imports this module.
    from app.services import recording_collections as sets

    collection = None
    if payload.collection_id is not None:
        # A track of a playlist from an event: the playlist's own allowance and cap, and what the
        # track did not say comes from the playlist (services/recording_collections.py).
        member = await session.get(UserAccount, member_id)
        if member is None:
            raise HTTPException(status_code=401, detail="Sign in is required")
        collection = await sets.check_upload_into_set(
            session, set_id=payload.collection_id, member=member, settings=settings, team=team
        )
        payload = sets.with_set_defaults(payload, collection)
    else:
        await ensure_daily_allowance(session, member_id, settings, team=team)

    # A word written under "Add your own" (a style, a main instrument): looked up and counted
    # before the file is touched, so a refused word leaves the upload exactly as it was.
    values = await _custom_values(session, member_id, payload, team=team)
    custom = values.custom

    info = await inspect_stored_file(storage, payload.key, settings)
    existing = await exact_duplicate(session, info.sha256)
    if existing is not None:
        await storage.delete(payload.key)
        raise HTTPException(status_code=409, detail=duplicate_detail(existing).model_dump())

    similar: list[tuple[Recording, float]] = []
    if info.fingerprint:
        own = await own_duplicate(
            session, member_id=member_id, title=title, fingerprint=info.fingerprint
        )
        if own is not None:
            await storage.delete(payload.key)
            detail = DuplicateDetail(
                code="own_duplicate",
                message="You already added this recording. It is in your uploads.",
                duplicate_of=_brief(own),
            )
            raise HTTPException(status_code=409, detail=detail.model_dump())
        similar = await similar_recordings(session, info.fingerprint, sha256=info.sha256)
    # The three layers together (services/recording_matches.py): sound, and title with duration.
    matches = await library_matches(
        session,
        title=title,
        duration_sec=payload.duration_sec or info.duration_sec,
        sound=similar,
        sha256=info.sha256,
        viewer_id=member_id,
    )
    similar = [(row, 0.0) for row, _ in matches]
    reasons = {row.id: why for row, why in matches}
    confirmed = payload.confirm_different or payload.confirm_similar
    if similar and not confirmed:
        detail = DuplicateDetail(
            code="similar_recording",
            message="Sounds like a recording already in the library. Is yours different?",
            similar=[_brief(row, sorted(reasons[row.id])) for row, _ in similar],
        )
        raise HTTPException(status_code=409, detail=detail.model_dump())
    if similar and confirmed:
        # Remember at once: if the rest fails, a retry of this file is not asked again.
        await remember_confirmed(
            session, sha256=info.sha256, member_id=member_id, others=[row for row, _ in similar]
        )

    moment = now_utc()
    position = None
    if collection is not None:
        position = payload.position or await sets.next_position(session, collection.id)
        visible = await sets.count_visible(session, collection.id)
        if (
            collection.finished_at is None
            and collection.tracks_expected
            and visible + 1 >= collection.tracks_expected
        ):
            collection.finished_at = moment
    kept = clean_info(payload.kind, payload.recording_type, payload.tempo, payload.performance)
    style_mirror = legacy_single(values.styles, values.styles_other)
    recording = Recording(
        kind=payload.kind,
        type=validate_type(payload.kind, payload.type),
        title=title,
        author=performer,
        added_by=member_name,
        author_id=member_id,
        by_author=keeps_by_author(payload.kind, payload.by_author),
        status="published",
        duration_sec=payload.duration_sec or info.duration_sec,
        audio_key=payload.key,
        audio_url=storage.public_url(payload.key),
        audio_mime=f"audio/{info.extension}",
        audio_bytes=info.size,
        audio_sha256=info.sha256,
        fingerprint=info.fingerprint,
        loudness_lufs=info.loudness.lufs if info.loudness else None,
        true_peak_db=info.loudness.true_peak_db if info.loudness else None,
        loudness_measured_at=moment if info.loudness else None,
        terms_accepted_at=moment,
        terms_version=payload.terms_version,
        published_at=moment,
        duplicate_of=similar[0][0].id if similar else None,
        year=payload.year,
        language=values.language,  # None for a Kiirtan (the schema drops it)
        language_other=values.language_other,
        styles=values.styles if keeps_style(payload.kind) else None,
        styles_other=values.styles_other if keeps_style(payload.kind) else None,
        style=style_mirror[0],
        style_other=style_mirror[1],
        moods=values.moods if keeps_style(payload.kind) else None,
        moods_other=values.moods_other if keeps_style(payload.kind) else None,
        styles_other_ok=values.styles_ok or None,
        moods_other_ok=values.moods_ok or None,
        practice=payload.practice if payload.kind == "kiirtan" else None,
        recording_type=kept[0],
        tempo=kept[1],
        performance=kept[2],
        lead_instrument=values.lead if keeps_instrument(payload.kind) else None,
        lead_instrument_other=values.lead_other if keeps_instrument(payload.kind) else None,
        dance=payload.dance if payload.kind in KINDS_WITH_DANCE else None,
        place=clean_line(payload.place, 200),
        discourse=(
            clean_line(payload.discourse, 200) if payload.kind in KINDS_WITH_DISCOURSE else None
        ),
        recorded_on=payload.recorded_on,
        collection_id=collection.id if collection is not None else None,
        position=position,
        credits=clean_text(payload.credits, 300) or None,
        notes=clean_text(payload.notes, 500) or None,
        ps_song_number=payload.ps_song_number if payload.kind == "prabhat_samgiita" else None,
    )
    # A word the team accepted earlier is already public.
    recording.lead_instrument_checked = any(
        r.kind == "accepted" and r.field == words.INSTRUMENT for r in custom
    )
    session.add(recording)
    try:
        await session.flush()
        if keeps_style(payload.kind):
            # the moods the uploader chose become suggestions the listeners can confirm
            for mood in values.moods:
                session.add(
                    RecordingMood(
                        recording_id=recording.id,
                        mood=mood,
                        source="uploader",
                        suggested_by=member_id,
                        status="suggested",
                    )
                )
        for resolved in custom:
            await words.register_use(
                session, resolved, member_id=member_id, recording_id=recording.id
            )
        await session.commit()
    except IntegrityError:
        # Two uploads of the same bytes at the same moment: the unique index let the other one win.
        await session.rollback()
        winner = await exact_duplicate(session, info.sha256)
        if winner is None:
            raise
        await storage.delete(payload.key)
        raise HTTPException(status_code=409, detail=duplicate_detail(winner).model_dump()) from None
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
    song_number: int | None = None,
) -> tuple[list[Recording], int]:
    conditions: list[Any] = [Recording.status.in_(VISIBLE)]
    blocked = await blocked_author_ids(session, viewer_id)
    if blocked:
        conditions.append(or_(Recording.author_id.is_(None), Recording.author_id.not_in(blocked)))
    if kind:
        conditions.append(Recording.kind.in_(stored_kinds(kind)))
    if song_number:
        # The recordings of one Prabhat Samgiita song (the song page lists them).
        conditions.append(Recording.kind == "prabhat_samgiita")
        conditions.append(Recording.ps_song_number == song_number)
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
        "kind": public_kind(recording.kind),
        "reason": reason,
        "removed_at": (recording.removed_at or now_utc()).isoformat(),
        "actions": ["contact", "upload_corrected"],
    }
    return title, body, payload


def duplicate_reason(original: Recording) -> str:
    """The removal reason the author reads when the team marks a recording as a duplicate."""
    by = f" by {original.author}" if original.author else ""
    return f"It duplicates “{original.title}”{by}, which is already in the library"


async def remove_recording(
    session: AsyncSession,
    recording: Recording,
    *,
    reason: str,
    by: str,
    duplicate_of: Recording | None = None,
) -> MemberNotice | None:
    """Take a recording down. With `duplicate_of` it is removed as a copy of that recording:
    the notice points at the original and the plays move to it (the count stays true).
    """
    reason = clean_text(reason, 500)
    moment = now_utc()
    recording.status = "removed"
    recording.removed_reason = reason
    recording.removed_at = moment
    recording.removed_by = by
    recording.reviewed_at = moment
    recording.reviewed_by = by
    if duplicate_of is not None:
        recording.removed_duplicate_of = duplicate_of.id
        duplicate_of.plays = (duplicate_of.plays or 0) + (recording.plays or 0)
        recording.plays = 0
    notice: MemberNotice | None = None
    if recording.author_id is not None:
        title, body, payload = removal_notice(recording, reason)
        if duplicate_of is not None:
            payload["duplicate_of"] = {
                "id": str(duplicate_of.id),
                "title": duplicate_of.title,
                "author": duplicate_of.author,
            }
            payload["actions"] = ["open_original", "contact"]
            body = (
                f"“{recording.title}” was removed because: {reason}. "
                "You can open the original in the app. If you think this was a mistake, write to "
                "us from the app (Contact us) and we will look again."
            )
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


async def remove_as_duplicate(
    session: AsyncSession, recording: Recording, *, original_id: UUID, by: str
) -> MemberNotice | None:
    """Admin: `recording` is a copy of `original_id`. Remove it with a notice that points there."""
    if original_id == recording.id:
        raise HTTPException(status_code=422, detail="A recording cannot be a duplicate of itself.")
    original = await session.get(Recording, original_id)
    if original is None:
        raise HTTPException(status_code=404, detail="The original recording was not found")
    if original.status not in VISIBLE:
        raise HTTPException(
            status_code=409,
            detail="The original is not published, so it cannot be the one to keep.",
        )
    if recording.status == "removed":
        raise HTTPException(status_code=409, detail="Already removed")
    return await remove_recording(
        session, recording, reason=duplicate_reason(original), by=by, duplicate_of=original
    )


async def restore_recording(
    session: AsyncSession, recording: Recording, *, by: str
) -> MemberNotice | None:
    moment = now_utc()
    recording.status = "published"
    recording.removed_reason = None
    recording.removed_at = None
    recording.removed_by = None
    recording.removed_duplicate_of = None
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
            payload={"recording_id": str(recording.id), "kind": public_kind(recording.kind)},
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
