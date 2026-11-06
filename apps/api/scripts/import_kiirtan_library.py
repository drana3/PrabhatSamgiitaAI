#!/usr/bin/env python3
"""Bulk import of a Kiirtan library (a folder of audio files plus a metadata table).

Safe by default: WITHOUT `--execute` this is a dry run. It reads the database (to know which files
are already in the library) and prints what it WOULD do; it writes nothing, uploads nothing.

    # 1. look first (the default)
    python scripts/import_kiirtan_library.py --folder ~/Kiirtan --csv ~/Kiirtan/table.csv
    # 2. a pilot of 50 files
    python scripts/import_kiirtan_library.py --folder ... --csv ... --limit 50 --execute
    # 3. the rest (resumes from the state file; finished files are skipped)
    python scripts/import_kiirtan_library.py --folder ... --csv ... --execute

The table is a CSV with a header row: `title` (required), `performer`, `mantra`, `year`, and
`file` (the file name inside the folder; when it is missing, the file whose name without extension
equals the title is used). `type` is optional too. Commas or semicolons both work; UTF-8.

Per file, in this order:
  1. the SHA-256 of the file is in the library already (or earlier in this run): skipped;
  2. not audio, or larger than the limit: reported, not imported;
  3. Chromaprint fingerprint close to a recording in the library or earlier in this run:
     NOT imported, written to the report CSV for a human to decide;
  4. otherwise: the audio is normalised (MP3 and M4A are stored as they are, other formats are
     converted to MP3 128 kbps with ffmpeg; `--normalise off` stores every file as it is),
     uploaded to the storage backend the API uses (RECORDING_STORAGE_BACKEND), and a published
     recording is created with the mantra group assigned by the same rule as the API.

`recordings.audio_sha256` holds the hash of the SOURCE file, so the same file sent later through
the app is refused as a duplicate even when this script converted it. Imported recordings have no
member account (author_id empty), are marked reviewed (they would flood the admin "new" queue) and
are credited to `--added-by`.

The state file (`--state`, default next to the table) is written after every file, so a stopped
run continues where it stopped. Delete a file's entry from it to process that file again.

Design and rules: docs/kiirtan-publishing.md, section "Duplicates". The fingerprint step needs
`fpcalc`; with `--execute` the script refuses to start without it unless `--allow-no-fingerprint`.
"""

from __future__ import annotations

import argparse
import asyncio
import csv
import json
import os
import shutil
import sys
import tempfile
from collections.abc import Awaitable, Callable, Sequence
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, TextIO

API_ROOT = Path(__file__).resolve().parents[1]
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

from sqlalchemy import select  # noqa: E402
from sqlalchemy.exc import IntegrityError  # noqa: E402
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker  # noqa: E402

from app.models.recordings import MantraGroup, Recording  # noqa: E402
from app.services.mantras import clean_mantra, get_or_create_group, mantra_key  # noqa: E402
from app.services.recording_fingerprint import (  # noqa: E402
    SIMILAR_THRESHOLD,
    Fingerprint,
    compute_fingerprint,
    decode_fingerprint,
    fpcalc_available,
    sha256_of_file,
    similar_matches,
)
from app.services.recording_storage import (  # noqa: E402
    RecordingStorage,
    new_key,
    sniff_audio,
)
from app.services.recordings import VISIBLE, clean_text, validate_type  # noqa: E402

# The folder part of imported storage keys: there is no member behind a bulk-loaded recording.
LIBRARY_OWNER = "00000000-0000-0000-0000-000000000000"
MB = 1024 * 1024
DEFAULT_ADDED_BY = "Ananda Marga team"
REVIEWED_BY = "bulk import"
DONE = {"imported", "skipped_exact", "near_duplicate"}
CONTENT_TYPES = {
    "mp3": "audio/mpeg",
    "m4a": "audio/mp4",
    "aac": "audio/aac",
    "wav": "audio/wav",
    "ogg": "audio/ogg",
    "flac": "audio/flac",
    "webm": "audio/webm",
}
KEEP_AS_IS = {"mp3", "m4a"}
REPORT_FIELDS = [
    "file",
    "title",
    "performer",
    "mantra",
    "year",
    "status",
    "detail",
    "match_id",
    "match_title",
    "score",
    "sha256",
]

