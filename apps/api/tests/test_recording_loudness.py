"""Loudness of recordings (docs/loudness-leveling.md): reading ffmpeg's EBU R128 summary, the
fields of the API, the measurement at upload (with a stand-in for ffmpeg), the migration 0048 and
the backfill script.

A real ffmpeg is used by one test only, and only when it is installed. The API runs against an
in-memory SQLite database: Postgres is NOT covered here.
"""

# ruff: noqa: F811
from __future__ import annotations

import csv
import importlib.util
import io
import json
import os
import shutil
import stat
import subprocess
import sys
from collections.abc import Iterator
from pathlib import Path
from types import ModuleType
from uuid import UUID

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://test:test@localhost/test")

import pytest
import sqlalchemy as sa
from alembic.config import Config as AlembicConfig
from alembic.script import ScriptDirectory
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.pool import StaticPool
from test_recording_duplicates_migration import VERSIONS, load, run
from test_recordings import World, mp3, world  # noqa: F401

from app.models.media import Media
from app.models.recordings import Recording
from app.schemas.recordings import RecordingOut
from app.schemas.song import MediaItemResponse
from app.services import recording_loudness as loud
from app.services.media_quality import to_media_item_response
from app.services.recording_loudness import Loudness, clean_loudness, measure_loudness

API_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(API_ROOT / "scripts"))
import measure_recording_loudness as backfill  # noqa: E402

# What `ffmpeg -af ebur128=peak=true:framelog=quiet -f null -` prints (a real run, shortened).
SUMMARY = """\
[Parsed_ebur128_0 @ 0x938c08f00] Summary:

  Integrated loudness:
    I:         -14.3 LUFS
    Threshold: -24.3 LUFS

  Loudness range:
    LRA:         5.2 LU
    Threshold: -34.3 LUFS
    LRA low:   -18.0 LUFS
    LRA high:  -12.8 LUFS

  True peak:
    Peak:       -0.8 dBFS
[out#0/null @ 0x938c08780] video:0KiB audio:517KiB subtitle:0KiB other streams:0KiB
"""
SILENCE = SUMMARY.replace("-14.3 LUFS", "-70.0 LUFS").replace("-0.8 dBFS", "-inf dBFS")


# --------------------------------------------------------------------------- reading the summary


def test_the_summary_gives_loudness_peak_and_range() -> None:
    assert loud.parse_ebur128_summary(SUMMARY) == Loudness(-14.3, -0.8, 5.2)


def test_only_the_summary_counts_not_the_frame_lines_before_it() -> None:
    frames = "[Parsed_ebur128_0 @ 0x1] t: 0.1 M: -120.7 S: -120.7 I: -70.0 LUFS LRA: 0.0 LU\n"
    assert loud.parse_ebur128_summary(frames + SUMMARY) == Loudness(-14.3, -0.8, 5.2)
    assert loud.parse_ebur128_summary(frames) is None


def test_silence_and_garbage_are_not_a_measurement() -> None:
    assert loud.parse_ebur128_summary(SILENCE) is None
    assert loud.parse_ebur128_summary("") is None
    assert loud.parse_ebur128_summary("Summary:\n  nothing useful") is None


def test_clean_loudness_rounds_and_rejects_the_impossible() -> None:
    assert clean_loudness(-14.26, -0.84) == (-14.3, -0.8)
    assert clean_loudness(None, -1.0) is None and clean_loudness(-14.0, None) is None
    assert clean_loudness(float("nan"), -1.0) is None
    assert clean_loudness(-14.0, float("-inf")) is None
    assert clean_loudness(-70.0, -30.0) is None  # the gate floor: silence
    assert clean_loudness(3.0, -1.0) is None  # louder than full scale
    assert clean_loudness(-14.0, 20.0) is None
    assert clean_loudness(-14.0, 0.4) == (-14.0, 0.4)  # a true peak may pass 0 dBTP a little


