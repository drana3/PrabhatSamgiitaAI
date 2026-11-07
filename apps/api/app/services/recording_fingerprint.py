"""Hashes and audio fingerprints for the duplicate check of new recordings.

* SHA-256 of the file: an EXACT match blocks the upload (the same bytes are already published).
* Chromaprint (`fpcalc`, optional): a NEAR match only warns. Different performances of the same
  mantra are versions, not duplicates, so the author decides ("A similar recording exists. Is yours
  different?").

The fingerprint is stored as the raw Chromaprint integers, packed big-endian (4 bytes each) and
base64 encoded.
When `fpcalc` is not installed, `compute_fingerprint` returns None and the near check is skipped.
"""

from __future__ import annotations

import asyncio
import base64
import hashlib
import json
import logging
import shutil
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from numpy.typing import NDArray

logger = logging.getLogger(__name__)
_warned_missing = False

# Mean share of equal bits (over the best alignment) from which two recordings count as "similar".
SIMILAR_THRESHOLD = 0.80
# How many 0.12 s steps the second recording may be shifted against the first.
MAX_OFFSET = 24
FPCALC_SECONDS = 120
FPCALC_TIMEOUT = 60.0

_POPCOUNT = np.array([bin(i).count("1") for i in range(256)], dtype=np.uint8)


def sha256_of_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


@dataclass(frozen=True)
class Fingerprint:
    duration_sec: int
    data: str  # base64 of big-endian uint32 values


def encode_fingerprint(values: list[int] | NDArray[np.uint32]) -> str:
    array = np.asarray(values, dtype=np.uint64).astype(">u4")
    return base64.b64encode(array.tobytes()).decode("ascii")


def decode_fingerprint(data: str) -> NDArray[np.uint32]:
    raw = base64.b64decode(data.encode("ascii"))
    return np.frombuffer(raw, dtype=">u4").astype(np.uint32)


def similarity(a: NDArray[np.uint32], b: NDArray[np.uint32], max_offset: int = MAX_OFFSET) -> float:
    """Share of equal bits (0..1) at the best alignment of two raw fingerprints.

    Unrelated audio sits near 0.5. A re-encode or the same take lands above 0.8.
    """
    if len(a) == 0 or len(b) == 0:
        return 0.0
    best = 0.0
    for offset in range(-max_offset, max_offset + 1):
        left = a[max(offset, 0) :]
        right = b[max(-offset, 0) :]
        length = min(len(left), len(right))
        if length < 20:
            continue
        diff = np.bitwise_xor(left[:length], right[:length]).view(np.uint8)
        wrong = int(_POPCOUNT[diff].sum())
        best = max(best, 1.0 - wrong / (length * 32))
    return best


def fpcalc_available(path: str = "fpcalc") -> bool:
    return shutil.which(path) is not None


def similar_matches(
    mine: NDArray[np.uint32],
    others: list[tuple[str, str]],
    *,
    threshold: float = SIMILAR_THRESHOLD,
    limit: int = 3,
) -> list[tuple[str, float]]:
    """Of `(id, encoded fingerprint)` pairs, those close to `mine`, best first (id, score).

    A damaged fingerprint is skipped, never an error. The cost is linear in the library size.
    """
    scored: list[tuple[str, float]] = []
    for ident, encoded in others:
        if not encoded:
            continue
        try:
            score = similarity(mine, decode_fingerprint(encoded))
        except (ValueError, TypeError):
            continue
        if score >= threshold:
            scored.append((ident, score))
    scored.sort(key=lambda pair: pair[1], reverse=True)
    return scored[:limit]


async def compute_fingerprint(path: Path, fpcalc_path: str = "fpcalc") -> Fingerprint | None:
    """Run `fpcalc -raw -json`. None when fpcalc is missing, fails, times out or returns nothing."""
    global _warned_missing
    binary = shutil.which(fpcalc_path)
    if binary is None:
        if not _warned_missing:
            _warned_missing = True
            logger.warning(
                "fpcalc (Chromaprint) is not installed: uploads are not compared by sound, "
                "only by SHA-256. Install libchromaprint-tools or set RECORDING_FPCALC_PATH."
            )
        return None
    try:
        process = await asyncio.create_subprocess_exec(
            binary,
            "-raw",
            "-json",
            "-length",
            str(FPCALC_SECONDS),
            str(path),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.DEVNULL,
        )
    except OSError:
        return None
    try:
        stdout, _ = await asyncio.wait_for(process.communicate(), timeout=FPCALC_TIMEOUT)
    except TimeoutError:
        process.kill()
        return None
    except OSError:
        return None
    if process.returncode != 0:
        return None
    try:
        payload = json.loads(stdout)
        values = [int(v) & 0xFFFFFFFF for v in payload["fingerprint"]]
        duration = int(round(float(payload.get("duration", 0))))
    except (ValueError, KeyError, TypeError):
        return None
    if not values:
        return None
    return Fingerprint(duration_sec=duration, data=encode_fingerprint(values))
