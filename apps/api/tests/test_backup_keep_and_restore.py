"""infra/backup scripts: keep-N-copies cleanup, encrypted flow and restore.sh, with stand-in tools.

(The basic dry-run and parse checks live in test_backup_scripts.py.)

The real dump/restore/drill run against a real PostgreSQL is described in docs/backups.md; these
tests only guard the parts that must never silently break: the refusals, the receipt, and that
cleanup keeps the newest copies and leaves everything else alone.
"""

from __future__ import annotations

import json
import os
import shutil
import stat
import subprocess
from pathlib import Path

import pytest

BACKUP_DIR = Path(__file__).resolve().parents[3] / "infra" / "backup"

pytestmark = pytest.mark.skipif(shutil.which("bash") is None, reason="needs bash")


def _tool(folder: Path, name: str, body: str) -> None:
    path = folder / name
    path.write_text("#!/bin/sh\n" + body + "\n")
    path.chmod(path.stat().st_mode | stat.S_IEXEC)


@pytest.fixture
def stand_ins(tmp_path: Path) -> Path:
    """A folder of fake pg_dump / psql / age that act the way the scripts need."""
    folder = tmp_path / "bin"
    folder.mkdir()
    # pg_dump ... --file=PATH : writes some bytes there
    _tool(
        folder,
        "pg_dump",
        'for a in "$@"; do case "$a" in --file=*) printf "DUMP" > "${a#--file=}";; esac; done',
    )
    # psql -c "..." : the receipt asks for counts, then the schema version
    _tool(
        folder,
        "psql",
        'case "$*" in *alembic_version*) echo 0068_x;; '
        '*) printf "songs:3\\nrecordings:25\\nuser_accounts:1\\n";; esac',
    )
    # age -r KEY -o OUT IN   /   age -d -i KEY -o OUT IN : "encrypts" by prefixing a marker
    _tool(
        folder,
        "age",
        'out=""; in=""; dec=0\n'
        'while [ $# -gt 0 ]; do case "$1" in -o) out="$2"; shift 2;; -r|-i) shift 2;; '
        '-d) dec=1; shift;; *) in="$1"; shift;; esac; done\n'
        'if [ "$dec" = 1 ]; then tail -c +5 "$in" > "$out"; '
        'else (printf "AGE:"; cat "$in") > "$out"; fi',
    )
    return folder


def _run(
    script: str, env: dict[str, str], stand_ins: Path | None, *args: str
) -> subprocess.CompletedProcess[str]:
    path = f"{stand_ins}:{os.environ['PATH']}" if stand_ins else os.environ["PATH"]
    base = {"PATH": path, "HOME": os.environ.get("HOME", "/")}
    return subprocess.run(
        ["bash", str(BACKUP_DIR / script), *args],
        env={**base, **env},
        capture_output=True,
        text=True,
        check=False,
    )


def test_dry_run_needs_no_tools_and_hides_the_password(tmp_path: Path) -> None:
    result = _run(
        "pg_backup.sh",
        {
            "BACKUP_DATABASE_URL": "postgresql://user:hunter2@db.example/prod",
            "BACKUP_REMOTE": str(tmp_path / "out"),
            "BACKUP_AGE_RECIPIENT": "age1example",
        },
        None,
        "--dry-run",
    )
    assert result.returncode == 0, result.stderr
    assert "hunter2" not in result.stderr
    assert not (tmp_path / "out").exists()


def test_plain_dump_is_refused_without_the_rehearsal_flag(tmp_path: Path) -> None:
    result = _run(
        "pg_backup.sh",
        {
            "BACKUP_DATABASE_URL": "postgresql://u@h/d",
            "BACKUP_REMOTE": str(tmp_path),
            "BACKUP_ENCRYPT": "none",
        },
        None,
        "--dry-run",
    )
    assert result.returncode != 0
    assert "BACKUP_ALLOW_PLAIN" in result.stderr


def test_plain_dump_is_refused_for_a_cloud_destination() -> None:
    result = _run(
        "pg_backup.sh",
        {
            "BACKUP_DATABASE_URL": "postgresql://u@h/d",
            "BACKUP_REMOTE": "backup:bucket/db",
            "BACKUP_ENCRYPT": "none",
            "BACKUP_ALLOW_PLAIN": "1",
        },
        None,
        "--dry-run",
    )
    assert result.returncode != 0
    assert "local folder" in result.stderr


