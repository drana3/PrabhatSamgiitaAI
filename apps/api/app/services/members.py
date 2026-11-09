from __future__ import annotations

import base64
import hmac
import json
import logging
import re
from dataclasses import dataclass, replace
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

from fastapi import HTTPException, Request
from sqlalchemy import delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import set_committed_value

from app.config import get_settings
from app.models import (
    QuizAttempt,
    QuizCertification,
    QuizEventSubmission,
    UserAccount,
    UserChatMessage,
    UserFavorite,
    UserInterestProfile,
)
from app.models.member_session import MemberSession
from app.schemas.member import ChatHistoryDay, ChatMemoryTurn, ChatMemoryWrite, MemberProfile
from app.services.admin_members import (
    apply_default_admin,
    ensure_ephemeral_smoke_admin,
    is_ephemeral_member,
    normalize_member_email,
)
from app.services.member_phone import phone_profile_fields

NAME_CLAIMS = {
    "name",
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name",
    "http://schemas.microsoft.com/identity/claims/displayname",
}
EMAIL_CLAIMS = {
    "email",
    "emails",
    "preferred_username",
    "upn",
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/upn",
}
SUBJECT_CLAIMS = {
    "sub",
    "oid",
    "nameidentifier",
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier",
    "http://schemas.microsoft.com/identity/claims/objectidentifier",
}

CHAT_RETENTION_DAYS = 30
RECENT_TURN_LIMIT = 12


def _is_companion_scope(song_number: int | None) -> bool:
    """Long-term day-grouped history and monthly archives apply only to the AI companion."""
    return song_number is None


def _month_key(moment: datetime) -> str:
    return moment.astimezone(UTC).strftime("%Y-%m")


def _day_key(moment: datetime) -> str:
    return moment.astimezone(UTC).strftime("%Y-%m-%d")


def _turn_from_message(message: UserChatMessage) -> ChatMemoryTurn:
    return ChatMemoryTurn(
        role="assistant" if message.role == "assistant" else "user",
        content=message.content,
    )


def _group_messages_by_day(messages: list[UserChatMessage]) -> list[ChatHistoryDay]:
    buckets: dict[str, list[UserChatMessage]] = {}
    for message in sorted(messages, key=lambda row: row.created_at):
        buckets.setdefault(_day_key(message.created_at), []).append(message)
    return [
        ChatHistoryDay(
            date=day,
            turns=[_turn_from_message(message) for message in buckets[day]],
        )
        for day in sorted(buckets.keys(), reverse=True)
    ]


def _archived_summary(monthly_summaries: dict[str, Any]) -> str:
    if not monthly_summaries:
        return ""
    parts = [f"{month}: {str(text).strip()}" for month, text in sorted(monthly_summaries.items())]
    return " ".join(parts)[-4000:]


async def _archive_expired_messages(
    session: AsyncSession, member: UserAccount, now: datetime
) -> None:
    expired = list(
        (
            await session.scalars(
                select(UserChatMessage).where(
                    UserChatMessage.user_id == member.id,
                    UserChatMessage.song_number.is_(None),
                    UserChatMessage.expires_at <= now,
                )
            )
        ).all()
    )
    if not expired:
        return

    profile = await session.get(UserInterestProfile, member.id)
    if profile is None:
        profile = UserInterestProfile(user_id=member.id)
        session.add(profile)

    monthly = dict(profile.monthly_summaries or {})
    buckets: dict[str, list[UserChatMessage]] = {}
    for message in expired:
        buckets.setdefault(_month_key(message.created_at), []).append(message)

    for month, messages in buckets.items():
        user_lines = [
            message.content.strip()[:160]
            for message in messages
            if message.role == "user" and message.content.strip()
        ]
        if not user_lines:
            continue
        snippet = "; ".join(user_lines[:6])
        prior = str(monthly.get(month, "")).strip()
        merged = f"{prior}; {snippet}".strip("; ").strip() if prior else snippet
        monthly[month] = merged[:2000]

    profile.monthly_summaries = monthly
    for message in expired:
        await session.delete(message)