def test_loudness_is_read_back_from_the_metadata_of_an_archive_item() -> None:
    ok = {"loudness": {"lufs": -16.2, "true_peak_db": -2.0, "measured_at": "2026-11-08"}}
    assert loud.loudness_from_metadata(ok) == (-16.2, -2.0)
    assert loud.loudness_from_metadata({}) is None
    assert loud.loudness_from_metadata(None) is None
    assert loud.loudness_from_metadata({"loudness": "loud"}) is None
    assert loud.loudness_from_metadata({"loudness": {"lufs": True, "true_peak_db": -1}}) is None
    assert loud.loudness_from_metadata({"loudness": {"lufs": -99, "true_peak_db": -1}}) is None


def test_the_catalogue_response_carries_the_numbers_only_for_audio() -> None:
    audio = Media(
        song_number=1,
        kind="audio",
        provider="direct_audio",
        title="t",
        url="https://x/a.mp3",
        verification_status="verified",
        metadata_json={"loudness": {"lufs": -12.5, "true_peak_db": -0.9}},
    )
    shown = to_media_item_response(audio)
    assert (shown.loudness_lufs, shown.true_peak_db) == (-12.5, -0.9)
    video = Media(
        song_number=1,
        kind="video",
        provider="youtube",
        title="v",
        url="https://youtu.be/x",
        verification_status="verified",
        metadata_json={"loudness": {"lufs": -12.5, "true_peak_db": -0.9}},
    )
    assert to_media_item_response(video).loudness_lufs is None
    assert (
        MediaItemResponse(
            kind="audio", provider="p", title="t", url="u", verification_status="v"
        ).loudness_lufs
        is None
    )


def test_the_recording_schema_refuses_an_impossible_loudness() -> None:
    fields = RecordingOut.model_fields
    assert fields["loudness_lufs"].default is None and fields["true_peak_db"].default is None
    with pytest.raises(ValueError):
        RecordingOut.model_validate({"loudness_lufs": 5.0})


# --------------------------------------------------------------------------- running ffmpeg


def make_fake_ffmpeg(
    folder: Path, *, summary: str = SUMMARY, code: int = 0, sleep: float = 0
) -> Path:
    """A stand-in for ffmpeg: prints the summary (or fails, or hangs) on stderr."""
    script = folder / "ffmpeg"
    script.write_text(
        "#!/usr/bin/env python3\n"
        "import sys, time\n"
        f"time.sleep({sleep})\n"
        f"sys.stderr.write({summary!r})\n"
        f"sys.exit({code})\n"
    )
    script.chmod(script.stat().st_mode | stat.S_IEXEC)
    return script


async def test_measure_loudness_runs_ffmpeg_and_reads_its_summary(tmp_path: Path) -> None:
    audio = tmp_path / "a.mp3"
    audio.write_bytes(b"ID3\x04 whatever")
    fake = make_fake_ffmpeg(tmp_path)
    assert await measure_loudness(audio, str(fake)) == Loudness(-14.3, -0.8, 5.2)


async def test_no_ffmpeg_a_failing_ffmpeg_silence_and_a_hang_all_give_none(tmp_path: Path) -> None:
    audio = tmp_path / "a.mp3"
    audio.write_bytes(b"ID3\x04 whatever")
    assert await measure_loudness(audio, "definitely-not-installed") is None
    broken = tmp_path / "broken"
    broken.mkdir()
    assert await measure_loudness(audio, str(make_fake_ffmpeg(broken, code=1))) is None
    quiet = tmp_path / "quiet"
    quiet.mkdir()
    assert await measure_loudness(audio, str(make_fake_ffmpeg(quiet, summary=SILENCE))) is None
    slow = tmp_path / "slow"
    slow.mkdir()
    assert await measure_loudness(audio, str(make_fake_ffmpeg(slow, sleep=5)), timeout=0.5) is None


# --------------------------------------------------------------------------- an untrusted file


