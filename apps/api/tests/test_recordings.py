"""Kiirtan / Bhajan recordings: publish at once, duplicates, reports, blocks, takedown.

The API runs against an in-memory SQLite database and the local disk storage. Postgres-only
behaviour (JSONB, the migration against a real server) is not covered here.
"""

from __future__ import annotations

import os
import stat
import time
from collections.abc import AsyncIterator
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, cast
from uuid import UUID, uuid4

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://test:test@localhost/test")

import httpx
import numpy as np
import pytest
import pytest_asyncio
from fastapi import FastAPI, HTTPException, Request
from sqlalchemy import Select, Table, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.api.v1 import recordings as api
from app.config import Settings, get_settings
from app.core.db import get_session
from app.core.middleware import RequestContextMiddleware
from app.core.security import require_admin
from app.models import Base, UserAccount
from app.models.recordings import AuthorBlock, MemberNotice, Recording, RecordingReport
from app.services import recording_fingerprint as fingerprints
from app.services import recordings as service
from app.services.recording_storage import (
    LocalDiskStorage,
    S3Storage,
    StorageError,
    extension_for,
    get_recording_storage,
    key_belongs_to,
    new_key,
    presign_s3_url,
    sign_upload_token,
    sniff_audio,
    verify_upload_token,
)

TERMS = "t-1"


def make_settings(**values: object) -> Settings:
    """Settings by field name (the fields are declared with upper-case env aliases)."""
    return Settings.model_validate({key.upper(): value for key, value in values.items()})


# --------------------------------------------------------------------------- pure helpers


def test_presigned_url_matches_the_aws_documentation_example() -> None:
    url = presign_s3_url(
        method="GET",
        endpoint="https://s3.amazonaws.com",
        bucket="examplebucket",
        key="test.txt",
        access_key_id="AKIAIOSFODNN7EXAMPLE",
        secret_access_key="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
        region="us-east-1",
        expires_in=86400,
        now=datetime(2013, 5, 24, tzinfo=UTC),
        path_style=False,
    )
    assert url.endswith(
        "X-Amz-Signature=aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404"
    )
    assert url.startswith("https://examplebucket.s3.amazonaws.com/test.txt?")


def test_presigned_put_signs_the_content_type_and_never_carries_the_secret() -> None:
    url = presign_s3_url(
        method="PUT",
        endpoint="https://acct.r2.cloudflarestorage.com",
        bucket="kiirtan",
        key="recordings/a/b.mp3",
        access_key_id="AK",
        secret_access_key="SECRET-VALUE",
        region="auto",
        expires_in=900,
        signed_headers={"content-type": "audio/mpeg"},
    )
    assert "/kiirtan/recordings/a/b.mp3?" in url
    assert "X-Amz-SignedHeaders=content-type%3Bhost" in url
    assert "SECRET-VALUE" not in url


def test_upload_token_roundtrip_expiry_and_tamper() -> None:
    token = sign_upload_token(
        "s", key="k", content_type="audio/mpeg", max_bytes=10, expires_at=2000
    )
    assert verify_upload_token("s", token, now=1000)["k"] == "k"
    with pytest.raises(StorageError, match="expired"):
        verify_upload_token("s", token, now=3000)
    with pytest.raises(StorageError):
        verify_upload_token("other", token, now=1000)
    body, mac = token.split(".")
    with pytest.raises(StorageError):
        verify_upload_token("s", body + "x." + mac, now=1000)


def test_sniff_audio_and_extension_and_key_ownership() -> None:
    assert sniff_audio(b"ID3\x04" + bytes(12)) == "mp3"
    assert sniff_audio(b"\xff\xfb\x90\x00" + bytes(12)) == "mp3"
    assert sniff_audio(b"\xff\xf1\x50\x80" + bytes(12)) == "aac"
    assert sniff_audio(b"\x00\x00\x00\x20ftypM4A " + bytes(8)) == "m4a"
    assert sniff_audio(b"RIFF\x00\x00\x00\x00WAVEfmt ") == "wav"
    assert sniff_audio(b"OggS" + bytes(12)) == "ogg"
    assert sniff_audio(b"fLaC" + bytes(12)) == "flac"
    assert sniff_audio(b"%PDF-1.7" + bytes(8)) is None
    assert sniff_audio(b"MZ" + bytes(14)) is None
    assert extension_for("audio/mpeg; charset=x") == "mp3"
    assert extension_for("video/mp4") is None
    member = str(uuid4())
    key = new_key(member, "mp3")
    assert key_belongs_to(key, member)
    assert not key_belongs_to(key, str(uuid4()))
    assert not key_belongs_to("recordings/../../etc/passwd", member)


