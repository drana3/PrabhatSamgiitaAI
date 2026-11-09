"""Optional virus scan of an uploaded recording with ClamAV (docs/upload-validation.md, step 3b).

Two ways to reach ClamAV, whichever is configured first:

1. A ClamAV **daemon** (`clamd`) over the network: `CLAMD_HOST` (+ `CLAMD_PORT`, default 3310). The
   file is streamed to it (`INSTREAM`); nothing has to be installed in the API container, and the
   virus signatures are updated by the daemon's own container. This is the one to use on a small
   server: `clamscan` loads about 1 GB of signatures on every run.
2. The **`clamscan` program** inside the image (`RECORDING_CLAMSCAN_PATH`, default `clamscan`).

`RECORDING_VIRUS_SCAN` decides what a missing or broken scanner means:

* `off`: no scan.
* `auto` (default): scan when a scanner is there. Without one, the upload goes on and the log says
  so once. A scanner that fails or times out also lets the upload go on (logged).
* `required`: no upload without a clean scan. A missing or failing scanner answers 503 ("try again
  later"); the file stays unpublished.

An infected file is always refused (422 `virus_found`) and deleted from storage.
Nothing here ever raises into the caller except `UploadRejected`.
"""

from __future__ import annotations

import asyncio
import logging
import shutil
import struct
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

from app.config import Settings
from app.services.upload_validation import UploadRejected

logger = logging.getLogger(__name__)

MODES = ("off", "auto", "required")
CHUNK = 64 * 1024
_warned_missing = False

State = Literal["clean", "infected", "skipped", "error"]


@dataclass(frozen=True)
class ScanResult:
    state: State
    signature: str | None = None  # the name ClamAV gave the threat, for the log only
    via: str | None = None  # "clamd" or "clamscan"


def scan_mode(settings: Settings) -> str:
    mode = (settings.recording_virus_scan or "auto").strip().lower()
    return mode if mode in MODES else "auto"


def clamd_configured(settings: Settings) -> bool:
    return bool((settings.clamd_host or "").strip())


def clamscan_binary(settings: Settings) -> str | None:
    return shutil.which(settings.recording_clamscan_path)


def scanner_name(settings: Settings) -> str | None:
    """Which scanner would be used right now: 'clamd', 'clamscan' or None."""
    if clamd_configured(settings):
        return "clamd"
    if clamscan_binary(settings):
        return "clamscan"
    return None


async def _scan_with_clamd(path: Path, host: str, port: int, timeout: float) -> ScanResult:
    """The clamd INSTREAM protocol: `zINSTREAM\\0`, then (4-byte length + data) chunks, then 0."""
    reader, writer = await asyncio.wait_for(asyncio.open_connection(host, port), timeout=10)
    try:
        writer.write(b"zINSTREAM\0")
        with path.open("rb") as handle:
            while chunk := handle.read(CHUNK):
                writer.write(struct.pack(">I", len(chunk)) + chunk)
                await asyncio.wait_for(writer.drain(), timeout=timeout)
        writer.write(struct.pack(">I", 0))
        await asyncio.wait_for(writer.drain(), timeout=timeout)
        reply = await asyncio.wait_for(reader.read(4096), timeout=timeout)
    finally:
        writer.close()
        try:
            await writer.wait_closed()
        except OSError:
            pass
    return _parse_reply(reply.decode("utf-8", errors="replace").strip("\0\r\n "), "clamd")


def _parse_reply(text: str, via: str) -> ScanResult:
    """`stream: OK`, `stream: Name FOUND`, or `... ERROR`."""
    if text.endswith("FOUND"):
        name = text.split(":", 1)[-1].removesuffix("FOUND").strip() or "unknown"
        return ScanResult("infected", name, via)
    if text.endswith("OK"):
        return ScanResult("clean", None, via)
    return ScanResult("error", None, via)


async def _scan_with_clamscan(path: Path, binary: str, timeout: float) -> ScanResult:
    process = await asyncio.create_subprocess_exec(
        binary,
        "--no-summary",
        "--stdout",
        str(path),
        stdin=asyncio.subprocess.DEVNULL,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.DEVNULL,
        env={"PATH": "/usr/bin:/bin:/usr/local/bin", "LC_ALL": "C"},
    )
    try:
        stdout, _ = await asyncio.wait_for(process.communicate(), timeout=timeout)
    except TimeoutError:
        process.kill()
        await process.wait()
        return ScanResult("error", None, "clamscan")
    # exit 0 = clean, 1 = virus found, 2 = scanner trouble (for example no signature database)
    if process.returncode == 0:
        return ScanResult("clean", None, "clamscan")
    if process.returncode == 1:
        line = stdout.decode("utf-8", errors="replace").strip().splitlines()
        text = line[0] if line else ""
        return (
            _parse_reply(text, "clamscan")
            if text.endswith("FOUND")
            else ScanResult("infected", "unknown", "clamscan")
        )
    return ScanResult("error", None, "clamscan")


async def scan_file(path: Path, settings: Settings) -> ScanResult:
    """Scan one file. Never raises; 'skipped' means no scanner was used (off or not installed)."""
    global _warned_missing
    if scan_mode(settings) == "off":
        return ScanResult("skipped")
    timeout = float(settings.recording_virus_scan_timeout_seconds)
    try:
        if clamd_configured(settings):
            host = (settings.clamd_host or "").strip()
            return await _scan_with_clamd(path, host, settings.clamd_port, timeout)
        binary = clamscan_binary(settings)
        if binary is None:
            if not _warned_missing:
                _warned_missing = True
                logger.warning(
                    "No virus scanner: uploads are not scanned. Set CLAMD_HOST to a ClamAV "
                    "daemon, or install clamav and set RECORDING_CLAMSCAN_PATH "
                    "(docs/launch-readiness.md, server tools)."
                )
            return ScanResult("skipped")
        return await _scan_with_clamscan(path, binary, timeout)
    except (OSError, TimeoutError, struct.error) as exc:
        logger.warning("virus scan failed (%s): %s", type(exc).__name__, exc)
        return ScanResult("error")


def decide(result: ScanResult, mode: str) -> UploadRejected | None:
    """The refusal for this scan result under this mode, or None when the upload may go on."""
    if result.state == "infected":
        logger.warning("upload refused: virus scanner reported %s", result.signature)
        return UploadRejected(
            422, "virus_found", "This file did not pass the safety check, so it was not added."
        )
    if mode == "required" and result.state != "clean":
        return UploadRejected(
            503,
            "scan_unavailable",
            "We cannot check files for safety right now. Please try again a little later.",
        )
    return None


async def check_upload(path: Path, settings: Settings) -> None:
    """Scan and raise `UploadRejected` when the file must be refused."""
    refusal = decide(await scan_file(path, settings), scan_mode(settings))
    if refusal is not None:
        raise refusal