TOPIC_TERMS = {
    "meaning": ("meaning", "mean", "arth", "matlab"),
    "translation": ("translate", "translation", "anuvad", "bhasha", "language"),
    "spirituality": ("spiritual", "devotion", "bhakti", "meditation", "sadhana"),
    "music": ("raga", "raag", "tala", "taal", "melody", "music"),
    "practice": ("harmonium", "sargam", "notation", "practice", "sing"),
    "festival": ("festival", "utsav", "purnima", "birthday", "new year"),
    "service": ("service", "seva", "humanity", "welfare", "prout"),
}


logger = logging.getLogger(__name__)

# How far a request's identity is trusted (docs/security-member-auth.md):
#   "provider" the sign-in provider's own signed proof, checked on the server (exchange only)
#   "session" a signed token the server issued after checking the sign-in with the provider
#   "web"     the website server (its own key), or the shared key while LEGACY_PRINCIPAL_ADMIN
#   "legacy"  the old shared key that ships inside every app: plain member at most, never admin
TRUST_SESSION = "session"
TRUST_WEB = "web"
TRUST_LEGACY = "legacy"
TRUST_PROVIDER = "provider"  # just proven with the sign-in provider (token exchange)
LEGACY_LOG_EVERY = 500
legacy_hits = 0
SESSION_TOUCH_SECONDS = 300


@dataclass(frozen=True, slots=True)
class MemberIdentity:
    subject: str
    provider: str
    display_name: str
    email: str | None
    avatar_url: str | None = None
    trust: str = TRUST_WEB
    # False: the provider did not vouch for the address. It is then never used to find, merge or
    # promote an account.
    email_verified: bool = True
    # Only for "session": the account and session named in the signed token.
    account_id: UUID | None = None
    session_id: UUID | None = None


def _claim_value(claims: list[dict[str, Any]], accepted: set[str]) -> str | None:
    for claim in claims:
        claim_type = str(claim.get("typ") or claim.get("type") or "").casefold()
        if claim_type in accepted:
            value = str(claim.get("val") or claim.get("value") or "").strip()
            if value:
                return value
    return None


def _email_from_claims(claims: list[dict[str, Any]], fallback: Any = None) -> str | None:
    candidates: list[str] = []
    for claim in claims:
        claim_type = str(claim.get("typ") or claim.get("type") or "").casefold()
        if claim_type not in EMAIL_CLAIMS:
            continue
        value = str(claim.get("val") or claim.get("value") or "").strip()
        if value:
            candidates.append(value)
    if fallback:
        candidates.append(str(fallback))
    normalized = [email for email in (normalize_member_email(item) for item in candidates) if email]
    for email in normalized:
        if "@" in email and "#ext#" not in email:
            return email
    return normalized[0] if normalized else None


def decode_client_principal(encoded: str) -> MemberIdentity:
    try:
        payload = json.loads(base64.b64decode(encoded + "===").decode("utf-8"))
    except (ValueError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=401, detail="Invalid authenticated identity") from exc
    claims = payload.get("claims") if isinstance(payload.get("claims"), list) else []
    provider = str(payload.get("auth_typ") or payload.get("identity_provider") or "entra")
    subject = _claim_value(claims, SUBJECT_CLAIMS) or str(payload.get("user_id") or "")
    email = _email_from_claims(claims, payload.get("user_details"))
    display_name = _claim_value(claims, NAME_CLAIMS) or email or "Prabhat Samgiita member"
    if not subject:
        raise HTTPException(status_code=401, detail="Authenticated identity has no subject")
    return MemberIdentity(
        subject=f"{provider}:{subject}",
        provider=provider,
        display_name=str(display_name)[:255],
        email=str(email)[:320] if email else None,
    )


def _bearer_token(request: Request) -> str | None:
    value = request.headers.get("authorization") or ""
    scheme, _, token = value.partition(" ")
    if scheme.casefold() == "bearer" and token.strip():
        return token.strip()
    return None


def _identity_from_access_token(token: str) -> MemberIdentity:
    from app.services.member_tokens import TokenError, verify_access_token

    try:
        claims = verify_access_token(token)
    except TokenError as exc:
        logger.info("member access token refused: %s", exc.reason)
        raise HTTPException(status_code=401, detail="Sign in again") from exc
    return MemberIdentity(
        subject=claims.subject,
        provider=claims.provider,
        display_name="",
        email=None,
        trust=TRUST_SESSION,
        account_id=claims.account_id,
        session_id=claims.session_id,
    )