def make_recording_ffmpeg(folder: Path, *, body: str = "") -> Path:
    """A stand-in that records its arguments, environment and pid beside itself, then prints."""
    script = folder / "ffmpeg"
    script.write_text(
        "#!/usr/bin/env python3\n"
        "import json, os, sys, time\n"
        f"here = {str(folder)!r}\n"
        "open(here + '/argv.json', 'w').write(json.dumps(sys.argv[1:]))\n"
        "open(here + '/env.json', 'w').write(json.dumps(dict(os.environ)))\n"
        "open(here + '/pid', 'w').write(str(os.getpid()))\n"
        f"{body}\n"
        f"sys.stderr.write({SUMMARY!r})\n"
    )
    script.chmod(script.stat().st_mode | stat.S_IEXEC)
    return script


def recorded(folder: Path, name: str) -> object:
    return json.loads((folder / name).read_text())


async def test_ffmpeg_gets_a_whitelisted_protocol_a_fixed_format_and_a_file_prefixed_path(
    tmp_path: Path,
) -> None:
    audio = tmp_path / "concat:evil.mp3"
    audio.write_bytes(b"ID3\x04 whatever")
    fake = make_recording_ffmpeg(tmp_path)
    assert await measure_loudness(audio, str(fake)) is not None
    argv = recorded(tmp_path, "argv.json")
    assert isinstance(argv, list)
    assert argv[argv.index("-protocol_whitelist") + 1] == "file"
    assert argv.index("-protocol_whitelist") < argv.index("-i")
    assert argv[argv.index("-f") + 1] == "mp3"
    assert argv.index("-f") < argv.index("-i")
    assert argv[argv.index("-i") + 1] == f"file:{audio.resolve()}"
    assert argv[argv.index("-i") + 1].startswith("file:/")
    assert argv[argv.index("-threads") + 1] == "1"
    assert int(argv[argv.index("-t") + 1]) == loud.MAX_INPUT_SECONDS
    assert "-nostdin" in argv
    assert argv[-3:] == ["-f", "null", "-"]


@pytest.mark.parametrize(
    ("head", "demuxer"),
    [
        (b"ID3\x04\x00", "mp3"),
        (b"\xff\xfb\x90\x00", "mp3"),
        (b"\xff\xf1\x50\x80", "aac"),
        (b"\x00\x00\x00\x20ftypM4A \x00\x00", "mov"),
        (b"RIFF\x00\x00\x00\x00WAVEfmt ", "wav"),
        (b"OggS\x00\x02", "ogg"),
        (b"fLaC\x00\x00", "flac"),
        (b"\x1a\x45\xdf\xa3\x9f", "matroska"),
    ],
)
def test_the_demuxer_comes_from_the_type_we_sniffed(
    tmp_path: Path, head: bytes, demuxer: str
) -> None:
    audio = tmp_path / "x.bin"  # the name says nothing: only the bytes count
    audio.write_bytes(head + b"\x00" * 16)
    arguments = loud.ffmpeg_input_arguments(audio)
    assert arguments is not None
    assert arguments[arguments.index("-f") + 1] == demuxer


@pytest.mark.parametrize(
    "content",
    [
        b"#EXTM3U\nhttp://169.254.169.254/latest/meta-data/\n",
        b"ffconcat version 1.0\nfile '/etc/passwd'\n",
        b"<?xml version='1.0'?><MPD/>",
        b"",
    ],
)
async def test_a_playlist_or_other_non_audio_file_never_starts_ffmpeg(
    tmp_path: Path, content: bytes
) -> None:
    audio = tmp_path / "evil.mp3"  # a harmless extension does not make it audio
    audio.write_bytes(content)
    fake = make_recording_ffmpeg(tmp_path)
    assert await measure_loudness(audio, str(fake)) is None
    assert not (tmp_path / "argv.json").exists()
    assert loud.ffmpeg_input_arguments(audio) is None


