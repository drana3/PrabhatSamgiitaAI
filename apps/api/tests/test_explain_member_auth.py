import base64
import json
import os

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://test:test@localhost/test")
os.environ.setdefault("MEMBER_PROXY_KEY", "test-proxy-key")

from app.services.members import try_member_identity


def encoded_principal(*, provider: str, subject: str) -> str:
    payload = {
        "auth_typ": provider,
        "claims": [
            {"typ": "oid", "val": subject},
            {"typ": "name", "val": "Member"},
        ],
    }
    return base64.b64encode(json.dumps(payload).encode()).decode()


class FakeHeaders:
    def __init__(self, values: dict[str, str]) -> None:
        self._values = {key.casefold(): value for key, value in values.items()}

    def get(self, key: str, default: str | None = None) -> str | None:
        return self._values.get(key.casefold(), default)


class FakeRequest:
    def __init__(self, headers: dict[str, str]) -> None:
        self.headers = FakeHeaders(headers)


def test_try_member_identity_accepts_apple_principal_with_proxy_key() -> None:
    principal = encoded_principal(provider="apple", subject="apple-user-1")
    request = FakeRequest(
        {
            "x-ms-client-principal": principal,
            "x-member-proxy-key": "test-proxy-key",
        }
    )

    identity = try_member_identity(request)  # type: ignore[arg-type]

    assert identity is not None
    assert identity.subject == "apple:apple-user-1"
    assert identity.provider == "apple"


def test_try_member_identity_rejects_missing_proxy_key() -> None:
    principal = encoded_principal(provider="aad", subject="user-1")
    request = FakeRequest({"x-ms-client-principal": principal})

    assert try_member_identity(request) is None  # type: ignore[arg-type]
