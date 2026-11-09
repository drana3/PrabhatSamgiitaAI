"""Member sign-in tokens: the replacement for the shared key (docs/security-member-auth.md).

What must hold: a forged or foreign token is refused, the old shared key never gives admin or team,
roles come from the database on every request, and a revoked or expired session stops working.
"""

from __future__ import annotations

import base64
import json
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import jwt
import pytest

from app.models import UserAccount
from app.services import member_tokens, members
from app.services.member_tokens import TokenError, issue_access_token, verify_access_token
from tests.member_session_support import (
    ADMIN_ID,
    OTHER_ID,
    OWNER_EMAIL,
    PLAIN_ID,
    SECRET,
    World,
    legacy_headers,
    make_settings,
    use_settings,
    web_headers,
)
from tests.member_session_support import world_fixture as world_fixture  # noqa: F401

ME = "/api/v1/members/session"


async def get(world: World, path: str, headers: dict[str, str]):  # type: ignore[no-untyped-def]
    return await world.client.get(path, headers=headers)


# --------------------------------------------------------------------------- the old shared key


async def test_shared_key_with_forged_owner_email_is_not_admin(world: World) -> None:
    headers = legacy_headers("attacker", email=OWNER_EMAIL)

    assert (await get(world, "/t/me", headers)).json()["is_admin"] is False
    assert (await get(world, "/t/admin", headers)).status_code == 403
    assert (await get(world, "/t/team", headers)).json() == {"team": False}
    # and nothing was written to the database: the forged address is not stored at all, and no
    # account that carries the owner address was made or changed into an admin
    rows = [row for row in await world.all_accounts() if row.email == OWNER_EMAIL]
    assert not any(row.is_admin for row in rows)
    attacker = [r for r in await world.all_accounts() if r.external_subject == "google:attacker"]
    assert len(attacker) == 1 and attacker[0].email is None


async def test_shared_key_with_a_forged_email_does_not_find_or_change_another_account(
    world: World,
) -> None:
    """QA-001 follow-up: a stranger who holds the shared key types the address of a real member.
    The request must not land in that member's account, and must not rewrite its address."""
    before = await world.account(PLAIN_ID)
    headers = legacy_headers("stranger", email=before.email)

    me = (await get(world, "/t/me", headers)).json()

    assert me["id"] != str(PLAIN_ID)
    after = await world.account(PLAIN_ID)
    assert after.email == before.email
    assert after.external_subject == before.external_subject
    accounts = await world.all_accounts()
    assert len(accounts) == 4  # the three fixtures and the stranger's own empty account


async def test_shared_key_cannot_move_the_address_of_its_own_account_to_a_victims(
    world: World,
) -> None:
    mine = legacy_headers("stranger", email="stranger@example.org")
    await get(world, "/t/me", mine)
    forged = legacy_headers("stranger", email="plain@example.net")

    await get(world, "/t/me", forged)

    row = next(r for r in await world.all_accounts() if r.external_subject == "google:stranger")
    assert row.email is None
    plain = await world.account(PLAIN_ID)
    assert plain.email == "plain@example.net"


async def test_the_website_key_still_vouches_for_the_address(world: World) -> None:
    """The website server does the sign-in itself, so its address is trusted (own key)."""
    headers = web_headers("google:plain-sub", email="plain@example.net")

    me = (await get(world, "/t/me", headers)).json()

    assert me["id"] == str(PLAIN_ID)


async def test_shared_key_with_the_subject_of_a_real_admin_is_still_not_admin(world: World) -> None:
    headers = legacy_headers("admin-sub")  # the real admin's subject: google:admin-sub

    assert (await get(world, "/t/me", headers)).json()["id"] == str(ADMIN_ID)
    assert (await get(world, "/t/admin", headers)).status_code == 403
    assert (await get(world, "/t/team", headers)).json() == {"team": False}
    assert (await world.account(ADMIN_ID)).is_admin is True  # the row is untouched


async def test_shared_key_with_a_probe_name_does_not_make_an_admin(world: World) -> None:
    headers = legacy_headers("aad:deploy-smoke")

    assert (await get(world, "/t/admin", headers)).status_code == 403


async def test_emergency_switch_lets_the_shared_key_act_as_admin_again(
    world: World, monkeypatch: pytest.MonkeyPatch
) -> None:
    use_settings(monkeypatch, make_settings(LEGACY_PRINCIPAL_ADMIN="true"))

    assert (await get(world, "/t/admin", legacy_headers("admin-sub"))).status_code == 200