def _note_legacy_use() -> None:
    global legacy_hits
    legacy_hits += 1
    if legacy_hits == 1 or legacy_hits % LEGACY_LOG_EVERY == 0:
        logger.warning("legacy member principal accepted %d time(s) since start", legacy_hits)


def _identity_from_proxy_headers(request: Request) -> MemberIdentity:
    settings = get_settings()
    web_key = settings.web_proxy_key
    provided_web = request.headers.get("x-web-proxy-key")
    shared_key = settings.member_proxy_key
    provided_key = request.headers.get("x-member-proxy-key")
    if web_key and provided_web and hmac.compare_digest(web_key, provided_web):
        trust = TRUST_WEB
    elif shared_key and provided_key and hmac.compare_digest(shared_key, provided_key):
        if not settings.allow_legacy_member_principal:
            raise HTTPException(
                status_code=401, detail="This app version can no longer sign in. Please update."
            )
        trust = TRUST_WEB if settings.legacy_principal_admin else TRUST_LEGACY
        if trust == TRUST_LEGACY:
            _note_legacy_use()
    else:
        raise HTTPException(status_code=401, detail="Member proxy authentication failed")
    principal = request.headers.get("x-ms-client-principal")
    if not principal:
        raise HTTPException(status_code=401, detail="Sign in is required")
    # Only the website server (its own key) can vouch for an e-mail address. A principal that came
    # with the shared app key is typed by the caller, so its address proves nothing.
    return replace(
        decode_client_principal(principal), trust=trust, email_verified=(trust == TRUST_WEB)
    )


def require_member_identity(request: Request) -> MemberIdentity:
    """Who is calling. A signed token wins; the old shared key only gives a plain member."""
    token = _bearer_token(request)
    if token is not None:
        return _identity_from_access_token(token)
    return _identity_from_proxy_headers(request)


def try_member_identity(request: Request) -> MemberIdentity | None:
    try:
        token = _bearer_token(request)
        if token is not None:
            return _identity_from_access_token(token)
        if not (
            request.headers.get("x-member-proxy-key") or request.headers.get("x-web-proxy-key")
        ) or not request.headers.get("x-ms-client-principal"):
            return None
        return _identity_from_proxy_headers(request)
    except HTTPException:
        return None


async def lookup_preferred_language(
    session: AsyncSession,
    identity: MemberIdentity | None,
) -> str | None:
    if identity is None:
        return None
    from app.services.chat_language import resolve_preferred_language

    row = await session.scalar(
        select(UserAccount.preferred_language).where(
            UserAccount.external_subject == identity.subject,
            UserAccount.deleted_at.is_(None),
        )
    )
    if row is None and identity.email and identity.email_verified:
        canonical = await _find_canonical_by_email(session, identity.email)
        if canonical is not None:
            row = canonical.preferred_language
    return resolve_preferred_language(str(row) if row else None)


def _subject_rank(subject: str) -> int:
    """Higher = more canonical (Easy Auth OID beats email/preview forks)."""
    value = (subject or "").casefold()
    if (
        value.startswith(("aad:", "google:", "facebook:", "apple:", "local:"))
        and "@" not in value
        and "preview" not in value
    ):
        return 3
    if "preview" in value or value.endswith("@prabhat.local"):
        return 0
    if "@" in value:
        return 1
    return 2


def _account_preference(row: UserAccount) -> tuple[int, int, datetime]:
    """Lower tuple = stronger canonical account (admin, OID, then oldest)."""
    return (
        0 if row.is_admin else 1,
        -_subject_rank(row.external_subject),
        row.created_at or datetime.min.replace(tzinfo=UTC),
    )


# Providers that confirm an address before they hand it out. An account made by e-mail and
# password ("local"), by Facebook (never promised verified) or by anything else is not matched by
# address at sign-in, otherwise a stranger could register someone else's address first and have
# the real owner land in that account.
VOUCHING_PROVIDERS = frozenset({"google", "apple", "aad", "entra", "microsoft", "azure"})


async def _accounts_sharing_mailbox(
    session: AsyncSession, email: str | None, *, vouched_only: bool = False
) -> list[UserAccount]:
    normalized = normalize_member_email(email)
    if not normalized or normalized.endswith("@prabhat.local"):
        return []
    clauses = [func.lower(UserAccount.email) == normalized]
    local, _, domain = normalized.partition("@")
    if local and domain:
        clauses.append(func.lower(UserAccount.email).like(f"{local}_{domain}#ext#%"))
    rows = list(
        (
            await session.scalars(
                select(UserAccount).where(UserAccount.deleted_at.is_(None), or_(*clauses))
            )
        ).all()
    )
    return [
        row
        for row in rows
        if normalize_member_email(row.email) == normalized
        and (not vouched_only or (row.identity_provider or "").casefold() in VOUCHING_PROVIDERS)
    ]