# --------------------------------------------------------------------------- the table


@dataclass(frozen=True)
class Row:
    line: int
    title: str
    performer: str
    mantra: str
    year: int | None
    file: str
    type: str = "other"


def _read_table(path: Path) -> list[dict[str, str]]:
    text = path.read_text(encoding="utf-8-sig")
    try:
        dialect = csv.Sniffer().sniff(text[:4096], delimiters=",;\t")
    except csv.Error:
        dialect = csv.excel
    reader = csv.DictReader(text.splitlines(), dialect=dialect)
    rows: list[dict[str, str]] = []
    for raw in reader:
        rows.append({(k or "").strip().lower(): (v or "").strip() for k, v in raw.items()})
    return rows


def load_rows(table: Path, folder: Path) -> tuple[list[Row], list[dict[str, str]]]:
    """The rows of the table, and the report lines of rows that cannot be used."""
    by_stem = {p.stem.lower(): p.name for p in folder.iterdir() if p.is_file()}
    rows: list[Row] = []
    problems: list[dict[str, str]] = []
    for number, raw in enumerate(_read_table(table), start=2):
        title = clean_text(raw.get("title"), 200)
        name = raw.get("file") or raw.get("filename") or by_stem.get(title.lower(), "")
        year_text = raw.get("year", "")
        year: int | None = None
        if year_text:
            try:
                year = int(year_text)
            except ValueError:
                year = None
        if not title or not name:
            problems.append(
                {
                    "file": name,
                    "title": title,
                    "status": "bad_row",
                    "detail": f"line {number}: a title and a file are required",
                }
            )
            continue
        rows.append(
            Row(
                line=number,
                title=title,
                performer=clean_text(raw.get("performer") or raw.get("author"), 200),
                mantra=clean_mantra(raw.get("mantra")),
                year=year if year and 1800 <= year <= 2200 else None,
                file=name,
                type=raw.get("type") or "other",
            )
        )
    return rows, problems


# --------------------------------------------------------------------------- the state file


class State:
    """Per file: its final answer, so a stopped run resumes. Written after every file."""

    def __init__(self, path: Path | None) -> None:
        self.path = path
        self.items: dict[str, dict[str, Any]] = {}
        if path is not None and path.is_file():
            self.items = json.loads(path.read_text(encoding="utf-8")).get("files", {})

    def done(self, name: str) -> dict[str, Any] | None:
        entry = self.items.get(name)
        return entry if entry and entry.get("status") in DONE else None

    def record(self, name: str, **values: Any) -> None:
        self.items[name] = {**values, "at": datetime.now(UTC).isoformat()}
        self.save()

    def save(self) -> None:
        if self.path is None:
            return
        temporary = self.path.with_suffix(self.path.suffix + ".tmp")
        temporary.write_text(
            json.dumps({"version": 1, "files": self.items}, ensure_ascii=False, indent=1),
            encoding="utf-8",
        )
        temporary.replace(self.path)


# --------------------------------------------------------------------------- the library


@dataclass
class Library:
    """What the database already knows: hashes, fingerprints, mantra groups."""

    hashes: dict[str, tuple[str, str, str]] = field(
        default_factory=dict
    )  # sha -> id, title, status
    fingerprints: list[tuple[str, str]] = field(default_factory=list)  # id, encoded
    titles: dict[str, str] = field(default_factory=dict)  # id -> title
    groups: set[tuple[str, str]] = field(default_factory=set)  # (kind, key)


async def load_library(session: AsyncSession) -> Library:
    library = Library()
    rows = (
        await session.execute(
            select(
                Recording.id,
                Recording.title,
                Recording.status,
                Recording.audio_sha256,
                Recording.fingerprint,
            )
        )
    ).all()
    for ident, title, status, sha, fingerprint in rows:
        library.hashes[sha] = (str(ident), title, status)
        library.titles[str(ident)] = title
        if fingerprint and status in VISIBLE:
            library.fingerprints.append((str(ident), fingerprint))
    for kind, key in (
        await session.execute(
            select(MantraGroup.kind, MantraGroup.key).where(MantraGroup.merged_into_id.is_(None))
        )
    ).all():
        library.groups.add((kind, key))
    return library


