from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest

from app.models import UserAccount, UserChatMessage
from app.schemas.member import ChatMemoryTurn, ChatMemoryWrite
from app.services.members import (
    MemberIdentity,
    _merge_fork_into_canonical,
    member_profile,
    recent_chat_memory,
    store_chat_memory,
    sync_member,
)


def _member(*, subject: str = "aad:oid-website", email: str = "member@example.com") -> UserAccount:
    return UserAccount(
        id=uuid4(),
        external_subject=subject,
        identity_provider="aad",
        email=email,
        display_name="Member",
        last_seen_at=datetime.now(UTC),
        personalization_enabled=True,
        is_admin=False,
        is_super_admin=False,
    )


def _chat_message(
    user_id,
    song_number: int | None,
    role: str,
    content: str,
    *,
    created_at: datetime | None = None,
) -> UserChatMessage:
    now = datetime.now(UTC)
    return UserChatMessage(
        id=uuid4(),
        user_id=user_id,
        song_number=song_number,
        role=role,
        content=content,
        created_at=created_at or now,
        expires_at=now + timedelta(days=30),
    )


class _ChatMemorySession:
    """Minimal async session stub for chat-memory service tests."""

    def __init__(self, messages: list[UserChatMessage] | None = None):
        self.messages = list(messages or [])
        self.committed = 0

    def add(self, obj: object) -> None:
        if isinstance(obj, UserChatMessage):
            if getattr(obj, "id", None) is None:
                obj.id = uuid4()
            if getattr(obj, "created_at", None) is None:
                obj.created_at = datetime.now(UTC)
            self.messages.append(obj)

    async def execute(self, statement) -> _ChatResult:
        sql = str(statement).casefold()
        if "from user_chat_messages" in sql:
            now = datetime.now(UTC)
            rows = [message for message in self.messages if message.expires_at > now]
            if "song_number" in sql:
                rows = [message for message in rows if message.song_number == 12]
            if "order by" in sql and "asc" in sql:
                rows.sort(key=lambda message: message.created_at)
            else:
                rows.sort(key=lambda message: message.created_at, reverse=True)
            return _ChatResult(rows)
        return _ChatResult([])

    async def scalars(self, statement):
        sql = str(statement).casefold()
        if "from user_chat_messages" in sql and "expires_at <=" in sql:
            now = datetime.now(UTC)
            rows = [message for message in self.messages if message.expires_at <= now]
            return _ChatResult(rows)
        return _ChatResult([])

    async def delete(self, obj: object) -> None:
        if isinstance(obj, UserChatMessage) and obj in self.messages:
            self.messages.remove(obj)

    async def commit(self) -> None:
        self.committed += 1

    async def get(self, _model, _pk):
        return None


class _ChatResult:
    def __init__(self, items: list[UserChatMessage]):
        self._items = items

    def scalars(self):
        return self

    def all(self):
        return self._items


class _SyncSession:
    def __init__(self, members: list[UserAccount]):
        self.members = members
        self.added: list[UserAccount] = []
        self.committed = 0

    def add(self, obj: UserAccount) -> None:
        self.added.append(obj)
        self.members.append(obj)

    async def flush(self) -> None:
        for member in self.added:
            if member.id is None:
                member.id = uuid4()

    async def scalar(self, statement):
        sql = str(statement).casefold()
        if "external_subject" in sql:
            for member in self.members:
                if member.external_subject == "aad:website-oid":
                    return member
        return None

    async def scalars(self, _statement):
        return _ScalarResult([])

    async def commit(self) -> None:
        self.committed += 1

    async def refresh(self, _member: UserAccount) -> None:
        return None


class _ScalarResult:
    def __init__(self, items):
        self._items = items

    def all(self):
        return self._items


@pytest.mark.asyncio
async def test_store_and_restore_chat_memory_is_song_scoped() -> None:
    member = _member()
    session = _ChatMemorySession(
        [
            _chat_message(member.id, 12, "user", "Explain PS 12"),
            _chat_message(member.id, 12, "assistant", "PS 12 is devotional."),
            _chat_message(member.id, 99, "user", "Explain PS 99"),
        ]
    )

    await store_chat_memory(
        session,  # type: ignore[arg-type]
        member,
        ChatMemoryWrite(
            song_number=12,
            turns=[
                ChatMemoryTurn(role="user", content="What is the theme?"),
                ChatMemoryTurn(role="assistant", content="Inner peace."),
            ],
        ),
    )

    _, turns, _, _, _ = await recent_chat_memory(session, member, 12)  # type: ignore[arg-type]
    contents = [turn.content for turn in turns]
    assert "Explain PS 12" in contents
    assert "PS 12 is devotional." in contents
    assert "Explain PS 99" not in contents


@pytest.mark.asyncio
async def test_recent_chat_memory_restores_when_personalization_disabled() -> None:
    member = _member()
    member.personalization_enabled = False
    session = _ChatMemorySession(
        [_chat_message(member.id, 12, "user", "Restore me on sign-in")]
    )

    summary, turns, _, _, _ = await recent_chat_memory(session, member, 12)  # type: ignore[arg-type]

    assert summary == ""
    assert [turn.content for turn in turns] == ["Restore me on sign-in"]


