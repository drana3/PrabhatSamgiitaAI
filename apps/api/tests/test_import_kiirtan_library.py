"""The bulk import script `scripts/import_kiirtan_library.py` (level 5 of the duplicates work).

Everything runs on SQLite, a temporary folder of tiny generated audio files, local-disk storage in a
temporary folder and the fake `fpcalc` of test_recordings.py. Nothing touches a real database or a
real bucket.
"""

# ruff: noqa: F811
# (the `world` fixture comes in by name from test_recordings.py and is used as an argument)
from __future__ import annotations

import importlib.util
import io
import os
import sys
from pathlib import Path
from types import ModuleType

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://test:test@localhost/test")

import pytest
from sqlalchemy import func, select
from test_recordings import World, mp3, world  # noqa: F401  (the fixture is used by name)

from app.models.recordings import MantraGroup, Recording
from app.services.mantras import mantra_key
from app.services.recording_fingerprint import compute_fingerprint, sha256_of_file

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "import_kiirtan_library.py"


def load_script() -> ModuleType:
    spec = importlib.util.spec_from_file_location("import_kiirtan_library", SCRIPT)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


script = load_script()


def wav(seed: int) -> bytes:
    """A tiny WAV-looking file; the fake fpcalc reads `FP=<seed>;` from it."""
    return b"RIFF\x24\x00\x00\x00WAVE" + f"FP={seed};".encode() + os.urandom(16)


async def fake_convert(source: Path, target: Path, _ffmpeg: str) -> bool:
    """Stands in for ffmpeg: an MP3 that still carries the sound marker of the source."""
    target.write_bytes(b"ID3\x04CONVERTED" + source.read_bytes()[12:])
    return True


class Library:
    """A folder with audio files and a CSV table."""

    def __init__(self, root: Path) -> None:
        self.folder = root / "library"
        self.folder.mkdir()
        self.table = root / "table.csv"
        self.rows: list[dict[str, str]] = []

    def add(
        self,
        name: str,
        data: bytes,
        *,
        title: str,
        performer: str = "Sample group",
        mantra: str = "Baba Nam Kevalam",
        year: str = "",
    ) -> None:
        (self.folder / name).write_bytes(data)
        self.rows.append(
            {"file": name, "title": title, "performer": performer, "mantra": mantra, "year": year}
        )

    def write_table(self) -> None:
        header = "file,title,performer,mantra,year"
        lines = [header]
        for row in self.rows:
            cells = [row["file"], row["title"], row["performer"], row["mantra"], row["year"]]
            lines.append(",".join('"' + cell.replace('"', '""') + '"' for cell in cells))
        self.table.write_text("\n".join(lines) + "\n", encoding="utf-8")


def make_importer(
    world: World,
    library: Library,
    *,
    execute: bool,
    limit: int | None = None,
    normalise: str = "mp3",
    storage: object | None = None,
    **config: object,
) -> tuple[object, io.StringIO]:
    library.write_table()
    out = io.StringIO()
    settings = script.Config(
        folder=library.folder,
        table=library.table,
        execute=execute,
        limit=limit,
        normalise=normalise,
        fpcalc=world.settings.recording_fpcalc_path,
        state_path=library.table.with_suffix(".state.json"),
        report_path=library.table.with_suffix(".report.csv"),
        **config,
    )

    async def fingerprint(path: Path, fpcalc: str):  # type: ignore[no-untyped-def]
        return await compute_fingerprint(path, fpcalc)

    importer = script.Importer(
        settings,
        sessions=world.sessions,
        storage=storage if storage is not None else world.storage,
        out=out,
        converter=fake_convert,
        fingerprinter=fingerprint,
    )
    return importer, out


async def total(world: World, model: type) -> int:
    return int(await world.scalar(select(func.count()).select_from(model)) or 0)


