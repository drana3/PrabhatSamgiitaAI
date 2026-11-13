"""Sign in with Apple: revoke the Apple grant when the member deletes the account (rule 5.1.1(v)).

No network: Apple's two endpoints are replaced by `apple_revoke._post_form`, the private key is
generated here. Pinned:

* the client secret is an ES256 JWT with the claims Apple asks for, built from env-style values
  (the key may carry literal backslash-n escapes);
* sign-in with an authorization code stores the refresh token (and only if the code is the same
  Apple user's); without the code nothing is called;
* deleting an Apple member calls Apple's revoke endpoint with client_id, client_secret and token;
* every Apple failure (no key, no stored token, error answer, exception) leaves the deletion
  a 204, and no log line carries the key, the secret or the token.
"""

from __future__ import annotations

import json
import time
from collections.abc import AsyncIterator
from datetime import UTC, datetime
from typing import Any, cast
from uuid import UUID

import httpx
import jwt
import pytest
import pytest_asyncio
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec, rsa
from jwt.algorithms import RSAAlgorithm
from sqlalchemy import Table, event, func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.models import AppleRefreshToken, Base, UserAccount
from app.models.member_session import MemberSession
from app.services import apple_revoke, provider_tokens
from tests.member_session_support import World, build_app, make_settings, use_settings
from tests.test_account_deletion import TABLES as DELETION_TABLES

EXCHANGE = "/api/v1/members/session/exchange"
DELETE_ME = "/api/v1/members/me"
APPLE_USER = UUID("00000000-0000-0000-0000-0000000a9901")
GOOGLE_USER = UUID("00000000-0000-0000-0000-0000000a9902")
BUNDLE = "net.prabhatasamgiita.ai"
TEAM = "TEAM123456"
KEY_ID = "KEYID12345"
REFRESH = "r.apple-refresh-token-for-tests"
CODE = "c.one-time-authorization-code"

_EC = ec.generate_private_key(ec.SECP256R1())
PEM = _EC.private_bytes(
    serialization.Encoding.PEM,
    serialization.PrivateFormat.PKCS8,
    serialization.NoEncryption(),
).decode()
PEM_ESCAPED = PEM.strip().replace("\n", "\\n")  # how a one-line environment value looks
_RSA = rsa.generate_private_key(public_exponent=65537, key_size=2048)
KID = "apple-test-key"


def apple_settings(**overrides: Any) -> Any:
    values: dict[str, Any] = {
        "APPLE_BUNDLE_IDS": f"{BUNDLE},net.example.second",
        "APPLE_TEAM_ID": TEAM,
        "APPLE_KEY_ID": KEY_ID,
        "APPLE_PRIVATE_KEY": PEM_ESCAPED,
    }
    values.update(overrides)
    return make_settings(**values)


class FakeApple:
    """Records every call made to Apple and answers from a script."""

    def __init__(self) -> None:
        self.calls: list[tuple[str, dict[str, str]]] = []
        self.token_answer: tuple[int, dict[str, Any] | None] = (200, {})
        self.revoke_answer: tuple[int, dict[str, Any] | None] = (200, None)
        self.raise_on: set[str] = set()

    async def post(self, url: str, data: dict[str, str]) -> tuple[int, dict[str, Any] | None]:
        self.calls.append((url, dict(data)))
        if url in self.raise_on:
            raise httpx.ConnectError("boom")
        return self.token_answer if url == apple_revoke.APPLE_TOKEN_URL else self.revoke_answer

    def to(self, url: str) -> list[dict[str, str]]:
        return [data for called, data in self.calls if called == url]


@pytest.fixture
def apple(monkeypatch: pytest.MonkeyPatch) -> FakeApple:
    fake = FakeApple()
    monkeypatch.setattr(apple_revoke, "_post_form", fake.post)
    return fake


def apple_id_token(sub: str) -> str:
    now = int(time.time())
    return jwt.encode(
        {
            "iss": "https://appleid.apple.com",
            "aud": BUNDLE,
            "sub": sub,
            "iat": now,
            "exp": now + 600,
            "email": "relay@privaterelay.appleid.com",
            "email_verified": "true",
        },
        _RSA,
        algorithm="RS256",
        headers={"kid": KID},
    )


def apple_answer(sub: str, refresh: str = REFRESH) -> tuple[int, dict[str, Any]]:
    """What Apple's token endpoint says: a refresh token and an id_token for the same user."""
    return 200, {"refresh_token": refresh, "id_token": apple_id_token(sub), "access_token": "a"}


