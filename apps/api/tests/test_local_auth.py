from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.models import UserAccount, UserCredential
from app.schemas.auth import LocalLoginWrite, LocalRegisterWrite
from app.services.local_auth import login_local_user, register_local_user
from app.services.members import decode_client_principal, sync_member, MemberIdentity


class _AuthSession:
    def __init__(self):
        self.accounts: list[UserAccount] = []
        self.credentials: list[UserCredential] = []
        self.committed = 0

    def add(self, obj: object) -> None:
        if isinstance(obj, UserAccount):
            if getattr(obj, "id", None) is None:
                obj.id = uuid4()
            self.accounts.append(obj)
        elif isinstance(obj, UserCredential):
            if getattr(obj, "id", None) is None:
                obj.id = uuid4()
            self.credentials.append(obj)

    async def flush(self) -> None:
        return None

    async def scalar(self, statement):
        sql = str(statement.compile(compile_kwargs={"literal_binds": True})).casefold()
        if "from user_credentials" in sql:
            for credential in self.credentials:
                if credential.email.casefold() in sql:
                    return credential
        return None

    async def scalars(self, statement):
        sql = str(statement.compile(compile_kwargs={"literal_binds": True})).casefold()
        rows: list[object] = []
        if "from user_accounts" in sql:
            for account in self.accounts:
                if account.deleted_at is not None:
                    continue
                if account.email and account.email.casefold() in sql:
                    rows.append(account)
        return _ScalarResult(rows)

    async def get(self, model, pk):
        if model is UserAccount:
            return next((account for account in self.accounts if account.id == pk), None)
        return None

    async def commit(self) -> None:
        self.committed += 1

    async def refresh(self, member: UserAccount) -> None:
        return None


class _ScalarResult:
    def __init__(self, items):
        self._items = items

    def all(self):
        return self._items


@pytest.mark.asyncio
async def test_register_and_login_local_user_returns_member_principal() -> None:
    session = _AuthSession()

    registered = await register_local_user(
        session,  # type: ignore[arg-type]
        LocalRegisterWrite(
            email="member@example.com",
            password="secure-pass-1",
            display_name="Member",
        ),
    )
    identity = decode_client_principal(registered.client_principal)
    assert identity.provider == "local"
    assert identity.email == "member@example.com"

    logged_in = await login_local_user(
        session,  # type: ignore[arg-type]
        LocalLoginWrite(email="member@example.com", password="secure-pass-1"),
    )
    assert logged_in.client_principal == registered.client_principal


@pytest.mark.asyncio
async def test_register_links_password_to_existing_oauth_account() -> None:
    session = _AuthSession()
    oauth_member = UserAccount(
        id=uuid4(),
        external_subject="aad:website-oid",
        identity_provider="aad",
        email="member@example.com",
        display_name="Member",
        last_seen_at=datetime.now(UTC),
    )
    session.accounts.append(oauth_member)

    registered = await register_local_user(
        session,  # type: ignore[arg-type]
        LocalRegisterWrite(
            email="member@example.com",
            password="secure-pass-1",
            display_name="Member",
        ),
    )
    identity = decode_client_principal(registered.client_principal)
    assert identity.subject == "aad:website-oid"
    assert identity.provider == "aad"


@pytest.mark.asyncio
async def test_login_rejects_invalid_password() -> None:
    session = _AuthSession()
    await register_local_user(
        session,  # type: ignore[arg-type]
        LocalRegisterWrite(
            email="member@example.com",
            password="secure-pass-1",
            display_name="Member",
        ),
    )
    with pytest.raises(HTTPException) as error:
        await login_local_user(
            session,  # type: ignore[arg-type]
            LocalLoginWrite(email="member@example.com", password="wrong-password"),
        )
    assert error.value.status_code == 401