# --------------------------------------------------------------------------- the run


@dataclass
class Config:
    folder: Path
    table: Path
    execute: bool = False
    limit: int | None = None
    kind: str = "kiirtan"
    added_by: str = DEFAULT_ADDED_BY
    normalise: str = "mp3"  # "mp3" or "off"
    ffmpeg: str = "ffmpeg"
    fpcalc: str = "fpcalc"
    max_bytes: int = 60 * 1024 * 1024
    state_path: Path | None = None
    report_path: Path | None = None
    offline: bool = False
    allow_no_fingerprint: bool = False
    max_failures: int = 5
    threshold: float = SIMILAR_THRESHOLD


@dataclass
class Outcome:
    row: Row | None
    status: str
    detail: str = ""
    sha256: str = ""
    match_id: str = ""
    match_title: str = ""
    score: float | None = None


Converter = Callable[[Path, Path, str], Awaitable[bool]]


async def ffmpeg_to_mp3(source: Path, target: Path, ffmpeg: str) -> bool:
    """Decode `source`, write a 128 kbps 44.1 kHz stereo MP3 without tags. False on any failure."""
    binary = shutil.which(ffmpeg)
    if binary is None:
        return False
    process = await asyncio.create_subprocess_exec(
        binary,
        "-nostdin",
        "-y",
        "-loglevel",
        "error",
        "-i",
        str(source),
        "-vn",
        "-map_metadata",
        "-1",
        "-ar",
        "44100",
        "-ac",
        "2",
        "-b:a",
        "128k",
        "-f",
        "mp3",
        str(target),
        stdout=asyncio.subprocess.DEVNULL,
        stderr=asyncio.subprocess.DEVNULL,
    )
    try:
        await asyncio.wait_for(process.wait(), timeout=900)
    except TimeoutError:
        process.kill()
        return False
    return process.returncode == 0 and target.is_file() and target.stat().st_size > 0


Fingerprinter = Callable[[Path, str], Awaitable[Fingerprint | None]]


