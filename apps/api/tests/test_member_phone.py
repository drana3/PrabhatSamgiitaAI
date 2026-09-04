from __future__ import annotations

from types import SimpleNamespace

from app.services.member_phone import phone_required


def _member(*, identity_provider: str, phone_e164: str | None = None) -> SimpleNamespace:
    return SimpleNamespace(identity_provider=identity_provider, phone_e164=phone_e164)


def test_oauth_members_without_phone_are_not_required() -> None:
    for provider in ("google", "aad", "facebook", "entra"):
        assert phone_required(_member(identity_provider=provider)) is False


def test_local_member_without_phone_is_required() -> None:
    assert phone_required(_member(identity_provider="local")) is True


def test_any_member_with_phone_is_not_required() -> None:
    assert (
        phone_required(
            _member(identity_provider="local", phone_e164="+919876543210"),
        )
        is False
    )
    assert (
        phone_required(
            _member(identity_provider="google", phone_e164="+919876543210"),
        )
        is False
    )
