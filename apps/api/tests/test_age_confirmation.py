"""Sign-up age confirmation ("I'm 16 or older", docs/age-confirmation.md).

* `age_confirmed: false` is always refused, with 422 and nothing created.
* `age_confirmed: true` registers as before.
* A missing field (an old app build) is accepted, unless REQUIRE_AGE_CONFIRMATION is on.
* Only validated, never stored: the account has no age column.
* Signing in is not affected.
"""

from __future__ import annotations

from typing import Any

import pytest
from pydantic import ValidationError

from app.schemas.auth import LocalRegisterWrite
from app.services import local_auth
from tests.member_session_support import World, make_settings
from tests.member_session_support import world_fixture as world_fixture  # noqa: F401

REGISTER = "/api/v1/auth/register"
LOGIN = "/api/v1/auth/login"


def body(email: str = "newcomer@example.net", **extra: Any) -> dict[str, Any]:
    return {"email": email, "password": "correct-horse-1", "display_name": "Newcomer", **extra}


async def emails(world: World) -> set[str | None]:
    return {row.email for row in await world.all_accounts()}


async def test_confirmed_age_registers_and_returns_tokens(world: World) -> None:
    response = await world.client.post(REGISTER, json=body(age_confirmed=True))

    assert response.status_code == 200, response.text
    assert response.json()["access_token"]
    assert "newcomer@example.net" in await emails(world)


async def test_an_explicit_false_is_refused_and_creates_nothing(world: World) -> None:
    response = await world.client.post(REGISTER, json=body(age_confirmed=False))

    assert response.status_code == 422
    assert "16" in response.json()["detail"]
    assert "newcomer@example.net" not in await emails(world)


async def test_a_missing_field_from_an_old_app_is_still_accepted(world: World) -> None:
    response = await world.client.post(REGISTER, json=body())

    assert response.status_code == 200, response.text
    assert "newcomer@example.net" in await emails(world)


async def test_the_switch_makes_the_missing_field_a_refusal_too(
    world: World, monkeypatch: pytest.MonkeyPatch
) -> None:
    strict = make_settings(REQUIRE_AGE_CONFIRMATION="true")
    monkeypatch.setattr(local_auth, "get_settings", lambda: strict)

    missing = await world.client.post(REGISTER, json=body())
    refused = await world.client.post(REGISTER, json=body(age_confirmed=False))
    accepted = await world.client.post(REGISTER, json=body(age_confirmed=True))

    assert missing.status_code == 422 and refused.status_code == 422
    assert accepted.status_code == 200, accepted.text


async def test_the_default_setting_lets_old_builds_in() -> None:
    assert make_settings().require_age_confirmation is False


async def test_null_counts_as_missing(world: World) -> None:
    response = await world.client.post(REGISTER, json=body(age_confirmed=None))

    assert response.status_code == 200, response.text


async def test_signing_in_needs_no_age_field(world: World) -> None:
    await world.client.post(REGISTER, json=body(age_confirmed=True))

    login = await world.client.post(
        LOGIN, json={"email": "newcomer@example.net", "password": "correct-horse-1"}
    )

    assert login.status_code == 200, login.text


async def test_a_wrong_type_is_a_plain_validation_error(world: World) -> None:
    response = await world.client.post(REGISTER, json=body(age_confirmed="maybe"))

    assert response.status_code == 422
    assert "newcomer@example.net" not in await emails(world)


def test_the_age_is_not_stored_anywhere_on_the_account() -> None:
    from app.models import UserAccount, UserCredential

    for model in (UserAccount, UserCredential):
        assert not [c.name for c in model.__table__.columns if "age" in c.name.split("_")]


def test_the_schema_defaults_to_not_sent() -> None:
    payload = LocalRegisterWrite(email="a@example.net", password="long-enough-1", display_name="A")
    assert payload.age_confirmed is None
    with pytest.raises(ValidationError):
        LocalRegisterWrite.model_validate(body(age_confirmed="maybe"))
