from __future__ import annotations

import base64
import hmac
import json
import re
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi import HTTPException, Request
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models import (
    QuizAttempt,
    QuizCertification,
    UserAccount,
    UserChatMessage,
    UserFavorite,
    UserInterestProfile,
)
from app.schemas.member import ChatMemoryTurn, ChatMemoryWrite, MemberProfile
from app.services.admin_members import apply_default_admin, is_ephemeral_member

NAME_CLAIMS = {
    "name",
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name",
    "http://schemas.microsoft.com/identity/claims/displayname",
}
EMAIL_CLAIMS = {
    "email",
    "emails",
    "preferred_username",
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
}
SUBJECT_CLAIMS = {
    "sub",
    "oid",
    "nameidentifier",
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier",
    "http://schemas.microsoft.com/identity/claims/objectidentifier",
}

TOPIC_TERMS = {
    "meaning": ("meaning", "mean", "arth", "matlab"),
    "translation": ("translate", "translation", "anuvad", "bhasha", "language"),
    "spirituality": ("spiritual", "devotion", "bhakti", "meditation", "sadhana"),
    "music": ("raga", "raag", "tala", "taal", "melody", "music"),
    "practice": ("harmonium", "sargam", "notation", "practice", "sing"),
    "festival": ("festival", "utsav", "purnima", "birthday", "new year"),
    "service": ("service", "seva", "humanity", "welfare", "prout"),
}


@dataclass(frozen=True, slots=True)
class MemberIdentity:
    subject: str
    provider: str
    display_name: str
    email: str | None
    avatar_url: str | None = None


def _claim_value(claims: list[dict[str, Any]], accepted: set[str]) -> str | None:
    for claim in claims:
        claim_type = str(claim.get("typ") or claim.get("type") or "").casefold()
        if claim_type in accepted:
            value = str(claim.get("val") or claim.get("value") or "").strip()
            if value:
                return value
    return None


def decode_client_principal(encoded: str) -> MemberIdentity:
    try:
        payload = json.loads(base64.b64decode(encoded + "===").decode("utf-8"))
    except (ValueError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=401, detail="Invalid authenticated identity") from exc
    claims = payload.get("claims") if isinstance(payload.get("claims"), list) else []
    provider = str(payload.get("auth_typ") or payload.get("identity_provider") or "entra")
    subject = _claim_value(claims, SUBJECT_CLAIMS) or str(payload.get("user_id") or "")
    email = _claim_value(claims, EMAIL_CLAIMS) or payload.get("user_details")
    display_name = _claim_value(claims, NAME_CLAIMS) or email or "Prabhat Samgiita member"
    if not subject:
        raise HTTPException(status_code=401, detail="Authenticated identity has no subject")
    return MemberIdentity(
        subject=f"{provider}:{subject}",
        provider=provider,
        display_name=str(display_name)[:255],
        email=str(email)[:320] if email else None,
    )


def require_member_identity(request: Request) -> MemberIdentity:
    configured_key = get_settings().member_proxy_key
    provided_key = request.headers.get("x-member-proxy-key")
    if not configured_key or not provided_key or not hmac.compare_digest(
        configured_key, provided_key
    ):
        raise HTTPException(status_code=401, detail="Member proxy authentication failed")
    principal = request.headers.get("x-ms-client-principal")
    if not principal:
        raise HTTPException(status_code=401, detail="Sign in is required")
    return decode_client_principal(principal)


def try_member_identity(request: Request) -> MemberIdentity | None:
    configured_key = get_settings().member_proxy_key
    provided_key = request.headers.get("x-member-proxy-key")
    principal = request.headers.get("x-ms-client-principal")
    if not configured_key or not provided_key or not principal:
        return None
    if not hmac.compare_digest(configured_key, provided_key):
        return None
    try:
        return decode_client_principal(principal)
    except HTTPException:
        return None


def _subject_rank(subject: str) -> int:
    """Higher = more canonical (Easy Auth OID beats email/preview forks)."""
    value = (subject or "").casefold()
    if value.startswith("aad:") and "@" not in value and "preview" not in value:
        return 3
    if "preview" in value or value.endswith("@prabhat.local"):
        return 0
    if "@" in value:
        return 1
    return 2


def _account_preference(row: UserAccount) -> tuple:
    """Lower tuple = stronger canonical account (admin, OID, then oldest)."""
    return (
        0 if row.is_admin else 1,
        -_subject_rank(row.external_subject),
        row.created_at or datetime.min.replace(tzinfo=UTC),
    )