async def _find_canonical_by_email(
    session: AsyncSession, email: str, *, vouched_only: bool = False
) -> UserAccount | None:
    rows = await _accounts_sharing_mailbox(session, email, vouched_only=vouched_only)
    if not rows:
        return None
    rows.sort(key=_account_preference)
    return rows[0]


async def _absorb_mailbox_twins(
    session: AsyncSession, member: UserAccount, email: str | None
) -> UserAccount:
    """Fold every account for this mailbox into one, keeping quiz/admin/chat."""
    twins = [
        row
        for row in await _accounts_sharing_mailbox(session, email, vouched_only=True)
        if row.id != member.id
    ]
    for twin in twins:
        if _account_preference(twin) < _account_preference(member):
            await _merge_fork_into_canonical(session, member, twin)
            member = twin
        else:
            await _merge_fork_into_canonical(session, twin, member)
    return member


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

    canon_event_ids = set(
        (
            await session.execute(
                select(QuizEventSubmission.event_id).where(
                    QuizEventSubmission.user_id == canonical.id
                )
            )
        ).scalars()
    )
    fork_events = list(
        (
            await session.scalars(
                select(QuizEventSubmission).where(QuizEventSubmission.user_id == fork.id)
            )
        ).all()
    )
    for submission in fork_events:
        if submission.event_id in canon_event_ids:
            await session.delete(submission)
        else:
            submission.user_id = canonical.id

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


def _cap_to_plain_member(member: UserAccount) -> UserAccount:
    """A request that came through the old shared key never acts as admin or team.

    The row in the database is not touched: only this request's copy of the account says "not admin"
    (`set_committed_value` marks nothing as changed), and `is_team_member` / `require_admin_member`
    look at `plain_member_only`.
    """
    set_committed_value(member, "is_admin", False)
    set_committed_value(member, "is_super_admin", False)
    member.plain_member_only = True  # type: ignore[attr-defined]
    return member


async def _member_from_session(session: AsyncSession, identity: MemberIdentity) -> UserAccount:
    """The account named in a signed token. Roles stay as the database has them right now."""
    if identity.account_id is None or identity.session_id is None:
        raise HTTPException(status_code=401, detail="Sign in again")
    member = await session.get(UserAccount, identity.account_id)
    row = await session.get(MemberSession, identity.session_id)
    if (
        member is None
        or member.deleted_at is not None
        or row is None
        or row.revoked_at is not None
        or row.user_id != member.id
    ):
        raise HTTPException(status_code=401, detail="Sign in again")
    now = datetime.now(UTC)
    seen = member.last_seen_at
    if seen is None or (now - (seen if seen.tzinfo else seen.replace(tzinfo=UTC))) > timedelta(
        seconds=SESSION_TOUCH_SECONDS
    ):
        member.last_seen_at = now
        await session.commit()
    member.database_roles_only = True  # type: ignore[attr-defined]
    return member


