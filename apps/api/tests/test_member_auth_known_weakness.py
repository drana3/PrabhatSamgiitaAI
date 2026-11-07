"""Pins today's member-auth behaviour so the weakness is visible and cannot change silently.

The mobile app ships the shared MEMBER_PROXY_KEY inside its bundle, and the API trusts the identity
(X-MS-CLIENT-PRINCIPAL) that arrives with that key. Anyone who extracts the key can claim any member.
See docs/security-member-auth.md for the attack, the proposed fix and what needs the owner's decision.

These tests describe the CURRENT behaviour. When the fix lands (server-issued signed session tokens),
they must be rewritten on purpose, not deleted by accident.
"""

import base64
import json
import os
from datetime import UTC, datetime
from uuid import uuid4

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://test:test@localhost/test")
os.environ.setdefault("MEMBER_PROXY_KEY", "test-proxy-key")

from app.config import Settings
from app.models import UserAccount
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


def test_key_plus_self_made_principal_is_accepted_as_any_member() -> None:
    request = FakeRequest(
        {
            "x-member-proxy-key": "test-proxy-key",
            "x-ms-client-principal": forged_principal(subject="victim-123", email="victim@example.com"),
        }
    )

    identity = require_member_identity(request)  # type: ignore[arg-type]

    # Nothing proves the caller owns this account: only the shared key was checked.
    assert identity.subject == "google:victim-123"
    assert identity.email == "victim@example.com"


def test_forged_owner_email_is_promoted_to_admin() -> None:
    settings = Settings(DEFAULT_ADMIN_EMAILS="owner@example.com", PROTECTED_ADMIN_EMAILS="")
    member = account(subject="google:forged", email="owner@example.com", name="Forged")

    assert apply_default_admin(member, settings) is True
    assert member.is_admin is True


def test_probe_name_in_a_self_made_principal_makes_an_admin() -> None:
    # Used by infra/azure/deploy-app.sh. It is also a way in for anyone holding the key.
    member = account(subject="aad:deploy-smoke", email="deploy-smoke@prabhat.local", name="deploy-smoke")

    ensure_ephemeral_smoke_admin(member)

    assert member.is_admin is True
