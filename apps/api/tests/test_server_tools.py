"""Helper programs on the server (docs/launch-readiness.md, "Server tools"): what happens when
ffmpeg, fpcalc, ClamAV or time zone data is missing, the health lines that report it, and the image
definition that is supposed to install them."""

from __future__ import annotations

import asyncio
import os
import struct
import sys
from collections.abc import AsyncIterator
from datetime import timedelta
from pathlib import Path
from uuid import uuid4
from zoneinfo import ZoneInfoNotFoundError

import httpx
import pytest
from fastapi import FastAPI, HTTPException

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://test:test@localhost/test")

from app.api.v1 import server_tools as server_tools_api
from app.config import Settings, get_settings
from app.core import timezones
from app.core.security import hash_admin_api_key, require_admin
from app.services import recording_fingerprint, recording_loudness, server_tools, virus_scan
from app.services.upload_validation import UploadRejected

REPO = Path(__file__).resolve().parents[3]
# a tiny valid mono PCM WAV: the earlier upload checks pass, only the scanner can refuse it
WAV = (
    b"RIFF"
    + struct.pack("<I", 36 + 1000)
    + b"WAVEfmt "
    + struct.pack("<IHHIIHH", 16, 1, 1, 8000, 8000, 1, 8)
    + b"data"
    + struct.pack("<I", 1000)
    + b"\x80" * 1000
)
EICAR = rb"X5O!P%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"


def _settings(**extra: object) -> Settings:
    return Settings.model_validate({"_env_file": None, **extra})


# --------------------------------------------------------------------------- missing programs


async def test_a_missing_ffmpeg_and_fpcalc_degrade_without_a_crash(tmp_path: Path) -> None:
    audio = tmp_path / "a.mp3"
    audio.write_bytes(b"ID3" + b"\0" * 2000)
    nowhere = "/nonexistent/tool"
    assert await recording_loudness.measure_loudness(audio, nowhere) is None
    assert await recording_fingerprint.compute_fingerprint(audio, nowhere) is None


async def test_the_tool_report_says_which_are_missing_and_names_no_path() -> None:
    settings = _settings(
        RECORDING_FFMPEG_PATH="/nonexistent/ffmpeg",
        RECORDING_FPCALC_PATH="/nonexistent/fpcalc",
        RECORDING_CLAMSCAN_PATH="/nonexistent/clamscan",
    )
    report = await server_tools.tools_report(settings)
    by_name = {tool["name"]: tool for tool in report["tools"]}  # type: ignore[index,union-attr]
    assert set(by_name) == {"ffmpeg", "fpcalc", "clamav", "tzdata"}
    for name in ("ffmpeg", "fpcalc", "clamav"):
        assert by_name[name]["present"] is False
        assert by_name[name]["version"] is None
        assert by_name[name]["if_missing"]
    assert report["all_present"] is False
    assert "/nonexistent" not in repr(report)
    assert server_tools.tools_summary(settings)["ffmpeg"] is False


async def test_a_present_tool_shows_its_version_line(tmp_path: Path) -> None:
    fake = tmp_path / "fakecalc"
    fake.write_text("#!/bin/sh\necho 'fpcalc version 9.9.9'\n")
    fake.chmod(0o755)
    report = await server_tools.collect_tools(_settings(RECORDING_FPCALC_PATH=str(fake)))
    fpcalc = next(tool for tool in report if tool.name == "fpcalc")
    assert fpcalc.present and fpcalc.version == "fpcalc version 9.9.9"


@pytest.fixture
async def admin_client() -> AsyncIterator[httpx.AsyncClient]:
    app = FastAPI()
    app.include_router(server_tools_api.router, prefix="/api/v1")
    state = {"admin": True}

    def admin() -> str:
        if not state["admin"]:
            raise HTTPException(status_code=401, detail="Invalid admin credentials")
        return "api-key-admin"

    app.dependency_overrides[require_admin] = admin
    app.dependency_overrides[get_settings] = lambda: _settings(
        RECORDING_FFMPEG_PATH="/nonexistent/ffmpeg"
    )
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://t") as http:
        http.state = state  # type: ignore[attr-defined]
        yield http


async def test_the_admin_page_lists_the_tools(admin_client: httpx.AsyncClient) -> None:
    response = await admin_client.get("/api/v1/admin/server-tools")
    assert response.status_code == 200
    body = response.json()
    assert {tool["name"] for tool in body["tools"]} == {"ffmpeg", "fpcalc", "clamav", "tzdata"}
    assert body["virus_scan_mode"] == "auto"


