from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest

from app.models import UserAccount, UserChatMessage, UserInterestProfile
from app.services.members import (
    _archive_expired_messages,
    _group_messages_by_day,
    recent_chat_memory,
)


def _member() -> UserAccount:
    return UserAccount(
        id=uuid4(),
        external_subject="local:test-user",
        identity_provider="local",
        display_name="Test Member",
        email="member@example.com",
        last_seen_at=datetime.now(UTC),
        personalization_enabled=True,
        is_admin=False,
    )


def _message(
    user_id,
    *,
    role: str,
    content: str,
    created_at: datetime,
    expires_at: datetime,
    song_number: int | None = 12,
) -> UserChatMessage:
    return UserChatMessage(
        id=uuid4(),
        user_id=user_id,
        song_number=song_number,
        role=role,
        content=content,
        created_at=created_at,
        expires_at=expires_at,
    )


class _ArchiveSession:
    def __init__(self, expired: list[UserChatMessage], profile: UserInterestProfile | None):
        self.expired = expired
        self.profile = profile
        self.deleted: list[UserChatMessage] = []

    async def scalars(self, _statement):
        class Result:
            def __init__(self, rows):
                self._rows = rows

            def all(self):
                return self._rows

        return Result(self.expired)

    async def get(self, _model, _user_id):
        return self.profile

    def add(self, profile):
        self.profile = profile

    async def delete(self, message):
        self.deleted.append(message)


class _RecentMemorySession:
    def __init__(self, messages: list[UserChatMessage], profile: UserInterestProfile | None):
        self.messages = messages
        self.profile = profile
        self.committed = False

    async def scalars(self, _statement):
        return _RecentResult([])

    async def get(self, _model, _user_id):
        return self.profile

    async def execute(self, statement):
        return _RecentResult(self.messages)

    async def commit(self):
        self.committed = True


class _RecentResult:
    def __init__(self, rows: list[UserChatMessage]):
        self._rows = rows

    def scalars(self):
        return self

    def all(self):
        return self._rows


def test_group_messages_by_day_orders_newest_first() -> None:
    now = datetime(2026, 8, 8, tzinfo=UTC)
    messages = [
        _message(uuid4(), role="user", content="Day one", created_at=now, expires_at=now),
        _message(
            uuid4(),
            role="assistant",
            content="Reply one",
            created_at=now + timedelta(minutes=1),
            expires_at=now,
        ),
        _message(
            uuid4(),
            role="user",
            content="Day two",
            created_at=now + timedelta(days=1),
            expires_at=now,
        ),
    ]

    grouped = _group_messages_by_day(messages)

    assert [day.date for day in grouped] == ["2026-08-09", "2026-08-08"]
    assert grouped[0].turns[0].content == "Day two"


@pytest.mark.asyncio
async def test_archive_expired_messages_rolls_into_monthly_summary() -> None:
    member = _member()
    now = datetime(2026, 8, 8, tzinfo=UTC)
    expired = [
        _message(
            member.id,
            role="user",
            content="What is PS 12 about?",
            created_at=datetime(2026, 6, 15, tzinfo=UTC),
            expires_at=now - timedelta(days=1),
            song_number=None,
        )
    ]
    session = _ArchiveSession(expired, None)

    await _archive_expired_messages(session, member, now)

    assert session.profile is not None
    assert session.profile.monthly_summaries["2026-06"] == "What is PS 12 about?"
    assert session.deleted == expired


@pytest.mark.asyncio
async def test_recent_chat_memory_returns_history_days_and_archived_summary() -> None:
    member = _member()
    now = datetime(2026, 8, 8, 12, tzinfo=UTC)
    messages = [
        _message(
            member.id,
            role="user",
            content="Explain PS 12",
            created_at=now - timedelta(days=1),
            expires_at=now + timedelta(days=20),
            song_number=None,
        ),
        _message(
            member.id,
            role="assistant",
            content="PS 12 is devotional.",
            created_at=now - timedelta(days=1, minutes=-1),
            expires_at=now + timedelta(days=20),
            song_number=None,
        ),
    ]
    profile = UserInterestProfile(
        user_id=member.id,
        summary_text="Interested in meaning and practice.",
        monthly_summaries={"2026-06": "Asked about meditation songs."},
    )
    session = _RecentMemorySession(messages, profile)

    summary, turns, history_days, archived_summary, monthly = await recent_chat_memory(
        session,  # type: ignore[arg-type]
        member,
        None,
    )

    assert summary == "Interested in meaning and practice."
    assert [turn.content for turn in turns] == ["Explain PS 12", "PS 12 is devotional."]
    assert history_days[0].date == "2026-08-07"
    assert "2026-06: Asked about meditation songs." in archived_summary
    assert monthly["2026-06"] == "Asked about meditation songs."


@pytest.mark.asyncio
async def test_song_scoped_chat_memory_skips_companion_history_features() -> None:
    member = _member()
    now = datetime(2026, 8, 8, 12, tzinfo=UTC)
    messages = [
        _message(
            member.id,
            role="user",
            content="Song page question",
            created_at=now - timedelta(hours=1),
            expires_at=now + timedelta(days=20),
            song_number=12,
        ),
    ]
    profile = UserInterestProfile(
        user_id=member.id,
        summary_text="Interested in meaning.",
        monthly_summaries={"2026-06": "Companion archive only."},
    )
    session = _RecentMemorySession(messages, profile)

    summary, turns, history_days, archived_summary, monthly = await recent_chat_memory(
        session,  # type: ignore[arg-type]
        member,
        12,
    )

    assert summary == "Interested in meaning."
    assert [turn.content for turn in turns] == ["Song page question"]
    assert history_days == []
    assert archived_summary == ""
    assert monthly == {}
