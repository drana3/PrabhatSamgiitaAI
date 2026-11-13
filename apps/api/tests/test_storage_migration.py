"""Moving recording files between storages (docs/storage.md): dry run, idempotence, the SHA-256
receipt, and the promise that nothing is ever deleted or overwritten."""

from __future__ import annotations

import hashlib
import importlib.util
import os
import sys
from pathlib import Path
from uuid import uuid4

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://test:test@localhost/test")

import pytest

from app.services import storage_migration as sm
from app.services.recording_storage import LocalDiskStorage

API_ROOT = Path(__file__).resolve().parents[1]


def _disk(path: Path) -> LocalDiskStorage:
    return LocalDiskStorage(base_dir=path, api_base_url="http://x", secret="s")


def _key(ext: str = "mp3") -> str:
    return f"recordings/{uuid4()}/{uuid4()}.{ext}"


def _receipt(key: str, data: bytes, *, size: bool = True) -> sm.FileReceipt:
    return sm.FileReceipt(
        key=key, sha256=hashlib.sha256(data).hexdigest(), size=len(data) if size else None
    )


@pytest.fixture
def disks(tmp_path: Path) -> tuple[LocalDiskStorage, LocalDiskStorage]:
    return _disk(tmp_path / "old"), _disk(tmp_path / "new")


async def test_dry_run_reads_and_writes_nothing(disks) -> None:
    old, new = disks
    key, data = _key(), b"ID3" + b"\x00" * 100
    old.write(key, data)
    report = await sm.migrate([_receipt(key, data)], source=old, target=new)
    assert [r.outcome for r in report.results] == [sm.WOULD_COPY]
    assert report.ok and not report.apply
    assert not new.path_for(key).exists()


async def test_apply_copies_and_verifies_and_is_idempotent(disks) -> None:
    old, new = disks
    key, data = _key(), b"ID3" + b"abc" * 500
    old.write(key, data)
    receipts = [_receipt(key, data)]
    first = await sm.migrate(receipts, source=old, target=new, apply=True)
    assert first.summary()[sm.COPIED] == 1
    assert new.path_for(key).read_bytes() == data
    assert old.path_for(key).exists(), "the source is never touched"
    second = await sm.migrate(receipts, source=old, target=new, apply=True)
    assert second.summary()[sm.PRESENT] == 1 and second.summary()[sm.COPIED] == 0


async def test_damaged_original_is_not_copied(disks) -> None:
    old, new = disks
    key, good = _key(), b"ID3" + b"good" * 100
    old.write(key, b"ID3" + b"bad!" * 100)  # same size, other bytes
    report = await sm.migrate([_receipt(key, good)], source=old, target=new, apply=True)
    assert report.results[0].outcome == sm.SOURCE_MISMATCH
    assert not report.ok
    assert not new.path_for(key).exists()


async def test_missing_everywhere_is_reported(disks) -> None:
    old, new = disks
    report = await sm.migrate([_receipt(_key(), b"x")], source=old, target=new, apply=True)
    assert report.results[0].outcome == sm.MISSING_SOURCE and not report.ok


async def test_target_with_other_bytes_is_never_overwritten(disks) -> None:
    old, new = disks
    key, data = _key(), b"ID3" + b"1" * 200
    old.write(key, data)
    new.write(key, b"ID3" + b"2" * 200)  # same size, different bytes
    receipt = _receipt(key, data)
    quick = await sm.migrate([receipt], source=old, target=new, apply=True)
    assert quick.results[0].outcome == sm.PRESENT  # size matches, hash not asked for
    checked = await sm.migrate(
        [receipt], source=old, target=new, apply=True, verify_existing=True
    )
    assert checked.results[0].outcome == sm.TARGET_MISMATCH
    assert new.path_for(key).read_bytes() == b"ID3" + b"2" * 200, "kept for a person to inspect"
    wrong_size = _receipt(key, data + b"extra")
    other = await sm.migrate([wrong_size], source=old, target=new, apply=True)
    assert other.results[0].outcome in (sm.TARGET_MISMATCH, sm.SOURCE_MISMATCH)


async def test_storage_error_is_a_result_not_a_crash(disks) -> None:
    old, new = disks

    class Broken(LocalDiskStorage):
        async def store_file(self, key, source, content_type):  # type: ignore[override]
            raise sm.StorageError("bucket says no")

    key, data = _key(), b"ID3" + b"z" * 50
    old.write(key, data)
    broken = Broken(base_dir=new.base_dir, api_base_url="http://x", secret="s")
    report = await sm.migrate([_receipt(key, data)], source=old, target=broken, apply=True)
    assert report.results[0].outcome == sm.FAILED
    assert "bucket says no" in report.results[0].detail


def test_content_types() -> None:
    assert sm.content_type_for("recordings/a/b.mp3") == "audio/mpeg"
    assert sm.content_type_for("recordings/a/b.m4a") in {"audio/mp4", "audio/x-m4a", "audio/m4a"}
    assert sm.content_type_for("recordings/a/b.wav").startswith("audio/")


def _load_script():
    spec = importlib.util.spec_from_file_location(
        "migrate_recording_files", API_ROOT / "scripts" / "migrate_recording_files.py"
    )
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


async def test_script_run_prints_progress_and_summarises(disks, tmp_path: Path) -> None:
    script = _load_script()
    old, new = disks
    ok_key, ok_data = _key(), b"ID3" + b"o" * 64
    old.write(ok_key, ok_data)
    gone_key = _key()
    import io

    out = io.StringIO()
    report = await script.run(
        receipts=[_receipt(ok_key, ok_data), _receipt(gone_key, b"gone")],
        source=old,
        target=new,
        apply=True,
        verify_existing=False,
        rewrite_urls=False,
        sessions=None,
        out=out,
    )
    assert report.summary()[sm.COPIED] == 1 and report.summary()[sm.MISSING_SOURCE] == 1
    assert "missing_in_source" in out.getvalue()
    csv_path = tmp_path / "r.csv"
    script.write_report(csv_path, report)
    assert csv_path.read_text().splitlines()[0] == "key,outcome,detail"
    # the parser refuses a rewrite without --apply
    assert script.build_parser().parse_args(["--rewrite-urls"]).rewrite_urls is True
    assert await script.main_async(["--rewrite-urls"]) == 2
