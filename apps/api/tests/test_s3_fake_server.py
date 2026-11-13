"""S3 / R2 storage against a stand-in bucket that checks the signature like the real one does.

The older tests in test_recordings.py only check that a signature is *present*. Here the fake
server recomputes it from the request (secret key, date, expiry, signed headers) and answers 403
when it does not match, so a wrong key, a changed URL, an expired link or a different Content-Type
is caught.
Everything the storage needs comes from settings (env names in docs/storage.md).
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from pathlib import Path
from urllib.parse import parse_qs
from uuid import uuid4

import httpx
import pytest

from app.config import Settings
from app.services.recording_storage import (
    S3Storage,
    StorageError,
    get_recording_storage,
    new_key,
    presign_s3_url,
)

ENDPOINT = "https://acct.r2.cloudflarestorage.com"
BUCKET = "prabhat-recordings"
ACCESS = "AKIATESTKEY"
SECRET = "test-secret-not-real"  # noqa: S105


class FakeBucket:
    """Path-style bucket (R2, MinIO) that verifies Signature V4 query-string signing."""

    def __init__(self, *, secret: str = SECRET) -> None:
        self.secret = secret
        self.objects: dict[str, tuple[bytes, str]] = {}
        self.clock = datetime.now(UTC)
        self.calls: list[tuple[str, int]] = []

    def transport(self) -> httpx.MockTransport:
        return httpx.MockTransport(self._handle)

    def _verify(self, request: httpx.Request) -> str | None:
        query = {k: v[0] for k, v in parse_qs(request.url.query.decode()).items()}
        try:
            stamp = datetime.strptime(query["X-Amz-Date"], "%Y%m%dT%H%M%SZ").replace(tzinfo=UTC)
            lifetime = int(query["X-Amz-Expires"])
        except (KeyError, ValueError):
            return "missing signing fields"
        if self.clock > stamp + timedelta(seconds=lifetime):
            return "expired"
        if query.get("X-Amz-Credential", "").split("/")[0] != ACCESS:
            return "unknown access key"
        signed = query.get("X-Amz-SignedHeaders", "").split(";")
        extra = {name: request.headers.get(name, "") for name in signed if name != "host"}
        path = request.url.path.removeprefix(f"/{BUCKET}/")
        expected = presign_s3_url(
            method=request.method,
            endpoint=f"{request.url.scheme}://{request.url.host}",
            bucket=BUCKET,
            key=path,
            access_key_id=ACCESS,
            secret_access_key=self.secret,
            region=query["X-Amz-Credential"].split("/")[2],
            expires_in=lifetime,
            now=stamp,
            signed_headers=extra,
        )
        if parse_qs(expected.split("?", 1)[1])["X-Amz-Signature"][0] != query.get(
            "X-Amz-Signature"
        ):
            return "signature mismatch"
        return None

    def _handle(self, request: httpx.Request) -> httpx.Response:
        problem = self._verify(request)
        if problem:
            self.calls.append((request.method, 403))
            return httpx.Response(403, text=problem)
        key = request.url.path.removeprefix(f"/{BUCKET}/")
        if request.method == "PUT":
            self.objects[key] = (request.content, request.headers.get("content-type", ""))
            self.calls.append(("PUT", 200))
            return httpx.Response(200)
        if key not in self.objects:
            self.calls.append((request.method, 404))
            return httpx.Response(404)
        body, kind = self.objects[key]
        if request.method == "DELETE":
            del self.objects[key]
            return httpx.Response(204)
        headers = {"content-length": str(len(body)), "content-type": kind}
        self.calls.append((request.method, 200))
        if request.method == "HEAD":
            return httpx.Response(200, headers=headers)
        return httpx.Response(200, content=body, headers=headers)


def storage_for(bucket: FakeBucket, **overrides: str) -> S3Storage:
    return S3Storage(
        endpoint=ENDPOINT,
        bucket=BUCKET,
        access_key_id=ACCESS,
        secret_access_key=overrides.get("secret", SECRET),
        region="auto",
        public_base_url="https://audio.example.org",
        transport=bucket.transport(),
    )


async def test_round_trip_store_size_download_delete(tmp_path: Path) -> None:
    bucket = FakeBucket()
    storage = storage_for(bucket)
    key = new_key(str(uuid4()), "mp3")
    source = tmp_path / "in.mp3"
    source.write_bytes(b"ID3\x04" + b"x" * 1000)

    assert await storage.size(key) is None  # nothing there yet
    await storage.store_file(key, source, "audio/mpeg")
    assert bucket.objects[key][1] == "audio/mpeg"
    assert await storage.size(key) == 1004

    target = tmp_path / "out.mp3"
    await storage.materialize(key, target)
    assert target.read_bytes() == source.read_bytes()

    await storage.delete(key)
    assert await storage.size(key) is None
    await storage.delete(key)  # deleting what is already gone is not an error


async def test_a_wrong_secret_key_is_refused_by_the_bucket(tmp_path: Path) -> None:
    bucket = FakeBucket()  # the bucket knows the real secret
    wrong = storage_for(bucket, secret="some-other-secret")  # noqa: S106
    source = tmp_path / "in.mp3"
    source.write_bytes(b"ID3\x04data")
    with pytest.raises(StorageError, match="403"):
        await wrong.store_file(new_key(str(uuid4()), "mp3"), source, "audio/mpeg")
    assert bucket.objects == {}


async def test_an_expired_link_is_refused() -> None:
    bucket = FakeBucket()
    storage = storage_for(bucket)
    bucket.clock = datetime.now(UTC) + timedelta(hours=1)  # size() links live for 120 seconds
    with pytest.raises(StorageError, match="403"):
        await storage.size(new_key(str(uuid4()), "mp3"))


async def test_the_member_upload_link_only_accepts_the_declared_content_type() -> None:
    bucket = FakeBucket()
    storage = storage_for(bucket)
    key = new_key(str(uuid4()), "mp3")
    target = storage.presign_upload(key, "audio/mpeg", max_bytes=10, expires_in=600)
    async with httpx.AsyncClient(transport=bucket.transport()) as client:
        wrong = await client.put(target.url, content=b"x", headers={"Content-Type": "text/html"})
        assert wrong.status_code == 403, "the content type is part of the signature"
        right = await client.put(target.url, content=b"x", headers=target.headers)
        assert right.status_code == 200
        # a link signed for PUT cannot be used to delete
        assert (await client.delete(target.url)).status_code == 403


async def test_a_changed_key_in_a_signed_link_is_refused() -> None:
    bucket = FakeBucket()
    storage = storage_for(bucket)
    key = new_key(str(uuid4()), "mp3")
    other = new_key(str(uuid4()), "mp3")
    target = storage.presign_upload(key, "audio/mpeg", max_bytes=10, expires_in=600)
    forged = target.url.replace(key, other)
    async with httpx.AsyncClient(transport=bucket.transport()) as client:
        response = await client.put(forged, content=b"x", headers=target.headers)
    assert response.status_code == 403
    assert bucket.objects == {}


def _settings(**values: str | None) -> Settings:
    base: dict[str, str | None] = {
        "RECORDING_STORAGE_BACKEND": "s3",
        "RECORDING_S3_ENDPOINT": ENDPOINT,
        "RECORDING_S3_BUCKET": BUCKET,
        "RECORDING_S3_REGION": "auto",
        "RECORDING_S3_ACCESS_KEY_ID": ACCESS,
        "RECORDING_S3_SECRET_ACCESS_KEY": SECRET,
        "RECORDING_PUBLIC_BASE_URL": "https://audio.example.org/",
    }
    base.update(values)
    return Settings(_env_file=None, **{k: v for k, v in base.items() if v is not None})  # type: ignore[arg-type]


def test_every_value_comes_from_settings_with_the_documented_names() -> None:
    storage = get_recording_storage(_settings())
    assert isinstance(storage, S3Storage)
    assert (storage.endpoint, storage.bucket, storage.access_key_id) == (ENDPOINT, BUCKET, ACCESS)
    assert storage.secret_access_key == SECRET
    key = new_key(str(uuid4()), "mp3")
    assert storage.public_url(key) == f"https://audio.example.org/{key}"
    link = storage.presign_upload(key, "audio/mpeg", max_bytes=1, expires_in=60).url
    assert link.startswith(f"{ENDPOINT}/{BUCKET}/{key}?")
    assert SECRET not in link


@pytest.mark.parametrize(
    "name",
    [
        "RECORDING_S3_ENDPOINT",
        "RECORDING_S3_BUCKET",
        "RECORDING_S3_ACCESS_KEY_ID",
        "RECORDING_S3_SECRET_ACCESS_KEY",
        "RECORDING_PUBLIC_BASE_URL",
    ],
)
def test_a_missing_value_is_named_in_the_error(name: str) -> None:
    with pytest.raises(StorageError, match=name):
        get_recording_storage(_settings(**{name: None}))
