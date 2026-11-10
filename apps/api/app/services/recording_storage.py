"""Where the audio files of recordings live.

One small interface, two adapters:

* `LocalDiskStorage` for development and tests: files under `RECORDING_LOCAL_DIR`, uploaded to this
  API through a short-lived signed token (`PUT /api/v1/recordings/uploads/{token}`), served by
  `GET /api/v1/recordings/media/{key}`.
* `S3Storage` for Cloudflare R2 or any S3-compatible bucket: the phone uploads straight to the
  bucket with a presigned PUT URL (AWS Signature V4 in the query string, written here with the
  standard library so no SDK is needed). The API never carries the audio bytes in production. It
  reads the object back through a presigned GET to hash it, fingerprint it and check its type.

No credential is stored in the repository: everything comes from `RECORDING_*` settings
(docs/kiirtan-publishing.md).
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import re
import shutil
import time
from collections.abc import Mapping
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Protocol
from urllib.parse import quote, urlsplit
from uuid import uuid4

import httpx

from app.config import Settings, get_settings


class StorageError(Exception):
    """The storage backend is missing, misconfigured or refused the request."""


@dataclass(frozen=True)
class UploadTarget:
    """What the phone needs: send `method` to `url` with `headers` and the raw bytes."""

    key: str
    method: str
    url: str
    headers: dict[str, str]
    expires_at: datetime
    max_bytes: int


class RecordingStorage(Protocol):
    name: str

    def presign_upload(
        self, key: str, content_type: str, *, max_bytes: int, expires_in: int
    ) -> UploadTarget: ...

    async def size(self, key: str) -> int | None:
        """Size in bytes of the stored object, or None when it is not there."""
        ...

    async def materialize(self, key: str, destination: Path) -> None:
        """Copy the object to a local file (for hashing, sniffing and fingerprinting)."""
        ...

    async def delete(self, key: str) -> None: ...

    async def store_file(self, key: str, source: Path, content_type: str) -> None:
        """Put a local file at `key` (the bulk import; the phone uploads with a presigned URL)."""
        ...

    def public_url(self, key: str) -> str: ...


# --------------------------------------------------------------------------- keys and formats

AUDIO_TYPES: dict[str, str] = {
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/mp4": "m4a",
    "audio/x-m4a": "m4a",
    "audio/m4a": "m4a",
    "audio/aac": "aac",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/wave": "wav",
    "audio/ogg": "ogg",
    "audio/flac": "flac",
    "audio/webm": "webm",
}
KEY_PATTERN = re.compile(
    r"^recordings/[0-9a-f-]{36}/[0-9a-f-]{36}\.(mp3|m4a|aac|wav|ogg|flac|webm)$"
)


def extension_for(content_type: str) -> str | None:
    return AUDIO_TYPES.get(content_type.split(";")[0].strip().lower())


def new_key(member_id: str, extension: str) -> str:
    """`recordings/<member id>/<random id>.<ext>`; the member id says whose file it is."""
    return f"recordings/{member_id}/{uuid4()}.{extension}"


def key_belongs_to(key: str, member_id: str) -> bool:
    return bool(KEY_PATTERN.fullmatch(key)) and key.split("/")[1] == member_id


def sniff_audio(head: bytes) -> str | None:
    """The audio format named by the first bytes of a file, or None when it is not audio."""
    if head.startswith(b"ID3"):
        return "mp3"
    if len(head) >= 2 and head[0] == 0xFF and (head[1] & 0xE0) == 0xE0:
        return "aac" if (head[1] & 0xF6) == 0xF0 else "mp3"
    if len(head) >= 12 and head[4:8] == b"ftyp":
        return "m4a"
    if len(head) >= 12 and head[:4] == b"RIFF" and head[8:12] == b"WAVE":
        return "wav"
    if head.startswith(b"OggS"):
        return "ogg"
    if head.startswith(b"fLaC"):
        return "flac"
    if head.startswith(b"\x1a\x45\xdf\xa3"):
        return "webm"
    return None


# --------------------------------------------------------------------------- local disk


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _unb64(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def sign_upload_token(
    secret: str, *, key: str, content_type: str, max_bytes: int, expires_at: int
) -> str:
    body = _b64(
        json.dumps(
            {"k": key, "c": content_type, "m": max_bytes, "e": expires_at}, separators=(",", ":")
        ).encode()
    )
    mac = _b64(hmac.new(secret.encode(), body.encode(), hashlib.sha256).digest())
    return f"{body}.{mac}"


def verify_upload_token(secret: str, token: str, *, now: float | None = None) -> dict[str, object]:
    try:
        body, mac = token.split(".", 1)
        expected = _b64(hmac.new(secret.encode(), body.encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(mac, expected):
            raise StorageError("Upload link is not valid")
        data = json.loads(_unb64(body))
    except (ValueError, json.JSONDecodeError) as exc:
        raise StorageError("Upload link is not valid") from exc
    if not isinstance(data, dict) or float(data.get("e", 0)) < (
        now if now is not None else time.time()
    ):
        raise StorageError("Upload link has expired")
    return data


@dataclass
class LocalDiskStorage:
    base_dir: Path
    api_base_url: str
    secret: str
    name: str = "local"

    def path_for(self, key: str) -> Path:
        if not KEY_PATTERN.fullmatch(key):
            raise StorageError("Invalid storage key")
        return self.base_dir / key

    def presign_upload(
        self, key: str, content_type: str, *, max_bytes: int, expires_in: int
    ) -> UploadTarget:
        expires = int(time.time()) + expires_in
        token = sign_upload_token(
            self.secret, key=key, content_type=content_type, max_bytes=max_bytes, expires_at=expires
        )
        return UploadTarget(
            key=key,
            method="PUT",
            url=f"{self.api_base_url.rstrip('/')}/api/v1/recordings/uploads/{token}",
            headers={"Content-Type": content_type},
            expires_at=datetime.fromtimestamp(expires, UTC),
            max_bytes=max_bytes,
        )

    def write(self, key: str, data: bytes) -> None:
        target = self.path_for(key)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)

    async def size(self, key: str) -> int | None:
        path = self.path_for(key)
        return path.stat().st_size if path.is_file() else None

    async def materialize(self, key: str, destination: Path) -> None:
        source = self.path_for(key)
        if not source.is_file():
            raise StorageError("Object not found")
        shutil.copyfile(source, destination)

    async def delete(self, key: str) -> None:
        self.path_for(key).unlink(missing_ok=True)

    async def store_file(self, key: str, source: Path, content_type: str) -> None:
        target = self.path_for(key)
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, target)

    def public_url(self, key: str) -> str:
        return f"{self.api_base_url.rstrip('/')}/api/v1/recordings/media/{key}"


# --------------------------------------------------------------------------- S3 / R2 (Signature V4)

ISO_FORMAT = "%Y%m%dT%H%M%SZ"


def _hmac(key: bytes, message: str) -> bytes:
    return hmac.new(key, message.encode("utf-8"), hashlib.sha256).digest()


def _quote(value: str) -> str:
    return quote(value, safe="-_.~")


def presign_s3_url(
    *,
    method: str,
    endpoint: str,
    bucket: str,
    key: str,
    access_key_id: str,
    secret_access_key: str,
    region: str,
    expires_in: int,
    now: datetime | None = None,
    signed_headers: Mapping[str, str] | None = None,
    path_style: bool = True,
    service: str = "s3",
) -> str:
    """A presigned URL (AWS Signature V4, parameters in the query string).

    `signed_headers` are extra headers the caller must send with exactly these values (for example
    `content-type`); `host` is always signed. `path_style=True` gives
    `https://endpoint/bucket/key` (R2 and MinIO);
    False gives `https://bucket.endpoint/key`.
    """
    moment = (now or datetime.now(UTC)).astimezone(UTC)
    stamp = moment.strftime(ISO_FORMAT)
    day = stamp[:8]
    parts = urlsplit(endpoint)
    host = parts.netloc if path_style else f"{bucket}.{parts.netloc}"
    path = f"/{bucket}/{key}" if path_style else f"/{key}"
    canonical_path = quote(path, safe="/-_.~")
    headers = {"host": host, **{k.lower(): v.strip() for k, v in (signed_headers or {}).items()}}
    header_names = ";".join(sorted(headers))
    scope = f"{day}/{region}/{service}/aws4_request"
    query = {
        "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
        "X-Amz-Credential": f"{access_key_id}/{scope}",
        "X-Amz-Date": stamp,
        "X-Amz-Expires": str(expires_in),
        "X-Amz-SignedHeaders": header_names,
    }
    canonical_query = "&".join(f"{_quote(k)}={_quote(v)}" for k, v in sorted(query.items()))
    canonical_headers = "".join(f"{name}:{headers[name]}\n" for name in sorted(headers))
    canonical_request = "\n".join(
        [
            method,
            canonical_path,
            canonical_query,
            canonical_headers,
            header_names,
            "UNSIGNED-PAYLOAD",
        ]
    )
    to_sign = "\n".join(
        [
            "AWS4-HMAC-SHA256",
            stamp,
            scope,
            hashlib.sha256(canonical_request.encode("utf-8")).hexdigest(),
        ]
    )
    signing_key = _hmac(
        _hmac(_hmac(_hmac(("AWS4" + secret_access_key).encode("utf-8"), day), region), service),
        "aws4_request",
    )
    signature = hmac.new(signing_key, to_sign.encode("utf-8"), hashlib.sha256).hexdigest()
    return f"{parts.scheme}://{host}{canonical_path}?{canonical_query}&X-Amz-Signature={signature}"


@dataclass
class S3Storage:
    endpoint: str
    bucket: str
    access_key_id: str
    secret_access_key: str
    region: str = "auto"
    public_base_url: str | None = None
    name: str = "s3"
    timeout: float = 60.0
    transport: httpx.AsyncBaseTransport | None = field(default=None, repr=False)

    def _url(
        self,
        method: str,
        key: str,
        expires_in: int,
        signed_headers: Mapping[str, str] | None = None,
    ) -> str:
        if not KEY_PATTERN.fullmatch(key):
            raise StorageError("Invalid storage key")
        return presign_s3_url(
            method=method,
            endpoint=self.endpoint,
            bucket=self.bucket,
            key=key,
            access_key_id=self.access_key_id,
            secret_access_key=self.secret_access_key,
            region=self.region,
            expires_in=expires_in,
            signed_headers=signed_headers,
        )

    def presign_upload(
        self, key: str, content_type: str, *, max_bytes: int, expires_in: int
    ) -> UploadTarget:
        url = self._url("PUT", key, expires_in, {"content-type": content_type})
        return UploadTarget(
            key=key,
            method="PUT",
            url=url,
            headers={"Content-Type": content_type},
            expires_at=datetime.fromtimestamp(time.time() + expires_in, UTC),
            max_bytes=max_bytes,
        )

    async def _request(self, method: str, url: str) -> httpx.Response:
        try:
            async with httpx.AsyncClient(timeout=self.timeout, transport=self.transport) as client:
                return await client.request(method, url)
        except httpx.HTTPError as exc:
            raise StorageError("Storage is not reachable") from exc

    async def size(self, key: str) -> int | None:
        response = await self._request("HEAD", self._url("HEAD", key, 120))
        if response.status_code == 404:
            return None
        if response.status_code >= 400:
            raise StorageError(f"Storage refused the request ({response.status_code})")
        return int(response.headers.get("content-length", "0"))

    async def materialize(self, key: str, destination: Path) -> None:
        url = self._url("GET", key, 300)
        try:
            async with httpx.AsyncClient(timeout=self.timeout, transport=self.transport) as client:
                async with client.stream("GET", url) as response:
                    if response.status_code == 404:
                        raise StorageError("Object not found")
                    if response.status_code >= 400:
                        raise StorageError(f"Storage refused the request ({response.status_code})")
                    with destination.open("wb") as handle:
                        async for chunk in response.aiter_bytes():
                            handle.write(chunk)
        except httpx.HTTPError as exc:
            raise StorageError("Storage is not reachable") from exc

    async def delete(self, key: str) -> None:
        response = await self._request("DELETE", self._url("DELETE", key, 120))
        if response.status_code >= 400 and response.status_code != 404:
            raise StorageError(f"Storage refused the request ({response.status_code})")

    async def store_file(self, key: str, source: Path, content_type: str) -> None:
        url = self._url("PUT", key, 900, {"content-type": content_type})
        data = source.read_bytes()
        try:
            async with httpx.AsyncClient(timeout=self.timeout, transport=self.transport) as client:
                response = await client.put(
                    url, content=data, headers={"Content-Type": content_type}
                )
        except httpx.HTTPError as exc:
            raise StorageError("Storage is not reachable") from exc
        if response.status_code >= 400:
            raise StorageError(f"Storage refused the upload ({response.status_code})")

    def public_url(self, key: str) -> str:
        if not self.public_base_url:
            raise StorageError("RECORDING_PUBLIC_BASE_URL is not configured")
        return f"{self.public_base_url.rstrip('/')}/{key}"


# --------------------------------------------------------------------------- factory


def get_recording_storage(settings: Settings | None = None) -> RecordingStorage:
    settings = settings or get_settings()
    backend = settings.recording_storage_backend.lower()
    if backend == "local":
        # The shared app key (MEMBER_PROXY_KEY) ships inside every app, so it must not sign links
        # in production. Order: own secret, then the server-only session secret, then (dev, or an
        # explicit RECORDING_SIGNING_ALLOW_PROXY_KEY) the shared key.
        secret = (
            settings.recording_signing_secret
            or settings.member_session_secret
            or (
                settings.member_proxy_key
                if settings.app_env != "production" or settings.recording_signing_allow_proxy_key
                else None
            )
        )
        if not secret:
            if settings.app_env == "production":
                raise StorageError("RECORDING_SIGNING_SECRET is required for local storage")
            secret = "dev-only-recording-secret"  # noqa: S105  (never used when APP_ENV=production)
        return LocalDiskStorage(
            base_dir=Path(settings.recording_local_dir).resolve(),
            api_base_url=settings.next_public_api_base_url,
            secret=secret,
        )
    if backend == "s3":
        missing = [
            name
            for name, value in (
                ("RECORDING_S3_ENDPOINT", settings.recording_s3_endpoint),
                ("RECORDING_S3_BUCKET", settings.recording_s3_bucket),
                ("RECORDING_S3_ACCESS_KEY_ID", settings.recording_s3_access_key_id),
                ("RECORDING_S3_SECRET_ACCESS_KEY", settings.recording_s3_secret_access_key),
                # Stored in the database as the recording's address, so publishing cannot work
                # without it. Better to stop at start than after the file is already uploaded.
                ("RECORDING_PUBLIC_BASE_URL", settings.recording_public_base_url),
            )
            if not value
        ]
        if missing:
            raise StorageError("Recording storage is not configured: " + ", ".join(missing))
        assert settings.recording_s3_endpoint and settings.recording_s3_bucket  # for mypy
        assert settings.recording_s3_access_key_id and settings.recording_s3_secret_access_key
        return S3Storage(
            endpoint=settings.recording_s3_endpoint,
            bucket=settings.recording_s3_bucket,
            access_key_id=settings.recording_s3_access_key_id,
            secret_access_key=settings.recording_s3_secret_access_key,
            region=settings.recording_s3_region,
            public_base_url=settings.recording_public_base_url,
        )
    raise StorageError(f"Unknown RECORDING_STORAGE_BACKEND: {backend}")
