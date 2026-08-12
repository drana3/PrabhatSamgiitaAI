from __future__ import annotations

import asyncio
import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models import Media, Song, UserAccount
from app.models.admin_workflow import SongIngestionSubmission, YoutubeReviewQueue
from app.schemas.admin_workflow import (
    SongIngestionPreview,
    SongIngestionWrite,
    TranslateFromEnglishResponse,
    YoutubeReviewApproveWrite,
    collect_language_warnings,
)
from app.services.ai import select_provider
from app.services.chat_language import _detect_text_language
from app.services.ingestion_language import SUPPORTED_LANGUAGES, validate_meaning_language
from app.services.meaning_translation import build_meaning_translation_prompt, pick_meaning_source
from app.services.media_quality import media_quality_key
from app.services.song_meanings import collect_stored_meanings

REPO_ROOT = Path(__file__).resolve().parents[4]
YOUTUBE_REVIEW_JSON = REPO_ROOT / "data" / "generated" / "youtube_review_queue.json"

def _youtube_embed_url(video_id: str) -> str:
    return f"https://www.youtube-nocookie.com/embed/{video_id}"


async def sync_youtube_review_queue(session: AsyncSession) -> int:
    if not YOUTUBE_REVIEW_JSON.exists():
        return 0
    rows = json.loads(YOUTUBE_REVIEW_JSON.read_text(encoding="utf-8"))
    imported = 0
    for row in rows:
        external_id = str(row.get("external_id") or "").strip()
        if not external_id:
            continue
        existing = await session.scalar(
            select(YoutubeReviewQueue).where(YoutubeReviewQueue.external_id == external_id)
        )
        if existing and existing.status != "pending_review":
            continue
        if existing is None:
            existing = YoutubeReviewQueue(
                external_id=external_id,
                title=str(row.get("title") or "Untitled video"),
                url=str(row.get("url") or ""),
                channel_id=row.get("channel_id"),
                channel_name=row.get("channel_name"),
                source_url=row.get("source_url"),
                candidate_song_number=row.get("candidate_song_number"),
                title_similarity=row.get("title_similarity"),
                review_reason=str(row.get("review_reason") or "pending_review"),
                status="pending_review",
            )
            session.add(existing)
            imported += 1
        else:
            existing.title = str(row.get("title") or existing.title)
            existing.candidate_song_number = row.get("candidate_song_number")
            existing.title_similarity = row.get("title_similarity")
            existing.review_reason = str(row.get("review_reason") or existing.review_reason)
    await session.commit()
    return imported


async def clear_pending_youtube_reviews(session: AsyncSession) -> int:
    rows = list(
        (
            await session.scalars(
                select(YoutubeReviewQueue).where(YoutubeReviewQueue.status == "pending_review")
            )
        ).all()
    )
    for row in rows:
        row.status = "dismissed"
    if YOUTUBE_REVIEW_JSON.exists():
        YOUTUBE_REVIEW_JSON.write_text("[]\n", encoding="utf-8")
    await session.commit()
    return len(rows)


async def list_youtube_reviews(
    session: AsyncSession,
    *,
    status: str = "pending_review",
    limit: int = 50,
    offset: int = 0,
) -> tuple[int, list[YoutubeReviewQueue]]:
    filters = []
    if status and status != "all":
        filters.append(YoutubeReviewQueue.status == status)
    total = await session.scalar(
        select(func.count()).select_from(YoutubeReviewQueue).where(*filters)
    )
    rows = list(
        (
            await session.execute(
                select(YoutubeReviewQueue)
                .where(*filters)
                .order_by(YoutubeReviewQueue.created_at.desc())
                .offset(offset)
                .limit(limit)
            )
        ).scalars().all()
    )
    return int(total or 0), rows