async def test_the_admin_page_needs_the_admin_key(admin_client: httpx.AsyncClient) -> None:
    admin_client.state["admin"] = False  # type: ignore[attr-defined]
    assert (await admin_client.get("/api/v1/admin/server-tools")).status_code == 401


async def test_the_real_app_mounts_the_page_behind_the_admin_key() -> None:
    from app.main import app

    app.dependency_overrides[get_settings] = lambda: _settings(
        ADMIN_API_KEY_HASH=hash_admin_api_key("right-key")
    )
    try:
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as http:
            url = "/api/v1/admin/server-tools"
            assert (await http.get(url)).status_code == 401
            assert (await http.get(url, headers={"X-Admin-Key": "wrong"})).status_code == 401
            assert (await http.get(url, headers={"X-Admin-Key": "right-key"})).status_code == 200
    finally:
        app.dependency_overrides.pop(get_settings, None)


# --------------------------------------------------------------------------- time zones


def test_india_survives_missing_zone_data(monkeypatch: pytest.MonkeyPatch) -> None:
    def broken(name: str) -> object:
        raise ZoneInfoNotFoundError(name)

    monkeypatch.setattr(timezones, "ZoneInfo", broken)
    zone = timezones.load_zone("Asia/Kolkata")
    assert zone.utcoffset(None) == timedelta(hours=5, minutes=30)
    with pytest.raises(ZoneInfoNotFoundError):
        timezones.load_zone("Europe/Berlin")  # another zone: never guessed
    assert timezones.tzdata_available() is False


def test_zone_data_is_normally_there() -> None:
    assert timezones.tzdata_available() is True
    assert timezones.load_zone("Europe/Berlin").utcoffset is not None


# --------------------------------------------------------------------------- virus scan


async def test_without_a_scanner_the_default_lets_the_upload_through(tmp_path: Path) -> None:
    path = tmp_path / "f"
    path.write_bytes(b"x" * 1000)
    settings = _settings(RECORDING_CLAMSCAN_PATH="/nonexistent/clamscan")
    result = await virus_scan.scan_file(path, settings)
    assert result.state == "skipped"
    await virus_scan.check_upload(path, settings)  # no exception


async def test_required_mode_refuses_when_there_is_no_scanner(tmp_path: Path) -> None:
    path = tmp_path / "f"
    path.write_bytes(b"x" * 1000)
    settings = _settings(
        RECORDING_VIRUS_SCAN="required", RECORDING_CLAMSCAN_PATH="/nonexistent/clamscan"
    )
    with pytest.raises(UploadRejected) as caught:
        await virus_scan.check_upload(path, settings)
    assert caught.value.status_code == 503 and caught.value.code == "scan_unavailable"


async def test_off_mode_never_scans_even_when_required_is_misspelt(tmp_path: Path) -> None:
    path = tmp_path / "f"
    path.write_bytes(EICAR)
    assert (await virus_scan.scan_file(path, _settings(RECORDING_VIRUS_SCAN="off"))).state == (
        "skipped"
    )
    # an unknown word means the default, not "off"
    assert virus_scan.scan_mode(_settings(RECORDING_VIRUS_SCAN="reqired")) == "auto"


def _fake_clamscan(tmp_path: Path, exit_code: int, line: str) -> str:
    script = tmp_path / f"clamscan-{exit_code}"
    script.write_text(f"#!/bin/sh\necho '{line}'\nexit {exit_code}\n")
    script.chmod(0o755)
    return str(script)


async def test_the_clamscan_program_answers_are_understood(tmp_path: Path) -> None:
    path = tmp_path / "f"
    path.write_bytes(b"x" * 1000)
    clean = _settings(RECORDING_CLAMSCAN_PATH=_fake_clamscan(tmp_path, 0, f"{path}: OK"))
    assert (await virus_scan.scan_file(path, clean)).state == "clean"
    bad = _settings(
        RECORDING_CLAMSCAN_PATH=_fake_clamscan(tmp_path, 1, f"{path}: Eicar-Test-Signature FOUND")
    )
    found = await virus_scan.scan_file(path, bad)
    assert found.state == "infected" and found.signature == "Eicar-Test-Signature"
    broken = _settings(RECORDING_CLAMSCAN_PATH=_fake_clamscan(tmp_path, 2, "no database"))
    assert (await virus_scan.scan_file(path, broken)).state == "error"
    with pytest.raises(UploadRejected) as caught:
        await virus_scan.check_upload(path, bad)
    assert caught.value.status_code == 422 and caught.value.code == "virus_found"
    # a broken scanner in the default mode lets the upload through, in required mode it does not
    await virus_scan.check_upload(path, broken)
    required = _settings(
        RECORDING_VIRUS_SCAN="required", RECORDING_CLAMSCAN_PATH=broken.recording_clamscan_path
    )
    with pytest.raises(UploadRejected):
        await virus_scan.check_upload(path, required)


