"""Move recording files from one storage to another, and prove they arrived intact.

The database remembers, for every recording, the key of its file, its size and its SHA-256
(`recordings.audio_key`, `audio_bytes`, `audio_sha256`). That is the receipt we check against:
a copy counts only when the bytes read back from the target hash to the same SHA-256.

Properties (docs/storage.md):

* DRY RUN is the default of the caller: `apply=False` reads and compares, writes nothing.
* IDEMPOTENT: a file that is already in the target with the right size is skipped; with
  `verify_existing=True` its hash is checked too. Running it twice, or after a crash, only does
  the missing part.
* NEVER DELETES: the source is read only. Removing the old files is a separate, manual decision.
* A source file whose hash does not match the database is NOT copied (a damaged original must not
  be spread to the new place); it is reported as `source_mismatch`.
"""

from __future__ import annotations

import hashlib
import mimetypes
import tempfile
from collections.abc import Iterable
from dataclasses import dataclass, field
from pathlib import Path

from app.services.recording_storage import (
    AUDIO_TYPES,
    RecordingStorage,
    StorageError,
)

CHUNK = 1024 * 1024

# Outcomes, one per file.
PRESENT = "present"  # already in the target (size, and hash when asked, match)
WOULD_COPY = "would_copy"  # dry run: missing in the target, source is fine
COPIED = "copied"  # copied and read back with the right hash
MISSING_SOURCE = "missing_in_source"  # neither place has it
SOURCE_MISMATCH = "source_mismatch"  # the original does not match the database receipt
TARGET_MISMATCH = "target_mismatch"  # target has it but the bytes differ (never overwritten)
FAILED = "failed"  # storage error; retry later

BAD = (MISSING_SOURCE, SOURCE_MISMATCH, TARGET_MISMATCH, FAILED)


@dataclass(frozen=True)
class FileReceipt:
    """What the database knows about one stored file."""

    key: str
    sha256: str
    size: int | None = None


@dataclass
class FileResult:
    key: str
    outcome: str
    detail: str = ""


@dataclass
class MigrationReport:
    apply: bool
    results: list[FileResult] = field(default_factory=list)

    def count(self, outcome: str) -> int:
        return sum(1 for item in self.results if item.outcome == outcome)

    @property
    def ok(self) -> bool:
        """True when nothing needs a human: every file is, or would be, safely in the target."""
        return not any(item.outcome in BAD for item in self.results)

    def summary(self) -> dict[str, int]:
        names = (PRESENT, WOULD_COPY, COPIED, *BAD)
        return {name: self.count(name) for name in names}


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while chunk := handle.read(CHUNK):
            digest.update(chunk)
    return digest.hexdigest()


def content_type_for(key: str) -> str:
    """The MIME type to store with a file: from its extension, `audio/mpeg` for mp3 and so on."""
    extension = key.rsplit(".", 1)[-1].lower()
    for mime, ext in AUDIO_TYPES.items():
        if ext == extension and mime.startswith("audio/") and mime not in {"audio/mp3"}:
            return mime
    return mimetypes.guess_type(key)[0] or "application/octet-stream"


async def _read_back(storage: RecordingStorage, key: str, folder: Path) -> Path:
    local = folder / "object"
    local.unlink(missing_ok=True)
    await storage.materialize(key, local)
    return local


async def migrate_one(
    receipt: FileReceipt,
    *,
    source: RecordingStorage,
    target: RecordingStorage,
    apply: bool,
    verify_existing: bool = False,
) -> FileResult:
    key = receipt.key
    try:
        target_size = await target.size(key)
        with tempfile.TemporaryDirectory(prefix="storage-migrate-") as workdir:
            folder = Path(workdir)
            if target_size is not None:
                if receipt.size is not None and target_size != receipt.size:
                    return FileResult(
                        key,
                        TARGET_MISMATCH,
                        f"size {target_size} in target, {receipt.size} expected",
                    )
                if not verify_existing:
                    return FileResult(key, PRESENT)
                local = await _read_back(target, key, folder)
                if sha256_file(local) != receipt.sha256:
                    return FileResult(key, TARGET_MISMATCH, "SHA-256 differs from the database")
                return FileResult(key, PRESENT, "verified")

            if await source.size(key) is None:
                return FileResult(key, MISSING_SOURCE, "not in the source and not in the target")
            local = await _read_back(source, key, folder)
            if sha256_file(local) != receipt.sha256:
                return FileResult(key, SOURCE_MISMATCH, "original does not match the database")
            if receipt.size is not None and local.stat().st_size != receipt.size:
                return FileResult(key, SOURCE_MISMATCH, "original has another size than recorded")
            if not apply:
                return FileResult(key, WOULD_COPY)
            await target.store_file(key, local, content_type_for(key))
            check = await _read_back(target, key, folder)
            if sha256_file(check) != receipt.sha256:
                # Leave the bad copy for a person to look at; never delete automatically.
                return FileResult(key, TARGET_MISMATCH, "read back after copy: SHA-256 differs")
            return FileResult(key, COPIED)
    except StorageError as exc:
        return FileResult(key, FAILED, str(exc))
    except OSError as exc:
        return FileResult(key, FAILED, f"{type(exc).__name__}: {exc}")


async def migrate(
    receipts: Iterable[FileReceipt],
    *,
    source: RecordingStorage,
    target: RecordingStorage,
    apply: bool = False,
    verify_existing: bool = False,
) -> MigrationReport:
    report = MigrationReport(apply=apply)
    for receipt in receipts:
        report.results.append(
            await migrate_one(
                receipt,
                source=source,
                target=target,
                apply=apply,
                verify_existing=verify_existing,
            )
        )
    return report