class Importer:
    def __init__(
        self,
        config: Config,
        *,
        sessions: async_sessionmaker[AsyncSession] | None,
        storage: RecordingStorage | None,
        out: TextIO = sys.stdout,
        converter: Converter | None = None,
        fingerprinter: Fingerprinter | None = None,
    ) -> None:
        self.config = config
        self.sessions = sessions
        self.storage = storage
        self.out = out
        self.converter: Converter = converter or (
            lambda source, target, _name: ffmpeg_to_mp3(source, target, config.ffmpeg)
        )
        self.fingerprinter: Fingerprinter = fingerprinter or compute_fingerprint
        self.state = State(config.state_path)
        self.outcomes: list[Outcome] = []

    def say(self, text: str) -> None:
        print(text, file=self.out)

    async def run(self) -> list[Outcome]:
        config = self.config
        mode = "EXECUTE" if config.execute else "DRY RUN (nothing is written)"
        self.say(f"Kiirtan library import: {mode}")
        self.say(f"  folder {config.folder}")
        self.say(f"  table  {config.table}")
        if config.limit:
            self.say(f"  pilot: at most {config.limit} files")
        rows, problems = load_rows(config.table, config.folder)
        for problem in problems:
            self.outcomes.append(Outcome(None, problem["status"], problem["detail"]))
            self._remember_problem(problem)
        library = await self._library()
        batch_hashes: dict[str, str] = {}
        batch_prints: list[tuple[str, str]] = []
        batch_titles: dict[str, str] = {}
        planned = 0
        failures = 0
        seen_files: set[str] = set()
        for row in rows:
            if config.limit and planned >= config.limit:
                self.say(f"Limit of {config.limit} reached; the rest is left for the next run.")
                break
            if row.file in seen_files:
                self._finish(Outcome(row, "bad_row", "the same file is listed twice"))
                continue
            seen_files.add(row.file)
            previous = self.state.done(row.file)
            if previous is not None:
                self._finish(
                    Outcome(row, "skipped_state", f"done earlier: {previous.get('status')}"),
                    quiet=True,
                )
                continue
            outcome = await self._one(row, library, batch_hashes, batch_prints, batch_titles)
            if outcome.status in ("imported", "would_import"):
                planned += 1
            if outcome.status == "failed":
                failures += 1
                if failures >= config.max_failures:
                    self._finish(outcome)
                    self.say(f"Stopped after {failures} failures. Fix the cause and run again.")
                    break
            else:
                failures = 0
            self._finish(outcome)
        self._write_report()
        self._summary()
        return self.outcomes

    # ---- pieces

    async def _library(self) -> Library:
        if self.config.offline or self.sessions is None:
            self.say("  database: not read (--offline); only this run is checked for duplicates")
            return Library()
        async with self.sessions() as session:
            library = await load_library(session)
        self.say(
            f"  library: {len(library.hashes)} recordings, "
            f"{len(library.fingerprints)} with a fingerprint, {len(library.groups)} mantras"
        )
        return library

    async def _one(
        self,
        row: Row,
        library: Library,
        batch_hashes: dict[str, str],
        batch_prints: list[tuple[str, str]],
        batch_titles: dict[str, str],
    ) -> Outcome:
        config = self.config
        path = config.folder / row.file
        if not path.is_file():
            return Outcome(row, "missing_file", "no such file in the folder")
        size = path.stat().st_size
        if size == 0:
            return Outcome(row, "not_audio", "the file is empty")
        with path.open("rb") as handle:
            extension = sniff_audio(handle.read(16))
        if extension is None:
            return Outcome(row, "not_audio", "this does not look like an audio file")
        sha = sha256_of_file(path)
        known = library.hashes.get(sha)
        if known is not None:
            note = " (removed by the team earlier)" if known[2] == "removed" else ""
            return Outcome(
                row,
                "skipped_exact",
                f"this file is in the library already{note}",
                sha,
                known[0],
                known[1],
            )
        if sha in batch_hashes:
            return Outcome(
                row,
                "skipped_exact",
                "the same file appears earlier in this table",
                sha,
                "",
                batch_hashes[sha],
            )
        if size > config.max_bytes:
            return Outcome(
                row,
                "too_big",
                f"{size // MB} MB is over the limit of {config.max_bytes // MB} MB",
                sha,
            )

        convert = config.normalise == "mp3" and extension not in KEEP_AS_IS
        # The fingerprint is taken from the original: it is what a later upload will be compared to.
        print_ = await self.fingerprinter(path, config.fpcalc)
        if print_ is not None:
            mine = decode_fingerprint(print_.data)
            candidates = library.fingerprints + batch_prints
            titles = {**library.titles, **batch_titles}
            matches = similar_matches(mine, candidates, threshold=config.threshold, limit=1)
            if matches:
                ident, score = matches[0]
                return Outcome(
                    row,
                    "near_duplicate",
                    "sounds like a recording that is already there; check it by ear",
                    sha,
                    ident,
                    titles.get(ident, ""),
                    score,
                )
        mantra_note = self._mantra_note(row, library)
        action = "convert to MP3, " if convert else ""
        if print_ is not None:
            batch_prints.append((f"file:{row.file}", print_.data))
            batch_titles[f"file:{row.file}"] = row.title
        if not config.execute:
            batch_hashes[sha] = row.title
            return Outcome(row, "would_import", f"{action}upload{mantra_note}", sha)
        with tempfile.TemporaryDirectory(prefix="kiirtan-import-") as scratch:
            source, stored_extension = path, extension
            if convert:
                target = Path(scratch) / "normalised.mp3"
                if not await self.converter(path, target, config.ffmpeg):
                    return Outcome(row, "failed", "ffmpeg could not convert this file", sha)
                source, stored_extension = target, "mp3"
            return await self._store(
                row, library, source, stored_extension, sha, print_, mantra_note, batch_hashes
            )

    def _mantra_note(self, row: Row, library: Library) -> str:
        key = mantra_key(row.mantra)
        if not key:
            return ", no mantra group"
        new = (self.config.kind, key) not in library.groups
        library.groups.add((self.config.kind, key))
        return f", mantra '{row.mantra}'" + (" (new group)" if new else "")

    async def _store(
        self,
        row: Row,
        library: Library,
        source: Path,
        extension: str,
        sha: str,
        print_: Fingerprint | None,
        mantra_note: str,
        batch_hashes: dict[str, str],
    ) -> Outcome:
        assert self.storage is not None and self.sessions is not None
        config = self.config
        key = new_key(LIBRARY_OWNER, extension)
        try:
            await self.storage.store_file(key, source, CONTENT_TYPES.get(extension, "audio/mpeg"))
        except Exception as exc:  # noqa: BLE001  (storage errors differ per backend)
            return Outcome(row, "failed", f"upload failed: {exc}", sha)
        moment = datetime.now(UTC)
        try:
            async with self.sessions() as session:
                group = await get_or_create_group(session, config.kind, row.mantra)
                recording = Recording(
                    kind=config.kind,
                    type=validate_type(config.kind, row.type),
                    title=row.title,
                    author=row.performer,
                    added_by=config.added_by,
                    author_id=None,
                    by_author=False,
                    status="published",
                    duration_sec=print_.duration_sec if print_ else None,
                    audio_key=key,
                    audio_url=self.storage.public_url(key),
                    audio_mime=f"audio/{extension}",
                    audio_bytes=source.stat().st_size,
                    audio_sha256=sha,
                    fingerprint=print_.data if print_ else None,
                    published_at=moment,
                    reviewed_at=moment,
                    reviewed_by=REVIEWED_BY,
                    mantra_title=row.mantra or None if group else None,
                    mantra_group_id=group.id if group else None,
                    year=row.year,
                )
                session.add(recording)
                await session.commit()
                ident = str(recording.id)
        except IntegrityError:
            await self.storage.delete(key)
            return Outcome(row, "skipped_exact", "the same file arrived meanwhile", sha)
        except Exception as exc:  # noqa: BLE001
            await self.storage.delete(key)
            return Outcome(row, "failed", f"database error: {exc}", sha)
        library.hashes[sha] = (ident, row.title, "published")
        library.titles[ident] = row.title
        if print_ is not None:
            library.fingerprints.append((ident, print_.data))
        batch_hashes[sha] = row.title
        return Outcome(row, "imported", f"stored as {key}{mantra_note}", sha, ident)

    def _remember_problem(self, problem: dict[str, str]) -> None:
        self.say(f"  [bad row] {problem['detail']}")

    def _finish(self, outcome: Outcome, *, quiet: bool = False) -> None:
        self.outcomes.append(outcome)
        row = outcome.row
        if row is None:
            return
        if (
            outcome.status in ("imported", "skipped_exact", "near_duplicate")
            and self.config.execute
        ):
            self.state.record(
                row.file,
                status=outcome.status,
                sha256=outcome.sha256,
                recording_id=outcome.match_id,
                title=row.title,
            )
        if quiet:
            return
        label = outcome.status.replace("_", " ")
        extra = f" -> {outcome.match_title!r}" if outcome.match_title else ""
        score = f" ({outcome.score:.0%})" if outcome.score is not None else ""
        self.say(f"  [{label}] {row.file}: {row.title}{extra}{score} {outcome.detail}".rstrip())

    def _write_report(self) -> None:
        path = self.config.report_path
        if path is None:
            return
        with path.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=REPORT_FIELDS)
            writer.writeheader()
            for outcome in self.outcomes:
                if outcome.status in ("skipped_state",):
                    continue
                row = outcome.row
                writer.writerow(
                    {
                        "file": row.file if row else "",
                        "title": row.title if row else "",
                        "performer": row.performer if row else "",
                        "mantra": row.mantra if row else "",
                        "year": row.year if row and row.year else "",
                        "status": outcome.status,
                        "detail": outcome.detail,
                        "match_id": outcome.match_id,
                        "match_title": outcome.match_title,
                        "score": f"{outcome.score:.3f}" if outcome.score is not None else "",
                        "sha256": outcome.sha256,
                    }
                )
        self.say(f"Report: {path}")

    def _summary(self) -> None:
        counts: dict[str, int] = {}
        for outcome in self.outcomes:
            counts[outcome.status] = counts.get(outcome.status, 0) + 1
        self.say("Summary:")
        for status in sorted(counts):
            self.say(f"  {status.replace('_', ' '):<16} {counts[status]}")
        if not self.config.execute:
            self.say("This was a dry run. Add --execute to do it (try --limit 50 first).")


