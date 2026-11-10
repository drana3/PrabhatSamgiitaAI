"""The store reviewer account (docs/store-review-account.md): off by default, configured only from
the environment, never admin, never takes over a real account, and gone again when switched off."""

from __future__ import annotations

from collections.abc import AsyncIterator
from uuid import uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.config import Settings
from app.models import Base, UserAccount, UserCredential
from app.schemas.auth import LocalLoginWrite, LocalRegisterWrite
from app.services.local_auth import login_local_user, register_local_user
from app.services.store_reviewer import REVIEWER_SUBJECT, sync_store_reviewer

EMAIL = "app-review@example.org"
PASSWORD = "correct horse battery"  # noqa: S105  (a test value)


def make(**values: object) -> Settings:
    base: dict[str, object] = {
        "STORE_REVIEWER_ENABLED": "true",
        "STORE_REVIEWER_EMAIL": EMAIL,
        "STORE_REVIEWER_PASSWORD": PASSWORD,
    }
    base.update(values)
    return Settings(_env_file=None, **base)  # type: ignore[arg-type]


@pytest.fixture
async def session() -> AsyncIterator[AsyncSession]:
    engine = create_async_engine(
        "sqlite+aiosqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False}
    )
    async with engine.begin() as connection:
        await connection.run_sync(
            lambda sync: Base.metadata.create_all(
                sync, tables=[UserAccount.__table__, UserCredential.__table__]
            )
        )
    async with async_sessionmaker(engine, expire_on_commit=False)() as db:
        yield db
    await engine.dispose()


async def can_sign_in(db: AsyncSession, password: str = PASSWORD, email: str = EMAIL) -> bool:
    try:
        await login_local_user(db, LocalLoginWrite(email=email, password=password))
    except HTTPException as exc:
        assert exc.status_code == 401
        return False
    return True


async def reviewer_rows(db: AsyncSession) -> list[UserAccount]:
    rows = await db.scalars(
        select(UserAccount).where(UserAccount.external_subject == REVIEWER_SUBJECT)
    )
    return list(rows)


async def test_off_by_default_creates_nothing(session: AsyncSession) -> None:
    settings = Settings(_env_file=None)
    assert settings.store_reviewer_enabled is False
    assert await sync_store_reviewer(session, settings) == "off"
    assert await reviewer_rows(session) == []


async def test_enabled_creates_an_ordinary_member_who_can_sign_in(session: AsyncSession) -> None:
    assert await sync_store_reviewer(session, make()) == "created"
    [member] = await reviewer_rows(session)
    assert member.email == EMAIL
    assert member.is_admin is False
    assert await can_sign_in(session)
    assert not await can_sign_in(session, password="wrong password here")
    # the stored password is a hash, never the password
    credential = await session.scalar(select(UserCredential))
    assert credential is not None and PASSWORD not in credential.password_hash


async def test_running_again_changes_nothing(session: AsyncSession) -> None:
    await sync_store_reviewer(session, make())
    assert await sync_store_reviewer(session, make()) == "unchanged"
    assert len(await reviewer_rows(session)) == 1


async def test_switching_off_removes_the_account_and_the_password(session: AsyncSession) -> None:
    await sync_store_reviewer(session, make())
    assert await sync_store_reviewer(session, make(STORE_REVIEWER_ENABLED="false")) == "removed"
    assert not await can_sign_in(session)
    assert (await session.scalars(select(UserCredential))).all() == []
    assert await sync_store_reviewer(session, make(STORE_REVIEWER_ENABLED="false")) == "off"


async def test_switching_on_again_restores_a_deleted_account_and_resets_the_password(
    session: AsyncSession,
) -> None:
    await sync_store_reviewer(session, make())
    await sync_store_reviewer(session, make(STORE_REVIEWER_ENABLED="false"))
    assert (
        await sync_store_reviewer(session, make(STORE_REVIEWER_PASSWORD="a brand new passphrase"))
        == "updated"
    )
    assert await can_sign_in(session, password="a brand new passphrase")
    assert not await can_sign_in(session)
    assert len(await reviewer_rows(session)) == 1


async def test_a_password_change_in_the_environment_takes_effect(session: AsyncSession) -> None:
    await sync_store_reviewer(session, make())
    assert (
        await sync_store_reviewer(session, make(STORE_REVIEWER_PASSWORD="rotated passphrase 2"))
        == "updated"
    )
    assert await can_sign_in(session, password="rotated passphrase 2")
    assert not await can_sign_in(session)


async def test_the_reviewer_can_never_be_an_admin(session: AsyncSession) -> None:
    await sync_store_reviewer(session, make())
    [member] = await reviewer_rows(session)
    member.is_admin = True
    await session.commit()
    await sync_store_reviewer(session, make())
    await session.refresh(member)
    assert member.is_admin is False


@pytest.mark.parametrize(
    "overrides",
    [
        {"STORE_REVIEWER_PASSWORD": "short"},
        {"STORE_REVIEWER_PASSWORD": None},
        {"STORE_REVIEWER_EMAIL": None},
        {"STORE_REVIEWER_EMAIL": "not-an-address"},
        {"DEFAULT_ADMIN_EMAILS": EMAIL},
        {"PROTECTED_ADMIN_EMAILS": EMAIL},
    ],
)
async def test_a_bad_configuration_creates_nothing(
    session: AsyncSession, overrides: dict[str, object]
) -> None:
    cleaned = {k: v for k, v in overrides.items() if v is not None}
    base = {
        "STORE_REVIEWER_ENABLED": "true",
        "STORE_REVIEWER_EMAIL": EMAIL,
        "STORE_REVIEWER_PASSWORD": PASSWORD,
    }
    for key, value in overrides.items():
        if value is None:
            base.pop(key)
    settings = Settings(_env_file=None, **{**base, **cleaned})  # type: ignore[arg-type]
    assert await sync_store_reviewer(session, settings) == "refused"
    assert await reviewer_rows(session) == []
    assert not await can_sign_in(session)


async def test_a_configuration_that_turns_bad_removes_a_working_account(
    session: AsyncSession,
) -> None:
    await sync_store_reviewer(session, make())
    assert await can_sign_in(session)
    assert await sync_store_reviewer(session, make(STORE_REVIEWER_PASSWORD="short")) == "refused"
    assert not await can_sign_in(session)


async def test_it_never_takes_over_a_real_members_email(session: AsyncSession) -> None:
    await register_local_user(
        session,
        LocalRegisterWrite(email=EMAIL, password="the real members password", display_name="Real"),
    )
    assert await sync_store_reviewer(session, make()) == "refused"
    assert await reviewer_rows(session) == []
    # the real member still signs in with their own password; the reviewer password does not work
    assert await can_sign_in(session, password="the real members password")
    assert not await can_sign_in(session)
    real = await session.scalar(select(UserAccount).where(UserAccount.email == EMAIL))
    assert real is not None and real.deleted_at is None and real.display_name == "Real"


async def test_other_members_are_untouched_by_switching_off(session: AsyncSession) -> None:
    other = uuid4()
    await register_local_user(
        session,
        LocalRegisterWrite(
            email="someone@example.org", password="someone's passphrase", display_name="S"
        ),
    )
    await sync_store_reviewer(session, make())
    await sync_store_reviewer(session, make(STORE_REVIEWER_ENABLED="false"))
    assert await can_sign_in(session, password="someone's passphrase", email="someone@example.org")
    assert other  # keep the linter quiet about the unused helper id