async def _fake_clamd(reply: bytes) -> tuple[asyncio.Server, int, list[bytes]]:
    """A tiny clamd: reads the INSTREAM protocol, remembers the bytes, sends `reply`."""
    received: list[bytes] = []

    async def handle(reader: asyncio.StreamReader, writer: asyncio.StreamWriter) -> None:
        command = await reader.readuntil(b"\0")
        if command == b"zPING\0":
            writer.write(b"PONG\0")
        else:
            assert command == b"zINSTREAM\0"
            body = b""
            while True:
                (size,) = struct.unpack(">I", await reader.readexactly(4))
                if size == 0:
                    break
                body += await reader.readexactly(size)
            received.append(body)
            writer.write(reply)
        await writer.drain()
        writer.close()

    server = await asyncio.start_server(handle, "127.0.0.1", 0)
    port = server.sockets[0].getsockname()[1]
    return server, port, received


async def test_clamd_over_the_network_clean_and_infected(tmp_path: Path) -> None:
    path = tmp_path / "f"
    path.write_bytes(os.urandom(200_000))
    server, port, received = await _fake_clamd(b"stream: OK\0")
    async with server:
        settings = _settings(CLAMD_HOST="127.0.0.1", CLAMD_PORT=port)
        assert (await virus_scan.scan_file(path, settings)).state == "clean"
        assert received[0] == path.read_bytes()  # the whole file went over, chunked
        tools = await server_tools.collect_tools(settings)
        assert next(t for t in tools if t.name == "clamav").present is True
    server, port, _ = await _fake_clamd(b"stream: Eicar-Test-Signature FOUND\0")
    async with server:
        settings = _settings(CLAMD_HOST="127.0.0.1", CLAMD_PORT=port)
        result = await virus_scan.scan_file(path, settings)
        assert result.state == "infected" and result.signature == "Eicar-Test-Signature"


async def test_a_clamd_that_is_down_is_an_error_not_a_crash(tmp_path: Path) -> None:
    path = tmp_path / "f"
    path.write_bytes(b"x" * 1000)
    server, port, _ = await _fake_clamd(b"")
    server.close()
    await server.wait_closed()  # the port is now closed
    settings = _settings(CLAMD_HOST="127.0.0.1", CLAMD_PORT=port)
    assert (await virus_scan.scan_file(path, settings)).state == "error"
    await virus_scan.check_upload(path, settings)  # default mode: the upload goes on
    tools = await server_tools.collect_tools(settings)
    assert next(t for t in tools if t.name == "clamav").present is False


@pytest.mark.skipif(sys.platform == "win32", reason="shell scripts")
async def test_an_infected_stored_file_is_deleted_and_refused(tmp_path: Path) -> None:
    from app.services.recording_storage import LocalDiskStorage
    from app.services.recordings import inspect_stored_file

    storage = LocalDiskStorage(tmp_path / "store", "http://t", "s" * 32)
    key = f"recordings/{uuid4()}/{uuid4()}.wav"
    storage.write(key, WAV)
    path = tmp_path / "clamscan"
    path.write_text("#!/bin/sh\necho 'x: Eicar-Test-Signature FOUND'\nexit 1\n")
    path.chmod(0o755)
    settings = _settings(RECORDING_CLAMSCAN_PATH=str(path))
    with pytest.raises(HTTPException) as caught:
        await inspect_stored_file(storage, key, settings)
    assert caught.value.status_code == 422
    assert (
        caught.value.headers is not None and caught.value.headers["X-Error-Code"] == "virus_found"
    )
    assert await storage.size(key) is None  # deleted


# --------------------------------------------------------------------------- the image


def test_the_image_installs_every_tool_it_is_supposed_to() -> None:
    dockerfile = (REPO / "apps/api/Dockerfile").read_text()
    runner = dockerfile.split("AS runner", 1)[1]
    for package in ("ffmpeg", "libchromaprint-tools", "tzdata"):
        assert package in runner, f"{package} is not installed in the runtime image"
    assert "INSTALL_CLAMAV" in dockerfile  # the scanner is a build option, see docs