# --------------------------------------------------------------------------- command line


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Import a folder of Kiirtan audio and its metadata table. Dry run by default.",
    )
    parser.add_argument("--folder", type=Path, required=True, help="folder with the audio files")
    parser.add_argument(
        "--csv",
        type=Path,
        required=True,
        help="metadata table (title, performer, mantra, year, file)",
    )
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument(
        "--dry-run", action="store_true", help="only print what would happen (the default)"
    )
    mode.add_argument("--execute", action="store_true", help="really upload and create recordings")
    parser.add_argument(
        "--limit", type=int, help="pilot: stop after this many files to import (for example 50)"
    )
    parser.add_argument(
        "--state", type=Path, help="resume file (default: <table>.import-state.json)"
    )
    parser.add_argument(
        "--report", type=Path, help="report CSV (default: <table>.import-report.csv)"
    )
    parser.add_argument("--kind", choices=["kiirtan", "bhajan"], default="kiirtan")
    parser.add_argument("--added-by", default=DEFAULT_ADDED_BY)
    parser.add_argument("--normalise", choices=["mp3", "off"], default="mp3")
    parser.add_argument("--ffmpeg", default="ffmpeg")
    parser.add_argument(
        "--max-mb", type=int, help="largest file to import (default: RECORDING_MAX_BYTES)"
    )
    parser.add_argument(
        "--offline", action="store_true", help="dry run without reading the database"
    )
    parser.add_argument(
        "--allow-no-fingerprint", action="store_true", help="import even when fpcalc is missing"
    )
    parser.add_argument(
        "--yes", action="store_true", help="do not ask for confirmation before --execute"
    )
    return parser