async def sync_member(session: AsyncSession, identity: MemberIdentity) -> UserAccount:
    if identity.trust == TRUST_SESSION:
        return await _member_from_session(session, identity)
    now = datetime.now(UTC)
    if identity.trust == TRUST_LEGACY:
        # The shared key ships inside every app: whoever holds it can type any address. It may
        # not find, merge, promote or write an e-mail (docs/security-member-auth.md).
        identity = replace(identity, email=None, email_verified=False)
    # An address the provider did not vouch for may not find, merge or promote an account,
    # and is not stored either (a stored address is what the next sign-in is matched against).
    trusted_email = identity.email if identity.email_verified else None
    member = await session.scalar(
        select(UserAccount).where(
            UserAccount.external_subject == identity.subject,
            UserAccount.deleted_at.is_(None),
        )
    )
    if member is None and trusted_email:
        canonical = await _find_canonical_by_email(session, trusted_email, vouched_only=True)
        if canonical is not None and not is_ephemeral_member(canonical):
            # Reuse the website Easy Auth account instead of forking by mobile UUID/email.
            member = canonical
    if member is None:
        member = UserAccount(
            external_subject=identity.subject,
            identity_provider=identity.provider,
            email=normalize_member_email(trusted_email) if trusted_email else None,
            display_name=identity.display_name,
            avatar_url=identity.avatar_url,
            preferred_language="english",
            last_seen_at=now,
        )
        session.add(member)
        await session.flush()
    else:
        member.deleted_at = None
    if trusted_email:
        member = await _absorb_mailbox_twins(session, member, trusted_email)
    member.identity_provider = identity.provider
    if trusted_email:
        member.email = normalize_member_email(trusted_email) or member.email
    # Keep a member-edited display name; only fill from OAuth when blank.
    if not (member.display_name or "").strip():
        member.display_name = identity.display_name
    member.avatar_url = identity.avatar_url or member.avatar_url
    member.last_seen_at = now
    # Promotion by owner e-mail: only for the website, or a provider that vouched for the address.
    # Never for the shared key. The probe names (deploy smoke test) work only via the website key.
    if identity.trust == TRUST_WEB:
        ensure_ephemeral_smoke_admin(member)
        apply_default_admin(member)
    elif identity.trust == TRUST_PROVIDER and identity.email_verified:
        apply_default_admin(member)
    await session.commit()
    await session.refresh(member)
    if identity.trust == TRUST_LEGACY:
        return _cap_to_plain_member(member)
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
        preferred_language=member.preferred_language or "english",
        country=member.country,
        personalization_enabled=member.personalization_enabled,
        is_admin=member.is_admin,
        is_super_admin=bool(member.is_super_admin),
        favorite_song_numbers=favorites,
        **phone_profile_fields(member),
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
    if _is_companion_scope(payload.song_number):
        await _archive_expired_messages(session, member, now)
    for turn in payload.turns:
        session.add(
            UserChatMessage(
                user_id=member.id,
                song_number=payload.song_number,
                role=turn.role,
                content=turn.content,
                expires_at=now + timedelta(days=CHAT_RETENTION_DAYS),
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
) -> tuple[str, list[ChatMemoryTurn], list[ChatHistoryDay], str, dict[str, str]]:
    # Always restore chat turns for signed-in members. personalization_enabled
    # only controls interest-summary exposure, not companion history.
    now = datetime.now(UTC)
    companion = _is_companion_scope(song_number)
    if companion:
        await _archive_expired_messages(session, member, now)
    profile = await session.get(UserInterestProfile, member.id)
    statement = select(UserChatMessage).where(
        UserChatMessage.user_id == member.id,
        UserChatMessage.expires_at > now,
    )
    if song_number is not None:
        statement = statement.where(UserChatMessage.song_number == song_number)
    else:
        statement = statement.where(UserChatMessage.song_number.is_(None))
    if companion:
        messages = list(
            (await session.execute(statement.order_by(UserChatMessage.created_at.asc())))
            .scalars()
            .all()
        )
    else:
        messages = list(
            (
                await session.execute(
                    statement.order_by(UserChatMessage.created_at.desc()).limit(RECENT_TURN_LIMIT)
                )
            )
            .scalars()
            .all()
        )
        messages = list(reversed(messages))
    await session.commit()
    summary = (
        profile.summary_text
        if profile and member.personalization_enabled
        else ""
    )
    if not companion:
        return summary, [_turn_from_message(message) for message in messages], [], "", {}
    monthly = {
        str(month): str(text)
        for month, text in dict(profile.monthly_summaries or {}).items()
        if str(text).strip()
    } if profile else {}
    archived = _archived_summary(monthly)
    recent_turns = [_turn_from_message(message) for message in messages[-RECENT_TURN_LIMIT:]]
    history_days = _group_messages_by_day(messages)
    return summary, recent_turns, history_days, archived, monthly


async def clear_member_chat_memory(session: AsyncSession, member: UserAccount) -> None:
    await session.execute(
        delete(UserChatMessage).where(UserChatMessage.user_id == member.id)
    )
    profile = await session.get(UserInterestProfile, member.id)
    if profile is not None:
        profile.summary_text = ""
        profile.topic_counts = {}
        profile.song_counts = {}
        profile.language_counts = {}
        profile.monthly_summaries = {}
    await session.commit()
