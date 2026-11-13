"""Exchanging a Google/Apple/Microsoft sign-in proof for our own session tokens.

The provider keys are generated here and served through the fetch hook: no network.
"""

from __future__ import annotations

import json
import time
from datetime import UTC, datetime
from typing import Any

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from jwt.algorithms import RSAAlgorithm

from app.models import UserAccount
from app.services import provider_tokens
from tests.member_session_support import (
    GOOGLE_CLIENT,
    OWNER_EMAIL,
    PLAIN_ID,
    World,
    make_settings,
    use_settings,
)
from tests.member_session_support import world_fixture as world_fixture  # noqa: F401

EXCHANGE = "/api/v1/members/session/exchange"
KID = "test-key-1"
_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)
_OTHER_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)


def _jwks(key: Any = _KEY, kid: str = KID) -> dict[str, Any]:
    public = json.loads(RSAAlgorithm.to_jwk(key.public_key()))
    public.update({"kid": kid, "alg": "RS256", "use": "sig"})
    return {"keys": [public]}


@pytest.fixture(autouse=True)
def fake_providers() -> Any:
    async def fetch(url: str) -> dict[str, Any]:
        return _jwks()

    provider_tokens.jwks_cache.set_fetcher(fetch)
    yield
    provider_tokens.jwks_cache.set_fetcher(None)


def google_token(
    *,
    sub: str = "g-sub-1",
    email: str | None = "member@example.net",
    verified: Any = True,
    aud: str = GOOGLE_CLIENT,
    iss: str = "https://accounts.google.com",
    exp_in: int = 3600,
    key: Any = _KEY,
    name: str = "Gopal",
) -> str:
    now = int(time.time())
    claims: dict[str, Any] = {
        "iss": iss,
        "aud": aud,
        "sub": sub,
        "iat": now - 5,
        "exp": now + exp_in,
        "name": name,
    }
    if email:
        claims["email"] = email
        claims["email_verified"] = verified
    return jwt.encode(claims, key, algorithm="RS256", headers={"kid": KID})


async def exchange(world: World, token: str, provider: str = "google") -> Any:
    return await world.client.post(
        EXCHANGE, json={"provider": provider, "id_token": token, "device_label": "Pixel"}
    )


async def test_google_proof_creates_an_account_and_returns_working_tokens(world: World) -> None:
    response = await exchange(world, google_token())

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["identity_provider"] == "google" and body["is_admin"] is False
    me = await world.client.get(
        "/t/me", headers={"Authorization": f"Bearer {body['access_token']}"}
    )
    assert me.status_code == 200 and me.json()["id"] == body["account_id"]
    subjects = {row.external_subject for row in await world.all_accounts()}
    assert "google:g-sub-1" in subjects  # same subject format as the old shared-key path


async def test_existing_member_is_found_by_subject_so_nothing_is_lost(world: World) -> None:
    response = await exchange(world, google_token(sub="plain-sub", email="plain@example.net"))

    assert response.json()["account_id"] == str(PLAIN_ID)


async def test_wrong_audience_is_refused(world: World) -> None:
    assert (await exchange(world, google_token(aud="someone-elses-app"))).status_code == 401


async def test_wrong_issuer_is_refused(world: World) -> None:
    assert (await exchange(world, google_token(iss="https://evil.example"))).status_code == 401


async def test_expired_proof_is_refused(world: World) -> None:
    assert (await exchange(world, google_token(exp_in=-600))).status_code == 401


async def test_proof_signed_with_a_stranger_key_is_refused(world: World) -> None:
    assert (await exchange(world, google_token(key=_OTHER_KEY))).status_code == 401