@pytest.fixture(autouse=True)
def apple_keys() -> AsyncIterator[None]:
    public = json.loads(RSAAlgorithm.to_jwk(_RSA.public_key()))
    public.update({"kid": KID, "alg": "RS256", "use": "sig"})

    async def fetch(url: str) -> dict[str, Any]:
        return {"keys": [public]}

    provider_tokens.jwks_cache.set_fetcher(fetch)
    yield
    provider_tokens.jwks_cache.set_fetcher(None)


@pytest_asyncio.fixture(name="world")
async def world_fixture(monkeypatch: pytest.MonkeyPatch) -> AsyncIterator[World]:
    settings = apple_settings()
    use_settings(monkeypatch, settings)
    monkeypatch.setattr(apple_revoke, "get_settings", lambda: settings)
    engine = create_async_engine(
        "sqlite+aiosqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False}
    )

    @event.listens_for(engine.sync_engine, "connect")
    def _foreign_keys_on(dbapi_connection: Any, _record: Any) -> None:
        dbapi_connection.execute("PRAGMA foreign_keys=ON")

    tables = [cast(Table, m.__table__) for m in (*DELETION_TABLES, AppleRefreshToken)]
    async with engine.begin() as conn:
        await conn.run_sync(lambda c: Base.metadata.create_all(c, tables=tables))
    sessions = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with sessions() as session:
        session.add(
            UserAccount(
                id=APPLE_USER,
                external_subject="apple:apple-sub-1",
                identity_provider="apple",
                display_name="Apple Member",
                email="relay@privaterelay.appleid.com",
                last_seen_at=datetime.now(UTC),
            )
        )
        session.add(
            UserAccount(
                id=GOOGLE_USER,
                external_subject="google:g-sub-9",
                identity_provider="google",
                display_name="Google Member",
                email="g9@example.net",
                last_seen_at=datetime.now(UTC),
            )
        )
        await session.commit()
    app = build_app(sessions)
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://t"
    ) as client:
        yield World(client, sessions)
    await engine.dispose()


async def sign_in_as(world: World, account_id: UUID) -> dict[str, str]:
    pair = await world.tokens_for(account_id)
    return world.bearer(pair)


async def store_token(world: World, account_id: UUID, token: str = REFRESH) -> None:
    async with world.sessions() as session:
        session.add(AppleRefreshToken(user_id=account_id, refresh_token=token))
        await session.commit()


async def count(world: World, model: Any, *where: Any) -> int:
    async with world.sessions() as session:
        return int(await session.scalar(select(func.count()).select_from(model).where(*where)))


# ---- the client secret ----------------------------------------------------------------------


def test_client_secret_is_an_es256_jwt_with_the_claims_apple_asks_for() -> None:
    settings = apple_settings()
    assert apple_revoke.apple_revocation_configured(settings)

    secret = apple_revoke.build_client_secret(settings, now=1_700_000_000)

    header = jwt.get_unverified_header(secret)
    assert header["alg"] == "ES256" and header["kid"] == KEY_ID
    claims = jwt.decode(
        secret,
        _EC.public_key(),
        algorithms=["ES256"],
        audience="https://appleid.apple.com",
        options={"verify_exp": False, "verify_iat": False},
    )
    assert claims["iss"] == TEAM
    assert claims["sub"] == BUNDLE  # the FIRST entry of APPLE_BUNDLE_IDS
    assert claims["iat"] == 1_700_000_000
    assert 0 < claims["exp"] - claims["iat"] <= 15_777_000  # Apple's limit is six months


def test_a_key_with_real_newlines_works_too() -> None:
    settings = apple_settings(APPLE_PRIVATE_KEY=PEM)
    secret = apple_revoke.build_client_secret(settings)
    jwt.decode(secret, _EC.public_key(), algorithms=["ES256"], audience="https://appleid.apple.com")


@pytest.mark.parametrize(
    "missing", ["APPLE_TEAM_ID", "APPLE_KEY_ID", "APPLE_PRIVATE_KEY", "APPLE_BUNDLE_IDS"]
)
def test_any_missing_piece_means_not_configured(missing: str) -> None:
    assert apple_revoke.apple_revocation_configured(apple_settings(**{missing: ""})) is False


def test_the_private_key_is_not_in_the_settings_repr() -> None:
    assert "BEGIN PRIVATE KEY" not in repr(apple_settings())
    assert PEM_ESCAPED not in repr(apple_settings())


# ---- the revoke call ------------------------------------------------------------------------