def statuses(outcomes: list) -> dict[str, int]:  # type: ignore[type-arg]
    result: dict[str, int] = {}
    for outcome in outcomes:
        result[outcome.status] = result.get(outcome.status, 0) + 1
    return result


def stored_files(world: World) -> list[Path]:
    root = world.storage.base_dir
    return [path for path in root.rglob("*") if path.is_file()] if root.exists() else []


@pytest.fixture
def library(tmp_path: Path) -> Library:
    return Library(tmp_path)


# ============================================================ dry run


async def test_dry_run_prints_the_plan_and_writes_nothing(world: World, library: Library) -> None:
    library.add("one.mp3", mp3(1), title="Song one")
    library.add("two.wav", wav(2), title="Song two", mantra="Hara Hara Shambhu")
    importer, out = make_importer(world, library, execute=False)

    outcomes = await importer.run()  # type: ignore[attr-defined]

    assert statuses(outcomes) == {"would_import": 2}
    text = out.getvalue()
    assert "DRY RUN" in text and "convert to MP3" in text and "(new group)" in text
    assert "Add --execute" in text
    assert await total(world, Recording) == 0
    assert await total(world, MantraGroup) == 0
    assert stored_files(world) == []
    assert not library.table.with_suffix(".state.json").exists()  # a dry run is not resumable


async def test_dry_run_still_flags_files_already_in_the_library(
    world: World, library: Library
) -> None:
    data = mp3(5)
    assert (await world.publish("a", data)).status_code == 201
    library.add("known.mp3", data, title="Known")
    library.add("fresh.mp3", mp3(6), title="Fresh")
    importer, _ = make_importer(world, library, execute=False)

    outcomes = await importer.run()  # type: ignore[attr-defined]

    assert statuses(outcomes) == {"skipped_exact": 1, "would_import": 1}
    assert await total(world, Recording) == 1


# ============================================================ import


async def test_execute_imports_stores_and_groups_like_the_api(
    world: World, library: Library
) -> None:
    source = wav(3)
    library.add("a.wav", source, title="Evening Kiirtan", year="1998", mantra="Bábá Nám Kevalam")
    library.add("b.mp3", mp3(4), title="Morning Kiirtan", mantra="baba-nam-kevalam")
    importer, _ = make_importer(world, library, execute=True)

    outcomes = await importer.run()  # type: ignore[attr-defined]

    assert statuses(outcomes) == {"imported": 2}
    async with world.sessions() as session:
        rows = list((await session.scalars(select(Recording).order_by(Recording.title))).all())
    assert [r.title for r in rows] == ["Evening Kiirtan", "Morning Kiirtan"]
    evening, morning = rows
    assert evening.status == "published" and evening.author_id is None
    assert evening.added_by == "Ananda Marga team" and evening.reviewed_by == "bulk import"
    assert evening.year == 1998 and evening.author == "Sample group"
    # WAV was normalised to MP3, the hash is the SOURCE's, so the same WAV sent later is refused
    assert evening.audio_key.endswith(".mp3") and evening.audio_mime == "audio/mp3"
    assert evening.audio_sha256 != ""
    import hashlib

    assert evening.audio_sha256 == hashlib.sha256(source).hexdigest()
    assert morning.audio_key.endswith(".mp3") and morning.audio_key.startswith("recordings/")
    assert len(stored_files(world)) == 2
    assert evening.fingerprint is not None
    # one group for both spellings, the same one the API would pick for a third spelling
    assert evening.mantra_group_id == morning.mantra_group_id is not None
    assert await total(world, MantraGroup) == 1
    via_api = await world.publish("a", mp3(40), mantra="BABA NAM KEVALAM!")
    assert via_api.status_code == 201, via_api.text
    assert via_api.json()["mantra_id"] == str(evening.mantra_group_id)
    group = await world.scalar(select(MantraGroup))
    assert group.key == mantra_key("Baba Nam Kevalam")