async def test_an_unreadable_file_is_not_measured(tmp_path: Path) -> None:
    fake = make_recording_ffmpeg(tmp_path)
    assert await measure_loudness(tmp_path / "missing.mp3", str(fake)) is None
    assert not (tmp_path / "argv.json").exists()


async def test_ffmpeg_gets_a_clean_environment(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgresql://user:secret@db/app")
    monkeypatch.setenv("R2_SECRET_ACCESS_KEY", "very-secret")
    audio = tmp_path / "a.mp3"
    audio.write_bytes(b"ID3\x04 whatever")
    assert await measure_loudness(audio, str(make_recording_ffmpeg(tmp_path))) is not None
    seen = recorded(tmp_path, "env.json")
    assert isinstance(seen, dict)
    assert "DATABASE_URL" not in seen
    assert "R2_SECRET_ACCESS_KEY" not in seen
    # nothing of the parent's environment but the two values we pass (macOS adds one of its own)
    assert (set(seen) & set(os.environ)) - {"PATH", "LC_ALL", "__CF_USER_TEXT_ENCODING"} == set()
    assert seen["PATH"] == "/usr/bin:/bin"


async def test_a_run_that_takes_too_long_is_killed(tmp_path: Path) -> None:
    audio = tmp_path / "a.mp3"
    audio.write_bytes(b"ID3\x04 whatever")
    fake = make_recording_ffmpeg(tmp_path, body="time.sleep(30)")
    assert await measure_loudness(audio, str(fake), timeout=0.6) is None
    pid = int((tmp_path / "pid").read_text())
    with pytest.raises(ProcessLookupError):
        os.kill(pid, 0)


async def test_a_flood_of_output_is_read_without_keeping_it_all(tmp_path: Path) -> None:
    audio = tmp_path / "a.mp3"
    audio.write_bytes(b"ID3\x04 whatever")
    flood = "sys.stderr.write('x' * 5_000_000)"
    found = await measure_loudness(audio, str(make_recording_ffmpeg(tmp_path, body=flood)))
    assert found == Loudness(-14.3, -0.8, 5.2)  # the Summary at the end still arrives


async def test_the_import_conversion_is_just_as_careful(tmp_path: Path) -> None:
    spec = importlib.util.spec_from_file_location(
        "import_kiirtan_library_for_loudness",
        Path(__file__).resolve().parents[1] / "scripts" / "import_kiirtan_library.py",
    )
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    fake = make_recording_ffmpeg(tmp_path)
    evil = tmp_path / "evil.mp3"
    evil.write_bytes(b"#EXTM3U\nhttp://example.com/x\n")
    assert await module.ffmpeg_to_mp3(evil, tmp_path / "out.mp3", str(fake)) is False
    assert not (tmp_path / "argv.json").exists()
    good = tmp_path / "good.mp3"
    good.write_bytes(b"ID3\x04 whatever")
    await module.ffmpeg_to_mp3(good, tmp_path / "out.mp3", str(fake))
    argv = recorded(tmp_path, "argv.json")
    assert isinstance(argv, list)
    assert argv[argv.index("-protocol_whitelist") + 1] == "file"
    assert argv[argv.index("-i") + 1].startswith("file:/")
    assert argv[argv.index("-f") + 1] == "mp3"


@pytest.mark.skipif(shutil.which("ffmpeg") is None, reason="ffmpeg is not installed")
async def test_the_real_ffmpeg_measures_a_tone_within_a_decibel(tmp_path: Path) -> None:
    """ffmpeg's `sine` source peaks at -18 dBFS; `volume=-20dB` makes that -38 dBFS. A sine's
    loudness sits close to its peak (RMS 3 dB lower, K-weighting about 0.7 dB, and a mono file
    counted as dual mono 3 dB higher), so both numbers should be near -38."""
    audio = tmp_path / "tone.wav"
    subprocess.run(
        [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-f",
            "lavfi",
            "-i",
            "sine=frequency=440:duration=5",
            "-af",
            "volume=-20dB",
            "-ac",
            "1",
            str(audio),
        ],
        check=True,
    )
    found = await measure_loudness(audio, "ffmpeg")
    assert found is not None
    assert -39.0 <= found.true_peak_db <= -37.0
    assert -1.5 <= found.lufs - found.true_peak_db <= 0.0
    silent = tmp_path / "silent.wav"
    subprocess.run(
        [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-f",
            "lavfi",
            "-i",
            "anullsrc=r=44100:cl=stereo",
            "-t",
            "2",
            str(silent),
        ],
        check=True,
    )
    assert await measure_loudness(silent, "ffmpeg") is None


# --------------------------------------------------------------------------- at upload


async def test_an_upload_is_measured_and_the_numbers_are_listed(
    world: World, tmp_path: Path
) -> None:
    folder = tmp_path / "bin"
    folder.mkdir()
    world.settings.recording_ffmpeg_path = str(make_fake_ffmpeg(folder))
    made = await world.publish("a", mp3(4100))
    assert made.status_code == 201, made.text
    body = made.json()
    assert (body["loudness_lufs"], body["true_peak_db"]) == (-14.3, -0.8)
    got = (await world.client.get(f"/api/v1/recordings/{body['id']}")).json()
    assert got["loudness_lufs"] == -14.3
    listed = (await world.client.get("/api/v1/recordings")).json()["items"]
    assert listed[0]["true_peak_db"] == -0.8
    stamp = await world.scalar(select(Recording.loudness_measured_at))
    assert stamp is not None


async def test_an_upload_without_ffmpeg_still_publishes_with_empty_numbers(world: World) -> None:
    world.settings.recording_ffmpeg_path = "definitely-not-installed"
    made = await world.publish("a", mp3(4110))
    assert made.status_code == 201, made.text
    assert made.json()["loudness_lufs"] is None and made.json()["true_peak_db"] is None
    assert await world.scalar(select(Recording.loudness_measured_at)) is None


# --------------------------------------------------------------------------- migration 0048


@pytest.fixture
def m48() -> ModuleType:
    return load("0048_recording_loudness")


@pytest.fixture
def engine() -> Iterator[sa.Engine]:
    engine = sa.create_engine("sqlite://", poolclass=StaticPool)
    with engine.begin() as connection:
        connection.execute(sa.text("CREATE TABLE recordings (id CHAR(32) PRIMARY KEY, title TEXT)"))
        connection.execute(sa.text("INSERT INTO recordings (id, title) VALUES ('a', 'Old')"))
    yield engine
    engine.dispose()


def columns(engine: sa.Engine) -> set[str]:
    return {c["name"] for c in sa.inspect(engine).get_columns("recordings")}


NEW = {"loudness_lufs", "true_peak_db", "loudness_measured_at"}


def test_0048_follows_0047_and_the_chain_has_one_head() -> None:
    script = ScriptDirectory.from_config(AlembicConfig(str(VERSIONS.parents[1] / "alembic.ini")))
    assert len(script.get_heads()) == 1
    revision = script.get_revision("0048_recording_loudness")
    assert revision is not None and revision.down_revision == "0047_recording_chord_charts"
    assert script.get_heads() == ["0048_recording_loudness"]


def test_0048_adds_the_columns_keeps_old_rows_and_runs_twice(
    engine: sa.Engine, m48: ModuleType
) -> None:
    run(engine, m48.upgrade)
    run(engine, m48.upgrade)
    assert NEW <= columns(engine)
    with engine.connect() as connection:
        row = connection.execute(
            sa.text(
                "SELECT title, loudness_lufs, true_peak_db, loudness_measured_at FROM recordings"
            )
        ).one()
    assert tuple(row) == ("Old", None, None, None)


def test_0048_downgrade_drops_only_its_columns(engine: sa.Engine, m48: ModuleType) -> None:
    run(engine, m48.upgrade)
    run(engine, m48.downgrade)
    assert not NEW & columns(engine)
    assert {"id", "title"} <= columns(engine)


# --------------------------------------------------------------------------- the backfill script


@compiles(JSONB, "sqlite")
def _jsonb_as_json(_type: JSONB, _compiler: object, **_kw: object) -> str:
    return "JSON"


MEDIA_TABLE = """
CREATE TABLE media (
    id INTEGER PRIMARY KEY, song_number INTEGER, kind VARCHAR(32) NOT NULL,
    provider VARCHAR(64) NOT NULL, title VARCHAR(255) NOT NULL, url VARCHAR(1024) NOT NULL,
    embed_url VARCHAR(1024), verification_status VARCHAR(32) NOT NULL DEFAULT 'unverified',
    source_url VARCHAR(1024), notes TEXT, metadata_json JSON NOT NULL DEFAULT '{}',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
)
"""


async def media_database() -> tuple[AsyncEngine, async_sessionmaker[AsyncSession]]:
    """The `media` table by hand: its Postgres-only default (`'{}'::jsonb`) is not valid SQLite."""
    engine = create_async_engine(
        "sqlite+aiosqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False}
    )
    async with engine.begin() as conn:
        await conn.execute(sa.text(MEDIA_TABLE))
    return engine, async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def test_backfill_dry_run_counts_and_writes_nothing(world: World) -> None:
    world.settings.recording_ffmpeg_path = "definitely-not-installed"
    await world.publish("a", mp3(4200))
    await world.publish("a", mp3(4201))
    out = io.StringIO()
    run_ = backfill.Backfill(
        backfill.Config(limit=10), sessions=world.sessions, storage=world.storage, out=out
    )
    results = await run_.run()
    assert [r.status for r in results] == ["would_measure", "would_measure"]
    assert "DRY RUN" in out.getvalue() and "Add --execute" in out.getvalue()
    assert (
        await world.scalar(
            select(sa.func.count())
            .select_from(Recording)
            .where(Recording.loudness_lufs.is_not(None))
        )
        == 0
    )


async def test_backfill_measures_stores_and_is_idempotent_with_a_limit_and_a_report(
    world: World, tmp_path: Path
) -> None:
    world.settings.recording_ffmpeg_path = "definitely-not-installed"
    for seed in (4210, 4211, 4212):
        await world.publish("a", mp3(seed))

    async def meter(path: Path, _ffmpeg: str) -> Loudness | None:
        return Loudness(-17.0, -3.2)

    report = tmp_path / "r.csv"
    config = backfill.Config(execute=True, limit=2, report_path=report)
    first = await backfill.Backfill(
        config, sessions=world.sessions, storage=world.storage, out=io.StringIO(), meter=meter
    ).run()
    assert [r.status for r in first] == ["measured", "measured"]  # the limit held
    lines = list(csv.DictReader(report.open(encoding="utf-8")))
    assert [(x["status"], x["lufs"], x["true_peak_db"]) for x in lines] == [
        ("measured", "-17.0", "-3.2")
    ] * 2
    second = await backfill.Backfill(
        config, sessions=world.sessions, storage=world.storage, out=io.StringIO(), meter=meter
    ).run()
    assert [r.status for r in second] == ["measured"]  # only the one left, none twice
    third = await backfill.Backfill(
        config, sessions=world.sessions, storage=world.storage, out=io.StringIO(), meter=meter
    ).run()
    assert third == []
    async with world.sessions() as session:
        rows = (await session.scalars(select(Recording))).all()
    assert {(r.loudness_lufs, r.true_peak_db) for r in rows} == {(-17.0, -3.2)}
    assert all(r.loudness_measured_at is not None for r in rows)


async def test_backfill_reports_what_could_not_be_measured_and_keeps_going(world: World) -> None:
    world.settings.recording_ffmpeg_path = "definitely-not-installed"
    await world.publish("a", mp3(4220))

    async def meter(_path: Path, _ffmpeg: str) -> Loudness | None:
        return None

    out = io.StringIO()
    done = await backfill.Backfill(
        backfill.Config(execute=True),
        sessions=world.sessions,
        storage=world.storage,
        out=out,
        meter=meter,
    ).run()
    assert [r.status for r in done] == ["unmeasurable"]
    assert await world.scalar(select(Recording.loudness_lufs)) is None  # nothing invented
    assert "unmeasurable" in out.getvalue()


async def test_backfill_skips_removed_recordings(world: World) -> None:
    world.settings.recording_ffmpeg_path = "definitely-not-installed"
    made = await world.publish("a", mp3(4230))
    rid = made.json()["id"]
    async with world.sessions() as session:
        row = await session.get(Recording, UUID(rid))
        assert row is not None
        row.status = "removed"
        await session.commit()
    done = await backfill.Backfill(
        backfill.Config(), sessions=world.sessions, storage=world.storage, out=io.StringIO()
    ).run()
    assert done == []


async def test_backfill_measures_the_archive_items_through_a_downloader() -> None:
    engine, sessions = await media_database()
    async with sessions() as session:
        session.add_all(
            [
                Media(
                    song_number=1,
                    kind="audio",
                    provider="direct_audio",
                    title="One",
                    url="https://archive.example/1.mp3",
                    verification_status="verified",
                    metadata_json={"channel_name": "keep me"},
                ),
                Media(
                    song_number=2,
                    kind="audio",
                    provider="direct_audio",
                    title="Done",
                    url="https://archive.example/2.mp3",
                    verification_status="verified",
                    metadata_json={"loudness": {"lufs": -15.0, "true_peak_db": -2.0}},
                ),
                Media(
                    song_number=3,
                    kind="video",
                    provider="youtube",
                    title="Video",
                    url="https://youtu.be/xxxxxxxxxxx",
                    verification_status="verified",
                    metadata_json={},
                ),
            ]
        )
        await session.commit()
    asked: list[str] = []

    async def downloader(url: str, target: Path, _max: int) -> bool:
        asked.append(url)
        target.write_bytes(b"audio")
        return True

    async def meter(_path: Path, _ffmpeg: str) -> Loudness | None:
        return Loudness(-19.4, -4.1)

    config = backfill.Config(source="media", execute=True, delay=0)
    done = await backfill.Backfill(
        config,
        sessions=sessions,
        storage=None,
        out=io.StringIO(),
        meter=meter,
        downloader=downloader,
    ).run()
    assert [(r.ident, r.status) for r in done] == [("1", "measured")]
    assert asked == ["https://archive.example/1.mp3"]  # the measured one and the video are skipped
    async with sessions() as session:
        one = await session.get(Media, 1)
    assert one is not None
    assert one.metadata_json["channel_name"] == "keep me"  # nothing else was touched
    assert loud.loudness_from_metadata(one.metadata_json) == (-19.4, -4.1)
    assert to_media_item_response(one).loudness_lufs == -19.4
    again = await backfill.Backfill(
        config,
        sessions=sessions,
        storage=None,
        out=io.StringIO(),
        meter=meter,
        downloader=downloader,
    ).run()
    assert again == []
    await engine.dispose()


async def test_backfill_reports_a_failed_download(world: World) -> None:
    engine, sessions = await media_database()
    async with sessions() as session:
        session.add(
            Media(
                song_number=1,
                kind="audio",
                provider="direct_audio",
                title="One",
                url="https://archive.example/1.mp3",
                verification_status="verified",
                metadata_json={},
            )
        )
        await session.commit()

    async def refuse(_url: str, _target: Path, _max: int) -> bool:
        return False

    done = await backfill.Backfill(
        backfill.Config(source="media", execute=True, delay=0),
        sessions=sessions,
        storage=None,
        out=io.StringIO(),
        downloader=refuse,
    ).run()
    assert [r.status for r in done] == ["failed"]
    await engine.dispose()
