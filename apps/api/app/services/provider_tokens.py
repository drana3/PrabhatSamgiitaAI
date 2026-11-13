"""Check a sign-in proof from Google, Apple or Microsoft on the server.

The phone signs in with the provider and gets a signed ID token. It
sends the token here once; the server checks the signature against the provider's public keys, the
issuer, the audience (our own client ids), the expiry, and only then says "this really is that
person". Nothing the phone writes by itself is believed (docs/security-member-auth.md).

The network is reached through a small hook (`JwksFetcher`) so the tests can run offline with keys
they generate.

Facebook sign-in was removed on 9 November 2026 (docs/sign-in-setup.md). A request that still says
"facebook" gets "unknown provider". Accounts made through Facebook earlier stay in the database.
"""

from __future__ import annotations

import hashlib
import logging
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any

import httpx
import jwt
from jwt.algorithms import RSAAlgorithm

from app.config import Settings, get_settings

logger = logging.getLogger(__name__)

GOOGLE_JWKS = "https://www.googleapis.com/oauth2/v3/certs"
APPLE_JWKS = "https://appleid.apple.com/auth/keys"
MICROSOFT_JWKS = "https://login.microsoftonline.com/common/discovery/v2.0/keys"
JWKS_TTL_SECONDS = 3600
SUPPORTED = ("google", "apple", "aad")

JwksFetcher = Callable[[str], Awaitable[dict[str, Any]]]


class ProviderTokenError(Exception):
    def __init__(self, reason: str, *, status: int = 401) -> None:
        super().__init__(reason)
        self.reason = reason
        self.status = status


@dataclass(frozen=True, slots=True)
class VerifiedProviderIdentity:
    provider: str
    subject: str  # the id inside the provider; the account subject is "provider:subject"
    email: str | None
    email_verified: bool
    display_name: str
    avatar_url: str | None = None


async def _http_json(url: str, params: dict[str, str] | None = None) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=8.0) as client:
        response = await client.get(url, params=params)
        response.raise_for_status()
        data = response.json()
    if not isinstance(data, dict):
        raise ProviderTokenError("provider answered with something unexpected", status=503)
    return data


async def _default_jwks(url: str) -> dict[str, Any]:
    return await _http_json(url)


class JwksCache:
    """Public keys of a provider, kept for an hour; an unknown key id forces one fresh download."""

    def __init__(self, fetcher: JwksFetcher | None = None) -> None:
        self._fetcher = fetcher or _default_jwks
        self._store: dict[str, tuple[float, dict[str, dict[str, Any]]]] = {}

    def set_fetcher(self, fetcher: JwksFetcher | None) -> None:
        self._fetcher = fetcher or _default_jwks
        self._store.clear()

    async def _keys(self, url: str, *, force: bool) -> dict[str, dict[str, Any]]:
        cached = self._store.get(url)
        if cached and not force and cached[0] > time.monotonic():
            return cached[1]
        try:
            document = await self._fetcher(url)
        except ProviderTokenError:
            raise
        except Exception as exc:
            logger.warning("could not download sign-in keys from %s: %s", url, type(exc).__name__)
            raise ProviderTokenError("sign-in provider is unreachable", status=503) from exc
        keys = {
            str(item["kid"]): item
            for item in document.get("keys", [])
            if isinstance(item, dict) and item.get("kid") and item.get("kty") == "RSA"
        }
        self._store[url] = (time.monotonic() + JWKS_TTL_SECONDS, keys)
        return keys

    async def public_key(self, url: str, kid: str) -> Any:
        keys = await self._keys(url, force=False)
        if kid not in keys:
            keys = await self._keys(url, force=True)
        if kid not in keys:
            raise ProviderTokenError("unknown signing key")
        return RSAAlgorithm.from_jwk(keys[kid])


jwks_cache = JwksCache()


def _csv(value: str) -> list[str]:
    return [item.strip() for item in (value or "").split(",") if item.strip()]


def _truthy(value: Any) -> bool:
    return value is True or str(value).casefold() == "true"


# Which setting each provider needs on the server. The ids are public values (not secrets).
REQUIRED_SETTING = {
    "google": "GOOGLE_OAUTH_CLIENT_IDS",
    "apple": "APPLE_BUNDLE_IDS",
    "aad": "AZURE_CLIENT_IDS",
}


def sign_in_setup_report(settings: Settings | None = None) -> dict[str, dict[str, Any]]:
    """For each provider: is it set up on this server, and which setting is missing. No values."""
    settings = settings or get_settings()
    ids = {
        "google": _csv(settings.google_oauth_client_ids),
        "apple": _csv(settings.apple_bundle_ids),
        "aad": _csv(settings.azure_client_ids),
    }
    return {
        provider: {
            "configured": bool(values),
            "setting": REQUIRED_SETTING[provider],
            "count": len(values),
        }
        for provider, values in ids.items()
    }


