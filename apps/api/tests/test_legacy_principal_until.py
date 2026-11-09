"""LEGACY_PRINCIPAL_UNTIL: the date the old shared key stops (docs/decisions-security.md)."""

from __future__ import annotations

import os
from datetime import date

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://test:test@localhost/test")

import pytest

from app.config import Settings


def _settings(monkeypatch: pytest.MonkeyPatch, **env: str) -> Settings:
    for name in ("LEGACY_PRINCIPAL_UNTIL", "ALLOW_LEGACY_MEMBER_PRINCIPAL"):
        monkeypatch.delenv(name, raising=False)
    for name, value in env.items():
        monkeypatch.setenv(name, value)
    return Settings(_env_file=None)  # type: ignore[call-arg]


def test_no_date_keeps_the_key_working(monkeypatch: pytest.MonkeyPatch) -> None:
    assert _settings(monkeypatch).legacy_principal_allowed(date(2030, 1, 1)) is True


def test_an_empty_value_as_in_the_example_file_means_no_date(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    settings = _settings(monkeypatch, LEGACY_PRINCIPAL_UNTIL="")
    assert settings.legacy_principal_until is None
    assert settings.legacy_principal_allowed(date(2030, 1, 1)) is True


def test_the_key_works_up_to_the_date_and_is_refused_the_day_after(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    settings = _settings(monkeypatch, LEGACY_PRINCIPAL_UNTIL="2027-01-31")
    assert settings.legacy_principal_allowed(date(2027, 1, 30)) is True
    assert settings.legacy_principal_allowed(date(2027, 1, 31)) is True
    assert settings.legacy_principal_allowed(date(2027, 2, 1)) is False


def test_the_switch_still_ends_it_at_once(monkeypatch: pytest.MonkeyPatch) -> None:
    settings = _settings(
        monkeypatch, ALLOW_LEGACY_MEMBER_PRINCIPAL="false", LEGACY_PRINCIPAL_UNTIL="2027-01-31"
    )
    assert settings.legacy_principal_allowed(date(2026, 11, 9)) is False