async def test_symmetric_algorithm_confusion_is_refused(world: World) -> None:
    public_pem = _KEY.public_key().public_bytes(
        encoding=__import__(
            "cryptography.hazmat.primitives.serialization", fromlist=["x"]
        ).Encoding.PEM,
        format=__import__(
            "cryptography.hazmat.primitives.serialization", fromlist=["x"]
        ).PublicFormat.SubjectPublicKeyInfo,
    )
    now = int(time.time())
    # PyJWT refuses to sign HS256 with a PEM key; build the token by hand to try the attack
    import base64
    import hashlib
    import hmac

    def part(data: dict[str, Any]) -> bytes:
        return base64.urlsafe_b64encode(json.dumps(data).encode()).rstrip(b"=")

    signing = (
        part({"alg": "HS256", "kid": KID, "typ": "JWT"})
        + b"."
        + part(
            {
                "iss": "https://accounts.google.com",
                "aud": GOOGLE_CLIENT,
                "sub": "attacker",
                "iat": now,
                "exp": now + 600,
            }
        )
    )
    signature = base64.urlsafe_b64encode(hmac.new(public_pem, signing, hashlib.sha256).digest())
    token = (signing + b"." + signature.rstrip(b"=")).decode()

    assert (await exchange(world, token)).status_code == 401


async def test_unknown_provider_and_missing_proof_are_refused(world: World) -> None:
    unknown = await world.client.post(EXCHANGE, json={"provider": "myspace", "id_token": "x"})
    missing = await world.client.post(EXCHANGE, json={"provider": "google"})

    assert unknown.status_code == 422 and missing.status_code == 422


async def test_unverified_email_never_merges_into_an_account_or_makes_an_admin(
    world: World,
) -> None:
    # the owner address, claimed by a stranger whose provider did not verify it
    response = await exchange(
        world, google_token(sub="stranger", email=OWNER_EMAIL, verified=False)
    )

    assert response.status_code == 200
    assert response.json()["is_admin"] is False
    me = await world.client.get(
        "/t/admin", headers={"Authorization": f"Bearer {response.json()['access_token']}"}
    )
    assert me.status_code == 403
    me_team = await world.client.get(
        "/t/team", headers={"Authorization": f"Bearer {response.json()['access_token']}"}
    )
    assert me_team.json() == {"team": False}


async def test_unverified_email_of_an_existing_member_does_not_take_over_that_account(
    world: World,
) -> None:
    response = await exchange(
        world, google_token(sub="stranger", email="plain@example.net", verified=False)
    )

    assert response.json()["account_id"] != str(PLAIN_ID)


async def test_verified_owner_email_is_promoted_once_at_sign_in(world: World) -> None:
    response = await exchange(world, google_token(sub="the-owner", email=OWNER_EMAIL))

    assert response.status_code == 200
    assert response.json()["is_admin"] is True
    token = response.json()["access_token"]
    assert (
        await world.client.get("/t/admin", headers={"Authorization": f"Bearer {token}"})
    ).status_code == 200


async def test_display_name_cannot_make_a_probe_admin(world: World) -> None:
    response = await exchange(world, google_token(sub="x1", name="deploy-smoke", email=None))

    assert response.json()["is_admin"] is False


async def test_provider_outage_is_a_503_not_a_login(world: World) -> None:
    async def down(url: str) -> dict[str, Any]:
        raise RuntimeError("network down")

    provider_tokens.jwks_cache.set_fetcher(down)

    assert (await exchange(world, google_token())).status_code == 503


async def test_unconfigured_audience_is_a_503(
    world: World, monkeypatch: pytest.MonkeyPatch
) -> None:
    use_settings(monkeypatch, make_settings(GOOGLE_OAUTH_CLIENT_IDS=""))

    assert (await exchange(world, google_token())).status_code == 503


async def test_apple_proof(world: World) -> None:
    now = int(time.time())
    token = jwt.encode(
        {
            "iss": "https://appleid.apple.com",
            "aud": "net.prabhatasamgiita.ai",
            "sub": "apple-user-1",
            "iat": now,
            "exp": now + 600,
            "email": "relay@privaterelay.appleid.com",
            "email_verified": "true",
        },
        _KEY,
        algorithm="RS256",
        headers={"kid": KID},
    )

    response = await exchange(world, token, "apple")

    assert response.status_code == 200
    assert "apple:apple-user-1" in {row.external_subject for row in await world.all_accounts()}