async def _find_canonical_by_email(
    session: AsyncSession, email: str
) -> UserAccount | None:
    normalized = email.strip().casefold()
    if not normalized or normalized.endswith("@prabhat.local"):
        return None
    rows = list(
        (
            await session.scalars(
                select(UserAccount).where(
                    UserAccount.deleted_at.is_(None),
                    func.lower(UserAccount.email) == normalized,
                )
            )
        ).all()
    )
    if not rows:
        return None
    rows.sort(key=_account_preference)
    return rows[0]


async def _merge_fork_into_canonical(
    session: AsyncSession, fork: UserAccount, canonical: UserAccount
) -> None:
    """Move quiz/favorites/chat from a mobile identity fork onto the website account."""
    if fork.id == canonical.id:
        return
    fav_numbers = set(
        (
            await session.execute(
                select(UserFavorite.song_number).where(UserFavorite.user_id == canonical.id)
            )
        ).scalars()
    )
    fork_favs = list(
        (
            await session.scalars(select(UserFavorite).where(UserFavorite.user_id == fork.id))
        ).all()
    )
    for fav in fork_favs:
        if fav.song_number in fav_numbers:
            await session.delete(fav)
        else:
            fav.user_id = canonical.id

    cert_levels = set(
        (
            await session.execute(
                select(QuizCertification.level).where(QuizCertification.user_id == canonical.id)
            )
        ).scalars()
    )
    fork_certs = list(
        (
            await session.scalars(
                select(QuizCertification).where(QuizCertification.user_id == fork.id)
            )
        ).all()
    )
    for cert in fork_certs:
        if cert.level in cert_levels:
            await session.delete(cert)
        else:
            cert.user_id = canonical.id

    fork_attempts = list(
        (
            await session.scalars(select(QuizAttempt).where(QuizAttempt.user_id == fork.id))
        ).all()
    )
    for attempt in fork_attempts:
        attempt.user_id = canonical.id

    fork_chats = list(
        (
            await session.scalars(
                select(UserChatMessage).where(UserChatMessage.user_id == fork.id)
            )
        ).all()
    )
    for chat in fork_chats:
        chat.user_id = canonical.id

    if canonical.is_admin or fork.is_admin:
        canonical.is_admin = True
    fork.deleted_at = datetime.now(UTC)


async def sync_member(session: AsyncSession, identity: MemberIdentity) -> UserAccount:
    now = datetime.now(UTC)
    member = await session.scalar(
        select(UserAccount).where(UserAccount.external_subject == identity.subject)
    )
    if member is None and identity.email:
        canonical = await _find_canonical_by_email(session, identity.email)
        if canonical is not None and not is_ephemeral_member(canonical):
            # Reuse the website Easy Auth account instead of forking by mobile UUID/email.
            member = canonical
    if member is None:
        member = UserAccount(
            external_subject=identity.subject,
            identity_provider=identity.provider,
            email=identity.email,
            display_name=identity.display_name,
            avatar_url=identity.avatar_url,
            last_seen_at=now,
        )
        session.add(member)
        await session.flush()
    else:
        # Existing fork subject (mobile UUID / email principal): fold into website OID account.
        if identity.email:
            canonical = await _find_canonical_by_email(session, identity.email)
            if (
                canonical is not None
                and canonical.id != member.id
                and _account_preference(canonical) < _account_preference(member)
            ):
                await _merge_fork_into_canonical(session, member, canonical)
                member = canonical
            # Website/OID sign-in: absorb weaker email twins (orphaned mobile UUID forks)
            # so quiz certs and admin are restored onto the canonical account.
            twins = list(
                (
                    await session.scalars(
                        select(UserAccount).where(
                            UserAccount.deleted_at.is_(None),
                            func.lower(UserAccount.email) == identity.email.strip().casefold(),
                            UserAccount.id != member.id,
                        )
                    )
                ).all()
            )
            for twin in twins:
                if _account_preference(member) < _account_preference(twin):
                    await _merge_fork_into_canonical(session, twin, member)
        member.identity_provider = identity.provider
        member.email = identity.email or member.email
        member.display_name = identity.display_name
        member.avatar_url = identity.avatar_url or member.avatar_url
        member.last_seen_at = now
        member.deleted_at = None
    apply_default_admin(member)
    await session.commit()
    await session.refresh(member)
    return member


