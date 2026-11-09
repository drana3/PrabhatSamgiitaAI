"""Which helper programs the server has (docs/launch-readiness.md, "Server tools").

The API works without any of them; each one only switches a feature on. This module answers one
question for the admin page and the health check: which are there? It names no secret, no
address and no path: only a yes/no, the program's own version line, what it is for, and what the
member loses when it is missing.
"""

from __future__ import annotations

import asyncio
import shutil
import socket
from dataclasses import asdict, dataclass

from app.config import Settings
from app.core.timezones import tzdata_available
from app.services.virus_scan import clamd_configured, clamscan_binary, scan_mode

VERSION_TIMEOUT = 3.0
VERSION_MAX_CHARS = 90


@dataclass(frozen=True)
class ToolStatus:
    name: str
    present: bool
    version: str | None
    purpose: str
    if_missing: str


async def _version_line(binary: str, *args: str) -> str | None:
    """The first line the program prints for `--version`, shortened. None when it will not say."""
    try:
        process = await asyncio.create_subprocess_exec(
            binary,
            *args,
            stdin=asyncio.subprocess.DEVNULL,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
            env={"PATH": "/usr/bin:/bin:/usr/local/bin", "LC_ALL": "C"},
        )
        stdout, _ = await asyncio.wait_for(process.communicate(), timeout=VERSION_TIMEOUT)
    except (OSError, TimeoutError):
        return None
    lines = stdout.decode("utf-8", errors="replace").strip().splitlines()
    return lines[0][:VERSION_MAX_CHARS] if lines else None


def _clamd_reachable(host: str, port: int) -> bool:
    try:
        with socket.create_connection((host, port), timeout=2.0) as connection:
            connection.sendall(b"zPING\0")
            return connection.recv(16).strip(b"\0\n ") == b"PONG"
    except OSError:
        return False


async def collect_tools(settings: Settings) -> list[ToolStatus]:
    ffmpeg = shutil.which(settings.recording_ffmpeg_path)
    fpcalc = shutil.which(settings.recording_fpcalc_path)
    versions = await asyncio.gather(
        _version_line(ffmpeg, "-version") if ffmpeg else asyncio.sleep(0, None),
        _version_line(fpcalc, "-version") if fpcalc else asyncio.sleep(0, None),
    )
    scan_present = False
    scan_version: str | None = None
    if scan_mode(settings) == "off":
        scan_version = "switched off (RECORDING_VIRUS_SCAN=off)"
    elif clamd_configured(settings):
        scan_present = await asyncio.to_thread(
            _clamd_reachable, (settings.clamd_host or "").strip(), settings.clamd_port
        )
        scan_version = "clamd daemon" if scan_present else "clamd configured, not answering"
    else:
        clamscan = clamscan_binary(settings)
        scan_present = clamscan is not None
        if clamscan:
            scan_version = await _version_line(clamscan, "--version")
    return [
        ToolStatus(
            name="ffmpeg",
            present=ffmpeg is not None,
            version=versions[0],
            purpose="Measures how loud each uploaded recording is, so the phone can level them.",
            if_missing="Recordings are stored without a loudness value; volume differs.",
        ),
        ToolStatus(
            name="fpcalc",
            present=fpcalc is not None,
            version=versions[1],
            purpose="Audio fingerprint (Chromaprint): warns when an upload sounds like another.",
            if_missing="Only exact copies are caught; the 'sounds alike' warning and the "
            "measured-length check are skipped.",
        ),
        ToolStatus(
            name="clamav",
            present=scan_present,
            version=scan_version,
            purpose="Virus scan of every uploaded recording.",
            if_missing="Uploads are not scanned (RECORDING_VIRUS_SCAN=auto) or refused with a "
            "'try again later' answer (RECORDING_VIRUS_SCAN=required).",
        ),
        ToolStatus(
            name="tzdata",
            present=tzdata_available(),
            version=None,
            purpose="Time zone data for 'today' on the home screen and for scheduled broadcasts.",
            if_missing="India uses a fixed +05:30; any other zone is refused with an error.",
        ),
    ]


async def tools_report(settings: Settings) -> dict[str, object]:
    tools = await collect_tools(settings)
    return {
        "tools": [asdict(tool) for tool in tools],
        "all_present": all(tool.present for tool in tools),
        "virus_scan_mode": scan_mode(settings),
    }


def tools_summary(settings: Settings) -> dict[str, bool]:
    """Yes/no per tool, without starting any program: cheap enough for the public health check."""
    return {
        "ffmpeg": shutil.which(settings.recording_ffmpeg_path) is not None,
        "fpcalc": shutil.which(settings.recording_fpcalc_path) is not None,
        "clamav": clamd_configured(settings) or clamscan_binary(settings) is not None,
        "tzdata": tzdata_available(),
    }