async def test_revoke_posts_client_id_secret_and_token(apple: FakeApple) -> None:
    ok = await apple_revoke.revoke_refresh_token(REFRESH, apple_settings())

    assert ok is True
    [data] = apple.to(apple_revoke.APPLE_REVOKE_URL)
    assert apple_revoke.APPLE_REVOKE_URL == "https://appleid.apple.com/auth/revoke"
    assert data["client_id"] == BUNDLE
    assert data["token"] == REFRESH
    assert data["token_type_hint"] == "refresh_token"
    jwt.decode(
        data["client_secret"],
        _EC.public_key(),
        algorithms=["ES256"],
        audience="https://appleid.apple.com",
    )


async def test_revoke_without_a_key_calls_nothing(apple: FakeApple) -> None:
    ok = await apple_revoke.revoke_refresh_token(REFRESH, apple_settings(APPLE_PRIVATE_KEY=""))

    assert ok is False and apple.calls == []


async def test_revoke_swallows_an_error_answer_and_an_exception(
    apple: FakeApple, caplog: pytest.LogCaptureFixture
) -> None:
    apple.revoke_answer = (400, {"error": "invalid_grant"})
    assert await apple_revoke.revoke_refresh_token(REFRESH, apple_settings()) is False
    apple.raise_on = {apple_revoke.APPLE_REVOKE_URL}
    assert await apple_revoke.revoke_refresh_token(REFRESH, apple_settings()) is False
    assert REFRESH not in caplog.text and "BEGIN PRIVATE KEY" not in caplog.text


async def test_revoke_with_an_unreadable_key_is_swallowed(apple: FakeApple) -> None:
    settings = apple_settings(APPLE_PRIVATE_KEY="not a key at all")

    assert await apple_revoke.revoke_refresh_token(REFRESH, settings) is False
    assert apple.calls == []


# ---- sign-in: trading the authorization code --------------------------------------------------


async def apple_sign_in(world: World, *, sub: str = "apple-sub-1", code: str | None = CODE) -> Any:
    body: dict[str, Any] = {
        "provider": "apple",
        "id_token": apple_id_token(sub),
        "device_label": "iPhone",
    }
    if code is not None:
        body["authorization_code"] = code
    return await world.client.post(EXCHANGE, json=body)


async def test_sign_in_with_the_code_stores_the_refresh_token(
    world: World, apple: FakeApple
) -> None:
    apple.token_answer = apple_answer("apple-sub-1")

    response = await apple_sign_in(world)

    assert response.status_code == 200, response.text
    [data] = apple.to(apple_revoke.APPLE_TOKEN_URL)
    assert data["grant_type"] == "authorization_code" and data["code"] == CODE
    assert data["client_id"] == BUNDLE
    async with world.sessions() as session:
        row = await session.get(AppleRefreshToken, APPLE_USER)
        assert row is not None and row.refresh_token == REFRESH
    assert REFRESH not in response.text  # the phone never gets Apple's token back


async def test_a_second_sign_in_replaces_the_stored_token(world: World, apple: FakeApple) -> None:
    await store_token(world, APPLE_USER, "r.old")
    apple.token_answer = apple_answer("apple-sub-1", "r.new")

    await apple_sign_in(world)

    async with world.sessions() as session:
        row = await session.get(AppleRefreshToken, APPLE_USER)
        assert row is not None and row.refresh_token == "r.new"
    assert await count(world, AppleRefreshToken) == 1


async def test_sign_in_without_the_code_calls_apple_not_at_all(
    world: World, apple: FakeApple
) -> None:
    response = await apple_sign_in(world, code=None)

    assert response.status_code == 200
    assert apple.calls == []
    assert await count(world, AppleRefreshToken) == 0


async def test_a_code_that_belongs_to_another_apple_user_is_not_stored(
    world: World, apple: FakeApple
) -> None:
    apple.token_answer = apple_answer("someone-else")

    response = await apple_sign_in(world)

    assert response.status_code == 200
    assert await count(world, AppleRefreshToken) == 0


async def test_apple_failing_at_sign_in_never_fails_the_sign_in(
    world: World, apple: FakeApple
) -> None:
    apple.raise_on = {apple_revoke.APPLE_TOKEN_URL}

    response = await apple_sign_in(world)

    assert response.status_code == 200 and response.json()["access_token"]
    assert await count(world, AppleRefreshToken) == 0