async def _decode(
    token: str,
    *,
    provider: str,
    jwks_url: str,
    audiences: list[str],
    issuers: list[str] | None,
) -> dict[str, Any]:
    if not audiences:
        # Say exactly what is missing (in the log and in the answer); never a vague failure.
        setting = REQUIRED_SETTING[provider]
        logger.error("%s sign-in is not set up: the server setting %s is empty", provider, setting)
        raise ProviderTokenError(
            f"{provider} sign-in is not configured on the server: set {setting}", status=503
        )
    try:
        header = jwt.get_unverified_header(token)
    except jwt.PyJWTError as exc:
        raise ProviderTokenError("not a token") from exc
    if header.get("alg") != "RS256" or not header.get("kid"):
        raise ProviderTokenError("unexpected algorithm")
    key = await jwks_cache.public_key(jwks_url, str(header["kid"]))
    try:
        payload: dict[str, Any] = jwt.decode(
            token,
            key,
            algorithms=["RS256"],
            audience=audiences,
            issuer=issuers,
            options={
                "require": ["exp", "iat", "sub", "iss", "aud"],
                "verify_iss": issuers is not None,
            },
            leeway=10,
        )
    except jwt.ExpiredSignatureError as exc:
        raise ProviderTokenError("sign-in proof expired") from exc
    except jwt.PyJWTError as exc:
        raise ProviderTokenError(f"invalid sign-in proof: {type(exc).__name__}") from exc
    return payload


def _check_nonce(payload: dict[str, Any], nonce: str | None) -> None:
    if not nonce:
        return
    claim = str(payload.get("nonce") or "")
    hashed = hashlib.sha256(nonce.encode("utf-8")).hexdigest()
    if claim not in (nonce, hashed):
        raise ProviderTokenError("nonce does not match")


async def _google(token: str, nonce: str | None, settings: Settings) -> VerifiedProviderIdentity:
    payload = await _decode(
        token,
        provider="google",
        jwks_url=GOOGLE_JWKS,
        audiences=_csv(settings.google_oauth_client_ids),
        issuers=["https://accounts.google.com", "accounts.google.com"],
    )
    _check_nonce(payload, nonce)
    email = str(payload.get("email") or "").strip() or None
    picture = str(payload.get("picture") or "")
    return VerifiedProviderIdentity(
        provider="google",
        subject=str(payload["sub"]),
        email=email,
        email_verified=bool(email) and _truthy(payload.get("email_verified")),
        display_name=str(payload.get("name") or email or "Google member")[:255],
        avatar_url=picture if picture.startswith("https://") else None,
    )


async def _apple(token: str, nonce: str | None, settings: Settings) -> VerifiedProviderIdentity:
    payload = await _decode(
        token,
        provider="apple",
        jwks_url=APPLE_JWKS,
        audiences=_csv(settings.apple_bundle_ids),
        issuers=["https://appleid.apple.com"],
    )
    _check_nonce(payload, nonce)
    email = str(payload.get("email") or "").strip() or None
    return VerifiedProviderIdentity(
        provider="apple",
        subject=str(payload["sub"]),
        email=email,
        email_verified=bool(email) and _truthy(payload.get("email_verified")),
        display_name=(email.split("@")[0] if email else "") or "Apple member",
    )


async def _microsoft(token: str, nonce: str | None, settings: Settings) -> VerifiedProviderIdentity:
    # The issuer carries the tenant id, so it is compared after the signature check, against
    # the tid claim.
    payload = await _decode(
        token,
        provider="aad",
        jwks_url=MICROSOFT_JWKS,
        audiences=_csv(settings.azure_client_ids),
        issuers=None,
    )
    tenant = str(payload.get("tid") or "")
    if not tenant or payload.get("iss") != f"https://login.microsoftonline.com/{tenant}/v2.0":
        raise ProviderTokenError("unexpected issuer")
    _check_nonce(payload, nonce)
    subject = str(payload.get("oid") or payload["sub"])
    email = next(
        (
            str(payload[name]).strip()
            for name in ("email", "preferred_username", "upn")
            if "@" in str(payload.get(name) or "")
        ),
        None,
    )
    # Microsoft does not promise that an e-mail claim was verified. Trust it only for tenants we run
    # ourselves or when the owner-verified-domain claim says so.
    verified = bool(email) and (
        _truthy(payload.get("xms_edov")) or tenant in _csv(settings.member_trusted_ms_tenants)
    )
    return VerifiedProviderIdentity(
        provider="aad",
        subject=subject,
        email=email,
        email_verified=verified,
        display_name=str(payload.get("name") or email or "Microsoft member")[:255],
    )


async def verify_provider_token(
    provider: str,
    *,
    id_token: str | None,
    nonce: str | None,
    settings: Settings | None = None,
) -> VerifiedProviderIdentity:
    settings = settings or get_settings()
    if provider not in SUPPORTED:
        raise ProviderTokenError("unknown provider", status=422)
    if not id_token or len(id_token) > 8192:
        raise ProviderTokenError("an id token is required", status=422)
    if provider == "google":
        return await _google(id_token, nonce, settings)
    if provider == "apple":
        return await _apple(id_token, nonce, settings)
    return await _microsoft(id_token, nonce, settings)