async def member_profile(session: AsyncSession, member: UserAccount) -> MemberProfile:
    favorites = list(
        (
            await session.execute(
                select(UserFavorite.song_number)
                .where(UserFavorite.user_id == member.id)
                .order_by(UserFavorite.created_at.desc())
            )
        ).scalars()
    )
    return MemberProfile(
        id=member.id,
        display_name=member.display_name,
        email=member.email,
        avatar_url=member.avatar_url,
        identity_provider=member.identity_provider,
        preferred_language=member.preferred_language,
        country=member.country,
        personalization_enabled=member.personalization_enabled,
        is_admin=member.is_admin,
        favorite_song_numbers=favorites,
    )


def _detect_language(content: str) -> str:
    if re.search(r"[\u0900-\u097f]", content):
        return "Hindi/Devanagari"
    if re.search(r"[\u0980-\u09ff]", content):
        return "Bengali"
    if re.search(r"[\u0600-\u06ff]", content):
        return "Urdu"
    if re.search(r"[\u0b80-\u0bff]", content):
        return "Tamil"
    if re.search(r"[\u0c00-\u0c7f]", content):
        return "Telugu"
    return "Roman/English"


def _increment(counter: dict[str, Any], key: str) -> None:
    counter[key] = int(counter.get(key, 0)) + 1


def _summary(profile: UserInterestProfile) -> str:
    topics = sorted(profile.topic_counts.items(), key=lambda item: (-int(item[1]), item[0]))[:3]
    songs = sorted(profile.song_counts.items(), key=lambda item: (-int(item[1]), int(item[0])))[:4]
    languages = sorted(
        profile.language_counts.items(), key=lambda item: (-int(item[1]), item[0])
    )[:2]
    parts = []
    if topics:
        parts.append("often explores " + ", ".join(topic for topic, _ in topics))
    if songs:
        parts.append("has asked about songs " + ", ".join(song for song, _ in songs))
    if languages:
        parts.append("usually communicates in " + " and ".join(name for name, _ in languages))
    sentence = "; ".join(parts)
    return (sentence[:1].upper() + sentence[1:] + ".") if sentence else ""


async def store_chat_memory(
    session: AsyncSession, member: UserAccount, payload: ChatMemoryWrite
) -> str:
    now = datetime.now(UTC)
    await session.execute(
        delete(UserChatMessage).where(UserChatMessage.expires_at <= now)
    )
    for turn in payload.turns:
        session.add(
            UserChatMessage(
                user_id=member.id,
                song_number=payload.song_number,
                role=turn.role,
                content=turn.content,
                expires_at=now + timedelta(days=30),
            )
        )

    summary = ""
    if member.personalization_enabled:
        profile = await session.get(UserInterestProfile, member.id)
        if profile is None:
            profile = UserInterestProfile(user_id=member.id)
            session.add(profile)
        topics = dict(profile.topic_counts or {})
        songs = dict(profile.song_counts or {})
        languages = dict(profile.language_counts or {})
        for turn in payload.turns:
            if turn.role != "user":
                continue
            normalized = turn.content.casefold()
            for topic, terms in TOPIC_TERMS.items():
                if any(term in normalized for term in terms):
                    _increment(topics, topic)
            _increment(languages, _detect_language(turn.content))
        if payload.song_number is not None:
            _increment(songs, str(payload.song_number))
        profile.topic_counts = topics
        profile.song_counts = songs
        profile.language_counts = languages
        profile.summary_text = _summary(profile)
        summary = profile.summary_text

    await session.commit()
    return summary


async def recent_chat_memory(
    session: AsyncSession, member: UserAccount, song_number: int | None
) -> tuple[str, list[ChatMemoryTurn]]:
    # Always restore chat turns for signed-in members. personalization_enabled
    # only controls interest-summary exposure, not companion history.
    now = datetime.now(UTC)
    await session.execute(delete(UserChatMessage).where(UserChatMessage.expires_at <= now))
    profile = await session.get(UserInterestProfile, member.id)
    statement = select(UserChatMessage).where(
        UserChatMessage.user_id == member.id,
        UserChatMessage.expires_at > now,
    )
    if song_number is not None:
        statement = statement.where(UserChatMessage.song_number == song_number)
    messages = list(
        (await session.execute(statement.order_by(UserChatMessage.created_at.desc()).limit(12)))
        .scalars()
        .all()
    )
    await session.commit()
    summary = (
        profile.summary_text
        if profile and member.personalization_enabled
        else ""
    )
    return (
        summary,
        [
            ChatMemoryTurn(
                role="assistant" if message.role == "assistant" else "user",
                content=message.content,
            )
            for message in reversed(messages)
        ],
    )
