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

The table is a CSV with a header row: `title` (required), `performer`, `category`, `language`,
`language_name`, `dance`, `credits`, `year`, `song`, `date` and `file` (the file name inside the
folder; when it is missing, the file whose name without extension equals the title is used). Only
`title` is required; the rest may be empty. Commas or semicolons both work; UTF-8.

  * `category`: kiirtan (default; a Kiirtan is a version of Baba Nam Kevalam, there is no mantra
    column), bhajan, prabhat_samgiita, spiritual_song, dance_song or baba_audio (Baba's Audio
    Discourses: the speaker is Baba, the performer cell is ignored; an old devotional_song reads
    as bhajan). Empty means `--category`. A Kiirtan has no language: the cell is ignored for it.
  * `language`: an ISO code (bn, sa, hi, en, ru, ...) or the English name (Bengali, Hindi, ...);
    `other` needs `language_name`. REQUIRED for bhajan, spiritual_song and baba_audio (the cell, or
    `--language`). Empty cells take `--language` / `--language-name`.
  * `dance`: tandava or kaoshiki. REQUIRED for dance_song (the cell, or `--dance`), not allowed
    for any other category.
  * `performer`: who sings; `credits`: "words and music by"; `year`: the year it was recorded
    (1900 up to this year); `date`: the day it was recorded (YYYY-MM-DD, for a set's track).
  * `song`: the Prabhat Samgiita song number (1 to 5018), REQUIRED when the category is
    prabhat_samgiita, not allowed otherwise. `type` (the old Kiirtan/Bhajan sub-type) is optional.

A FOLDER AS A PLAYLIST FROM AN EVENT: add `--set-title "Retreat in Krakow" --set-date 2025-05-01`
(and `--set-end-date`, `--set-place`, `--set-description`). The recordings go into one playlist
(docs/kiirtan-sets.md) in the order of the table. Then `--csv` is optional: without a table every
audio file of the folder becomes a track, in file-name order, titled from its name
("03_Baba_Nam.mp3" becomes "Baba Nam"). `--category`, `--language` and `--dance` are the playlist's
defaults. Running it again finds the same playlist (same title and start day, no owner) and adds
what is missing.

Per file, in this order:
  1. the SHA-256 of the file is in the library already (or earlier in this run): skipped;
  2. not audio, or larger than the limit: reported, not imported;
  3. Chromaprint fingerprint close to a recording in the library or earlier in this run:
     NOT imported, written to the report CSV for a human to decide;
  4. otherwise: the audio is normalised (MP3 and M4A are stored as they are, other formats are
     converted to MP3 128 kbps with ffmpeg; `--normalise off` stores every file as it is),
     uploaded to the storage backend the API uses (RECORDING_STORAGE_BACKEND), and a published
     recording is created in its category.

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
import re
import shutil
import sys
import tempfile
from collections.abc import Awaitable, Callable, Sequence
from dataclasses import dataclass, field
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Any, TextIO

API_ROOT = Path(__file__).resolve().parents[1]
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

from sqlalchemy import select  # noqa: E402
from sqlalchemy.exc import IntegrityError  # noqa: E402
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker  # noqa: E402

from app.models.recording_collections import RecordingCollection  # noqa: E402
from app.models.recordings import (  # noqa: E402
    BABA_AUTHOR,
    DANCES,
    KINDS_WITH_DANCE,
    KINDS_WITH_LANGUAGE,
    PS_SONG_COUNT,
    RECORDING_KINDS,
    Recording,
    public_kind,
)
from app.schemas.recordings import kind_field_problem  # noqa: E402
from app.services.recording_fingerprint import (  # noqa: E402
    SIMILAR_THRESHOLD,
    Fingerprint,
    compute_fingerprint,
    decode_fingerprint,
    fpcalc_available,
    sha256_of_file,
    similar_matches,
)
from app.services.recording_languages import (  # noqa: E402
    LANGUAGE_CODES,
    OTHER,
    clean_language_other,
    normalize_language,
)
from app.services.recording_loudness import (  # noqa: E402
    Loudness,
    ffmpeg_environment,
    ffmpeg_input_arguments,
    measure_loudness,
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
FIRST_YEAR = 1900
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
    "category",
    "performer",
    "language",
    "language_name",
    "dance",
    "credits",
    "year",
    "song",
    "recorded_on",
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
    year: int | None
    file: str
    category: str = ""  # empty: the run's default category (`--category`)
    language: str | None = None  # an ISO code, or "other"
    language_name: str | None = None  # the name, when the language is "other"
    dance: str | None = None
    recorded_on: date | None = None
    credits: str = ""
    song: int | None = None  # the Prabhat Samgiita song number
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


AUDIO_SUFFIXES = {".mp3", ".m4a", ".aac", ".wav", ".ogg", ".flac", ".webm"}


def title_from_file_name(name: str) -> str:
    """ "03_Baba_Nam-Kevalam.mp3" -> "Baba Nam Kevalam": the track number and the extension go."""
    stem = Path(name).stem
    stem = re.sub(r"^\s*\d{1,3}\s*[-_.)]+\s*", "", stem)
    return clean_text(re.sub(r"[_]+", " ", stem).replace("-", " "), 200) or Path(name).stem


def rows_from_folder(folder: Path) -> list[dict[str, str]]:
    """No table: every audio file of the folder, in file-name order (a set of an event)."""
    files = sorted(
        (p for p in folder.iterdir() if p.is_file() and p.suffix.lower() in AUDIO_SUFFIXES),
        key=lambda p: p.name.lower(),
    )
    return [{"title": title_from_file_name(p.name), "file": p.name} for p in files]


def load_rows(
    table: Path | None,
    folder: Path,
    default_category: str = "kiirtan",
    *,
    default_language: str | None = None,
    default_language_name: str | None = None,
    default_dance: str | None = None,
) -> tuple[list[Row], list[dict[str, str]]]:
    """The rows of the table, and the report lines of rows that cannot be used.

    `table` None: every audio file of the folder is a row (the folder-as-a-playlist mode).
    The defaults fill the language and dance cells that are empty.
    """
    by_stem = {p.stem.lower(): p.name for p in folder.iterdir() if p.is_file()}
    rows: list[Row] = []
    problems: list[dict[str, str]] = []
    table_rows = _read_table(table) if table is not None else rows_from_folder(folder)
    for number, raw in enumerate(table_rows, start=2):
        title = clean_text(raw.get("title"), 200)
        name = raw.get("file") or raw.get("filename") or by_stem.get(title.lower(), "")
        year_text = raw.get("year", "")
        year: int | None = None
        if year_text:
            try:
                year = int(year_text)
            except ValueError:
                year = None
        category = (raw.get("category") or "").strip().lower().replace(" ", "_").replace("-", "_")
        category = public_kind(category)  # the old "devotional song" is a bhajan
        language_text = (raw.get("language") or "").strip()
        language_name = clean_language_other(raw.get("language_name") or raw.get("language_other"))
        dance = (raw.get("dance") or "").strip().lower() or None
        recorded_text = (raw.get("date") or raw.get("recorded_on") or "").strip()
        song_text = (raw.get("song") or raw.get("song_number") or "").strip()
        song = int(song_text) if song_text.isdigit() else None
        effective = category or default_category
        complaint = ""
        language: str | None = None
        recorded_on: date | None = None
        if recorded_text:
            try:
                recorded_on = date.fromisoformat(recorded_text)
            except ValueError:
                complaint = "date must look like 2025-05-01"
        if language_text:
            try:
                language = normalize_language(language_text)
            except ValueError:
                complaint = complaint or (
                    f"language must be an ISO code or English name ({', '.join(LANGUAGE_CODES)}) "
                    "or other"
                )
        else:
            language = default_language
            language_name = language_name or default_language_name
        if effective not in KINDS_WITH_LANGUAGE:
            language, language_name = None, None  # a Kiirtan has no language: the cell is ignored
        elif language != OTHER:
            language_name = None
        if not dance and effective in KINDS_WITH_DANCE:
            dance = default_dance
        if not title or not name:
            complaint = "a title and a file are required"
        elif category and category not in RECORDING_KINDS:
            complaint = f"category must be one of {', '.join(RECORDING_KINDS)}"
        elif dance and dance not in DANCES and effective in KINDS_WITH_DANCE:
            complaint = f"dance must be one of {', '.join(DANCES)}"
        elif effective == "prabhat_samgiita" and (song is None or not 1 <= song <= PS_SONG_COUNT):
            complaint = f"a Prabhat Samgiita recording needs a song number (1 to {PS_SONG_COUNT})"
        elif effective != "prabhat_samgiita" and song_text:
            complaint = "a song number belongs to the prabhat_samgiita category only"
        elif not complaint:
            complaint = (
                kind_field_problem(
                    effective,
                    language=language,
                    language_other=language_name,
                    dance=dance,
                    ps_song_number=song if effective == "prabhat_samgiita" else None,
                )
                or ""
            )
            complaint = complaint.replace("Choose the", "a row needs the").rstrip(".")
        if complaint:
            problems.append(
                {
                    "file": name,
                    "title": title,
                    "status": "bad_row",
                    "detail": f"line {number}: {complaint}",
                }
            )
            continue
        rows.append(
            Row(
                line=number,
                title=title,
                performer=clean_text(raw.get("performer") or raw.get("author"), 200),
                year=year if year and FIRST_YEAR <= year <= datetime.now(UTC).year else None,
                file=name,
                category=category,
                language=language,
                language_name=language_name,
                dance=dance if effective in KINDS_WITH_DANCE else None,
                recorded_on=recorded_on,
                credits=clean_text(raw.get("credits"), 300),
                song=song if effective == "prabhat_samgiita" else None,
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
    """What the database already knows: hashes and fingerprints."""

    hashes: dict[str, tuple[str, str, str]] = field(
        default_factory=dict
    )  # sha -> id, title, status
    fingerprints: list[tuple[str, str]] = field(default_factory=list)  # id, encoded
    titles: dict[str, str] = field(default_factory=dict)  # id -> title


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
    return library


# --------------------------------------------------------------------------- the run


@dataclass
class Config:
    folder: Path
    table: Path | None  # None: every audio file of the folder, in name order (needs a set title)
    execute: bool = False
    limit: int | None = None
    kind: str = "kiirtan"  # the category of rows whose `category` cell is empty
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
    # defaults for table cells that are empty
    language: str | None = None
    language_name: str | None = None
    dance: str | None = None
    # a folder imported as a playlist from an event (docs/kiirtan-sets.md)
    set_title: str | None = None
    set_date: date | None = None
    set_end_date: date | None = None
    set_place: str | None = None
    set_description: str | None = None


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
    # The source is somebody else's file: fixed demuxer, file protocol only, clean environment.
    source_arguments = ffmpeg_input_arguments(source)
    if source_arguments is None:
        return False
    process = await asyncio.create_subprocess_exec(
        binary,
        "-nostdin",
        "-y",
        "-loglevel",
        "error",
        *source_arguments,
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
        stdin=asyncio.subprocess.DEVNULL,
        stdout=asyncio.subprocess.DEVNULL,
        stderr=asyncio.subprocess.DEVNULL,
        env=ffmpeg_environment(),
    )
    try:
        await asyncio.wait_for(process.wait(), timeout=900)
    except TimeoutError:
        process.kill()
        return False
    return process.returncode == 0 and target.is_file() and target.stat().st_size > 0


Fingerprinter = Callable[[Path, str], Awaitable[Fingerprint | None]]
LoudnessMeter = Callable[[Path, str], Awaitable[Loudness | None]]


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
        loudness_meter: LoudnessMeter | None = None,
    ) -> None:
        self.config = config
        self.sessions = sessions
        self.storage = storage
        self.out = out
        self.converter: Converter = converter or (
            lambda source, target, _name: ffmpeg_to_mp3(source, target, config.ffmpeg)
        )
        self.fingerprinter: Fingerprinter = fingerprinter or compute_fingerprint
        # How loud the stored file is (docs/loudness-leveling.md); a miss leaves the numbers empty.
        self.loudness_meter: LoudnessMeter = loudness_meter or measure_loudness
        self.state = State(config.state_path)
        self.outcomes: list[Outcome] = []
        self.collection_id: Any = None  # the playlist the run fills (set mode, --execute)
        self.positions: dict[str, int] = {}

    def say(self, text: str) -> None:
        print(text, file=self.out)

    async def run(self) -> list[Outcome]:
        config = self.config
        mode = "EXECUTE" if config.execute else "DRY RUN (nothing is written)"
        self.say(f"Kiirtan library import: {mode}")
        self.say(f"  folder {config.folder}")
        self.say(f"  table  {config.table or '(none: the audio files of the folder)'}")
        if config.set_title:
            self.say(f"  playlist: {config.set_title!r}, from {config.set_date}")
        if config.limit:
            self.say(f"  pilot: at most {config.limit} files")
        rows, problems = load_rows(
            config.table,
            config.folder,
            config.kind,
            default_language=normalize_language(config.language) if config.language else None,
            default_language_name=config.language_name,
            default_dance=config.dance,
        )
        self.positions = {row.file: number for number, row in enumerate(rows, start=1)}
        for problem in problems:
            self.outcomes.append(Outcome(None, problem["status"], problem["detail"]))
            self._remember_problem(problem)
        library = await self._library()
        if config.set_title and config.execute and rows:
            await self._open_set(len(rows))
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
        await self._close_set()
        self._write_report()
        self._summary()
        return self.outcomes

    # ---- the playlist (set mode)

    async def _open_set(self, expected: int) -> None:
        """Find the playlist of an earlier run (same title and first day, no owner) or make it."""
        assert self.sessions is not None and self.config.set_title and self.config.set_date
        config = self.config
        async with self.sessions() as session:
            found = await session.scalar(
                select(RecordingCollection).where(
                    RecordingCollection.title == clean_text(config.set_title, 200),
                    RecordingCollection.starts_on == config.set_date,
                    RecordingCollection.owner_id.is_(None),
                    RecordingCollection.status == "active",
                )
            )
            if found is None:
                found = RecordingCollection(
                    owner_id=None,
                    owner_name=config.added_by,
                    title=clean_text(config.set_title, 200),
                    description=clean_text(config.set_description, 1000) or None,
                    place=clean_text(config.set_place, 200) or None,
                    starts_on=config.set_date,
                    ends_on=config.set_end_date,
                    event_year=config.set_date.year,
                    event_month=config.set_date.month,
                    default_kind=config.kind,
                    default_language=normalize_language(config.language)
                    if config.language
                    else None,
                    default_language_other=config.language_name,
                    default_dance=config.dance,
                    tracks_expected=expected,
                    status="active",
                )
                session.add(found)
                await session.commit()
                self.say(f"  playlist made: {found.title!r}")
            else:
                self.say(f"  playlist found: {found.title!r} (adding what is missing)")
            self.collection_id = found.id

    async def _close_set(self) -> None:
        if self.collection_id is None or self.sessions is None:
            return
        async with self.sessions() as session:
            collection = await session.get(RecordingCollection, self.collection_id)
            if collection is not None:
                collection.finished_at = datetime.now(UTC)
                await session.commit()

    # ---- pieces

    async def _library(self) -> Library:
        if self.config.offline or self.sessions is None:
            self.say("  database: not read (--offline); only this run is checked for duplicates")
            return Library()
        async with self.sessions() as session:
            library = await load_library(session)
        self.say(
            f"  library: {len(library.hashes)} recordings, "
            f"{len(library.fingerprints)} with a fingerprint"
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
        category = row.category or config.kind
        note = f", {category}" + (f" (PS {row.song})" if row.song else "")
        action = "convert to MP3, " if convert else ""
        if print_ is not None:
            batch_prints.append((f"file:{row.file}", print_.data))
            batch_titles[f"file:{row.file}"] = row.title
        if not config.execute:
            batch_hashes[sha] = row.title
            return Outcome(row, "would_import", f"{action}upload{note}", sha)
        with tempfile.TemporaryDirectory(prefix="kiirtan-import-") as scratch:
            source, stored_extension = path, extension
            if convert:
                target = Path(scratch) / "normalised.mp3"
                if not await self.converter(path, target, config.ffmpeg):
                    return Outcome(row, "failed", "ffmpeg could not convert this file", sha)
                source, stored_extension = target, "mp3"
            return await self._store(
                row, library, source, stored_extension, sha, print_, note, batch_hashes
            )

    async def _store(
        self,
        row: Row,
        library: Library,
        source: Path,
        extension: str,
        sha: str,
        print_: Fingerprint | None,
        note: str,
        batch_hashes: dict[str, str],
    ) -> Outcome:
        assert self.storage is not None and self.sessions is not None
        config = self.config
        key = new_key(LIBRARY_OWNER, extension)
        category = row.category or config.kind
        try:
            await self.storage.store_file(key, source, CONTENT_TYPES.get(extension, "audio/mpeg"))
        except Exception as exc:  # noqa: BLE001  (storage errors differ per backend)
            return Outcome(row, "failed", f"upload failed: {exc}", sha)
        loudness = await self.loudness_meter(source, config.ffmpeg)
        moment = datetime.now(UTC)
        try:
            async with self.sessions() as session:
                recording = Recording(
                    kind=category,
                    type=validate_type(category, row.type),
                    title=row.title,
                    author=BABA_AUTHOR if category == "baba_audio" else row.performer,
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
                    loudness_lufs=loudness.lufs if loudness else None,
                    true_peak_db=loudness.true_peak_db if loudness else None,
                    loudness_measured_at=moment if loudness else None,
                    published_at=moment,
                    reviewed_at=moment,
                    reviewed_by=REVIEWED_BY,
                    year=row.year,
                    # a Kiirtan has no language (it is always Baba Nam Kevalam)
                    language=row.language if category in KINDS_WITH_LANGUAGE else None,
                    language_other=row.language_name if row.language == OTHER else None,
                    dance=row.dance if category in KINDS_WITH_DANCE else None,
                    recorded_on=row.recorded_on,
                    collection_id=self.collection_id,
                    position=self.positions.get(row.file) if self.collection_id else None,
                    credits=row.credits or None,
                    ps_song_number=row.song,
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
        return Outcome(row, "imported", f"stored as {key}{note}", sha, ident)

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
                        "category": (row.category or self.config.kind) if row else "",
                        "language": row.language or "" if row else "",
                        "language_name": row.language_name or "" if row else "",
                        "dance": row.dance or "" if row else "",
                        "recorded_on": row.recorded_on or "" if row else "",
                        "credits": row.credits if row else "",
                        "year": row.year if row and row.year else "",
                        "song": row.song or "" if row else "",
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
        if self.config.set_title and not self.config.execute:
            self.say(f"  (the playlist {self.config.set_title!r} would be made or found)")
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
        help="metadata table (title, performer, category, language, language_name, dance, "
        "credits, year, song, date, file); optional with --set-title",
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
    parser.add_argument(
        "--category",
        "--kind",
        dest="kind",
        choices=list(RECORDING_KINDS),
        default="kiirtan",
        help="category of rows whose category cell is empty (default: kiirtan)",
    )
    parser.add_argument(
        "--language", help="language for rows whose language cell is empty (ISO code or name)"
    )
    parser.add_argument("--language-name", help="the language's name when --language is other")
    parser.add_argument(
        "--dance", choices=list(DANCES), help="dance for dance_song rows whose cell is empty"
    )
    parser.add_argument("--set-title", help="import the folder as ONE playlist with this title")
    parser.add_argument("--set-date", type=date.fromisoformat, help="approximate date of the event, YYYY-MM-DD (the playlist shows only its year and month)")
    parser.add_argument("--set-end-date", type=date.fromisoformat, help="last day, YYYY-MM-DD (kept for old data, not shown)")
    parser.add_argument("--set-place")
    parser.add_argument("--set-description")
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
    table: Path | None = args.csv
    stem = table if table is not None else args.folder / "playlist"
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
        state_path=args.state or stem.with_suffix(".import-state.json"),
        report_path=args.report or stem.with_suffix(".import-report.csv"),
        offline=bool(args.offline),
        allow_no_fingerprint=bool(args.allow_no_fingerprint),
        language=args.language,
        language_name=args.language_name,
        dance=args.dance,
        set_title=args.set_title,
        set_date=args.set_date,
        set_end_date=args.set_end_date,
        set_place=args.set_place,
        set_description=args.set_description,
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
    if args.csv is None and not args.set_title:
        print(
            "Give --csv, or --set-title to import every audio file of the folder.", file=sys.stderr
        )
        return 2
    if args.csv is not None and not args.csv.is_file():
        print(f"Table not found: {args.csv}", file=sys.stderr)
        return 2
    if args.set_title and not args.set_date:
        print("A playlist needs its first day: add --set-date YYYY-MM-DD.", file=sys.stderr)
        return 2
    if args.language:
        try:
            normalize_language(args.language)
        except ValueError:
            print(
                f"Unknown --language {args.language!r}. Use an ISO code or other.", file=sys.stderr
            )
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