def test_fingerprint_roundtrip_and_similarity() -> None:
    rng = np.random.default_rng(1)
    a = rng.integers(0, 2**32, 300, dtype=np.uint64).astype(np.uint32)
    assert np.array_equal(fingerprints.decode_fingerprint(fingerprints.encode_fingerprint(a)), a)
    assert fingerprints.similarity(a, a) == 1.0
    unrelated = rng.integers(0, 2**32, 300, dtype=np.uint64).astype(np.uint32)
    assert fingerprints.similarity(a, unrelated) < 0.6
    shifted = np.concatenate([np.zeros(5, dtype=np.uint32), a])
    assert fingerprints.similarity(a, shifted) > 0.95
    assert fingerprints.similarity(a, np.array([], dtype=np.uint32)) == 0.0


def make_fake_fpcalc(folder: Path) -> Path:
    """A stand-in for Chromaprint: the file says its fingerprint (`FP=<seed>;NOISE=<percent>;`)."""
    script = folder / "fpcalc"
    script.write_text(
        "#!/usr/bin/env python3\n"
        "import json, random, re, sys\n"
        "data = open(sys.argv[-1], 'rb').read()\n"
        "m = re.search(rb'FP=(\\d+);(?:NOISE=(\\d+);)?', data)\n"
        "if not m:\n"
        "    sys.exit(2)\n"
        "seed = int(m.group(1)); noise = int(m.group(2) or 0)\n"
        "r = random.Random(seed)\n"
        "values = [r.getrandbits(32) for _ in range(240)]\n"
        "n = random.Random(seed + 1000)\n"
        "if noise:\n"
        "    flips = noise * 32 // 100 or 1\n"
        "    values = [v ^ sum(1 << n.randrange(32) for _ in range(flips)) for v in values]\n"
        "print(json.dumps({'duration': 123.4, 'fingerprint': values}))\n"
    )
    script.chmod(script.stat().st_mode | stat.S_IEXEC)
    return script


async def test_compute_fingerprint_with_and_without_fpcalc(tmp_path: Path) -> None:
    audio = tmp_path / "a.mp3"
    audio.write_bytes(b"ID3\x04FP=7;" + bytes(20))
    assert await fingerprints.compute_fingerprint(audio, "definitely-not-installed") is None
    result = await fingerprints.compute_fingerprint(audio, str(make_fake_fpcalc(tmp_path)))
    assert result is not None
    assert result.duration_sec == 123
    assert len(fingerprints.decode_fingerprint(result.data)) == 240
    broken = tmp_path / "b.mp3"
    broken.write_bytes(b"ID3\x04 no fingerprint here")
    assert await fingerprints.compute_fingerprint(broken, str(tmp_path / "fpcalc")) is None