async def test_microsoft_proof_checks_the_tenant_in_the_issuer(
    world: World, monkeypatch: pytest.MonkeyPatch
) -> None:
    use_settings(monkeypatch, make_settings(AZURE_CLIENT_IDS="azure-app"))
    now = int(time.time())

    def ms(iss: str) -> str:
        return jwt.encode(
            {
                "iss": iss,
                "aud": "azure-app",
                "sub": "pairwise",
                "oid": "oid-123",
                "tid": "tenant-1",
                "iat": now,
                "exp": now + 600,
                "preferred_username": OWNER_EMAIL,
                "name": "Microsoft Person",
            },
            _KEY,
            algorithm="RS256",
            headers={"kid": KID},
        )

    good = await exchange(world, ms("https://login.microsoftonline.com/tenant-1/v2.0"), "aad")
    bad = await exchange(world, ms("https://login.microsoftonline.com/other-tenant/v2.0"), "aad")

    assert good.status_code == 200
    assert good.json()["is_admin"] is False  # a Microsoft address is not vouched for by default
    assert "aad:oid-123" in {row.external_subject for row in await world.all_accounts()}
    assert bad.status_code == 401


async def test_facebook_sign_in_is_gone(world: World) -> None:
    """Facebook login was removed (docs/sign-in-setup.md): the server says "unknown provider"."""
    refused = await world.client.post(
        EXCHANGE, json={"provider": "facebook", "access_token": "tok", "id_token": "x" * 40}
    )

    assert refused.status_code == 422
    assert "facebook:42" not in {row.external_subject for row in await world.all_accounts()}
    assert "facebook" not in provider_tokens.SUPPORTED


async def test_missing_google_ids_fail_clearly_and_name_the_setting(
    world: World, monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    use_settings(monkeypatch, make_settings(GOOGLE_OAUTH_CLIENT_IDS=""))

    with caplog.at_level("ERROR"):
        response = await exchange(world, google_token())

    assert response.status_code == 503
    assert response.json()["detail"] == "Google sign-in is not set up on this server yet"
    # the log (for the person running the server) names the exact setting; the phone does not
    assert "GOOGLE_OAUTH_CLIENT_IDS" in caplog.text
    assert "GOOGLE_OAUTH_CLIENT_IDS" not in response.text
    assert "g-sub-1" not in {row.external_subject for row in await world.all_accounts()}


async def test_missing_apple_ids_fail_clearly(
    world: World, monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    use_settings(monkeypatch, make_settings(APPLE_BUNDLE_IDS=""))

    with caplog.at_level("ERROR"):
        response = await exchange(world, google_token(), provider="apple")

    assert response.status_code == 503
    assert response.json()["detail"] == "Apple sign-in is not set up on this server yet"
    assert "APPLE_BUNDLE_IDS" in caplog.text


async def test_setup_report_lists_each_provider_without_values(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    settings = make_settings(
        GOOGLE_OAUTH_CLIENT_IDS="a.apps.googleusercontent.com, b.apps.googleusercontent.com",
        AZURE_CLIENT_IDS="",
    )

    report = provider_tokens.sign_in_setup_report(settings)

    assert report["google"] == {
        "configured": True,
        "setting": "GOOGLE_OAUTH_CLIENT_IDS",
        "count": 2,
    }
    assert report["apple"]["configured"] is True  # the app's own bundle id is the default
    assert report["aad"] == {"configured": False, "setting": "AZURE_CLIENT_IDS", "count": 0}
    assert "googleusercontent" not in json.dumps(report)


async def test_a_local_account_with_someones_address_is_not_taken_over_by_that_person(
    world: World,
) -> None:
    """A stranger registers with e-mail and password using the address of a person who has not
    joined yet. When that person signs in with Google, they must get their own account, not the
    stranger's (whose password the stranger knows)."""
    async with world.sessions() as session:
        stranger = UserAccount(
            external_subject="local:stranger",
            identity_provider="local",
            display_name="Stranger",
            email="victim@example.org",
            last_seen_at=datetime.now(UTC),
        )
        session.add(stranger)
        await session.commit()
        stranger_id = stranger.id

    response = await exchange(world, google_token(sub="victim-sub", email="victim@example.org"))

    assert response.status_code == 200
    assert response.json()["account_id"] != str(stranger_id)


async def test_an_address_the_provider_did_not_vouch_for_is_not_stored(world: World) -> None:
    response = await exchange(
        world, google_token(sub="unverified-sub", email="x@example.org", verified=False)
    )

    assert response.status_code == 200
    account = next(
        a for a in await world.all_accounts() if str(a.id) == response.json()["account_id"]
    )
    assert account.email is None