async def test_the_converted_wav_is_refused_when_it_comes_through_the_app_later(
    world: World, library: Library
) -> None:
    source = wav(7)
    library.add("a.wav", source, title="Wav song")
    importer, _ = make_importer(world, library, execute=True)
    await importer.run()  # type: ignore[attr-defined]

    answer = await world.client.post(
        "/api/v1/recordings/uploads",
        headers={"X-Test-Member": "a"},
        json={"file_name": "x.wav", "content_type": "audio/wav", "size_bytes": len(source)},
    )
    assert answer.status_code == 201
    target = answer.json()
    path = "/" + target["url"].split("://", 1)[1].split("/", 1)[1]
    await world.client.put(path, content=source, headers=target["headers"])
    publish = await world.client.post(
        "/api/v1/recordings",
        headers={"X-Test-Member": "a"},
        json=world.body(target["key"]),
    )
    assert publish.status_code == 409
    assert publish.json()["detail"]["code"] == "duplicate"


async def test_normalise_off_keeps_the_original_format(world: World, library: Library) -> None:
    library.add("a.wav", wav(8), title="Wav song")
    importer, _ = make_importer(world, library, execute=True, normalise="off")

    await importer.run()  # type: ignore[attr-defined]

    row = await world.scalar(select(Recording))
    assert row.audio_key.endswith(".wav")


# ============================================================ skipping and reporting


async def test_files_already_in_the_library_are_skipped_not_stored_again(
    world: World, library: Library
) -> None:
    data = mp3(10)
    assert (await world.publish("a", data)).status_code == 201
    library.add("same.mp3", data, title="Same file")
    library.add("copy.mp3", data, title="Same file again")  # also a copy within the table
    library.add("new.mp3", mp3(11), title="New")
    importer, out = make_importer(world, library, execute=True)

    outcomes = await importer.run()  # type: ignore[attr-defined]

    assert statuses(outcomes) == {"skipped_exact": 2, "imported": 1}
    assert await total(world, Recording) == 2
    assert len(stored_files(world)) == 2  # the first upload and the new one
    assert "in the library already" in out.getvalue()


async def test_a_removed_file_does_not_come_back_through_the_import(
    world: World, library: Library
) -> None:
    data = mp3(12)
    first = (await world.publish("a", data)).json()
    removed = await world.client.post(
        f"/api/v1/admin/recordings/{first['id']}/remove",
        json={"reason": "Not suitable", "reviewer": "Dada"},
    )
    assert removed.status_code == 200
    library.add("back.mp3", data, title="Back")
    importer, out = make_importer(world, library, execute=True)

    outcomes = await importer.run()  # type: ignore[attr-defined]

    assert statuses(outcomes) == {"skipped_exact": 1}
    assert "removed" in out.getvalue()


async def test_near_duplicates_go_to_the_report_and_are_not_imported(
    world: World, library: Library
) -> None:
    assert (await world.publish("a", mp3(20), title="Already here")).status_code == 201
    library.add("alt.mp3", mp3(20), title="Another take")  # same sound, other bytes
    library.add("other.mp3", mp3(21), title="Different")
    importer, _ = make_importer(world, library, execute=True)

    outcomes = await importer.run()  # type: ignore[attr-defined]

    assert statuses(outcomes) == {"near_duplicate": 1, "imported": 1}
    assert await total(world, Recording) == 2
    report = library.table.with_suffix(".report.csv").read_text(encoding="utf-8")
    lines = report.strip().splitlines()
    assert lines[0].startswith("file,title,performer,mantra,year,status")
    near = next(line for line in lines if "near_duplicate" in line)
    assert "alt.mp3" in near and "Already here" in near and "1.000" in near


async def test_two_near_duplicates_inside_the_same_table_import_only_the_first(
    world: World, library: Library
) -> None:
    library.add("one.mp3", mp3(30), title="One")
    library.add("two.mp3", mp3(30), title="Two")
    importer, _ = make_importer(world, library, execute=True)

    outcomes = await importer.run()  # type: ignore[attr-defined]

    assert statuses(outcomes) == {"imported": 1, "near_duplicate": 1}