async def test_legacy_sign_in_can_be_switched_off(
    world: World, monkeypatch: pytest.MonkeyPatch
) -> None:
    use_settings(monkeypatch, make_settings(ALLOW_LEGACY_MEMBER_PRINCIPAL="false"))

    response = await get(world, "/t/me", legacy_headers("plain-sub"))

    assert response.status_code == 401
    assert "update" in response.json()["detail"].lower()


async def test_website_key_keeps_admin(world: World) -> None:
    assert (await get(world, "/t/admin", web_headers("admin-sub"))).status_code == 200
    assert (await get(world, "/t/admin", web_headers("plain-sub"))).status_code == 403


async def test_wrong_website_key_is_refused(world: World) -> None:
    headers = web_headers("admin-sub")
    headers["X-Web-Proxy-Key"] = "guess"

    assert (await get(world, "/t/admin", headers)).status_code == 401


# --------------------------------------------------------------------------- signed tokens


async def test_valid_token_names_the_account_and_roles_come_from_the_database(world: World) -> None:
    admin = world.bearer(await world.tokens_for(ADMIN_ID))
    plain = world.bearer(await world.tokens_for(PLAIN_ID))

    assert (await get(world, "/t/me", admin)).json() == {"id": str(ADMIN_ID), "is_admin": True}
    assert (await get(world, "/t/admin", admin)).status_code == 200
    assert (await get(world, "/t/team", admin)).json() == {"team": True}
    assert (await get(world, "/t/admin", plain)).status_code == 403
    assert (await get(world, "/t/team", plain)).json() == {"team": False}
    profile = (await get(world, ME, plain)).json()
    assert profile["id"] == str(PLAIN_ID) and profile["is_admin"] is False


async def test_token_has_no_role_in_it(world: World) -> None:
    pair = await world.tokens_for(ADMIN_ID)

    claims = jwt.decode(pair.access_token, options={"verify_signature": False})

    assert not {"is_admin", "admin", "role", "roles", "is_super_admin"} & set(claims)
    assert claims["sub"] == str(ADMIN_ID)


async def test_demoted_admin_loses_the_right_on_the_next_request(world: World) -> None:
    admin = world.bearer(await world.tokens_for(ADMIN_ID))
    assert (await get(world, "/t/admin", admin)).status_code == 200

    await world.set_account(ADMIN_ID, is_admin=False)

    assert (await get(world, "/t/admin", admin)).status_code == 403
    assert (await get(world, "/t/team", admin)).json() == {"team": False}


async def test_promoted_member_gets_the_right_without_a_new_token(world: World) -> None:
    plain = world.bearer(await world.tokens_for(PLAIN_ID))
    assert (await get(world, "/t/admin", plain)).status_code == 403

    await world.set_account(PLAIN_ID, is_admin=True)

    assert (await get(world, "/t/admin", plain)).status_code == 200


async def test_token_signed_with_another_secret_is_refused(world: World) -> None:
    forged = jwt.encode(
        {
            "iss": "prabhat-api",
            "aud": "prabhat-member",
            "typ": "access",
            "sub": str(ADMIN_ID),
            "sid": str(uuid4()),
            "iat": int(datetime.now(UTC).timestamp()),
            "exp": int((datetime.now(UTC) + timedelta(hours=1)).timestamp()),
        },
        "an-attacker-chosen-secret-0123456789abcdef",
        algorithm="HS256",
    )

    assert (await get(world, "/t/admin", {"Authorization": f"Bearer {forged}"})).status_code == 401


async def test_token_with_algorithm_none_is_refused(world: World) -> None:
    def part(data: dict[str, object]) -> str:
        return base64.urlsafe_b64encode(json.dumps(data).encode()).rstrip(b"=").decode()

    now = int(datetime.now(UTC).timestamp())
    token = (
        part({"alg": "none", "typ": "JWT"})
        + "."
        + part(
            {
                "iss": "prabhat-api",
                "aud": "prabhat-member",
                "typ": "access",
                "sub": str(ADMIN_ID),
                "sid": str(uuid4()),
                "iat": now,
                "exp": now + 3600,
            }
        )
        + "."
    )

    assert (await get(world, "/t/admin", {"Authorization": f"Bearer {token}"})).status_code == 401


