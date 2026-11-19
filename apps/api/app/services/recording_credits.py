"""Several performers on one recording (docs/co-performers.md).

The uploader names people; a named MEMBER is asked and the recording is on their page only after
they say yes. A name with no page behind it stays text. The recording itself is never changed
(only its display credit, `recordings.author`, gets the name added or taken out).

States of one credit (`recording_credits.status`):

  text      a plain name, no page
  invited   a page was named and has not answered (expires after INVITE_DAYS, then `expired`)
  accepted  the page said yes (or the uploader's own page, or the team added it): on the page
  declined  the page said no (private: the uploader only sees "did not confirm")
  removed   taken off (by the person, by the uploader while unanswered, or by the team)
  expired   not answered in time; the name stays as text

An accepted credit can be taken off only by the person or by the team, never by the uploader.
"""

from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import UserAccount
from app.models.author_profiles import (
    AuthorClaim,
    AuthorClaimEvent,
    AuthorProfile,
    AuthorRecordingLink,
)
from app.models.recording_credits import (
    CREDIT_INVITES,
    CREDIT_ROLES,
    AuthorCreditBlock,
    RecordingCredit,
    RecordingCreditEvent,
)
from app.models.recordings import MemberNotice, Recording
from app.services import author_claim_rules as match
from app.services import author_rules as rules
from app.services.author_profiles import AuthorError, now_utc, refresh_snapshot

# ---- the knobs (one place each) --------------------------------------------------------------

MAX_CREDITS = 10  # people on one recording (not counting removed / declined / expired ones)
INVITE_DAYS = 60  # an invitation, or an invite link, is open this long
AUTHOR_TEXT_MAX = 200  # `recordings.author`

LIVE = (
    "text",
    "invited",
    "accepted",
)  # the rows that count towards MAX_CREDITS and "already added"
# A name that may not be offered again to the same page: it said no, or it left.
NO_AGAIN_EVENTS = ("declined", "left")


