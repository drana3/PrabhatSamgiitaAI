"""Forced and recommended app updates (docs/forced-update.md).

`evaluate` is pure. It never blocks by mistake: an unknown platform, a missing or unreadable
version, or no policy at all means "ok". Only a version that is clearly below the minimum is
"required".
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Literal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.app_version import AppVersionPolicy
from app.services.feature_flags import parse_version

PLATFORMS = ("ios", "android")
Status = Literal["ok", "recommended", "required"]
STORE_HOSTS = ("apps.apple.com", "itunes.apple.com", "play.google.com", "market.android.com")
VERSION_SHAPE = re.compile(r"^\d{1,4}(\.\d{1,4}){0,3}$")


@dataclass(frozen=True)
class VersionStatus:
    status: Status
    platform: str | None
    minimum_version: str | None
    recommended_version: str | None
    store_url: str | None


def _below(version: tuple[int, ...], limit: str | None) -> bool:
    wanted = parse_version(limit)
    if wanted is None:
        return False
    size = max(len(version), len(wanted))
    padded = version + (0,) * (size - len(version)), wanted + (0,) * (size - len(wanted))
    return padded[0] < padded[1]


def evaluate(
    platform: str | None, app_version: str | None, policy: AppVersionPolicy | None
) -> VersionStatus:
    clean = (platform or "").strip().lower()
    if clean not in PLATFORMS or policy is None:
        return VersionStatus("ok", clean or None, None, None, None)
    base = {
        "platform": clean,
        "minimum_version": policy.minimum_version,
        "recommended_version": policy.recommended_version,
        "store_url": policy.store_url,
    }
    version = parse_version(app_version)
    if version is None:
        return VersionStatus("ok", **base)
    if _below(version, policy.minimum_version):
        return VersionStatus("required", **base)
    if _below(version, policy.recommended_version):
        return VersionStatus("recommended", **base)
    return VersionStatus("ok", **base)


class PolicyError(ValueError):
    """A change the team asked for that would be unsafe or meaningless."""


def clean_version(value: str | None, label: str) -> str | None:
    text = (value or "").strip()
    if not text:
        return None
    if not VERSION_SHAPE.match(text):
        raise PolicyError(f"{label} must look like 2.1 or 2.1.0")
    return text


def clean_store_url(value: str | None) -> str | None:
    text = (value or "").strip()
    if not text:
        return None
    match = re.match(r"^https://([^/:@?#]+)(/|$)", text)
    if not match or match.group(1).lower() not in STORE_HOSTS:
        raise PolicyError("The store address must be an https link to the App Store or Google Play")
    return text


def check_pair(minimum: str | None, recommended: str | None) -> None:
    low, high = parse_version(minimum), parse_version(recommended)
    if low and high and _below(high, minimum):
        raise PolicyError("The recommended version cannot be lower than the minimum")


async def get_policy(session: AsyncSession, platform: str) -> AppVersionPolicy | None:
    row: AppVersionPolicy | None = await session.scalar(
        select(AppVersionPolicy).where(AppVersionPolicy.platform == platform)
    )
    return row


async def list_policies(session: AsyncSession) -> list[AppVersionPolicy]:
    rows = await session.scalars(select(AppVersionPolicy).order_by(AppVersionPolicy.platform))
    return list(rows)
