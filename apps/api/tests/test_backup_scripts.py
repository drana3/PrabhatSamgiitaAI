"""The backup scripts (infra/backup): they parse, their dry run touches nothing and needs no
tools, they refuse to start without their settings, and they never print a password."""

from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path

import pytest

BACKUP = Path(__file__).resolve().parents[3] / "infra" / "backup"
SCRIPTS = ["lib.sh", "pg_backup.sh", "files_backup.sh", "restore_drill.sh"]
BASH = shutil.which("bash")
pytestmark = pytest.mark.skipif(BASH is None, reason="bash is not installed")


def run(script: str, *args: str, env: dict[str, str] | None = None):
    clean = {"PATH": os.environ.get("PATH", ""), "HOME": os.environ.get("HOME", "")}
    clean.update(env or {})
    return subprocess.run(
        [BASH or "bash", str(BACKUP / script), *args],
        capture_output=True,
        text=True,
        env=clean,
        timeout=30,
    )


@pytest.mark.parametrize("script", SCRIPTS)
def test_script_parses(script: str) -> None:
    result = subprocess.run([BASH or "bash", "-n", str(BACKUP / script)], capture_output=True)
    assert result.returncode == 0, result.stderr.decode()


def test_pg_backup_dry_run_hides_the_password() -> None:
    result = run(
        "pg_backup.sh",
        "--dry-run",
        env={
            "BACKUP_DATABASE_URL": "postgresql://dbuser:SuperSecret123@host.example/db?sslmode=require",
            "BACKUP_AGE_RECIPIENT": "age1examplepublickey",
            "BACKUP_REMOTE": "backup:bucket/db",
        },
    )
    assert result.returncode == 0, result.stderr
    assert "SuperSecret123" not in result.stdout + result.stderr
    assert "dbuser:***@host.example" in result.stderr
    assert ".dump.age" in result.stderr and "35 days" in result.stderr


def test_pg_backup_refuses_without_settings() -> None:
    result = run("pg_backup.sh", "--dry-run", env={})
    assert result.returncode != 0 and "BACKUP_DATABASE_URL is not set" in result.stderr


def test_files_backup_dry_run_and_missing_settings() -> None:
    ok = run(
        "files_backup.sh",
        "--dry-run",
        env={"FILES_SOURCE": "r2:live", "FILES_BACKUP": "other:copy"},
    )
    assert ok.returncode == 0 and "never delete" in ok.stderr
    assert run("files_backup.sh", "--dry-run").returncode != 0


def test_restore_drill_dry_run_and_bad_argument() -> None:
    ok = run("restore_drill.sh", "--dry-run", "--file", "x.dump.age", "--identity", "k.key")
    assert ok.returncode == 0 and "pg_restore" in ok.stderr
    bad = run("restore_drill.sh", "--nonsense")
    assert bad.returncode != 0 and "unknown argument" in bad.stderr


def test_scripts_delete_only_inside_their_own_folder_and_never_the_source() -> None:
    for script in ("pg_backup.sh", "files_backup.sh", "restore_drill.sh"):
        text = (BACKUP / script).read_text()
        for line in text.splitlines():
            stripped = line.strip()
            if stripped.startswith("#"):
                continue
            if "rm -" in stripped:
                assert "${WORK:?}" in stripped, f"{script}: {stripped}"
    assert "rclone sync" not in (BACKUP / "files_backup.sh").read_text().replace("# ", "")