def config_from(args: argparse.Namespace, *, fpcalc: str, max_bytes: int) -> Config:
    table: Path = args.csv
    return Config(
        folder=args.folder,
        table=table,
        execute=bool(args.execute),
        limit=args.limit,
        kind=args.kind,
        added_by=args.added_by,
        normalise=args.normalise,
        ffmpeg=args.ffmpeg,
        fpcalc=fpcalc,
        max_bytes=args.max_mb * 1024 * 1024 if args.max_mb else max_bytes,
        state_path=args.state or table.with_suffix(".import-state.json"),
        report_path=args.report or table.with_suffix(".import-report.csv"),
        offline=bool(args.offline),
        allow_no_fingerprint=bool(args.allow_no_fingerprint),
    )


def _database_label(url: str) -> str:
    """Host and database name only: the password never reaches the screen."""
    rest = url.split("@", 1)[-1]
    return rest.split("?", 1)[0]


async def main_async(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    if not args.folder.is_dir():
        print(f"Folder not found: {args.folder}", file=sys.stderr)
        return 2
    if not args.csv.is_file():
        print(f"Table not found: {args.csv}", file=sys.stderr)
        return 2
    from app.config import get_settings

    settings = get_settings()
    config = config_from(
        args, fpcalc=settings.recording_fpcalc_path, max_bytes=settings.recording_max_bytes
    )
    if not fpcalc_available(config.fpcalc):
        message = (
            f"fpcalc ('{config.fpcalc}') is not installed: similar recordings cannot be found."
        )
        if config.execute and not config.allow_no_fingerprint:
            print(message + " Install it, or add --allow-no-fingerprint.", file=sys.stderr)
            return 2
        print("Warning: " + message)
    sessions: async_sessionmaker[AsyncSession] | None = None
    storage: RecordingStorage | None = None
    if not config.offline or config.execute:
        from app.core.db import SessionLocal

        sessions = SessionLocal
    if config.execute:
        from app.services.recording_storage import get_recording_storage

        storage = get_recording_storage(settings)
        print(
            f"Target: storage '{storage.name}', database '{_database_label(settings.database_url)}'"
        )
        if not args.yes and input("Type 'yes' to import for real: ").strip().lower() != "yes":
            print("Cancelled.")
            return 1
    importer = Importer(config, sessions=sessions, storage=storage)
    await importer.run()
    return 0


def main(argv: Sequence[str] | None = None) -> int:
    return asyncio.run(main_async(argv))


if __name__ == "__main__":
    os.environ.setdefault("PYTHONUNBUFFERED", "1")
    raise SystemExit(main())
