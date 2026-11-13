"""Copy the audio files of recordings to the storage the API is configured for (Cloudflare R2),
check every copy against the SHA-256 in the database, and (only on request) point the rows at the
new address. Docs: docs/storage.md.

Safe by design:

* DRY RUN by default: it reads, compares and prints what it would do. Nothing is written to the
  bucket or to the database. Add `--apply` to copy.
* IDEMPOTENT: a file already in the bucket with the right size is skipped (`--verify-existing`
  also re-reads it and checks the SHA-256). Run it as often as you like, also after a crash.
* NEVER DELETES: it does not remove anything from the old place, and it never overwrites a file
  in the bucket that differs from the receipt (it reports `target_mismatch` instead).
* A damaged original (hash differs from the database) is not copied.
* `--rewrite-urls` (needs `--apply`) updates `recordings.audio_url` to the bucket's public address,
  only for files that are proven to be in the bucket. Without it the database is not changed.

Where the old files are read from (`--source`):

* `url` (default): from each recording's current `audio_url`, over HTTPS. This works from a
  laptop, with no access to the server's disk: the API serves its own disk files at that address.
* `local`: from a folder on this machine (`--source-dir`), for a copy of the server disk.

The target is the storage of the environment: set `RECORDING_STORAGE_BACKEND=s3` and the
`RECORDING_S3_*` values (Cloudflare R2), or pass `--target-dir` to copy into a folder (a drill).

    cd apps/api
    python scripts/migrate_recording_files.py                              # dry run
    python scripts/migrate_recording_files.py --apply --limit 20           # a pilot
    python scripts/migrate_recording_files.py --apply --rewrite-urls --report moved.csv
    python scripts/migrate_recording_files.py --verify-existing            # integrity check only

Secrets are read from the environment and are never printed.
"""

from __future__ import annotations

import argparse
import asyncio
import csv
import sys
from collections.abc import Sequence
from pathlib import Path

API_ROOT = Path(__file__).resolve().parents[1]
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

import httpx  # noqa: E402
from sqlalchemy import select, update  # noqa: E402
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker  # noqa: E402

from app.models.recordings import Recording  # noqa: E402
from app.services.recording_storage import (  # noqa: E402
    LocalDiskStorage,
    RecordingStorage,
    StorageError,
)
from app.services.storage_migration import (  # noqa: E402
    COPIED,
    PRESENT,
    FileReceipt,
    FileResult,
    MigrationReport,
    migrate_one,
)


class UrlSource:
    """Read-only source that fetches each file from the address the database already holds."""

    name = "url"

    def __init__(self, urls: dict[str, str], *, timeout: float = 120.0) -> None:
        self.urls = urls
        self.timeout = timeout

    async def size(self, key: str) -> int | None:
        url = self.urls.get(key)
        if not url:
            return None
        try:
            async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=True) as client:
                response = await client.head(url)
        except httpx.HTTPError as exc:
            raise StorageError("Source is not reachable") from exc
        if response.status_code == 404:
            return None
        if response.status_code >= 400:
            raise StorageError(f"Source refused the request ({response.status_code})")
        return int(response.headers.get("content-length", "0"))

    async def materialize(self, key: str, destination: Path) -> None:
        url = self.urls.get(key)
        if not url:
            raise StorageError("Object not found")
        try:
            async with (
                httpx.AsyncClient(timeout=self.timeout, follow_redirects=True) as client,
                client.stream("GET", url) as response,
            ):
                if response.status_code >= 400:
                    raise StorageError(f"Source refused the request ({response.status_code})")
                with destination.open("wb") as handle:
                    async for chunk in response.aiter_bytes(1024 * 1024):
                        handle.write(chunk)
        except httpx.HTTPError as exc:
            raise StorageError("Source is not reachable") from exc


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Copy recording files to R2 (S3), verify by SHA-256. Dry run by default."
    )
    parser.add_argument("--apply", action="store_true", help="really copy (default is a dry run)")
    parser.add_argument(
        "--rewrite-urls",
        action="store_true",
        help="with --apply: set recordings.audio_url to the target's address for verified files",
    )
    parser.add_argument(
        "--verify-existing",
        action="store_true",
        help="also re-read files already in the target and check their SHA-256",
    )
    parser.add_argument("--source", choices=("url", "local"), default="url")
    parser.add_argument("--source-dir", type=Path, help="folder of the old files (--source local)")
    parser.add_argument("--target-dir", type=Path, help="copy into a folder instead of the bucket")
    parser.add_argument("--limit", type=int, default=0, help="at most this many files (0 = all)")
    parser.add_argument("--report", type=Path, help="write a CSV: one line per file")
    parser.add_argument("--yes", action="store_true", help="do not ask before --apply")
    return parser


