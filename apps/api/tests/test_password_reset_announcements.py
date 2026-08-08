from __future__ import annotations

from datetime import UTC, datetime, timedelta
from unittest.mock import patch
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.models import UserAccount, UserCredential
from app.models.announcements import PasswordResetToken, SiteAnnouncement
from app.services.announcements import create_announcement, list_active_announcements
from app.services.local_auth import _hash_password
from app.services.password_reset import _hash_token, complete_password_reset, request_password_reset


class _ScalarResult:
    def __init__(self, items):
        self._items = items

    def all(self):
        return self._items


class _ExecuteResult:
    def __init__(self, items):
        self._items = items

    def scalars(self):
        return self._items


class _ResetSession:
    def __init__(self, member: UserAccount, credential: UserCredential):
        self.member = member
        self.credential = credential
        self.tokens: list[PasswordResetToken] = []
        self.committed = 0

    def add(self, obj: object) -> None:
        if isinstance(obj, PasswordResetToken):
            self.tokens.append(obj)

    async def scalar(self, statement):
        sql = str(statement.compile(compile_kwargs={"literal_binds": True})).casefold()
        if "from password_reset_tokens" in sql and "count" in sql:
            recent = [
                token
                for token in self.tokens
                if token.user_id == self.member.id and token.used_at is None
            ]
            return len(recent)
        if "from password_reset_tokens" in sql:
            for token in self.tokens:
                if token.token_hash in sql:
                    return token
        if "from user_credentials" in sql:
            return self.credential
        if (
            "from user_accounts" in sql
            and self.member.email
            and self.member.email.casefold() in sql
        ):
            return self.member
        return None

    async def scalars(self, statement):
        sql = str(statement.compile(compile_kwargs={"literal_binds": True})).casefold()
        if "from user_accounts" in sql:
            if self.member.email and self.member.email.casefold() in sql:
                return _ScalarResult([self.member])
            return _ScalarResult([])
        return _ScalarResult([])

    async def commit(self) -> None:
        self.committed += 1


@pytest.mark.asyncio
async def test_request_password_reset_is_silent_for_unknown_email() -> None:
    session = _ResetSession(
        UserAccount(id=uuid4(), email="member@example.com", display_name="Member"),
        UserCredential(user_id=uuid4(), email="member@example.com", password_hash="x"),
    )
    with patch("app.services.password_reset.send_transactional_email", return_value=True) as send:
        await request_password_reset(session, "missing@example.com")  # type: ignore[arg-type]
    send.assert_not_called()
    assert session.committed == 0


@pytest.mark.asyncio
async def test_complete_password_reset_updates_credential() -> None:
    member_id = uuid4()
    raw_token = "reset-token-value-1234567890"
    token = PasswordResetToken(
        user_id=member_id,
        token_hash=_hash_token(raw_token),
        expires_at=datetime.now(UTC) + timedelta(minutes=30),
    )
    session = _ResetSession(
        UserAccount(id=member_id, email="member@example.com", display_name="Member"),
        UserCredential(
            user_id=member_id,
            email="member@example.com",
            password_hash=_hash_password("old-pass"),
        ),
    )
    session.tokens.append(token)

    await complete_password_reset(session, raw_token, "new-password-1")  # type: ignore[arg-type]
    assert session.credential.password_hash != _hash_password("old-pass")
    assert token.used_at is not None


@pytest.mark.asyncio
async def test_complete_password_reset_rejects_expired_token() -> None:
    member_id = uuid4()
    raw_token = "expired-token-value-123456789"
    token = PasswordResetToken(
        user_id=member_id,
        token_hash=_hash_token(raw_token),
        expires_at=datetime.now(UTC) - timedelta(minutes=1),
    )
    session = _ResetSession(
        UserAccount(id=member_id, email="member@example.com", display_name="Member"),
        UserCredential(user_id=member_id, email="member@example.com", password_hash="x"),
    )
    session.tokens.append(token)

    with pytest.raises(HTTPException) as exc:
        await complete_password_reset(session, raw_token, "new-password-1")  # type: ignore[arg-type]
    assert exc.value.status_code == 400


class _AnnouncementSession:
    def __init__(self):
        self.rows: list[SiteAnnouncement] = []
        self.committed = 0

    def add(self, obj: object) -> None:
        if isinstance(obj, SiteAnnouncement):
            if getattr(obj, "id", None) is None:
                obj.id = uuid4()
            self.rows.append(obj)

    async def flush(self) -> None:
        return None

    async def commit(self) -> None:
        self.committed += 1

    async def refresh(self, row: SiteAnnouncement) -> None:
        return None

    async def execute(self, statement):
        sql = str(statement.compile(compile_kwargs={"literal_binds": True})).casefold()
        now = datetime.now(UTC)
        rows = [
            row
            for row in self.rows
            if row.is_active and row.starts_at <= now and row.ends_at >= now
        ]
        if "order by" in sql:
            return _ExecuteResult(rows)
        return _ExecuteResult(self.rows)


@pytest.mark.asyncio
async def test_list_active_announcements_filters_by_window() -> None:
    session = _AnnouncementSession()
    now = datetime.now(UTC)
    session.rows = [
        SiteAnnouncement(
            title="Active",
            body="Now",
            kind="general",
            priority="normal",
            starts_at=now - timedelta(hours=1),
            ends_at=now + timedelta(hours=1),
            is_active=True,
        ),
        SiteAnnouncement(
            title="Expired",
            body="Past",
            kind="general",
            priority="normal",
            starts_at=now - timedelta(days=2),
            ends_at=now - timedelta(days=1),
            is_active=True,
        ),
    ]
    active = await list_active_announcements(session)  # type: ignore[arg-type]
    assert len(active) == 1
    assert active[0].title == "Active"


@pytest.mark.asyncio
async def test_create_announcement_rejects_invalid_window() -> None:
    session = _AnnouncementSession()
    creator = UserAccount(id=uuid4(), email="admin@example.com", display_name="Admin")
    now = datetime.now(UTC)
    with pytest.raises(HTTPException) as exc:
        await create_announcement(
            session,  # type: ignore[arg-type]
            creator=creator,
            title="Test",
            body="Body",
            kind="general",
            priority="normal",
            starts_at=now + timedelta(hours=1),
            ends_at=now,
            notify_by_email=False,
        )
    assert exc.value.status_code == 422