async def test_edited_token_body_is_refused(world: World) -> None:
    pair = await world.tokens_for(PLAIN_ID)
    head, body, signature = pair.access_token.split(".")
    claims = json.loads(base64.urlsafe_b64decode(body + "=" * (-len(body) % 4)))
    claims["sub"] = str(ADMIN_ID)  # swap in somebody else's id, keep the old signature
    edited = base64.urlsafe_b64encode(json.dumps(claims).encode()).rstrip(b"=").decode()

    response = await get(
        world, "/t/admin", {"Authorization": f"Bearer {head}.{edited}.{signature}"}
    )

    assert response.status_code == 401


async def test_token_of_one_member_with_the_session_of_another_is_refused(world: World) -> None:
    other_pair = await world.tokens_for(OTHER_ID)
    async with world.sessions() as session:
        admin = await session.get(UserAccount, ADMIN_ID)
        assert admin is not None
        # a token that says "I am the admin" but points at the session row of somebody else
        token, _ttl = issue_access_token(
            account=admin, session_id=other_pair.session_id, settings=make_settings()
        )

    assert (await get(world, "/t/admin", {"Authorization": f"Bearer {token}"})).status_code == 401


async def test_expired_token_is_refused(world: World) -> None:
    async with world.sessions() as session:
        plain = await session.get(UserAccount, PLAIN_ID)
        assert plain is not None
        pair = await member_tokens.start_session(
            session,
            plain,
            settings=make_settings(),
            now=datetime.now(UTC) - timedelta(hours=3),
        )

    response = await get(world, "/t/me", world.bearer(pair))

    assert response.status_code == 401
    with pytest.raises(TokenError, match="expired"):
        verify_access_token(pair.access_token, make_settings())


async def test_garbage_and_empty_bearer_are_refused(world: World) -> None:
    for value in ("Bearer ", "Bearer abc", "Bearer a.b.c", "Basic Zm9vOmJhcg=="):
        assert (await get(world, "/t/me", {"Authorization": value})).status_code == 401


async def test_bearer_beats_the_shared_key_and_a_bad_bearer_does_not_fall_back(
    world: World,
) -> None:
    headers = {**legacy_headers("plain-sub"), "Authorization": "Bearer nonsense"}

    assert (await get(world, "/t/me", headers)).status_code == 401


async def test_without_a_signing_secret_tokens_do_nothing(
    world: World, monkeypatch: pytest.MonkeyPatch
) -> None:
    pair = await world.tokens_for(ADMIN_ID)
    use_settings(monkeypatch, make_settings(MEMBER_SESSION_SECRET=""))

    assert (await get(world, "/t/me", world.bearer(pair))).status_code == 401
    exchange = await world.client.post(
        f"{ME}/exchange", json={"provider": "google", "id_token": "x"}
    )
    assert exchange.status_code == 503


async def test_a_short_secret_counts_as_not_set(monkeypatch: pytest.MonkeyPatch) -> None:
    settings = make_settings(MEMBER_SESSION_SECRET="short")

    assert member_tokens.session_tokens_enabled(settings) is False


async def test_rotating_the_secret_keeps_old_tokens_alive_until_they_expire(
    world: World, monkeypatch: pytest.MonkeyPatch
) -> None:
    pair = await world.tokens_for(PLAIN_ID)
    new_secret = "the-new-secret-0123456789abcdefghijklmnop"
    use_settings(
        monkeypatch,
        make_settings(MEMBER_SESSION_SECRET=new_secret, MEMBER_SESSION_SECRET_PREVIOUS=SECRET),
    )
    assert (await get(world, "/t/me", world.bearer(pair))).status_code == 200

    use_settings(monkeypatch, make_settings(MEMBER_SESSION_SECRET=new_secret))  # previous dropped
    assert (await get(world, "/t/me", world.bearer(pair))).status_code == 401


# --------------------------------------------------------------------------- revoke, refresh,
# delete


async def test_signing_out_revokes_only_that_device(world: World) -> None:
    phone = await world.tokens_for(PLAIN_ID)
    tablet = await world.tokens_for(PLAIN_ID)

    response = await world.client.post(f"{ME}/revoke", json={}, headers=world.bearer(phone))

    assert response.status_code == 204
    assert (await get(world, "/t/me", world.bearer(phone))).status_code == 401
    assert (await get(world, "/t/me", world.bearer(tablet))).status_code == 200


async def test_signing_out_everywhere_revokes_every_device(world: World) -> None:
    phone = await world.tokens_for(PLAIN_ID)
    tablet = await world.tokens_for(PLAIN_ID)
    other = await world.tokens_for(OTHER_ID)

    await world.client.post(f"{ME}/revoke", json={"all_devices": True}, headers=world.bearer(phone))

    assert (await get(world, "/t/me", world.bearer(phone))).status_code == 401
    assert (await get(world, "/t/me", world.bearer(tablet))).status_code == 401
    assert (await get(world, "/t/me", world.bearer(other))).status_code == 200


