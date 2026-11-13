"""Measure how loud the recordings already in the library are (docs/loudness-leveling.md).

New recordings are measured when they are uploaded or imported. This script fills in the ones that
were stored before that existed, or while ffmpeg was missing:

* `--source recordings` (default): the `recordings` table (Kiirtan, Bhajan, Baba's discourses...).
  The audio is read from the recording storage (Cloudflare R2 or local disk).
* `--source media`: the Prabhat Samgiita archive recordings of the `media` table. They are hosted on
  other sites, so each one is downloaded (polite pace: `--delay`) and the numbers are stored in
  `media.metadata_json["loudness"]` (no new column).
* `--source all`: both.

Safe by design:

* DRY RUN by default: it only lists how many items need a measurement. Nothing is downloaded,
  nothing is written. Add `--execute` to measure and store.
* IDEMPOTENT: an item that already has numbers is skipped (`--remeasure` includes them). Running
  it twice, or after a crash, does no harm: each item is committed on its own.
* LIMITED: `--limit` (default 50) caps the items of one run, so start with a pilot.
* REPORT: `--report file.csv` writes one line per item: what was measured, or why not.
* It never touches the audio files and never changes anything but the three loudness columns
  (or the `loudness` key of `metadata_json`).

Needs `ffmpeg` on the machine that runs it (`brew install ffmpeg` or `apt install ffmpeg`).

    cd apps/api
    python scripts/measure_recording_loudness.py                       # dry run: counts
    python scripts/measure_recording_loudness.py --execute --limit 20  # a pilot
    python scripts/measure_recording_loudness.py --execute --limit 500 --report loudness.csv

Never run it against the production database without a backup, and not from a build server: a
run reads every audio file once.
"""

from __future__ import annotations

import argparse
import asyncio
import csv
import os
import sys
import tempfile
from collections.abc import Awaitable, Callable, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, TextIO

API_ROOT = Path(__file__).resolve().parents[1]
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

import httpx  # noqa: E402
from sqlalchemy import select  # noqa: E402
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker  # noqa: E402

from app.models.media import Media  # noqa: E402
from app.models.recordings import Recording  # noqa: E402
from app.services.media_proxy import MEDIA_FETCH_USER_AGENT  # noqa: E402
from app.services.recording_loudness import (  # noqa: E402
    Loudness,
    ffmpeg_available,
    loudness_from_metadata,
    measure_loudness,
)
from app.services.recording_storage import RecordingStorage, StorageError  # noqa: E402

MB = 1024 * 1024
VISIBLE = ("published", "flagged")
SOURCES = ("recordings", "media", "all")
REPORT_FIELDS = ["source", "id", "title", "status", "lufs", "true_peak_db", "detail"]

Meter = Callable[[Path, str], Awaitable[Loudness | None]]
Downloader = Callable[[str, Path, int], Awaitable[bool]]


@dataclass
class Config:
    source: str = "recordings"
    execute: bool = False
    limit: int = 50
    remeasure: bool = False
    ffmpeg: str = "ffmpeg"
    delay: float = 1.0
    max_bytes: int = 200 * MB
    report_path: Path | None = None


@dataclass
class Result:
    source: str
    ident: str
    title: str
    status: str  # would_measure | measured | skipped | unmeasurable | failed
    lufs: float | None = None
    true_peak_db: float | None = None
    detail: str = ""


async def download_to(url: str, target: Path, max_bytes: int) -> bool:
    """Stream a public audio URL into `target`. False when it is too big, refused or unreachable."""
    headers = {"User-Agent": MEDIA_FETCH_USER_AGENT}
    try:
        async with (
            httpx.AsyncClient(timeout=60.0, follow_redirects=True, headers=headers) as client,
            client.stream("GET", url) as response,
        ):
            if response.status_code != 200:
                return False
            length = response.headers.get("content-length")
            if length and length.isdigit() and int(length) > max_bytes:
                return False
            written = 0
            with target.open("wb") as handle:
                async for chunk in response.aiter_bytes(1024 * 1024):
                    written += len(chunk)
                    if written > max_bytes:
                        return False
                    handle.write(chunk)
            return written > 0
    except httpx.HTTPError:
        return False