def test_encrypted_backup_leaves_no_plain_dump_and_writes_a_receipt(
    tmp_path: Path, stand_ins: Path
) -> None:
    out = tmp_path / "out"
    result = _run(
        "pg_backup.sh",
        {
            "BACKUP_DATABASE_URL": "postgresql://u@h/d",
            "BACKUP_REMOTE": str(out),
            "BACKUP_AGE_RECIPIENT": "age1example",
        },
        stand_ins,
    )
    assert result.returncode == 0, result.stderr
    assert not list(out.rglob("*.dump")), "the plain dump must never reach the backup place"
    [encrypted] = list(out.rglob("*.dump.age"))
    assert encrypted.read_bytes().startswith(b"AGE:")
    [receipt_path] = list(out.rglob("*.json"))
    receipt = json.loads(receipt_path.read_text())
    assert receipt["encrypted"] is True
    assert receipt["row_counts"] == {"songs": 3, "recordings": 25, "user_accounts": 1}
    assert receipt["alembic_version"] == "0068_x"


def test_keep_copies_removes_only_the_oldest_dumps_and_their_receipts(
    tmp_path: Path, stand_ins: Path
) -> None:
    out = tmp_path / "out"
    month = out / "2026" / "01"
    month.mkdir(parents=True)
    for day in ("01", "02", "03"):
        (month / f"prabhat-202601{day}T020000Z.dump").write_text("old")
        (month / f"prabhat-202601{day}T020000Z.json").write_text("{}")
    (out / "notes.txt").write_text("not a backup, must survive")
    result = _run(
        "pg_backup.sh",
        {
            "BACKUP_DATABASE_URL": "postgresql://u@h/d",
            "BACKUP_REMOTE": str(out),
            "BACKUP_ENCRYPT": "none",
            "BACKUP_ALLOW_PLAIN": "1",
            "BACKUP_KEEP_COPIES": "2",
        },
        stand_ins,
    )
    assert result.returncode == 0, result.stderr
    dumps = sorted(p.name for p in out.rglob("*.dump"))
    assert len(dumps) == 2
    assert (
        dumps[0] == "prabhat-20260103T020000Z.dump"
    )  # the newest old one stays, the new one is last
    assert not (month / "prabhat-20260101T020000Z.json").exists()
    assert (out / "notes.txt").exists()


@pytest.mark.parametrize("value", ["0", "two"])
def test_keep_copies_must_be_a_positive_number(tmp_path: Path, value: str) -> None:
    result = _run(
        "pg_backup.sh",
        {
            "BACKUP_DATABASE_URL": "postgresql://u@h/d",
            "BACKUP_REMOTE": str(tmp_path),
            "BACKUP_AGE_RECIPIENT": "age1example",
            "BACKUP_KEEP_COPIES": value,
        },
        None,
        "--dry-run",
    )
    assert result.returncode != 0


def test_restore_requires_a_target_and_refuses_a_non_empty_database(
    tmp_path: Path, stand_ins: Path
) -> None:
    missing = _run("restore.sh", {}, stand_ins, "--file", str(tmp_path / "x.dump"))
    assert missing.returncode != 0 and "--target-url" in missing.stderr

    dump = tmp_path / "x.dump"
    dump.write_text("DUMP")
    # fake psql answers "3" to the "how many tables" question: the target is not empty
    _tool(stand_ins, "psql", "echo 3")
    _tool(stand_ins, "pg_restore", "echo should-not-run >&2; exit 9")
    refused = _run(
        "restore.sh",
        {},
        stand_ins,
        "--file",
        str(dump),
        "--target-url",
        "postgresql://u:secret@h/d",
    )
    assert refused.returncode != 0
    assert "already has 3 tables" in refused.stderr
    assert "should-not-run" not in refused.stderr
    assert "secret" not in refused.stderr


def test_restore_script_parses() -> None:
    result = subprocess.run(["bash", "-n", str(BACKUP_DIR / "restore.sh")], capture_output=True)
    assert result.returncode == 0, result.stderr.decode()