async def approve_youtube_review(
    session: AsyncSession,
    review_id: UUID,
    reviewer: UserAccount,
    payload: YoutubeReviewApproveWrite,
) -> Media:
    review = await session.get(YoutubeReviewQueue, review_id)
    if review is None:
        raise HTTPException(status_code=404, detail="Review item not found")
    if review.status != "pending_review":
        raise HTTPException(status_code=400, detail="Review item is already processed")
    song = await session.scalar(select(Song).where(Song.number == payload.song_number))
    if song is None:
        raise HTTPException(status_code=404, detail="Song not found")

    metadata: dict[str, Any] = {
        "external_id": review.external_id,
        "channel_id": review.channel_id,
        "channel_name": review.channel_name,
        "source_status": "verified_community",
        "rights_status": "embed_only",
        "availability_status": "available",
        "match_score": review.title_similarity,
        "is_primary": payload.is_primary,
    }
    if payload.is_primary:
        await _clear_primary_media(session, payload.song_number, "video")

    media = Media(
        song_number=payload.song_number,
        kind="video",
        provider="youtube",
        title=review.title[:255],
        url=review.url,
        embed_url=_youtube_embed_url(review.external_id),
        verification_status="human_reviewed",
        source_url=review.source_url,
        notes=payload.review_note,
        metadata_json=metadata,
    )
    session.add(media)
    review.status = "approved"
    review.review_note = payload.review_note
    review.reviewed_by = reviewer.id
    review.reviewed_at = datetime.now(UTC)
    await session.commit()
    await session.refresh(media)
    return media


async def _clear_primary_media(session: AsyncSession, song_number: int, kind: str) -> None:
    rows = list(
        (
            await session.scalars(
                select(Media).where(
                    Media.song_number == song_number,
                    Media.kind == kind,
                )
            )
        ).all()
    )
    for row in rows:
        metadata = dict(row.metadata_json or {})
        if metadata.get("is_primary"):
            metadata["is_primary"] = False
            row.metadata_json = metadata


async def song_ingestion_preview(session: AsyncSession, song_number: int) -> SongIngestionPreview:
    song = await session.scalar(select(Song).where(Song.number == song_number))
    if song is None:
        raise HTTPException(status_code=404, detail="Song not found")
    media_rows = list(
        (await session.scalars(select(Media).where(Media.song_number == song_number))).all()
    )
    media_rows.sort(key=media_quality_key)
    audio = next((row for row in media_rows if row.kind == "audio"), None)
    video = next((row for row in media_rows if row.kind == "video"), None)
    return SongIngestionPreview(
        song_number=song_number,
        existing_lyrics=song.lyrics_original,
        existing_meanings=collect_stored_meanings(song),
        existing_audio_url=audio.url if audio else None,
        existing_video_url=video.url if video else None,
        existing_notation=song.harmonium_notation,
    )


async def submit_song_ingestion(
    session: AsyncSession,
    submitter: UserAccount,
    payload: SongIngestionWrite,
    *,
    allow_warnings: bool = False,
) -> SongIngestionSubmission:
    warnings = collect_language_warnings(payload)
    blocking = [warning for warning in warnings if warning]
    if blocking and not allow_warnings:
        raise HTTPException(
            status_code=400,
            detail={"message": "Language checks failed", "warnings": blocking},
        )
    song = await session.scalar(select(Song).where(Song.number == payload.song_number))
    if song is None:
        raise HTTPException(status_code=404, detail="Song not found")
    submission = SongIngestionSubmission(
        submitted_by=submitter.id,
        song_number=payload.song_number,
        status="pending_super_admin",
        payload_json=payload.model_dump(),
        language_warnings=warnings,
    )
    session.add(submission)
    await session.commit()
    await session.refresh(submission)
    return submission


async def list_song_ingestions(
    session: AsyncSession,
    *,
    status: str = "pending_super_admin",
    limit: int = 50,
    offset: int = 0,
) -> tuple[int, list[tuple[SongIngestionSubmission, str | None]]]:
    filters = []
    if status and status != "all":
        filters.append(SongIngestionSubmission.status == status)
    total = await session.scalar(
        select(func.count()).select_from(SongIngestionSubmission).where(*filters)
    )
    rows = list(
        (
            await session.execute(
                select(SongIngestionSubmission, UserAccount.email)
                .outerjoin(UserAccount, SongIngestionSubmission.submitted_by == UserAccount.id)
                .where(*filters)
                .order_by(SongIngestionSubmission.created_at.desc())
                .offset(offset)
                .limit(limit)
            )
        ).all()
    )
    return int(total or 0), [(row[0], row[1]) for row in rows]