async def test_bad_rows_and_files_are_reported_and_do_not_stop_the_run(
    world: World, library: Library
) -> None:
    library.add("good.mp3", mp3(50), title="Good")
    library.add("notes.mp3", b"this is a text file", title="Text")
    library.add("empty.mp3", b"", title="Empty")
    library.rows.append(
        {"file": "ghost.mp3", "title": "Ghost", "performer": "", "mantra": "", "year": ""}
    )
    library.rows.append({"file": "x.mp3", "title": "", "performer": "", "mantra": "", "year": ""})
    importer, _ = make_importer(world, library, execute=True)

    outcomes = await importer.run()  # type: ignore[attr-defined]

    assert statuses(outcomes) == {
        "imported": 1,
        "not_audio": 2,
        "missing_file": 1,
        "bad_row": 1,
    }
    assert await total(world, Recording) == 1


async def test_a_file_over_the_size_limit_is_reported(world: World, library: Library) -> None:
    library.add("big.mp3", mp3(60, b"x" * 3000), title="Big")
    importer, _ = make_importer(world, library, execute=True, max_bytes=2000)

    outcomes = await importer.run()  # type: ignore[attr-defined]

    assert statuses(outcomes) == {"too_big": 1}
    assert await total(world, Recording) == 0


async def test_a_row_without_a_mantra_gets_no_group(world: World, library: Library) -> None:
    library.add("a.mp3", mp3(70), title="No mantra", mantra="")
    importer, _ = make_importer(world, library, execute=True)

    await importer.run()  # type: ignore[attr-defined]

    row = await world.scalar(select(Recording))
    assert row.mantra_group_id is None and row.mantra_title is None
    assert await total(world, MantraGroup) == 0


# ============================================================ pilot and resume


async def test_limit_stops_after_that_many_imports_and_the_next_run_resumes(
    world: World, library: Library
) -> None:
    for number in range(4):
        library.add(f"s{number}.mp3", mp3(100 + number), title=f"Song {number}")
    importer, out = make_importer(world, library, execute=True, limit=2)

    first = await importer.run()  # type: ignore[attr-defined]

    assert statuses(first) == {"imported": 2}
    assert "Limit of 2 reached" in out.getvalue()
    assert await total(world, Recording) == 2
    state = library.table.with_suffix(".state.json").read_text(encoding="utf-8")
    assert "s0.mp3" in state and "s1.mp3" in state and "s3.mp3" not in state

    again, _ = make_importer(world, library, execute=True)
    second = await again.run()  # type: ignore[attr-defined]

    assert statuses(second) == {"skipped_state": 2, "imported": 2}
    assert await total(world, Recording) == 4
    assert len(stored_files(world)) == 4


async def test_a_stopped_run_continues_without_duplicates(world: World, library: Library) -> None:
    """The state file alone keeps finished files out, even if the database were not consulted."""
    for number in range(3):
        library.add(f"s{number}.mp3", mp3(200 + number), title=f"Song {number}")
    importer, _ = make_importer(world, library, execute=True, limit=1)
    await importer.run()  # type: ignore[attr-defined]

    offline, out = make_importer(world, library, execute=True, offline=True)
    outcomes = await offline.run()  # type: ignore[attr-defined]

    assert statuses(outcomes)["skipped_state"] == 1
    assert "not read (--offline)" in out.getvalue()


# ============================================================ failures


class BrokenStorage:
    name = "broken"

    async def store_file(self, key: str, source: Path, content_type: str) -> None:
        raise RuntimeError("bucket is down")

    async def delete(self, key: str) -> None:
        return None

    def public_url(self, key: str) -> str:
        return "http://x/" + key