def _digest(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def new_token() -> tuple[str, str]:
    """A long random token (shown once) and the hash that is kept."""
    token = secrets.token_urlsafe(32)
    return token, _digest(token)


async def _log(
    session: AsyncSession, credit: RecordingCredit, actor: str, action: str, note: str | None = None
) -> None:
    session.add(
        RecordingCreditEvent(
            credit_id=credit.id, at=now_utc(), actor=actor[:255], action=action, note=note
        )
    )


def _notice(
    user_id: UUID,
    kind: str,
    title: str,
    body: str,
    recording_id: UUID | None,
    payload: dict[str, Any],
) -> MemberNotice:
    return MemberNotice(
        user_id=user_id,
        kind=kind,
        recording_id=recording_id,
        title=title[:300],
        body=body,
        payload=payload,
    )


# --------------------------------------------------------------------------- the display credit


def _parts(text: str) -> list[str]:
    return match.split_credit(text)


def append_to_author(recording: Recording, name: str) -> None:
    """Put `name` in the display credit unless it is already there (same name, any spelling)."""
    text = recording.author or ""
    if any(match.same_name(part, name) for part in _parts(text)):
        return
    joined = f"{text} & {name}" if text.strip() else name
    if len(joined) <= AUTHOR_TEXT_MAX:
        recording.author = joined


def drop_from_author(recording: Recording, name: str) -> None:
    """Take `name` out of the display credit when it is one of its names (never empties it)."""
    parts = _parts(recording.author or "")
    kept = [p for p in parts if not match.same_name(p, name)]
    if kept and len(kept) < len(parts):
        recording.author = " & ".join(kept)


# --------------------------------------------------------------------------- reading


async def credits_of(session: AsyncSession, recording_id: UUID) -> list[RecordingCredit]:
    rows = await session.scalars(
        select(RecordingCredit)
        .where(RecordingCredit.recording_id == recording_id)
        .order_by(RecordingCredit.position, RecordingCredit.created_at)
    )
    return list(rows.all())


async def _live_count(session: AsyncSession, recording_id: UUID) -> int:
    return int(
        await session.scalar(
            select(func.count())
            .select_from(RecordingCredit)
            .where(RecordingCredit.recording_id == recording_id, RecordingCredit.status.in_(LIVE))
        )
        or 0
    )


async def _recording(session: AsyncSession, recording_id: UUID) -> Recording:
    recording = await session.get(Recording, recording_id)
    if recording is None:
        raise AuthorError("recording_not_found", 404, "Recording not found")
    return recording


def _can_manage(recording: Recording, member: UserAccount, is_team: bool) -> bool:
    return is_team or (recording.author_id is not None and recording.author_id == member.id)


async def _was_refused(session: AsyncSession, credit: RecordingCredit) -> bool:
    last = await session.scalar(
        select(RecordingCreditEvent.action)
        .where(
            RecordingCreditEvent.credit_id == credit.id,
            RecordingCreditEvent.action.in_(NO_AGAIN_EVENTS),
        )
        .limit(1)
    )
    return last is not None


# --------------------------------------------------------------------------- adding


async def _profile(session: AsyncSession, profile_id: UUID) -> AuthorProfile:
    profile = await session.get(AuthorProfile, profile_id)
    if profile is None:
        raise AuthorError("page_not_found", 404, "This author page does not exist")
    if profile.status == "suspended":
        raise AuthorError("page_suspended", 403, "This page cannot be added")
    return profile


async def _refuses(session: AsyncSession, profile: AuthorProfile, uploader_id: UUID) -> bool:
    if profile.credit_invites == "nobody":
        return True
    block = await session.scalar(
        select(AuthorCreditBlock.id).where(
            AuthorCreditBlock.profile_id == profile.id,
            AuthorCreditBlock.blocked_member_id == uploader_id,
        )
    )
    return block is not None


async def _approve_pending_claim(
    session: AsyncSession, profile: AuthorProfile, recording: Recording
) -> bool:
    """Two people agree (the uploader named the page, the page asked for it): a pending claim is
    approved at once. Returns True when there was a claim in force (pending or approved)."""
    claim = await session.scalar(
        select(AuthorClaim).where(
            AuthorClaim.profile_id == profile.id, AuthorClaim.recording_id == recording.id
        )
    )
    if claim is None or claim.status not in ("pending", "approved"):
        return False
    if claim.status == "pending":
        claim.status = "approved"
        claim.decided_by = "uploader"
        claim.decided_at = now_utc()
        session.add(
            AuthorClaimEvent(
                claim_id=claim.id,
                at=now_utc(),
                actor="uploader",
                action="approved",
                note="the uploader named this page on the recording",
            )
        )
    return True


async def add_credit(
    session: AsyncSession,
    recording: Recording,
    *,
    actor: str,
    name: str,
    profile_id: UUID | None = None,
    role: str = "performer",
    source: str = "uploader",
    uploader_id: UUID | None = None,
    commit: bool = True,
) -> RecordingCredit:
    """Add one person to a recording. `uploader_id` is who adds (used for blocks and for
    "this is the uploader's own page"); `source` is `uploader` or `team`. Raises AuthorError
    for what a person can fix."""
    clean = rules.clean_line(name, 120)
    if len(match.match_key(clean)) < 2:
        raise AuthorError("name_invalid", 422, "Write a name")
    if role not in CREDIT_ROLES:
        raise AuthorError("role_invalid", 422, "Choose Sings, Plays or Wrote it")
    if await _live_count(session, recording.id) >= MAX_CREDITS:
        raise AuthorError("too_many", 422, f"{MAX_CREDITS} is the limit on one recording")
    existing = await credits_of(session, recording.id)
    position = max((c.position for c in existing), default=-1) + 1
    profile: AuthorProfile | None = None
    reuse: RecordingCredit | None = None
    if profile_id is not None:
        profile = await _profile(session, profile_id)
        same = next((c for c in existing if c.profile_id == profile.id), None)
        if same is not None and same.status in LIVE:
            raise AuthorError("already_added", 422, "Already added")
        if same is not None and await _was_refused(session, same):
            # said no, or left: not asked again (and nothing tells the uploader why)
            raise AuthorError("already_added", 422, "Already added")
        reuse = same  # a removed / expired row of this page: the same row starts again
        own = uploader_id is not None and profile.member_id == uploader_id
        if (
            not own
            and source != "team"
            and uploader_id is not None
            and await _refuses(session, profile, uploader_id)
        ):
            raise AuthorError(
                "invites_off",
                422,
                "This person does not take invitations. You can write the name as plain text.",
            )
    else:
        if any(
            c.status in LIVE and c.profile_id is None and match.same_name(c.name, clean)
            for c in existing
        ):
            raise AuthorError("already_added", 422, "Already added")
    if reuse is not None:
        credit = reuse
        credit.name = clean
        credit.role = role
        credit.source = source
        credit.invited_by = uploader_id
        credit.status = "text"
        credit.decided_at = None
        credit.expires_at = None
    else:
        credit = RecordingCredit(
            recording_id=recording.id,
            position=position,
            name=clean,
            profile_id=profile.id if profile else None,
            role=role,
            source=source,
            invited_by=uploader_id,
            status="text",
        )
    moment = now_utc()
    notice: MemberNotice | None = None
    if profile is not None:
        own = uploader_id is not None and profile.member_id == uploader_id
        already = await _approve_pending_claim(session, profile, recording)
        if own or source == "team" or already:
            credit.status = "accepted"
            credit.decided_at = moment
        else:
            credit.status = "invited"
            credit.expires_at = moment + timedelta(days=INVITE_DAYS)
            notice = _notice(
                profile.member_id,
                "credit_invite",
                f"{recording.added_by} added you on “{recording.title}”",
                f"{recording.added_by} named you as a "
                f"{'writer' if role == 'author' else 'performer'} on “{recording.title}”. "
                "If it is you, it will be on your author page.",
                recording.id,
                {
                    "credit_id": None,  # filled after the flush
                    "profile_id": str(profile.id),
                    "role": role,
                    "recording_title": recording.title,
                },
            )
    session.add(credit)
    await session.flush()
    await _log(session, credit, actor, "added", source)
    if notice is not None:
        notice.payload = {**notice.payload, "credit_id": str(credit.id)}
        session.add(notice)
        await _log(session, credit, actor, "invited")
    append_to_author(recording, clean)
    if commit:
        await session.commit()
        if credit.status == "accepted" and profile is not None:
            await refresh_snapshot(session, profile, force=True)
    return credit


async def add_at_upload(
    session: AsyncSession,
    recording: Recording,
    uploader_id: UUID,
    performers: list[dict[str, Any]],
) -> None:
    """The people named on the upload form. A name that cannot be invited (the page takes no
    invitations, is gone or suspended) falls back to plain text, so the upload never fails because
    of a credit. Never raises."""
    for item in performers[:MAX_CREDITS]:
        raw_id = item.get("profile_id")
        pid = UUID(str(raw_id)) if raw_id else None
        name = str(item.get("name") or "")
        role = str(item.get("role") or "performer")
        try:
            await add_credit(
                session,
                recording,
                actor=f"member:{uploader_id}",
                name=name,
                profile_id=pid,
                role=role if role in CREDIT_ROLES else "performer",
                uploader_id=uploader_id,
                commit=False,
            )
        except AuthorError as exc:
            if pid is not None and exc.code in ("invites_off", "page_not_found", "page_suspended"):
                try:
                    await add_credit(
                        session,
                        recording,
                        actor=f"member:{uploader_id}",
                        name=name,
                        profile_id=None,
                        role=role if role in CREDIT_ROLES else "performer",
                        uploader_id=uploader_id,
                        commit=False,
                    )
                except AuthorError:
                    pass
            # every other refusal (a bad name, the same person twice, too many) just skips this one


# --------------------------------------------------------------------------- the person answers


async def _credit_for_page(
    session: AsyncSession, profile: AuthorProfile, credit_id: UUID
) -> RecordingCredit:
    credit = await session.get(RecordingCredit, credit_id)
    if credit is None or credit.profile_id != profile.id:
        raise AuthorError("credit_not_found", 404, "Not found")
    return credit


async def accept(
    session: AsyncSession, member: UserAccount, profile: AuthorProfile, credit_id: UUID
) -> RecordingCredit:
    credit = await _credit_for_page(session, profile, credit_id)
    if credit.status == "accepted":
        return credit  # answering twice is harmless
    if credit.status != "invited":
        raise AuthorError(
            "no_longer_open",
            409,
            "This invitation is no longer open",
        )
    credit.status = "accepted"
    credit.decided_at = now_utc()
    credit.expires_at = None
    await _log(session, credit, f"member:{member.id}", "accepted")
    recording = await session.get(Recording, credit.recording_id)
    if recording is not None and credit.invited_by is not None:
        session.add(
            _notice(
                credit.invited_by,
                "credit_accepted",
                f"{profile.display_name} confirmed",
                f"{profile.display_name} confirmed they are on “{recording.title}”. "
                "It is now on their author page too.",
                recording.id,
                {"credit_id": str(credit.id), "profile_id": str(profile.id)},
            )
        )
    await session.commit()
    await refresh_snapshot(session, profile, force=True)
    return credit


async def decline(
    session: AsyncSession,
    member: UserAccount,
    profile: AuthorProfile,
    credit_id: UUID,
    *,
    block: bool = False,
) -> RecordingCredit:
    credit = await _credit_for_page(session, profile, credit_id)
    if credit.status == "declined":
        return credit
    if credit.status != "invited":
        raise AuthorError("no_longer_open", 409, "This invitation is no longer open")
    credit.status = "declined"
    credit.decided_at = now_utc()
    credit.expires_at = None
    await _log(session, credit, f"member:{member.id}", "declined", "block" if block else None)
    recording = await session.get(Recording, credit.recording_id)
    if credit.invited_by is not None:
        if block:
            taken = await session.scalar(
                select(AuthorCreditBlock.id).where(
                    AuthorCreditBlock.profile_id == profile.id,
                    AuthorCreditBlock.blocked_member_id == credit.invited_by,
                )
            )
            if taken is None:
                session.add(
                    AuthorCreditBlock(profile_id=profile.id, blocked_member_id=credit.invited_by)
                )
        if recording is not None:
            session.add(
                _notice(
                    credit.invited_by,
                    "credit_declined",
                    f"{credit.name} did not confirm",
                    f"{credit.name} did not confirm “{recording.title}”. The name stays as text "
                    "on the recording.",
                    recording.id,
                    {"credit_id": str(credit.id)},
                )
            )
    await session.commit()
    return credit


async def accept_open_invite(
    session: AsyncSession, profile: AuthorProfile, recording_id: UUID, member_id: UUID
) -> bool:
    """A page that was invited and also claims the recording: the claim only accepts the
    invitation. Returns True when an open invitation was accepted."""
    credit = await session.scalar(
        select(RecordingCredit).where(
            RecordingCredit.recording_id == recording_id,
            RecordingCredit.profile_id == profile.id,
            RecordingCredit.status == "invited",
        )
    )
    if credit is None:
        return False
    credit.status = "accepted"
    credit.decided_at = now_utc()
    credit.expires_at = None
    await _log(session, credit, f"member:{member_id}", "accepted", "through a claim")
    return True


async def leave(
    session: AsyncSession, member: UserAccount, profile: AuthorProfile, credit_id: UUID
) -> RecordingCredit:
    """ "Take me off this recording": the page loses it; the name stays in the text credit."""
    credit = await _credit_for_page(session, profile, credit_id)
    if credit.status != "accepted":
        raise AuthorError("not_on_page", 409, "This recording is not on your page")
    credit.status = "removed"
    credit.decided_at = now_utc()
    await _log(session, credit, f"member:{member.id}", "left")
    await session.commit()
    await refresh_snapshot(session, profile, force=True)
    return credit


async def set_role(
    session: AsyncSession, member: UserAccount, profile: AuthorProfile, credit_id: UUID, role: str
) -> RecordingCredit:
    if role not in CREDIT_ROLES:
        raise AuthorError("role_invalid", 422, "Choose Sings, Plays or Wrote it")
    credit = await _credit_for_page(session, profile, credit_id)
    if credit.status not in ("invited", "accepted"):
        raise AuthorError("no_longer_open", 409, "This invitation is no longer open")
    credit.role = role
    await _log(session, credit, f"member:{member.id}", "role", role)
    await session.commit()
    return credit


# --------------------------------------------------------------------------- the uploader / team


async def remove(
    session: AsyncSession,
    member: UserAccount,
    credit_id: UUID,
    *,
    is_team: bool,
    actor: str,
) -> RecordingCredit:
    credit = await session.get(RecordingCredit, credit_id)
    if credit is None:
        raise AuthorError("credit_not_found", 404, "Not found")
    recording = await _recording(session, credit.recording_id)
    if not _can_manage(recording, member, is_team):
        raise AuthorError("not_yours", 403, "Only the person who added the recording can do this")
    if credit.status == "removed":
        return credit
    profile = await session.get(AuthorProfile, credit.profile_id) if credit.profile_id else None
    if credit.status == "accepted" and not is_team:
        own = profile is not None and profile.member_id == member.id
        if not own:
            raise AuthorError(
                "confirmed_credit",
                403,
                "This person has confirmed. Only they, or the team, can take them off. "
                "If it is a mistake, report it.",
            )
    was_accepted = credit.status == "accepted"
    credit.status = "removed"
    credit.decided_at = now_utc()
    credit.invite_token_hash = None
    credit.expires_at = None
    await _log(session, credit, actor, "removed", "team" if is_team else "uploader")
    drop_from_author(recording, credit.name)
    if is_team and was_accepted and profile is not None:
        session.add(
            _notice(
                profile.member_id,
                "credit_removed",
                "Taken off a recording",
                f"The team took you off “{recording.title}”. It is not on your author page now.",
                recording.id,
                {"credit_id": str(credit.id)},
            )
        )
    await session.commit()
    if was_accepted and profile is not None:
        await refresh_snapshot(session, profile, force=True)
    return credit


async def change_role_as_uploader(
    session: AsyncSession, member: UserAccount, credit_id: UUID, role: str, *, is_team: bool
) -> RecordingCredit:
    if role not in CREDIT_ROLES:
        raise AuthorError("role_invalid", 422, "Choose Sings, Plays or Wrote it")
    credit = await session.get(RecordingCredit, credit_id)
    if credit is None:
        raise AuthorError("credit_not_found", 404, "Not found")
    recording = await _recording(session, credit.recording_id)
    if not _can_manage(recording, member, is_team):
        raise AuthorError("not_yours", 403, "Only the person who added the recording can do this")
    if credit.status == "accepted" and not is_team:
        raise AuthorError("confirmed_credit", 403, "This person has confirmed")
    credit.role = role
    await _log(session, credit, f"member:{member.id}", "role", role)
    await session.commit()
    return credit


# --------------------------------------------------------------------------- people with no account


async def make_invite_link(
    session: AsyncSession, member: UserAccount, credit_id: UUID, *, is_team: bool
) -> tuple[str, datetime]:
    """A one-use link token for a name with no page. Returned once; only its hash is kept."""
    credit = await session.get(RecordingCredit, credit_id)
    if credit is None:
        raise AuthorError("credit_not_found", 404, "Not found")
    recording = await _recording(session, credit.recording_id)
    if not _can_manage(recording, member, is_team):
        raise AuthorError("not_yours", 403, "Only the person who added the recording can do this")
    if credit.status != "text" or credit.profile_id is not None:
        raise AuthorError("not_text", 409, "This name already has a page or was taken off")
    token, digest = new_token()
    credit.invite_token_hash = digest
    credit.expires_at = now_utc() + timedelta(days=INVITE_DAYS)
    await _log(session, credit, f"member:{member.id}", "link")
    await session.commit()
    return token, credit.expires_at


async def claim_by_token(
    session: AsyncSession, member: UserAccount, profile: AuthorProfile | None, token: str
) -> RecordingCredit:
    """The person opens the invite link, is signed in and has a page: the credit is theirs."""
    credit = await session.scalar(
        select(RecordingCredit).where(RecordingCredit.invite_token_hash == _digest(token))
    )
    now = now_utc()
    if (
        credit is None
        or credit.status != "text"
        or credit.expires_at is None
        or _aware(credit.expires_at) < now
    ):
        raise AuthorError("link_not_valid", 410, "This link is not valid any more")
    if profile is None:
        raise AuthorError("no_profile", 404, "You have no author page yet")
    if profile.status == "suspended":
        raise AuthorError("page_suspended", 403, "This page cannot be added")
    twin = await session.scalar(
        select(RecordingCredit.id).where(
            RecordingCredit.recording_id == credit.recording_id,
            RecordingCredit.profile_id == profile.id,
        )
    )
    if twin is not None:
        raise AuthorError("already_added", 422, "Already added")
    credit.profile_id = profile.id
    credit.status = "accepted"
    credit.source = "self"
    credit.decided_at = now
    credit.expires_at = None
    credit.invite_token_hash = None  # one use
    await _log(session, credit, f"member:{member.id}", "token_used")
    recording = await session.get(Recording, credit.recording_id)
    if recording is not None and credit.invited_by is not None:
        session.add(
            _notice(
                credit.invited_by,
                "credit_accepted",
                f"{profile.display_name} confirmed",
                f"{profile.display_name} confirmed they are on “{recording.title}”.",
                recording.id,
                {"credit_id": str(credit.id), "profile_id": str(profile.id)},
            )
        )
    await session.commit()
    await refresh_snapshot(session, profile, force=True)
    return credit


def _aware(value: datetime) -> datetime:
    from datetime import UTC

    return value if value.tzinfo else value.replace(tzinfo=UTC)


# --------------------------------------------------------------------------- housekeeping


async def expire_old(session: AsyncSession, now: datetime | None = None) -> int:
    """Invitations and links not answered within INVITE_DAYS: the credit goes back to plain text
    (a page invitation becomes `expired`, an unused link is just switched off)."""
    moment = now or now_utc()
    rows = (
        await session.scalars(
            select(RecordingCredit).where(
                RecordingCredit.expires_at.is_not(None), RecordingCredit.expires_at < moment
            )
        )
    ).all()
    count = 0
    for credit in rows:
        if credit.status == "invited":
            credit.status = "expired"
            credit.decided_at = moment
            await _log(session, credit, "system", "expired")
            recording = await session.get(Recording, credit.recording_id)
            if recording is not None and credit.invited_by is not None:
                session.add(
                    _notice(
                        credit.invited_by,
                        "credit_expired",
                        f"{credit.name} did not answer",
                        f"{credit.name} did not answer for {INVITE_DAYS} days. The name stays as "
                        f"text on “{recording.title}”.",
                        recording.id,
                        {"credit_id": str(credit.id)},
                    )
                )
            count += 1
        elif credit.status == "text":
            credit.invite_token_hash = None
            await _log(session, credit, "system", "expired", "link")
            count += 1
        credit.expires_at = None
    await session.commit()
    return count


# --------------------------------------------------------------------------- the person's own lists


async def my_invitations(
    session: AsyncSession, profile: AuthorProfile
) -> list[tuple[RecordingCredit, Recording]]:
    rows = (
        await session.execute(
            select(RecordingCredit, Recording)
            .join(Recording, Recording.id == RecordingCredit.recording_id)
            .where(RecordingCredit.profile_id == profile.id, RecordingCredit.status == "invited")
            .order_by(RecordingCredit.created_at.desc())
        )
    ).all()
    return [(c, r) for c, r in rows]


async def hidden_ids(session: AsyncSession, profile: AuthorProfile) -> set[UUID]:
    """Recordings the page's owner switched off for the page."""
    rows = await session.scalars(
        select(AuthorRecordingLink.recording_id).where(
            AuthorRecordingLink.profile_id == profile.id, AuthorRecordingLink.mode == "exclude"
        )
    )
    return set(rows.all())


async def my_credits(
    session: AsyncSession, profile: AuthorProfile
) -> list[tuple[RecordingCredit, Recording]]:
    """Credits on this page that are confirmed (so the person can take themselves off one)."""
    rows = (
        await session.execute(
            select(RecordingCredit, Recording)
            .join(Recording, Recording.id == RecordingCredit.recording_id)
            .where(RecordingCredit.profile_id == profile.id, RecordingCredit.status == "accepted")
            .order_by(RecordingCredit.decided_at.desc())
        )
    ).all()
    return [(c, r) for c, r in rows]


async def set_invites(session: AsyncSession, profile: AuthorProfile, value: str) -> AuthorProfile:
    if value not in CREDIT_INVITES:
        raise AuthorError("setting_invalid", 422, "Choose Everyone or Nobody")
    profile.credit_invites = value
    await session.commit()
    return profile


async def blocks_of(session: AsyncSession, profile: AuthorProfile) -> list[AuthorCreditBlock]:
    rows = await session.scalars(
        select(AuthorCreditBlock)
        .where(AuthorCreditBlock.profile_id == profile.id)
        .order_by(AuthorCreditBlock.created_at)
    )
    return list(rows.all())


async def unblock(session: AsyncSession, profile: AuthorProfile, block_id: UUID) -> None:
    row = await session.get(AuthorCreditBlock, block_id)
    if row is None or row.profile_id != profile.id:
        raise AuthorError("block_not_found", 404, "Not found")
    await session.delete(row)
    await session.commit()