async def review_song_ingestion(
    session: AsyncSession,
    submission_id: UUID,
    reviewer: UserAccount,
    *,
    approve: bool,
    review_note: str | None,
) -> SongIngestionSubmission:
    submission = await session.get(SongIngestionSubmission, submission_id)
    if submission is None:
        raise HTTPException(status_code=404, detail="Submission not found")
    if submission.status != "pending_super_admin":
        raise HTTPException(status_code=400, detail="Submission is already reviewed")

    submission.reviewed_by = reviewer.id
    submission.reviewed_at = datetime.now(UTC)
    submission.review_note = review_note
    if not approve:
        submission.status = "rejected"
        await session.commit()
        await session.refresh(submission)
        return submission

    payload = SongIngestionWrite.model_validate(submission.payload_json)
    song = await session.scalar(select(Song).where(Song.number == payload.song_number))
    if song is None:
        raise HTTPException(status_code=404, detail="Song not found")

    if payload.lyrics and payload.lyrics.strip():
        song.lyrics_original = payload.lyrics.strip()

    localized = dict((song.metadata_json or {}).get("localized_meanings") or {})
    for entry in payload.meanings:
        text = entry.text.strip()
        if entry.is_primary:
            if entry.language == "en":
                song.english_meaning = text
            elif entry.language == "hi":
                song.hindi_meaning = text
            else:
                localized[entry.language] = text
        else:
            extras = dict((song.metadata_json or {}).get("supplementary_meanings") or {})
            bucket = list(extras.get(entry.language) or [])
            bucket.append(text)
            extras[entry.language] = bucket[-5:]
            metadata = dict(song.metadata_json or {})
            metadata["supplementary_meanings"] = extras
            song.metadata_json = metadata

    if localized:
        metadata = dict(song.metadata_json or {})
        metadata["localized_meanings"] = localized
        song.metadata_json = metadata

    if payload.notation_text and payload.notation_text.strip():
        if payload.notation_is_primary or not song.harmonium_notation:
            song.harmonium_notation = payload.notation_text.strip()

    for media_entry in (payload.audio, payload.video):
        if media_entry is None:
            continue
        url = media_entry.url.strip()
        if not url:
            continue
        if media_entry.is_primary:
            await _clear_primary_media(session, payload.song_number, media_entry.kind)
        metadata = {"is_primary": media_entry.is_primary, "ingestion": True}
        session.add(
            Media(
                song_number=payload.song_number,
                kind=media_entry.kind,
                provider="youtube" if "youtube" in url else "external_site",
                title=(media_entry.title or f"PS {payload.song_number} {media_entry.kind}")[:255],
                url=url,
                embed_url=url if "embed" in url else None,
                verification_status="human_reviewed",
                metadata_json=metadata,
            )
        )

    if payload.comments:
        metadata = dict(song.metadata_json or {})
        comments = list(metadata.get("ingestion_comments") or [])
        comments.append({"at": datetime.now(UTC).isoformat(), "text": payload.comments.strip()})
        metadata["ingestion_comments"] = comments[-20:]
        song.metadata_json = metadata

    submission.status = "approved"
    await session.commit()
    await session.refresh(submission)
    return submission


def check_language(language: str, text: str) -> tuple[bool, str]:
    return validate_meaning_language(language, text)


async def translate_meaning_from_english(
    session: AsyncSession,
    song_number: int,
    target_language: str,
    english_text: str | None = None,
) -> TranslateFromEnglishResponse:
    code = target_language.strip().casefold()
    if code not in SUPPORTED_LANGUAGES:
        raise HTTPException(status_code=400, detail=f"Unsupported language: {target_language}")
    if code == "en":
        raise HTTPException(status_code=400, detail="Target language must not be English")

    song = await session.scalar(select(Song).where(Song.number == song_number))
    if song is None:
        raise HTTPException(status_code=404, detail="Song not found")

    source, source_language = pick_meaning_source(
        song,
        code,
        english_override=english_text,
    )
    if not source:
        raise HTTPException(
            status_code=400,
            detail="No source meaning available. Add an English or Hindi meaning first.",
        )

    prompt = build_meaning_translation_prompt(
        song,
        code,
        english_override=english_text,
    )
    provider = select_provider(get_settings())
    try:
        async with asyncio.timeout(30):
            draft = await provider.complete(prompt)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Translation failed: {exc}") from exc

    draft_text = draft.strip()
    ok, message = validate_meaning_language(code, draft_text)
    detected = _detect_text_language(draft_text)
    return TranslateFromEnglishResponse(
        draft_text=draft_text,
        source_language=source_language,
        target_language=code,
        detected_language=detected,
        language_check_ok=ok,
        language_check_message=message,
    )