async def test_refresh_rotates_and_the_old_refresh_token_stops_working(world: World) -> None:
    pair = await world.tokens_for(PLAIN_ID)

    first = await world.client.post(f"{ME}/refresh", json={"refresh_token": pair.refresh_token})
    assert first.status_code == 200
    fresh = first.json()
    assert fresh["refresh_token"] != pair.refresh_token
    assert (
        await get(world, "/t/me", {"Authorization": f"Bearer {fresh['access_token']}"})
    ).status_code == 200


async def test_reusing_a_spent_refresh_token_ends_the_whole_session(world: World) -> None:
    pair = await world.tokens_for(PLAIN_ID)
    first = await world.client.post(f"{ME}/refresh", json={"refresh_token": pair.refresh_token})
    fresh = first.json()

    replay = await world.client.post(f"{ME}/refresh", json={"refresh_token": pair.refresh_token})

    assert replay.status_code == 401
    # the thief's replay also killed the honest session: both must sign in again
    assert (
        await get(world, "/t/me", {"Authorization": f"Bearer {fresh['access_token']}"})
    ).status_code == 401
    again = await world.client.post(f"{ME}/refresh", json={"refresh_token": fresh["refresh_token"]})
    assert again.status_code == 401


async def test_refresh_with_a_forged_or_foreign_token_fails(world: World) -> None:
    pair = await world.tokens_for(PLAIN_ID)
    session_part = pair.refresh_token.split(".")[0]

    for value in (f"{session_part}.wrong-secret-value", "nonsense.value", "x" * 40):
        response = await world.client.post(f"{ME}/refresh", json={"refresh_token": value})
        assert response.status_code == 401


async def test_expired_refresh_token_fails(world: World) -> None:
    async with world.sessions() as session:
        plain = await session.get(UserAccount, PLAIN_ID)
        assert plain is not None
        pair = await member_tokens.start_session(
            session, plain, settings=make_settings(), now=datetime.now(UTC) - timedelta(days=40)
        )

    response = await world.client.post(f"{ME}/refresh", json={"refresh_token": pair.refresh_token})

    assert response.status_code == 401


async def test_deleted_account_cannot_use_its_token_or_refresh(world: World) -> None:
    pair = await world.tokens_for(PLAIN_ID)

    await world.set_account(PLAIN_ID, deleted_at=datetime.now(UTC))

    assert (await get(world, "/t/me", world.bearer(pair))).status_code == 401
    response = await world.client.post(f"{ME}/refresh", json={"refresh_token": pair.refresh_token})
    assert response.status_code == 401


async def test_refresh_token_is_stored_only_as_a_hash(world: World) -> None:
    from sqlalchemy import select

    from app.models.member_session import MemberSession

    pair = await world.tokens_for(PLAIN_ID)
    async with world.sessions() as session:
        rows = list((await session.scalars(select(MemberSession))).all())

    assert rows and all(pair.refresh_token not in (row.refresh_hash or "") for row in rows)
    assert all(len(row.refresh_hash) == 64 for row in rows)


# --------------------------------------------------------------------------- local login


async def test_local_login_returns_working_tokens_and_register_cannot_take_the_owner_address(
    world: World,
) -> None:
    payload = {
        "email": "newbie@example.com",
        "password": "correct horse battery",
        "display_name": "Newbie",
        "phone_country_code": "IN",
        "phone_number": "9876543210",
    }
    registered = await world.client.post("/api/v1/auth/register", json=payload)
    assert registered.status_code == 200, registered.text
    token = registered.json()["access_token"]
    assert token and registered.json()["refresh_token"]
    assert (await get(world, "/t/me", {"Authorization": f"Bearer {token}"})).status_code == 200

    login = await world.client.post(
        "/api/v1/auth/login", json={"email": payload["email"], "password": payload["password"]}
    )
    assert login.status_code == 200 and login.json()["access_token"]

    taken = await world.client.post(
        "/api/v1/auth/register",
        json={**payload, "email": OWNER_EMAIL, "phone_number": "9876543211"},
    )
    assert taken.status_code == 409


async def test_legacy_counter_counts_shared_key_use(world: World) -> None:
    before = members.legacy_hits

    await get(world, "/t/me", legacy_headers("plain-sub"))

    assert members.legacy_hits == before + 1