class Backfill:
    def __init__(
        self,
        config: Config,
        *,
        sessions: async_sessionmaker[AsyncSession],
        storage: RecordingStorage | None,
        out: TextIO = sys.stdout,
        meter: Meter | None = None,
        downloader: Downloader | None = None,
    ) -> None:
        self.config = config
        self.sessions = sessions
        self.storage = storage
        self.out = out
        self.meter: Meter = meter or measure_loudness
        self.downloader: Downloader = downloader or download_to
        self.results: list[Result] = []

    def say(self, text: str) -> None:
        print(text, file=self.out)

    async def run(self) -> list[Result]:
        config = self.config
        mode = "EXECUTE" if config.execute else "DRY RUN (nothing is downloaded or written)"
        self.say(f"Loudness backfill: {mode}; source {config.source}; limit {config.limit}")
        budget = config.limit
        if config.source in ("recordings", "all"):
            budget -= await self._recordings(budget)
        if config.source in ("media", "all") and budget > 0:
            budget -= await self._media(budget)
        self._summary()
        self._write_report()
        return self.results

    # ------------------------------------------------------------------ recordings

    async def _recordings(self, budget: int) -> int:
        if budget <= 0:
            return 0
        async with self.sessions() as session:
            query = select(Recording.id, Recording.title, Recording.audio_key).where(
                Recording.status.in_(VISIBLE)
            )
            if not self.config.remeasure:
                query = query.where(Recording.loudness_lufs.is_(None))
            rows = (await session.execute(query.order_by(Recording.created_at).limit(budget))).all()
        self.say(f"recordings that need a measurement (up to the limit): {len(rows)}")
        for ident, title, key in rows:
            result = Result("recordings", str(ident), title, "would_measure")
            if self.config.execute:
                result = await self._measure_recording(ident, title, key)
            self._remember(result)
        return len(rows)

    async def _measure_recording(self, ident: Any, title: str, key: str) -> Result:
        base = Result("recordings", str(ident), title, "failed")
        if self.storage is None:
            base.detail = "no storage configured"
            return base
        with tempfile.TemporaryDirectory(prefix="loudness-") as folder:
            local = Path(folder) / "audio"
            try:
                await self.storage.materialize(key, local)
            except StorageError as exc:
                base.detail = f"could not read the file: {exc}"
                return base
            except OSError as exc:
                base.detail = f"could not read the file: {exc}"
                return base
            found = await self.meter(local, self.config.ffmpeg)
        if found is None:
            base.status = "unmeasurable"
            base.detail = "ffmpeg gave no usable numbers (silent, damaged or not audio)"
            return base
        async with self.sessions() as session:
            row = await session.get(Recording, ident)
            if row is None:
                base.detail = "the recording is gone"
                return base
            row.loudness_lufs = found.lufs
            row.true_peak_db = found.true_peak_db
            row.loudness_measured_at = datetime.now(UTC)
            await session.commit()
        return Result("recordings", str(ident), title, "measured", found.lufs, found.true_peak_db)

    # ------------------------------------------------------------------ media (the archive)

    async def _media(self, budget: int) -> int:
        if budget <= 0:
            return 0
        async with self.sessions() as session:
            rows = (
                await session.execute(
                    select(Media.id, Media.title, Media.url, Media.metadata_json)
                    .where(Media.kind == "audio")
                    .order_by(Media.id)
                )
            ).all()
        todo = [
            (ident, title, url)
            for ident, title, url, metadata in rows
            if str(url).lower().startswith("https://")
            and (self.config.remeasure or loudness_from_metadata(metadata) is None)
        ][:budget]
        self.say(f"archive audio items that need a measurement (up to the limit): {len(todo)}")
        for index, (ident, title, url) in enumerate(todo):
            result = Result("media", str(ident), title, "would_measure")
            if self.config.execute:
                if index and self.config.delay > 0:
                    await asyncio.sleep(self.config.delay)
                result = await self._measure_media(ident, title, url)
            self._remember(result)
        return len(todo)

    async def _measure_media(self, ident: int, title: str, url: str) -> Result:
        base = Result("media", str(ident), title, "failed")
        with tempfile.TemporaryDirectory(prefix="loudness-") as folder:
            local = Path(folder) / "audio"
            if not await self.downloader(url, local, self.config.max_bytes):
                base.detail = "could not download the file (or it is over the size limit)"
                return base
            found = await self.meter(local, self.config.ffmpeg)
        if found is None:
            base.status = "unmeasurable"
            base.detail = "ffmpeg gave no usable numbers (silent, damaged or not audio)"
            return base
        async with self.sessions() as session:
            row = await session.get(Media, ident)
            if row is None:
                base.detail = "the media item is gone"
                return base
            # a new dict: SQLAlchemy does not see an in-place change of a JSON column
            row.metadata_json = {
                **(row.metadata_json or {}),
                "loudness": {
                    "lufs": found.lufs,
                    "true_peak_db": found.true_peak_db,
                    "measured_at": datetime.now(UTC).isoformat(timespec="seconds"),
                },
            }
            await session.commit()
        return Result("media", str(ident), title, "measured", found.lufs, found.true_peak_db)

    # ------------------------------------------------------------------ output

    def _remember(self, result: Result) -> None:
        self.results.append(result)
        if result.status == "would_measure":
            return
        shown = f"{result.lufs} LUFS, {result.true_peak_db} dBTP" if result.lufs is not None else ""
        name = f"{result.source} {result.ident} {result.title[:50]}"
        self.say(f"  [{result.status}] {name} {shown} {result.detail}")

    def _summary(self) -> None:
        counts: dict[str, int] = {}
        for result in self.results:
            counts[result.status] = counts.get(result.status, 0) + 1
        line = (
            ", ".join(f"{name} {count}" for name, count in sorted(counts.items()))
            or "nothing to do"
        )
        self.say(f"Done: {line}")
        if not self.config.execute and self.results:
            self.say(
                "This was a dry run. Add --execute to measure and store (try --limit 20 first)."
            )

    def _write_report(self) -> None:
        path = self.config.report_path
        if path is None:
            return
        with path.open("w", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(handle, fieldnames=REPORT_FIELDS)
            writer.writeheader()
            for result in self.results:
                writer.writerow(
                    {
                        "source": result.source,
                        "id": result.ident,
                        "title": result.title,
                        "status": result.status,
                        "lufs": "" if result.lufs is None else result.lufs,
                        "true_peak_db": "" if result.true_peak_db is None else result.true_peak_db,
                        "detail": result.detail,
                    }
                )
        self.say(f"Report: {path}")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawTextHelpFormatter
    )
    parser.add_argument("--source", choices=SOURCES, default="recordings")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--dry-run", action="store_true", help="only count (the default)")
    mode.add_argument("--execute", action="store_true", help="really measure and store")
    parser.add_argument("--limit", type=int, default=50, help="items in this run (default 50)")
    parser.add_argument(
        "--remeasure", action="store_true", help="include items that already have numbers"
    )
    parser.add_argument(
        "--ffmpeg", help="ffmpeg program (default: RECORDING_FFMPEG_PATH or ffmpeg)"
    )
    parser.add_argument(
        "--delay", type=float, default=1.0, help="seconds between archive downloads"
    )
    parser.add_argument("--max-mb", type=int, default=200, help="largest archive file to download")
    parser.add_argument("--report", type=Path, help="write a CSV report")
    parser.add_argument("--yes", action="store_true", help="do not ask before --execute")
    return parser


