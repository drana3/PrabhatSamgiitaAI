from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.config import Settings
from app.models import UserAccount
from app.services.admin_members import (
    ensure_ephemeral_smoke_admin,
    is_ephemeral_member,
    is_protected_admin,
    require_admin_member,
    revoke_admin,
)


def owner(email: str = "owner@example.com") -> UserAccount:
    return UserAccount(
        id=uuid4(),
        external_subject="google:owner",
        identity_provider="google",
        email=email,
        display_name="Owner",
        last_seen_at=datetime.now(UTC),
        is_admin=True,
    )


def admin(email: str = "admin@example.com") -> UserAccount:
    return UserAccount(
        id=uuid4(),
        external_subject="google:admin",
        identity_provider="google",
        email=email,
        display_name="Admin",
        last_seen_at=datetime.now(UTC),
        is_admin=True,
    )


def settings(*, protected: str = "") -> Settings:
    return Settings(
        DEFAULT_ADMIN_EMAILS="",
        PROTECTED_ADMIN_EMAILS=protected,
    )


def test_ephemeral_smoke_admin_is_granted_for_deploy_probes() -> None:
    probe = UserAccount(
        id=uuid4(),
        external_subject="aad:deploy-smoke",
        identity_provider="aad",
        email="deploy-smoke@prabhat.local",
        display_name="Deploy Smoke",
        last_seen_at=datetime.now(UTC),
        is_admin=False,
    )
    ensure_ephemeral_smoke_admin(probe)
    assert probe.is_admin is True


def test_ephemeral_smoke_admin_does_not_promote_real_members() -> None:
    member = owner("owner@example.com")
    member.is_admin = False
    ensure_ephemeral_smoke_admin(member)
    assert member.is_admin is False


def test_ephemeral_probe_accounts_are_not_protected() -> None:
    probe = UserAccount(
        id=uuid4(),
        external_subject="aad:deploy-smoke",
        identity_provider="aad",
        email="owner@example.com",
        display_name="Deploy Smoke",
        last_seen_at=datetime.now(UTC),
        is_admin=True,
    )
    cfg = settings(protected="owner@example.com")
    assert is_ephemeral_member(probe) is True
    assert is_protected_admin(probe, cfg) is False


def test_protected_admin_requires_explicit_list() -> None:
    cfg = settings(protected="owner@example.com")
    assert is_protected_admin(owner(), cfg) is True
    assert is_protected_admin(admin("other@example.com"), cfg) is False


def test_protected_admin_uses_explicit_list() -> None:
    cfg = settings(protected="owner@example.com")
    assert is_protected_admin(owner(), cfg) is True
    assert is_protected_admin(admin(), cfg) is False


@pytest.mark.asyncio
async def test_require_admin_member_rejects_non_admin() -> None:
    member = owner("owner@example.com")
    member.is_admin = False

    class Session:
        async def commit(self):
            raise AssertionError("commit should not run")

        async def refresh(self, value):
            raise AssertionError("refresh should not run")

    with pytest.raises(HTTPException, match="Admin access is required"):
        await require_admin_member(Session(), member)  # type: ignore[arg-type]


@pytest.mark.asyncio
async def test_revoke_admin_blocks_protected_owner() -> None:
    actor = admin()
    target = owner()

    class Session:
        async def get(self, _model, _id):
            return target

    with pytest.raises(HTTPException, match="protected"):
        await revoke_admin(Session(), target.id, actor, settings(protected="owner@example.com"))