async def test_a_failing_upload_leaves_no_row_and_stops_after_repeated_failures(
    world: World, library: Library
) -> None:
    for number in range(4):
        library.add(f"s{number}.mp3", mp3(300 + number), title=f"Song {number}")
    importer, out = make_importer(
        world, library, execute=True, storage=BrokenStorage(), max_failures=2
    )

    outcomes = await importer.run()  # type: ignore[attr-defined]

    assert statuses(outcomes) == {"failed": 2}
    assert "Stopped after 2 failures" in out.getvalue()
    assert await total(world, Recording) == 0
    # failed files are not remembered as done: the next run tries them again
    again, _ = make_importer(world, library, execute=True)
    assert statuses(await again.run())["imported"] == 4  # type: ignore[attr-defined]


async def test_ffmpeg_failure_is_reported_and_stores_nothing(
    world: World, library: Library
) -> None:
    library.add("a.wav", wav(400), title="Wav")
    importer, _ = make_importer(world, library, execute=True)

    async def refuse(source: Path, target: Path, ffmpeg: str) -> bool:
        return False

    importer.converter = refuse  # type: ignore[attr-defined]

    outcomes = await importer.run()  # type: ignore[attr-defined]

    assert statuses(outcomes) == {"failed": 1}
    assert await total(world, Recording) == 0 and stored_files(world) == []


# ============================================================ table reading and command line


def test_the_table_accepts_semicolons_and_finds_the_file_by_title(tmp_path: Path) -> None:
    folder = tmp_path / "f"
    folder.mkdir()
    (folder / "Song One.mp3").write_bytes(mp3(1))
    table = tmp_path / "t.csv"
    table.write_text(
        "Title;Performer;Mantra;Year\nSong One;Group;Baba Nam Kevalam;1999\n", encoding="utf-8-sig"
    )

    rows, problems = script.load_rows(table, folder)

    assert problems == []
    assert [(r.title, r.file, r.year, r.mantra) for r in rows] == [
        ("Song One", "Song One.mp3", 1999, "Baba Nam Kevalam")
    ]


def test_dry_run_is_the_default_and_execute_is_explicit() -> None:
    parser = script.build_parser()
    plain = parser.parse_args(["--folder", "f", "--csv", "t.csv"])
    assert plain.execute is False
    assert parser.parse_args(["--folder", "f", "--csv", "t.csv", "--execute"]).execute is True
    with pytest.raises(SystemExit):
        parser.parse_args(["--folder", "f", "--csv", "t.csv", "--execute", "--dry-run"])


async def test_execute_without_fpcalc_is_refused_unless_allowed(
    tmp_path: Path,
    world: World,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    library = Library(tmp_path)
    library.add("a.mp3", mp3(1), title="A")
    library.write_table()
    settings = world.settings.model_copy(update={"recording_fpcalc_path": "no-such-fpcalc"})
    monkeypatch.setattr("app.config.get_settings", lambda: settings)

    code = await script.main_async(
        ["--folder", str(library.folder), "--csv", str(library.table), "--execute", "--yes"]
    )

    assert code == 2
    assert "not installed" in capsys.readouterr().err
    assert not library.table.with_suffix(".import-state.json").exists()


async def test_missing_folder_or_table_is_a_clear_error(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    assert await script.main_async(["--folder", str(tmp_path / "no"), "--csv", "x.csv"]) == 2
    (tmp_path / "f").mkdir()
    assert await script.main_async(["--folder", str(tmp_path / "f"), "--csv", "x.csv"]) == 2
    assert "not found" in capsys.readouterr().err


def test_database_label_hides_the_password() -> None:
    label = script._database_label(
        "postgresql+psycopg://user:secret@host.example/db?sslmode=require"
    )
    assert label == "host.example/db"
    assert "secret" not in label


async def test_sha_helper_matches_the_script_hash(tmp_path: Path) -> None:
    path = tmp_path / "x.mp3"
    path.write_bytes(mp3(1))
    assert script.sha256_of_file(path) == sha256_of_file(path)
