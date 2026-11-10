"""A signed-in account for Apple and Google app reviewers. Docs: docs/store-review-account.md.

Reviewers cannot use Google or Apple sign-in with a throw-away identity, and they will not sign up
with a real e-mail, so the stores ask for a ready username and password. This keeps exactly one such
account, and only while the environment says so:

* OFF by default. `STORE_REVIEWER_ENABLED` is false unless somebody sets it.
* Nothing is stored in the repository. The e-mail and the password come from
  `STORE_REVIEWER_EMAIL` and `STORE_REVIEWER_PASSWORD`; the password must be at least 12 characters.
* It is an ordinary member. It is never an admin, and an owner/admin e-mail address is refused.
* It never takes over a real person's account: if the e-mail already belongs to somebody else the
  account is not created.
* Switching the flag off removes the account (and its password) at the next start of the API.
* While it is on, every start puts it back into the state described above (password reset, a
  deleted account restored), so a reviewer who deletes it during review can sign in again.

Sign-in itself is the normal `POST /api/v1/auth/login`; there is no special door.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.models import UserAccount, UserCredential
from app.services.admin_members import owner_admin_emails
from app.services.local_auth import EMAIL_PATTERN, _hash_password, _verify_password

logger = logging.getLogger(__name__)

REVIEWER_SUBJECT = "store-reviewer"
REVIEWER_NAME = "App Review"
MIN_PASSWORD_LENGTH = 12


async def _remove(session: AsyncSession, member: UserAccount | None) -> bool:
    """Soft-delete the reviewer member and drop its password. True when something changed."""
    if member is None:
        return False
    changed = False
    credentials = (
        await session.scalars(select(UserCredential).where(UserCredential.user_id == member.id))
    ).all()
    for credential in credentials:
        await session.delete(credential)
        changed = True
    if member.deleted_at is None:
        member.deleted_at = datetime.now(UTC)
        changed = True
    if changed:
        await session.commit()
    return changed


async def sync_store_reviewer(session: AsyncSession, settings: Settings) -> str:
    """Make the database match the settings. Returns a short state word (used by tests and logs):
    off, removed, created, updated, unchanged, or refused."""
    member = await session.scalar(
        select(UserAccount).where(
            UserAccount.identity_provider == "local",
            UserAccount.external_subject == REVIEWER_SUBJECT,
        )
    )

    if not settings.store_reviewer_enabled:
        if await _remove(session, member):
            logger.info("store reviewer account removed (STORE_REVIEWER_ENABLED is off)")
            return "removed"
        return "off"

    email = (settings.store_reviewer_email or "").strip().casefold()
    password = settings.store_reviewer_password or ""
    problem = None
    if not EMAIL_PATTERN.match(email):
        problem = "STORE_REVIEWER_EMAIL is missing or not an e-mail address"
    elif len(password) < MIN_PASSWORD_LENGTH:
        problem = f"STORE_REVIEWER_PASSWORD must be at least {MIN_PASSWORD_LENGTH} characters"
    elif email in owner_admin_emails(settings):
        problem = "STORE_REVIEWER_EMAIL is an owner/admin address"
    else:
        other_member = await session.scalar(
            select(UserAccount).where(
                func.lower(UserAccount.email) == email,
                UserAccount.deleted_at.is_(None),
                UserAccount.external_subject != REVIEWER_SUBJECT,
            )
        )
        other_credential = await session.scalar(
            select(UserCredential).where(func.lower(UserCredential.email) == email)
        )
        if other_member is not None or (
            other_credential is not None
            and (member is None or other_credential.user_id != member.id)
        ):
            problem = "STORE_REVIEWER_EMAIL already belongs to a real account"
    if problem:
        # Fail closed: a half-configured reviewer account must not stay usable.
        await _remove(session, member)
        logger.error("store reviewer account NOT created: %s", problem)
        return "refused"

    changed = False
    created = member is None
    if member is None:
        member = UserAccount(
            id=uuid4(),
            external_subject=REVIEWER_SUBJECT,
            identity_provider="local",
            email=email,
            display_name=REVIEWER_NAME,
            last_seen_at=datetime.now(UTC),
        )
        session.add(member)
        await session.flush()
    else:
        if member.email != email or member.deleted_at is not None or member.is_admin:
            changed = True
        member.email = email
        member.deleted_at = None
        member.is_admin = False
        member.display_name = REVIEWER_NAME

    credential = await session.scalar(
        select(UserCredential).where(UserCredential.user_id == member.id)
    )
    if credential is None:
        session.add(
            UserCredential(
                id=uuid4(), user_id=member.id, email=email, password_hash=_hash_password(password)
            )
        )
        changed = True
    else:
        if credential.email != email:
            credential.email = email
            changed = True
        if not _verify_password(password, credential.password_hash):
            credential.password_hash = _hash_password(password)
            changed = True
    await session.commit()
    logger.warning(
        "store reviewer account is ON (STORE_REVIEWER_ENABLED): switch it off after review"
    )
    return "created" if created else ("updated" if changed else "unchanged")