def _database_label(url: str) -> str:
    """Host and database name only: the password never reaches the screen."""
    return url.split("@", 1)[-1].split("?", 1)[0]


async def main_async(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    if args.limit < 1:
        print("--limit must be at least 1.", file=sys.stderr)
        return 2
    from app.config import get_settings
    from app.core.db import SessionLocal

    settings = get_settings()
    config = Config(
        source=args.source,
        execute=bool(args.execute),
        limit=args.limit,
        remeasure=bool(args.remeasure),
        ffmpeg=args.ffmpeg or settings.recording_ffmpeg_path,
        delay=args.delay,
        max_bytes=args.max_mb * MB,
        report_path=args.report,
    )
    if config.execute and not ffmpeg_available(config.ffmpeg):
        print(
            f"ffmpeg ('{config.ffmpeg}') is not installed: nothing can be measured.",
            file=sys.stderr,
        )
        return 2
    storage: RecordingStorage | None = None
    if config.execute:
        if config.source in ("recordings", "all"):
            from app.services.recording_storage import get_recording_storage

            storage = get_recording_storage(settings)
        print(
            f"Target: database '{_database_label(settings.database_url)}'"
            + (f", storage '{storage.name}'" if storage else "")
        )
        if (
            not args.yes
            and input("Type 'yes' to measure and store for real: ").strip().lower() != "yes"
        ):
            print("Cancelled.")
            return 1
    await Backfill(config, sessions=SessionLocal, storage=storage).run()
    return 0


def main(argv: Sequence[str] | None = None) -> int:
    return asyncio.run(main_async(argv))


if __name__ == "__main__":
    os.environ.setdefault("PYTHONUNBUFFERED", "1")
    raise SystemExit(main())
