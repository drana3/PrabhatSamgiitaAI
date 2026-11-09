"""The shared-key weakness (QA-001) and what is left of it. See docs/security-member-auth.md.

The mobile app used to ship MEMBER_PROXY_KEY in its bundle and the API trusted the identity
that came with it. These tests pinned that behaviour. The fix (signed per-member tokens, the
old key reduced to "plain member", the website on its own key) has landed, so they were
rewritten on purpose:

* the shared key still lets a request name a member (migration for old app versions), but the
  request is marked as trust "legacy" and can never be admin or team
  (see tests/test_member_session_auth.py);
* the helpers that promote by owner e-mail or by probe name are unchanged, because they are
  still used for the website and for verified sign-ins; what changed is who can reach them.
"""

import base64
import json
import os
from datetime import UTC, datetime
from uuid import uuid4

import pytest

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://test:test@localhost/test")
os.environ.setdefault("MEMBER_PROXY_KEY", "test-proxy-key")

from app.config import Settings
from app.models import UserAccount
from app.services import members
from app.services.admin_members import apply_default_admin, ensure_ephemeral_smoke_admin
from app.services.members import require_member_identity


class FakeHeaders:
    def __init__(self, values: dict[str, str]) -> None:
        self._values = {key.casefold(): value for key, value in values.items()}

    def get(self, key: str, default: str | None = None) -> str | None:
        return self._values.get(key.casefold(), default)


class FakeRequest:
    def __init__(self, headers: dict[str, str]) -> None:
        self.headers = FakeHeaders(headers)


def forged_principal(*, subject: str, email: str | None = None, name: str = "Anyone") -> str:
    claims = [{"typ": "oid", "val": subject}, {"typ": "name", "val": name}]
    if email:
        claims.append({"typ": "email", "val": email})
    payload = {"auth_typ": "google", "claims": claims}
    return base64.b64encode(json.dumps(payload).encode()).decode()


def account(*, subject: str, email: str | None, name: str) -> UserAccount:
    return UserAccount(
        id=uuid4(),
        external_subject=subject,
        identity_provider="google",
        email=email,
        display_name=name,
        last_seen_at=datetime.now(UTC),
        is_admin=False,
    )


def test_key_plus_self_made_principal_is_accepted_only_as_a_legacy_member(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    settings = Settings(MEMBER_PROXY_KEY="test-proxy-key", WEB_PROXY_KEY="")
    monkeypatch.setattr(members, "get_settings", lambda: settings)
    request = FakeRequest(
        {
            "x-member-proxy-key": "test-proxy-key",
            "x-ms-client-principal": forged_principal(
                subject="victim-123", email="victim@example.com"
            ),
        }
    )

    identity = require_member_identity(request)  # type: ignore[arg-type]

    # Still accepted so old app versions keep working, but with the lowest trust level.
    assert identity.subject == "google:victim-123"
    assert identity.email == "victim@example.com"
    assert identity.trust == "legacy"


def test_owner_email_helper_still_promotes_for_trusted_callers() -> None:
    # Reached only by the website key and by a sign-in the provider verified, never by the
    # shared key.
    settings = Settings(DEFAULT_ADMIN_EMAILS="owner@example.com", PROTECTED_ADMIN_EMAILS="")
    member = account(subject="google:forged", email="owner@example.com", name="Forged")

    assert apply_default_admin(member, settings) is True
    assert member.is_admin is True


def test_probe_name_helper_is_unchanged_but_only_the_website_key_reaches_it() -> None:
    # Used by infra/azure/deploy-app.sh through the website key (WEB_PROXY_KEY).
    member = account(
        subject="aad:deploy-smoke", email="deploy-smoke@prabhat.local", name="deploy-smoke"
    )

    ensure_ephemeral_smoke_admin(member)

    assert member.is_admin is True