async def load_receipts(
    sessions: async_sessionmaker[AsyncSession], limit: int
) -> tuple[list[FileReceipt], dict[str, str]]:
    async with sessions() as session:
        query = select(
            Recording.audio_key, Recording.audio_sha256, Recording.audio_bytes, Recording.audio_url
        ).order_by(Recording.created_at)
        if limit > 0:
            query = query.limit(limit)
        rows = (await session.execute(query)).all()
    receipts = [FileReceipt(key=r[0], sha256=r[1], size=r[2]) for r in rows]
    return receipts, {r[0]: r[3] for r in rows}


def write_report(path: Path, report: MigrationReport) -> None:
    with path.open("w", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["key", "outcome", "detail"])
        for item in report.results:
            writer.writerow([item.key, item.outcome, item.detail])


async def run(
    *,
    receipts: list[FileReceipt],
    source: RecordingStorage,
    target: RecordingStorage,
    apply: bool,
    verify_existing: bool,
    rewrite_urls: bool,
    sessions: async_sessionmaker[AsyncSession] | None,
    out=sys.stdout,
) -> MigrationReport:
    report = MigrationReport(apply=apply)
    total = len(receipts)
    for number, receipt in enumerate(receipts, start=1):
        result: FileResult = await migrate_one(
            receipt, source=source, target=target, apply=apply, verify_existing=verify_existing
        )
        report.results.append(result)
        if result.outcome not in (PRESENT,) or number % 50 == 0 or number == total:
            print(f"[{number}/{total}] {result.outcome:<18} {result.key} {result.detail}", file=out)
        if (
            apply
            and rewrite_urls
            and sessions is not None
            and result.outcome in (COPIED, PRESENT)
        ):
            new_url = target.public_url(receipt.key)
            async with sessions() as session:
                await session.execute(
                    update(Recording)
                    .where(Recording.audio_key == receipt.key, Recording.audio_url != new_url)
                    .values(audio_url=new_url)
                )
                await session.commit()
    return report


def _database_label(url: str) -> str:
    """Host and database name only: the password never reaches the screen."""
    return url.split("@", 1)[-1].split("?", 1)[0]


async def main_async(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    if args.rewrite_urls and not args.apply:
        print("--rewrite-urls needs --apply.", file=sys.stderr)
        return 2
    if args.source == "local" and not args.source_dir:
        print("--source local needs --source-dir.", file=sys.stderr)
        return 2
    from app.config import get_settings
    from app.core.db import SessionLocal
    from app.services.recording_storage import get_recording_storage

    settings = get_settings()
    receipts, urls = await load_receipts(SessionLocal, args.limit)

    source: RecordingStorage
    if args.source == "local":
        source = LocalDiskStorage(
            base_dir=args.source_dir.resolve(), api_base_url="http://unused", secret="unused"
        )
    else:
        source = UrlSource(urls)  # type: ignore[assignment]

    target: RecordingStorage
    if args.target_dir:
        target = LocalDiskStorage(
            base_dir=args.target_dir.resolve(), api_base_url="http://unused", secret="unused"
        )
    else:
        if settings.recording_storage_backend.lower() != "s3":
            print(
                "The target is not R2: set RECORDING_STORAGE_BACKEND=s3 and the RECORDING_S3_* "
                "values, or pass --target-dir.",
                file=sys.stderr,
            )
            return 2
        target = get_recording_storage(settings)

    print(
        f"Database '{_database_label(settings.database_url)}', {len(receipts)} files, "
        f"source '{args.source}', target '{target.name}', "
        + ("APPLY" if args.apply else "dry run (nothing is written)")
    )
    if (
        args.apply
        and not args.yes
        and input("Type 'yes' to copy and verify for real: ").strip().lower() != "yes"
    ):
        print("Cancelled.")
        return 1

    report = await run(
        receipts=receipts,
        source=source,
        target=target,
        apply=bool(args.apply),
        verify_existing=bool(args.verify_existing),
        rewrite_urls=bool(args.rewrite_urls),
        sessions=SessionLocal,
    )
    print("Summary:", ", ".join(f"{k}={v}" for k, v in report.summary().items() if v))
    if args.report:
        write_report(args.report, report)
        print(f"Report: {args.report}")
    return 0 if report.ok else 1


def main(argv: Sequence[str] | None = None) -> int:
    return asyncio.run(main_async(argv))


if __name__ == "__main__":
    raise SystemExit(main())
