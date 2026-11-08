"""Feature flags and A/B groups (docs/analytics-flags.md).

`evaluate` is a pure function: the same flag, the same install and the same app give the same
answer every time, on every server, with no table of assignments to keep. The group of a person is
a hash of the flag key and the install id, so:

* it is STABLE: it does not change between launches, or when the team changes the rollout percent;
* raising the percent only ADDS people: the first 10 percent stay inside the 50 percent;
* two flags are INDEPENDENT: the key is part of the hash, so a person in one test is not always
  in the other;
* the install id is used for the sum and not stored by the flag endpoint.

Order of the rules: kill switch, platform, app version window, per-install overrides, rollout
percent, then the variant by weight.
"""

from __future__ import annotations

import hashlib
import re
from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from typing import Any

from app.models.app_telemetry import FeatureFlag

KEY_PATTERN = re.compile(r"^[a-z][a-z0-9_]{1,62}$")
VARIANT_PATTERN = re.compile(r"^[a-z][a-z0-9_]{0,29}$")
PLATFORMS = ("ios", "android", "web")
OFF = "off"
ON = "on"


@dataclass(frozen=True)
class Context:
    """Who is asking. Every field may be missing."""

    install_id: str | None = None
    app_version: str | None = None
    platform: str | None = None


@dataclass(frozen=True)
class Result:
    enabled: bool
    variant: str
    reason: str


def parse_version(value: str | None) -> tuple[int, ...] | None:
    """`1.12.3` -> (1, 12, 3); `2.0.0-beta.1` -> (2, 0, 0). None when there is no number at all."""
    if not value:
        return None
    numbers = [int(part) for part in re.findall(r"\d+", value.split("-", 1)[0].split("+", 1)[0])]
    return tuple(numbers) if numbers else None


def _pad(a: tuple[int, ...], b: tuple[int, ...]) -> tuple[tuple[int, ...], tuple[int, ...]]:
    n = max(len(a), len(b))
    return a + (0,) * (n - len(a)), b + (0,) * (n - len(b))


def version_in_window(version: str | None, minimum: str | None, maximum: str | None) -> bool:
    if not minimum and not maximum:
        return True
    have = parse_version(version)
    if have is None:
        return False  # an app that does not say its version is not let into a limited flag
    if minimum and (low := parse_version(minimum)):
        a, b = _pad(have, low)
        if a < b:
            return False
    if maximum and (high := parse_version(maximum)):
        a, b = _pad(have, high)
        if a > b:
            return False
    return True


def bucket(flag_key: str, subject: str, purpose: str = "rollout") -> float:
    """A number in [0, 100) with two decimals, the same for the same flag and subject, always."""
    digest = hashlib.sha256(f"{flag_key}|{purpose}|{subject}".encode()).digest()
    return int.from_bytes(digest[:8], "big") % 10_000 / 100


def pick_variant(flag_key: str, subject: str, variants: Iterable[Mapping[str, Any]]) -> str:
    items = [(str(v["name"]), max(0, int(v.get("weight", 0)))) for v in variants]
    total = sum(weight for _, weight in items)
    if total <= 0:
        return ON
    point = bucket(flag_key, subject, "variant") / 100 * total
    running = 0.0
    for name, weight in items:
        running += weight
        if point < running:
            return name
    return items[-1][0]


def evaluate(flag: FeatureFlag, ctx: Context) -> Result:
    if not flag.enabled:
        return Result(False, OFF, "disabled")
    if flag.platforms and (ctx.platform or "") not in flag.platforms:
        return Result(False, OFF, "platform")
    if not version_in_window(ctx.app_version, flag.min_app_version, flag.max_app_version):
        return Result(False, OFF, "version")
    subject = (ctx.install_id or "").strip()
    variants = flag.variants or []
    if subject and subject in (flag.exclude_ids or []):
        return Result(False, OFF, "excluded")
    if subject and subject in (flag.include_ids or []):
        variant = pick_variant(flag.key, subject, variants) if variants else ON
        return Result(True, variant, "included")
    percent = max(0, min(100, int(flag.rollout_percent)))
    if percent >= 100:
        in_rollout = True
    elif percent <= 0:
        in_rollout = False
    elif not subject:
        in_rollout = False  # no stable id: cannot place the person, so keep it off
    else:
        in_rollout = bucket(flag.key, subject) < percent
    if not in_rollout:
        return Result(False, OFF, "rollout")
    if variants:
        who = subject or "anonymous"
        return Result(True, pick_variant(flag.key, who, variants), "rollout")
    return Result(True, ON, "rollout")


def evaluate_all(flags: Iterable[FeatureFlag], ctx: Context) -> dict[str, dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    for flag in flags:
        result = evaluate(flag, ctx)
        out[flag.key] = {"enabled": result.enabled, "variant": result.variant}
    return out


class FlagError(ValueError):
    """The team sent a flag that cannot be stored."""


def validate_flag_fields(data: Mapping[str, Any]) -> dict[str, Any]:
    """Check what the admin sent and return the clean fields."""
    clean: dict[str, Any] = {}
    if "enabled" in data:
        clean["enabled"] = bool(data["enabled"])
    if "description" in data:
        clean["description"] = str(data["description"])[:500]
    if "rollout_percent" in data:
        percent = data["rollout_percent"]
        if isinstance(percent, bool) or not isinstance(percent, int) or not 0 <= percent <= 100:
            raise FlagError("rollout_percent must be a whole number from 0 to 100")
        clean["rollout_percent"] = percent
    for field in ("min_app_version", "max_app_version"):
        if field in data:
            value = data[field]
            if value in (None, ""):
                clean[field] = None
            elif parse_version(str(value)) is None or len(str(value)) > 20:
                raise FlagError(f"{field} must look like 1.2.3")
            else:
                clean[field] = str(value)
    if "platforms" in data:
        platforms = data["platforms"]
        if platforms in (None, []):
            clean["platforms"] = None
        elif not isinstance(platforms, list) or any(p not in PLATFORMS for p in platforms):
            raise FlagError("platforms must be a list of ios, android, web")
        else:
            clean["platforms"] = sorted(set(platforms))
    if "variants" in data:
        variants = data["variants"]
        if variants in (None, []):
            clean["variants"] = None
        else:
            if not isinstance(variants, list) or not 2 <= len(variants) <= 6:
                raise FlagError("variants needs 2 to 6 entries")
            names: set[str] = set()
            total = 0
            for item in variants:
                name = str(item.get("name", "")) if isinstance(item, Mapping) else ""
                weight = item.get("weight") if isinstance(item, Mapping) else None
                if not VARIANT_PATTERN.fullmatch(name) or name == OFF or name in names:
                    raise FlagError("each variant needs its own lowercase name (not 'off')")
                if isinstance(weight, bool) or not isinstance(weight, int) or weight < 0:
                    raise FlagError("each variant needs a whole-number weight of 0 or more")
                names.add(name)
                total += weight
            if total <= 0:
                raise FlagError("variant weights must add up to more than 0")
            clean["variants"] = [{"name": v["name"], "weight": v["weight"]} for v in variants]
    for field in ("include_ids", "exclude_ids"):
        if field in data:
            ids = data[field]
            if not isinstance(ids, list) or len(ids) > 200 or any(
                not isinstance(i, str) or not 8 <= len(i) <= 64 for i in ids
            ):
                raise FlagError(f"{field} must be a list of up to 200 install ids")
            clean[field] = sorted(set(ids))
    return clean