async def test_the_code_is_ignored_for_other_providers(world: World, apple: FakeApple) -> None:
    now = int(time.time())
    google = jwt.encode(
        {
            "iss": "https://accounts.google.com",
            "aud": make_settings().google_oauth_client_ids,
            "sub": "g-sub-9",
            "iat": now,
            "exp": now + 600,
            "email": "g9@example.net",
            "email_verified": True,
        },
        _RSA,
        algorithm="RS256",
        headers={"kid": KID},
    )
    response = await world.client.post(
        EXCHANGE, json={"provider": "google", "id_token": google, "authorization_code": CODE}
    )

    assert response.status_code == 200 and apple.calls == []


# ---- account deletion -------------------------------------------------------------------------


async def test_deleting_an_apple_member_revokes_the_stored_token(
    world: World, apple: FakeApple
) -> None:
    await store_token(world, APPLE_USER)
    headers = await sign_in_as(world, APPLE_USER)

    response = await world.client.delete(DELETE_ME, headers=headers)

    assert response.status_code == 204
    [data] = apple.to(apple_revoke.APPLE_REVOKE_URL)
    assert data["token"] == REFRESH and data["client_id"] == BUNDLE
    assert await count(world, UserAccount, UserAccount.id == APPLE_USER) == 0
    assert await count(world, AppleRefreshToken) == 0  # the token row went with the account
    assert await count(world, MemberSession, MemberSession.user_id == APPLE_USER) == 0


async def test_an_apple_failure_never_stops_the_deletion(
    world: World, apple: FakeApple, caplog: pytest.LogCaptureFixture
) -> None:
    await store_token(world, APPLE_USER)
    apple.raise_on = {apple_revoke.APPLE_REVOKE_URL}
    headers = await sign_in_as(world, APPLE_USER)

    response = await world.client.delete(DELETE_ME, headers=headers)

    assert response.status_code == 204
    assert await count(world, UserAccount, UserAccount.id == APPLE_USER) == 0
    assert REFRESH not in caplog.text and "BEGIN PRIVATE KEY" not in caplog.text


async def test_an_error_answer_from_apple_never_stops_the_deletion(
    world: World, apple: FakeApple
) -> None:
    await store_token(world, APPLE_USER)
    apple.revoke_answer = (400, {"error": "invalid_client"})
    headers = await sign_in_as(world, APPLE_USER)

    response = await world.client.delete(DELETE_ME, headers=headers)

    assert response.status_code == 204
    assert await count(world, UserAccount, UserAccount.id == APPLE_USER) == 0


async def test_an_apple_member_without_a_stored_token_is_deleted_and_logged(
    world: World, apple: FakeApple, caplog: pytest.LogCaptureFixture
) -> None:
    headers = await sign_in_as(world, APPLE_USER)

    with caplog.at_level("WARNING"):
        response = await world.client.delete(DELETE_ME, headers=headers)

    assert response.status_code == 204
    assert apple.calls == []
    assert "no stored token" in caplog.text
    assert await count(world, UserAccount, UserAccount.id == APPLE_USER) == 0


async def test_without_the_apple_key_the_deletion_still_works(
    world: World, apple: FakeApple, monkeypatch: pytest.MonkeyPatch
) -> None:
    bare = apple_settings(APPLE_PRIVATE_KEY="", APPLE_TEAM_ID="", APPLE_KEY_ID="")
    monkeypatch.setattr(apple_revoke, "get_settings", lambda: bare)
    await store_token(world, APPLE_USER)
    headers = await sign_in_as(world, APPLE_USER)

    response = await world.client.delete(DELETE_ME, headers=headers)

    assert response.status_code == 204 and apple.calls == []


async def test_deleting_a_google_member_never_talks_to_apple(
    world: World, apple: FakeApple
) -> None:
    headers = await sign_in_as(world, GOOGLE_USER)

    response = await world.client.delete(DELETE_ME, headers=headers)

    assert response.status_code == 204 and apple.calls == []


async def test_the_deletion_works_when_the_token_table_does_not_exist_yet(
    world: World, apple: FakeApple
) -> None:
    """A server that has not run migration 0069 must still delete accounts."""
    async with world.sessions() as session:
        await session.execute(Base.metadata.tables["apple_refresh_tokens"].delete())
        await session.commit()
    async with world.sessions() as session:
        conn = await session.connection()
        await conn.run_sync(lambda c: Base.metadata.tables["apple_refresh_tokens"].drop(c))
        await session.commit()
    headers = await sign_in_as(world, APPLE_USER)

    response = await world.client.delete(DELETE_ME, headers=headers)

    assert response.status_code == 204
    assert await count(world, UserAccount, UserAccount.id == APPLE_USER) == 0
