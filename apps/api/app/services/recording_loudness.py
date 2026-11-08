"""How loud a recording is: integrated loudness (LUFS) and true peak (dBTP), read with ffmpeg.

Why: one recording is mastered loud and another quiet, so the phone turns one down and the other
up to a common level while it plays (docs/loudness-leveling.md). The phone needs two numbers per
recording, measured once on the server:

* `loudness_lufs`: integrated loudness per ITU-R BS.1770 / EBU R128 (K-weighted, gated), in LUFS.
* `true_peak_db`: the highest inter-sample peak, in dBTP. It decides how far a quiet recording can
  be raised before it would clip.

The measurement is `ffmpeg -af ebur128=peak=true:dualmono=true` and a read of its Summary block.
`dualmono` counts a mono file as played on both speakers, which is how a phone plays it.
It is about 300 to 500 times faster than real time, so an hour-long discourse takes seconds.

Like the Chromaprint fingerprint this is optional: when ffmpeg is not installed, fails, times out
or the file is silent, `measure_loudness` returns None and the recording simply has no numbers (the
phone plays it unchanged). The backfill script `scripts/measure_recording_loudness.py` fills in
the recordings that were stored without them.
"""

from __future__ import annotations

import asyncio
import logging
import math
import re
import shutil
from dataclasses import dataclass
from pathlib import Path

logger = logging.getLogger(__name__)
_warned_missing = False

# BS.1770 gates out everything below -70 LUFS: a measurement at the floor means "silence".
LUFS_FLOOR = -70.0
# Plausible ranges. Anything outside is a broken measurement and is dropped, never stored.
LUFS_RANGE = (-69.9, 0.0)
PEAK_RANGE = (-120.0, 6.0)
FFMPEG_TIMEOUT = 180.0

_I_LINE = re.compile(r"^\s*I:\s+(-?\d+(?:\.\d+)?|-?inf)\s+LUFS", re.MULTILINE)
_LRA_LINE = re.compile(r"^\s*LRA:\s+(-?\d+(?:\.\d+)?)\s+LU", re.MULTILINE)
_PEAK_LINE = re.compile(r"^\s*Peak:\s+(-?\d+(?:\.\d+)?|-?inf)\s+dBFS", re.MULTILINE)


@dataclass(frozen=True)
class Loudness:
    lufs: float
    true_peak_db: float
    range_lu: float | None = None


def clean_loudness(lufs: float | None, true_peak_db: float | None) -> tuple[float, float] | None:
    """The two numbers rounded to 0.1, or None when either is missing, not finite or implausible.

    Silence (an integrated loudness of -70 LUFS and a true peak of -inf) is None: there is no
    level to match, and a gain computed from it would be absurd.
    """
    if lufs is None or true_peak_db is None:
        return None
    if not (math.isfinite(lufs) and math.isfinite(true_peak_db)):
        return None
    if not (LUFS_RANGE[0] <= lufs <= LUFS_RANGE[1]):
        return None
    if not (PEAK_RANGE[0] <= true_peak_db <= PEAK_RANGE[1]):
        return None
    return round(lufs, 1), round(true_peak_db, 1)


def loudness_from_metadata(metadata: object) -> tuple[float, float] | None:
    """The numbers kept in a catalogue audio item's `metadata_json["loudness"]`, if valid.

    The Prabhat Samgiita archive recordings (the `media` table) have no column of their own: the
    backfill script stores `{"lufs": -14.2, "true_peak_db": -1.3, "measured_at": "..."}` there.
    """
    if not isinstance(metadata, dict):
        return None
    stored = metadata.get("loudness")
    if not isinstance(stored, dict):
        return None
    lufs, peak = stored.get("lufs"), stored.get("true_peak_db")
    if isinstance(lufs, bool) or isinstance(peak, bool):
        return None
    if not isinstance(lufs, int | float) or not isinstance(peak, int | float):
        return None
    return clean_loudness(float(lufs), float(peak))


def parse_ebur128_summary(text: str) -> Loudness | None:
    """Reads `I:`, `LRA:` and the true `Peak:` of the Summary block ffmpeg prints on stderr.

    Only the text after the last "Summary:" is read (the per-frame lines before it also carry an
    `I:`, and an early frame says -70). None when there is no summary or the numbers are unusable.
    """
    marker = text.rfind("Summary:")
    if marker < 0:
        return None
    block = text[marker:]
    integrated = _I_LINE.search(block)
    peak = _PEAK_LINE.search(block)
    if integrated is None or peak is None:
        return None
    lra = _LRA_LINE.search(block)
    cleaned = clean_loudness(float(integrated.group(1)), float(peak.group(1)))
    if cleaned is None:
        return None
    return Loudness(
        lufs=cleaned[0],
        true_peak_db=cleaned[1],
        range_lu=round(float(lra.group(1)), 1) if lra else None,
    )


def ffmpeg_available(path: str = "ffmpeg") -> bool:
    return shutil.which(path) is not None


async def measure_loudness(
    path: Path, ffmpeg_path: str = "ffmpeg", *, timeout: float = FFMPEG_TIMEOUT
) -> Loudness | None:
    """Run ffmpeg's EBU R128 meter over the whole file. None when it cannot be measured."""
    global _warned_missing
    binary = shutil.which(ffmpeg_path)
    if binary is None:
        if not _warned_missing:
            _warned_missing = True
            logger.warning(
                "ffmpeg is not installed: recordings are stored without a loudness measurement "
                "and the phone plays them at their own level. Install ffmpeg or set "
                "RECORDING_FFMPEG_PATH."
            )
        return None
    try:
        process = await asyncio.create_subprocess_exec(
            binary,
            "-hide_banner",
            "-nostats",
            "-nostdin",
            "-i",
            str(path),
            "-vn",
            "-af",
            "ebur128=peak=true:dualmono=true:framelog=quiet",
            "-f",
            "null",
            "-",
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.PIPE,
        )
    except OSError:
        return None
    try:
        _, stderr = await asyncio.wait_for(process.communicate(), timeout=timeout)
    except TimeoutError:
        process.kill()
        await process.wait()
        return None
    except OSError:
        return None
    if process.returncode != 0:
        return None
    return parse_ebur128_summary(stderr.decode("utf-8", errors="replace"))