@pytest.mark.asyncio
async def test_member_profile_reflects_database_admin_flag() -> None:
    member = _member()
    member.is_admin = True

    class FavoritesSession:
        async def execute(self, _statement):
            class Result:
                def scalars(self):
                    return iter([135, 3])

            return Result()

    profile = await member_profile(FavoritesSession(), member)  # type: ignore[arg-type]
    assert profile.is_admin is True
    assert profile.favorite_song_numbers == [135, 3]


@pytest.mark.asyncio
async def test_merge_fork_moves_chat_memory_to_canonical_account() -> None:
    from unittest.mock import AsyncMock, MagicMock

    canonical = _member(subject="aad:website-oid", email="member@example.com")
    canonical.is_admin = True
    fork = _member(subject="aad:mobile-fork-uuid", email="member@example.com")
    chat = _chat_message(fork.id, 12, "user", "Companion history from mobile")

    session = AsyncMock()
    session.execute = AsyncMock(
        side_effect=[
            MagicMock(scalars=MagicMock(return_value=[])),
            MagicMock(scalars=MagicMock(return_value=[])),
            MagicMock(scalars=MagicMock(return_value=[])),
        ]
    )
    session.scalars = AsyncMock(
        side_effect=[
            MagicMock(all=MagicMock(return_value=[])),
            MagicMock(all=MagicMock(return_value=[])),
            MagicMock(all=MagicMock(return_value=[])),
            MagicMock(all=MagicMock(return_value=[])),
            MagicMock(all=MagicMock(return_value=[chat])),
        ]
    )

    await _merge_fork_into_canonical(session, fork, canonical)
    assert chat.user_id == canonical.id


@pytest.mark.asyncio
async def test_merge_fork_moves_quiz_certification_to_canonical_account() -> None:
    from unittest.mock import AsyncMock, MagicMock

    from app.models import QuizCertification

    canonical = _member(subject="aad:website-oid", email="dewasheesh.rana3@gmail.com")
    fork = _member(subject="google:old-id", email="dewasheesh.rana3@gmail.com")
    cert = QuizCertification(id=uuid4(), user_id=fork.id, level="beginner")

    session = AsyncMock()
    session.execute = AsyncMock(
        side_effect=[
            MagicMock(scalars=MagicMock(return_value=[])),
            MagicMock(scalars=MagicMock(return_value=[])),
            MagicMock(scalars=MagicMock(return_value=[])),
        ]
    )
    session.scalars = AsyncMock(
        side_effect=[
            MagicMock(all=MagicMock(return_value=[])),
            MagicMock(all=MagicMock(return_value=[cert])),
            MagicMock(all=MagicMock(return_value=[])),
            MagicMock(all=MagicMock(return_value=[])),
            MagicMock(all=MagicMock(return_value=[])),
        ]
    )

    await _merge_fork_into_canonical(session, fork, canonical)
    assert cert.user_id == canonical.id


@pytest.mark.asyncio
async def test_sync_member_does_not_promote_unlisted_email() -> None:
    member = _member(subject="aad:website-oid", email="owner@example.com")
    member.is_admin = False
    session = _SyncSession([member])

    result = await sync_member(
        session,  # type: ignore[arg-type]
        MemberIdentity(
            subject="aad:website-oid",
            provider="aad",
            email="owner@example.com",
            display_name="Owner",
            avatar_url=None,
        ),
    )

    assert result.is_admin is False


@pytest.mark.asyncio
async def test_sync_member_preserves_edited_display_name() -> None:
    member = _member(subject="aad:website-oid", email="member@example.com")
    member.display_name = "Custom Name"
    session = _SyncSession([member])

    result = await sync_member(
        session,  # type: ignore[arg-type]
        MemberIdentity(
            subject="aad:website-oid",
            provider="aad",
            email="member@example.com",
            display_name="Google Name",
            avatar_url=None,
        ),
    )

    assert result.display_name == "Custom Name"


@pytest.mark.asyncio
async def test_sync_member_promotes_configured_owner_email(monkeypatch) -> None:
    from app.config import Settings

    monkeypatch.setattr(
        "app.services.admin_members.get_settings",
        lambda: Settings(
            DEFAULT_ADMIN_EMAILS="dewasheesh.rana3@gmail.com",
            PROTECTED_ADMIN_EMAILS="dewasheesh.rana3@gmail.com",
        ),
    )
    member = _member(subject="aad:website-oid", email="dewasheesh.rana3@gmail.com")
    member.is_admin = False
    session = _SyncSession([member])

    result = await sync_member(
        session,  # type: ignore[arg-type]
        MemberIdentity(
            subject="aad:website-oid",
            provider="aad",
            email="dewasheesh.rana3@gmail.com",
            display_name="Dewasheesh",
            avatar_url=None,
        ),
    )

    assert result.is_admin is True