def test_storage_factory(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    local = get_recording_storage(
        make_settings(recording_local_dir=str(tmp_path), recording_signing_secret="s")
    )
    assert isinstance(local, LocalDiskStorage)
    with pytest.raises(StorageError, match="RECORDING_S3_BUCKET"):
        get_recording_storage(
            make_settings(recording_storage_backend="s3", recording_s3_endpoint="https://x")
        )
    s3 = get_recording_storage(
        make_settings(
            recording_storage_backend="s3",
            recording_s3_endpoint="https://x.r2.cloudflarestorage.com",
            recording_s3_bucket="b",
            recording_s3_access_key_id="k",
            recording_s3_secret_access_key="s",
            recording_public_base_url="https://cdn.example/",
        )
    )
    assert isinstance(s3, S3Storage)
    key = new_key(str(uuid4()), "mp3")
    assert s3.public_url(key) == f"https://cdn.example/{key}"
    assert "X-Amz-Signature" in s3.presign_upload(key, "audio/mpeg", max_bytes=1, expires_in=60).url
    with pytest.raises(StorageError, match="Unknown"):
        get_recording_storage(make_settings(recording_storage_backend="ftp"))
    with pytest.raises(StorageError, match="SIGNING_SECRET"):
        get_recording_storage(
            make_settings(
                app_env="production", recording_local_dir=str(tmp_path), member_proxy_key=None
            )
        )


async def test_s3_storage_talks_to_the_bucket_with_presigned_urls() -> None:
    seen: list[tuple[str, str]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append((request.method, request.url.path))
        assert "X-Amz-Signature" in str(request.url)
        if request.method == "HEAD":
            return httpx.Response(200, headers={"content-length": "42"})
        if request.method == "GET":
            return httpx.Response(200, content=b"ID3\x04hello")
        return httpx.Response(204)

    storage = S3Storage(
        endpoint="https://x.r2.cloudflarestorage.com",
        bucket="b",
        access_key_id="k",
        secret_access_key="s",
        transport=httpx.MockTransport(handler),
    )
    key = new_key(str(uuid4()), "mp3")
    assert await storage.size(key) == 42
    assert (await storage.size(key)) is not None
    await storage.delete(key)
    assert [m for m, _ in seen] == ["HEAD", "HEAD", "DELETE"]


async def test_s3_storage_downloads_to_a_file(tmp_path: Path) -> None:
    storage = S3Storage(
        endpoint="https://x.r2.cloudflarestorage.com",
        bucket="b",
        access_key_id="k",
        secret_access_key="s",
        transport=httpx.MockTransport(lambda r: httpx.Response(200, content=b"ID3\x04data")),
    )
    target = tmp_path / "out"
    await storage.materialize(new_key(str(uuid4()), "mp3"), target)
    assert target.read_bytes() == b"ID3\x04data"
    missing = S3Storage(
        endpoint="https://x",
        bucket="b",
        access_key_id="k",
        secret_access_key="s",
        transport=httpx.MockTransport(lambda r: httpx.Response(404)),
    )
    with pytest.raises(StorageError):
        await missing.materialize(new_key(str(uuid4()), "mp3"), target)


async def test_upload_size_limit_is_lifted_only_for_the_local_upload_path() -> None:
    app = FastAPI()
    app.add_middleware(RequestContextMiddleware, max_request_bytes=1024)

    @app.put("/api/v1/recordings/uploads/{token}")
    async def upload(token: str, request: Request) -> dict[str, int]:
        return {"n": len(await request.body())}

    @app.post("/other")
    async def other(request: Request) -> dict[str, int]:
        return {"n": len(await request.body())}

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://t") as c:
        big = b"x" * 5000
        assert (await c.put("/api/v1/recordings/uploads/tok", content=big)).status_code == 200
        assert (await c.post("/other", content=big)).status_code == 413


def test_the_migration_follows_the_last_one_and_registers_the_tables() -> None:
    from alembic.config import Config
    from alembic.script import ScriptDirectory

    config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    script = ScriptDirectory.from_config(config)
    revision = script.get_revision("0027_recordings")
    assert revision is not None
    assert revision.down_revision == "0026_google_translate_quota_alert"
    assert {"recordings", "recording_reports", "recording_author_blocks", "member_notices"} <= set(
        Base.metadata.tables
    )


# --------------------------------------------------------------------------- API on SQLite

MEMBER_A = UUID("00000000-0000-0000-0000-00000000000a")
MEMBER_B = UUID("00000000-0000-0000-0000-00000000000b")


class World:
    def __init__(
        self,
        client: httpx.AsyncClient,
        sessions: async_sessionmaker[AsyncSession],
        storage: LocalDiskStorage,
        settings: Settings,
    ) -> None:
        self.client = client
        self.sessions = sessions
        self.storage = storage
        self.settings = settings

    async def upload(
        self,
        who: str,
        data: bytes,
        *,
        content_type: str = "audio/mpeg",
        size: int | None = None,
    ) -> str:
        """Ask for a target, send the bytes to it; returns the storage key."""
        response = await self.client.post(
            "/api/v1/recordings/uploads",
            headers={"X-Test-Member": who},
            json={
                "file_name": "x.mp3",
                "content_type": content_type,
                "size_bytes": size or len(data),
            },
        )
        assert response.status_code == 201, response.text
        target = response.json()
        path = target["url"].split("://", 1)[1].split("/", 1)[1]
        put = await self.client.put("/" + path, content=data, headers=target["headers"])
        assert put.status_code == 204, put.text
        return str(target["key"])

    def body(self, key: str, **overrides: object) -> dict[str, object]:
        base: dict[str, object] = {
            "key": key,
            "kind": "kiirtan",
            "title": "Baba Nam Kevalam",
            "author": "Sample group",
            "by_author": True,
            "terms_accepted": True,
            "terms_version": TERMS,
        }
        base.update(overrides)
        return base

    async def publish(self, who: str, data: bytes, **overrides: object) -> httpx.Response:
        key = await self.upload(who, data)
        return await self.client.post(
            "/api/v1/recordings", headers={"X-Test-Member": who}, json=self.body(key, **overrides)
        )

    async def scalar(self, statement: Select[Any]) -> Any:
        async with self.sessions() as session:
            return await session.scalar(statement)


def mp3(seed: int = 0, extra: bytes = b"") -> bytes:
    """Distinct fake MP3 bytes. `FP=<seed>;` is what the fake fpcalc fingerprints."""
    return b"ID3\x04" + f"FP={seed};".encode() + extra + os.urandom(16)


@pytest_asyncio.fixture
async def world(tmp_path: Path) -> AsyncIterator[World]:
    engine = create_async_engine(
        "sqlite+aiosqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False}
    )
    tables = [
        cast(Table, m.__table__)
        for m in (UserAccount, Recording, RecordingReport, AuthorBlock, MemberNotice)
    ]
    async with engine.begin() as conn:
        await conn.run_sync(lambda c: Base.metadata.create_all(c, tables=tables))
    sessions = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    now = datetime.now(UTC)
    async with sessions() as session:
        for member_id, name in ((MEMBER_A, "Ananda"), (MEMBER_B, "Bhakti")):
            session.add(
                UserAccount(
                    id=member_id,
                    external_subject=f"test:{name}",
                    identity_provider="test",
                    display_name=name,
                    last_seen_at=now,
                )
            )
        await session.commit()

    fpcalc = make_fake_fpcalc(tmp_path)
    settings = make_settings(
        _env_file=None,
        recording_terms_version=TERMS,
        recording_max_bytes=200_000,
        recording_fpcalc_path=str(fpcalc),
        recording_flag_threshold=3,
        next_public_api_base_url="http://t",
    )
    storage = LocalDiskStorage(
        base_dir=tmp_path / "files", api_base_url="http://t", secret="secret"
    )

    app = FastAPI()
    app.include_router(api.router, prefix="/api/v1")
    app.include_router(api.admin_router, prefix="/api/v1")

    async def override_session() -> AsyncIterator[AsyncSession]:
        async with sessions() as session:
            yield session

    members = {"a": MEMBER_A, "b": MEMBER_B}

    async def member_from_header(request: Request, session: AsyncSession) -> UserAccount | None:
        who = request.headers.get("X-Test-Member")
        return await session.get(UserAccount, members[who]) if who in members else None

    async def override_member(request: Request) -> UserAccount:
        async with sessions() as session:
            member = await member_from_header(request, session)
        if member is None:
            raise HTTPException(status_code=401, detail="Sign in is required")
        return member

    async def override_optional(request: Request) -> UserAccount | None:
        async with sessions() as session:
            return await member_from_header(request, session)

    async def override_admin() -> str:
        return "api-key-admin"

    app.dependency_overrides[get_session] = override_session
    app.dependency_overrides[api.get_member] = override_member
    app.dependency_overrides[api.get_optional_member] = override_optional
    app.dependency_overrides[api.get_storage] = lambda: storage
    app.dependency_overrides[get_settings] = lambda: settings
    app.dependency_overrides[require_admin] = override_admin
    service.limiter.reset()

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://t"
    ) as client:
        yield World(client, sessions, storage, settings)
    await engine.dispose()


async def test_an_upload_is_published_at_once_and_listed(world: World) -> None:
    response = await world.publish("a", mp3(1))
    assert response.status_code == 201, response.text
    item = response.json()
    assert item["status"] == "published"
    assert item["kind"] == "kiirtan"
    assert item["author_id"] == str(MEMBER_A)
    assert item["added_by"] == "Ananda"
    assert item["audio_url"].startswith("http://t/api/v1/recordings/media/recordings/")
    row = await world.scalar(select(Recording))
    assert row is not None
    assert row.terms_accepted_at is not None
    assert row.terms_version == TERMS
    assert len(row.audio_sha256) == 64
    assert row.fingerprint is not None
    assert row.duration_sec == 123
    assert row.published_at is not None

    public = (await world.client.get("/api/v1/recordings")).json()
    assert public["total"] == 1
    assert public["items"][0]["id"] == item["id"]
    assert public["items"][0]["removed_reason"] is None
    one = await world.client.get(f"/api/v1/recordings/{item['id']}")
    assert one.status_code == 200
    media = await world.client.get(f"/api/v1/recordings/media/{row.audio_key}")
    assert media.status_code == 200 and media.content.startswith(b"ID3")


async def test_bhajan_kind_type_and_filter(world: World) -> None:
    ok = await world.publish("a", mp3(2), kind="bhajan", type="morning", title="Morning song")
    assert ok.status_code == 201
    assert ok.json()["type"] == "morning"
    wrong_type = await world.publish("a", mp3(3), kind="kiirtan", type="morning", title="x")
    assert wrong_type.json()["type"] == "other"
    only_bhajans = (await world.client.get("/api/v1/recordings", params={"kind": "bhajan"})).json()
    assert [i["title"] for i in only_bhajans["items"]] == ["Morning song"]
    found = (await world.client.get("/api/v1/recordings", params={"q": "MORNING"})).json()
    assert found["total"] == 1


async def test_sign_in_and_terms_are_required(world: World) -> None:
    anonymous = await world.client.post(
        "/api/v1/recordings/uploads",
        json={"file_name": "x.mp3", "content_type": "audio/mpeg", "size_bytes": 10},
    )
    assert anonymous.status_code == 401
    key = await world.upload("a", mp3(4))
    refused = await world.client.post(
        "/api/v1/recordings",
        headers={"X-Test-Member": "a"},
        json=world.body(key, terms_accepted=False),
    )
    assert refused.status_code == 422
    stale = await world.client.post(
        "/api/v1/recordings",
        headers={"X-Test-Member": "a"},
        json=world.body(key, terms_version="old"),
    )
    assert stale.status_code == 422
    assert await world.scalar(select(Recording)) is None


async def test_validation_of_type_size_and_owner(world: World) -> None:
    video = await world.client.post(
        "/api/v1/recordings/uploads",
        headers={"X-Test-Member": "a"},
        json={"file_name": "x.mp4", "content_type": "video/mp4", "size_bytes": 10},
    )
    assert video.status_code == 415
    huge = await world.client.post(
        "/api/v1/recordings/uploads",
        headers={"X-Test-Member": "a"},
        json={"file_name": "x.mp3", "content_type": "audio/mpeg", "size_bytes": 10_000_000},
    )
    assert huge.status_code == 413
    # Someone else's key cannot be published.
    key = await world.upload("a", mp3(5))
    stolen = await world.client.post(
        "/api/v1/recordings", headers={"X-Test-Member": "b"}, json=world.body(key)
    )
    assert stolen.status_code == 403
    # A key that was never uploaded.
    ghost = new_key(str(MEMBER_A), "mp3")
    missing = await world.client.post(
        "/api/v1/recordings", headers={"X-Test-Member": "a"}, json=world.body(ghost)
    )
    assert missing.status_code == 422
    # Not audio: the local PUT refuses it before it is stored.
    target = (
        await world.client.post(
            "/api/v1/recordings/uploads",
            headers={"X-Test-Member": "a"},
            json={"file_name": "x.mp3", "content_type": "audio/mpeg", "size_bytes": 20},
        )
    ).json()
    path = "/" + target["url"].split("://", 1)[1].split("/", 1)[1]
    bad = await world.client.put(path, content=b"%PDF-1.7 not audio", headers=target["headers"])
    assert bad.status_code == 422
    wrong_type = await world.client.put(path, content=mp3(), headers={"Content-Type": "audio/wav"})
    assert wrong_type.status_code == 415


async def test_published_twice_is_refused(world: World) -> None:
    key = await world.upload("a", mp3(6))
    first = await world.client.post(
        "/api/v1/recordings", headers={"X-Test-Member": "a"}, json=world.body(key)
    )
    assert first.status_code == 201
    second = await world.client.post(
        "/api/v1/recordings", headers={"X-Test-Member": "a"}, json=world.body(key)
    )
    assert second.status_code == 409


async def test_an_exact_duplicate_is_blocked_with_a_link_to_the_existing_one(world: World) -> None:
    data = mp3(7)
    first = (await world.publish("a", data)).json()
    # Early check by hash, before the bytes travel.
    import hashlib

    early = await world.client.post(
        "/api/v1/recordings/uploads",
        headers={"X-Test-Member": "b"},
        json={
            "file_name": "x.mp3",
            "content_type": "audio/mpeg",
            "size_bytes": len(data),
            "sha256": hashlib.sha256(data).hexdigest(),
        },
    )
    assert early.status_code == 409
    detail = early.json()["detail"]
    assert detail["code"] == "duplicate"
    assert detail["duplicate_of"]["id"] == first["id"]
    assert "already in the app" in detail["message"]
    # Late check on the stored bytes (the client did not send a hash).
    late = await world.publish("b", data)
    assert late.status_code == 409
    assert late.json()["detail"]["duplicate_of"]["id"] == first["id"]
    count = len((await world.client.get("/api/v1/recordings")).json()["items"])
    assert count == 1
    # The refused file is not left behind in storage.
    assert len(list((world.storage.base_dir / "recordings" / str(MEMBER_B)).glob("*"))) == 0


async def test_a_similar_recording_only_warns_and_the_author_can_confirm(world: World) -> None:
    first = (await world.publish("a", mp3(8, b"NOISE=0;"), title="Original")).json()
    # Same fingerprint family (a little noise), different bytes: another performance of the chant.
    second_key = await world.upload("b", mp3(8, b"NOISE=5;"))
    warn = await world.client.post(
        "/api/v1/recordings",
        headers={"X-Test-Member": "b"},
        json=world.body(second_key, title="Mine"),
    )
    assert warn.status_code == 409
    detail = warn.json()["detail"]
    assert detail["code"] == "similar_recording"
    assert detail["message"] == "A similar recording exists. Is yours different?"
    assert detail["similar"][0]["id"] == first["id"]
    assert await world.scalar(select(Recording).where(Recording.title == "Mine")) is None

    confirmed = await world.client.post(
        "/api/v1/recordings",
        headers={"X-Test-Member": "b"},
        json=world.body(second_key, title="Mine", confirm_similar=True),
    )
    assert confirmed.status_code == 201
    assert confirmed.json()["status"] == "published"
    assert confirmed.json()["duplicate_of"] == first["id"]
    # A different chant is not similar.
    other = await world.publish("b", mp3(99), title="Another chant")
    assert other.status_code == 201


async def test_reports_are_deduplicated_and_flag_the_recording(world: World) -> None:
    item = (await world.publish("a", mp3(10))).json()
    url = f"/api/v1/recordings/{item['id']}/report"
    first = await world.client.post(
        url, headers={"X-Test-Member": "b"}, json={"reason": "wrong_info"}
    )
    assert first.status_code == 201
    assert first.json()["status"] == "received"
    again = await world.client.post(url, headers={"X-Test-Member": "b"}, json={"reason": "other"})
    assert again.json()["status"] == "already_reported"
    row = await world.scalar(select(Recording))
    assert row is not None and row.reports_count == 1 and row.status == "published"
    # Visitors without an account may report too; one report per device.
    anon = await world.client.post(url, json={"reason": "offensive", "comment": "Not suitable"})
    assert anon.status_code == 201
    anon_again = await world.client.post(url, json={"reason": "offensive"})
    assert anon_again.json()["status"] == "already_reported"
    unknown = await world.client.post(
        f"/api/v1/recordings/{uuid4()}/report", json={"reason": "other"}
    )
    assert unknown.status_code == 404
    bad_reason = await world.client.post(url, json={"reason": "spam"})
    assert bad_reason.status_code == 422


async def test_three_reports_or_one_copyright_report_flag_but_keep_it_live(world: World) -> None:
    many = (await world.publish("a", mp3(11))).json()
    async with world.sessions() as session:
        target = await session.get(Recording, UUID(many["id"]))
        assert target is not None
        for index in range(3):
            await service.add_report(
                session,
                recording=target,
                reporter_key=f"anon:{index}",
                reporter_id=None,
                reason="other",
                comment=None,
                flag_threshold=3,
            )
    row = await world.scalar(select(Recording).where(Recording.id == UUID(many["id"])))
    assert row is not None and row.status == "flagged" and row.reports_count == 3 and row.flagged_at

    claim = (await world.publish("a", mp3(12), title="Claimed")).json()
    await world.client.post(
        f"/api/v1/recordings/{claim['id']}/report",
        headers={"X-Test-Member": "b"},
        json={"reason": "copyright", "comment": "This is my album"},
    )
    flagged = await world.scalar(select(Recording).where(Recording.id == UUID(claim["id"])))
    assert flagged is not None and flagged.status == "flagged"
    # Flagged recordings stay in the public list until the team decides.
    titles = {i["title"] for i in (await world.client.get("/api/v1/recordings")).json()["items"]}
    assert "Claimed" in titles


async def test_report_rate_limit(world: World) -> None:
    ids = [(await world.publish("a", mp3(100 + n), title=f"T{n}")).json()["id"] for n in range(3)]
    codes: list[int] = []
    service.limiter.reset()
    for n in range(35):
        recording_id = ids[n % 3]
        response = await world.client.post(
            f"/api/v1/recordings/{recording_id}/report",
            headers={"X-Test-Member": "b"},
            json={"reason": "other"},
        )
        codes.append(response.status_code)
    assert 429 in codes
    assert codes[0] == 201


async def test_blocking_an_author_hides_their_recordings_for_that_member(world: World) -> None:
    await world.publish("a", mp3(20), title="By Ananda")
    await world.publish("b", mp3(21), title="By Bhakti")
    assert (
        await world.client.post(
            "/api/v1/recordings/blocks",
            headers={"X-Test-Member": "b"},
            json={"author_id": str(MEMBER_A)},
        )
    ).status_code == 201
    again = await world.client.post(
        "/api/v1/recordings/blocks",
        headers={"X-Test-Member": "b"},
        json={"author_id": str(MEMBER_A)},
    )
    assert again.json()["author_ids"] == [str(MEMBER_A)]
    seen_by_b = {
        i["title"]
        for i in (
            await world.client.get("/api/v1/recordings", headers={"X-Test-Member": "b"})
        ).json()["items"]
    }
    assert seen_by_b == {"By Bhakti"}
    seen_by_a = {
        i["title"]
        for i in (
            await world.client.get("/api/v1/recordings", headers={"X-Test-Member": "a"})
        ).json()["items"]
    }
    assert seen_by_a == {"By Ananda", "By Bhakti"}
    seen_by_guest = {
        i["title"] for i in (await world.client.get("/api/v1/recordings")).json()["items"]
    }
    assert seen_by_guest == {"By Ananda", "By Bhakti"}
    assert (
        await world.client.post(
            "/api/v1/recordings/blocks",
            headers={"X-Test-Member": "b"},
            json={"author_id": str(MEMBER_B)},
        )
    ).status_code == 422
    assert (
        await world.client.post(
            "/api/v1/recordings/blocks",
            headers={"X-Test-Member": "b"},
            json={"author_id": str(uuid4())},
        )
    ).status_code == 404
    listed = await world.client.get("/api/v1/recordings/blocks", headers={"X-Test-Member": "b"})
    assert listed.json()["author_ids"] == [str(MEMBER_A)]
    removed = await world.client.delete(
        f"/api/v1/recordings/blocks/{MEMBER_A}", headers={"X-Test-Member": "b"}
    )
    assert removed.json()["author_ids"] == []


async def test_the_admin_queue_lists_new_and_flagged_newest_first_with_report_counts(
    world: World,
) -> None:
    older = (await world.publish("a", mp3(30), title="Older")).json()
    time.sleep(0.01)
    newer = (await world.publish("b", mp3(31), title="Newer")).json()
    await world.client.post(
        f"/api/v1/recordings/{older['id']}/report",
        headers={"X-Test-Member": "b"},
        json={"reason": "copyright"},
    )
    queue = (await world.client.get("/api/v1/admin/recordings", params={"filter": "new"})).json()
    assert [i["title"] for i in queue["items"]] == ["Newer"]  # Older is flagged now, not "new"
    flagged = (
        await world.client.get("/api/v1/admin/recordings", params={"filter": "flagged"})
    ).json()
    assert [i["title"] for i in flagged["items"]] == ["Older"]
    assert flagged["items"][0]["reports_count"] == 1
    everything = (
        await world.client.get("/api/v1/admin/recordings", params={"filter": "all"})
    ).json()
    assert [i["title"] for i in everything["items"]] == ["Newer", "Older"]
    detail = (await world.client.get(f"/api/v1/admin/recordings/{older['id']}")).json()
    assert detail["reports"][0]["reason"] == "copyright"
    assert detail["reports"][0]["reporter_is_member"] is True
    assert detail["audio_sha256"]

    ok = await world.client.post(
        f"/api/v1/admin/recordings/{older['id']}/reviewed", json={"reviewer": "Dada"}
    )
    assert ok.json()["status"] == "published" and ok.json()["reviewed_by"] == "Dada"
    still_new = (
        await world.client.get("/api/v1/admin/recordings", params={"filter": "new"})
    ).json()
    assert [i["title"] for i in still_new["items"]] == ["Newer"]
    assert newer["status"] == "published"


async def test_removing_a_recording_hides_it_and_tells_the_author_why(world: World) -> None:
    item = (await world.publish("a", mp3(40), title="Borrowed song")).json()
    reason = "It uses a commercial recording without permission"
    removed = await world.client.post(
        f"/api/v1/admin/recordings/{item['id']}/remove", json={"reason": reason, "reviewer": "Dada"}
    )
    assert removed.status_code == 200
    out = removed.json()
    assert (
        out["status"] == "removed"
        and out["removed_reason"] == reason
        and out["removed_by"] == "Dada"
    )
    assert out["removed_at"]

    assert (await world.client.get("/api/v1/recordings")).json()["total"] == 0
    assert (await world.client.get(f"/api/v1/recordings/{item['id']}")).status_code == 404
    owner_view = await world.client.get(
        f"/api/v1/recordings/{item['id']}", headers={"X-Test-Member": "a"}
    )
    assert owner_view.json()["removed_reason"] == reason
    mine = (
        await world.client.get("/api/v1/recordings/mine", headers={"X-Test-Member": "a"})
    ).json()
    assert mine["items"][0]["status"] == "removed" and mine["items"][0]["removed_reason"] == reason
    stored = await world.scalar(select(Recording))
    assert stored is not None
    audio_key = stored.audio_key
    assert (await world.client.get(f"/api/v1/recordings/media/{audio_key}")).status_code == 404

    notices = (
        await world.client.get("/api/v1/recordings/notices", headers={"X-Test-Member": "a"})
    ).json()
    assert len(notices) == 1
    assert notices[0]["title"] == f"Your Kiirtan was removed: {reason}"
    assert notices[0]["kind"] == "recording_removed"
    assert notices[0]["payload"]["reason"] == reason
    assert "Contact us" in notices[0]["body"] and "corrected version" in notices[0]["body"]
    assert notices[0]["read_at"] is None
    other = (
        await world.client.get("/api/v1/recordings/notices", headers={"X-Test-Member": "b"})
    ).json()
    assert other == []
    read = await world.client.post(
        f"/api/v1/recordings/notices/{notices[0]['id']}/read", headers={"X-Test-Member": "a"}
    )
    assert read.json()["read_at"] is not None
    unread = await world.client.get(
        "/api/v1/recordings/notices", headers={"X-Test-Member": "a"}, params={"unread_only": True}
    )
    assert unread.json() == []
    foreign = await world.client.post(
        f"/api/v1/recordings/notices/{notices[0]['id']}/read", headers={"X-Test-Member": "b"}
    )
    assert foreign.status_code == 404

    again = await world.client.post(
        f"/api/v1/admin/recordings/{item['id']}/remove", json={"reason": reason}
    )
    assert again.status_code == 409
    short = await world.client.post(f"/api/v1/admin/recordings/{item['id']}/restore", json={})
    assert short.status_code == 200 and short.json()["status"] == "published"
    assert short.json()["removed_reason"] is None
    notices = (
        await world.client.get("/api/v1/recordings/notices", headers={"X-Test-Member": "a"})
    ).json()
    assert {n["kind"] for n in notices} == {"recording_removed", "recording_restored"}
    assert (await world.client.get("/api/v1/recordings")).json()["total"] == 1
    cannot = await world.client.post(f"/api/v1/admin/recordings/{item['id']}/restore", json={})
    assert cannot.status_code == 409


async def test_a_removed_file_cannot_be_uploaded_again(world: World) -> None:
    data = mp3(50)
    item = (await world.publish("a", data)).json()
    await world.client.post(
        f"/api/v1/admin/recordings/{item['id']}/remove", json={"reason": "Not ours to publish"}
    )
    again = await world.publish("a", data)
    assert again.status_code == 409
    detail = again.json()["detail"]
    assert detail["code"] == "removed_duplicate"
    assert "removed by the team" in detail["message"]
    # A corrected version (different bytes) is welcome.
    corrected = await world.publish("a", mp3(51), title="Corrected version")
    assert corrected.status_code == 201


async def test_play_count_is_counted_and_limited(world: World) -> None:
    item = (await world.publish("a", mp3(60))).json()
    first = await world.client.post(f"/api/v1/recordings/{item['id']}/play")
    assert first.status_code == 204
    row = await world.scalar(select(Recording))
    assert row is not None and row.plays == 1
    for _ in range(5):
        last = await world.client.post(f"/api/v1/recordings/{item['id']}/play")
    assert last.status_code == 429


async def test_terms_endpoint(world: World) -> None:
    terms = await world.client.get("/api/v1/recordings/terms")
    assert terms.json() == {"version": TERMS}


async def test_admin_endpoints_need_the_admin_key(world: World) -> None:
    world.client._transport.app.dependency_overrides.pop(require_admin)  # type: ignore[attr-defined]
    denied = await world.client.get("/api/v1/admin/recordings")
    assert denied.status_code in (401, 503)
    wrong = await world.client.post(
        f"/api/v1/admin/recordings/{uuid4()}/remove",
        json={"reason": "No reason"},
        headers={"X-Admin-Key": "wrong"},
    )
    assert wrong.status_code in (401, 503)
    assert (await world.client.get("/api/v1/recordings/mine")).status_code == 401
