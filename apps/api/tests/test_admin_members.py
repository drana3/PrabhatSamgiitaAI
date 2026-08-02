from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.config import Settings
from app.models import UserAccount
from app.services.admin_members import (
    apply_default_admin,
    is_protected_admin,
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


def settings(*, default: str = "", protected: str = "") -> Settings:
    return Settings(
        DEFAULT_ADMIN_EMAILS=default,
        PROTECTED_ADMIN_EMAILS=protected,
    )


def test_apply_default_admin_promotes_configured_email() -> None:
    member = owner("owner@example.com")
    member.is_admin = False
    apply_default_admin(member, settings(default="owner@example.com"))
    assert member.is_admin is True


def test_protected_admin_falls_back_to_default_list() -> None:
    cfg = settings(default="owner@example.com")
    assert is_protected_admin(owner(), cfg) is True
    assert is_protected_admin(admin("other@example.com"), cfg) is False


def test_protected_admin_uses_explicit_list() -> None:
    cfg = settings(default="owner@example.com,admin@example.com", protected="owner@example.com")
    assert is_protected_admin(owner(), cfg) is True
    assert is_protected_admin(admin(), cfg) is False


@pytest.mark.asyncio
async def test_revoke_admin_blocks_protected_owner() -> None:
    actor = admin()
    target = owner()

    class Session:
        async def get(self, _model, _id):
            return target

    with pytest.raises(HTTPException, match="protected"):
        await revoke_admin(Session(), target.id, actor, settings(protected="owner@example.com"))
