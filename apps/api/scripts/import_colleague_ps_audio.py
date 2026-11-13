# ruff: noqa: E501
"""Add the colleagues' PS recordings (Gunavati, 69 files) to the catalogue's `media` table.

Docs: docs/ps-audio.md. The files are already in the private R2 bucket; this only writes the catalogue rows that
point at them (the API route `/api/v1/ps-audio/{file}` signs the link when someone plays).

Safe by design:

* DRY RUN by default. It reads and prints the plan; nothing is written. `--apply` inserts.
* INSERT ONLY. It never updates or deletes a row. A row whose address is already in `media` is skipped, so it can
  be run again after a stop. The older archive links of the songs stay as they are.
* `--check-bucket` (read only) asks the bucket, with a signed HEAD, whether each file is there and has the size
  `audio.json` says. It needs the PS_AUDIO_S3_* / RECORDING_S3_* keys in the environment.
* Songs missing from the database are left out and reported.

    cd apps/api
    python scripts/import_colleague_ps_audio.py                       # dry run
    python scripts/import_colleague_ps_audio.py --check-bucket        # dry run + is every file in the bucket
    python scripts/import_colleague_ps_audio.py --apply               # insert

The database comes from DATABASE_URL, the public API address from NEXT_PUBLIC_API_BASE_URL (or --api-base), the
bucket keys from the environment. Nothing secret is printed.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path

API_ROOT = Path(__file__).resolve().parents[1]
REPOSITORY_ROOT = API_ROOT.parents[1]
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

import httpx  # noqa: E402
from sqlalchemy import select  # noqa: E402

from app.config import get_settings  # noqa: E402
from app.models.media import Media  # noqa: E402
from app.models.song import Song  # noqa: E402
from app.services.ps_audio import PS_AUDIO_PROVIDER, signed_get_url  # noqa: E402
from app.services.ps_audio_import import PlannedRow, plan_rows  # noqa: E402
from app.services.recording_storage import StorageError  # noqa: E402

AUDIO_JSON = REPOSITORY_ROOT / "data" / "curated" / "ps_colleagues" / "audio.json"
SONGS_JSON = REPOSITORY_ROOT / "data" / "generated" / "songs.json"


def load_titles() -> dict[int, str]:
    return {int(row["number"]): row["title"] for row in json.loads(SONGS_JSON.read_text("utf-8"))}


async def read_database(numbers: list[int]) -> tuple[dict[int, str] | None, set[str] | None, str]:
    """Song titles and existing ps_colleagues addresses from the database, or None, None and why it failed."""
    settings = get_settings()
    if not settings.database_url:
        return None, None, "DATABASE_URL is not set"
    from app.core.db import SessionLocal

    try:
        async with SessionLocal() as session:
            songs = {
                int(n): t
                for n, t in (
                    await session.execute(
                        select(Song.number, Song.title).where(Song.number.in_(numbers))
                    )
                ).all()
            }
            existing = set(
                (
                    await session.scalars(
                        select(Media.url).where(
                            Media.provider == PS_AUDIO_PROVIDER, Media.song_number.in_(numbers)
                        )
                    )
                ).all()
            )
    except Exception as exc:  # the reason only: never the connection string
        return None, None, f"database not reachable ({type(exc).__name__})"
    return songs, existing, "ok"


async def check_bucket(rows: list[PlannedRow]) -> tuple[int, list[str]]:
    settings = get_settings()
    bad: list[str] = []
    ok = 0
    async with httpx.AsyncClient(timeout=30.0) as client:
        for planned in rows:
            try:
                url = signed_get_url(settings, planned.file_name, method="HEAD")
            except StorageError as exc:
                return ok, [str(exc)]
            response = await client.head(url)
            if response.status_code != 200:
                bad.append(f"PS {planned.song_number}: bucket answered {response.status_code}")
                continue
            size = int(response.headers.get("content-length", "0"))
            if planned.bytes and size != planned.bytes:
                bad.append(
                    f"PS {planned.song_number}: size {size} in the bucket, {planned.bytes} in audio.json"
                )
                continue
            ok += 1
    return ok, bad


async def insert(rows: list[PlannedRow]) -> int:
    from app.core.db import SessionLocal

    async with SessionLocal() as session:
        session.add_all([planned.row for planned in rows])
        await session.commit()
    return len(rows)


async def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument(
        "--apply", action="store_true", help="insert the new rows (default: dry run)"
    )
    parser.add_argument(
        "--check-bucket", action="store_true", help="HEAD every file in the bucket (read only)"
    )
    parser.add_argument("--api-base", help="public API address; default NEXT_PUBLIC_API_BASE_URL")
    parser.add_argument(
        "--plan", type=Path, help="write the planned rows (no secrets) to this JSON file"
    )
    args = parser.parse_args(argv)

    settings = get_settings()
    api_base = args.api_base or settings.next_public_api_base_url
    audio = json.loads(AUDIO_JSON.read_text("utf-8"))
    titles = load_titles()
    numbers = sorted(int(k) for k in audio["songs"])
    db_titles, existing, state = await read_database(numbers)

    if db_titles is not None:
        # The title the app shows is the database's; fall back to the repository's data only for a missing row.
        titles = {n: db_titles.get(n) or "" for n in numbers}
    rows, problems = plan_rows(
        audio, titles, api_base_url=api_base, bucket=settings.ps_audio_s3_bucket
    )
    if existing is None:
        fresh = rows
    else:
        fresh = [r for r in rows if r.url not in existing]

    print(f"mode:       {'APPLY' if args.apply else 'dry run'}")
    print(f"database:   {state}")
    print(f"api base:   {api_base}")
    print(
        f"planned:    {len(rows)} rows ({len(rows) - len(fresh)} already there, {len(fresh)} new)"
    )
    for line in problems:
        print(f"problem:    {line}")
    if args.plan:
        args.plan.write_text(
            json.dumps(
                [
                    {
                        "song": r.song_number,
                        "title": r.title,
                        "url": r.url,
                        "r2_key": r.r2_key,
                        "bytes": r.bytes,
                    }
                    for r in rows
                ],
                indent=1,
                ensure_ascii=False,
            ),
            "utf-8",
        )
        print(f"plan:       written to {args.plan}")
    if args.check_bucket:
        ok, bad = await check_bucket(rows)
        print(f"bucket:     {ok} of {len(rows)} files found with the right size")
        for line in bad:
            print(f"bucket:     {line}")
        if bad:
            return 1
    if args.apply:
        if existing is None:
            print("refusing to write: the database could not be read (see 'database' above)")
            return 2
        if problems:
            print("refusing to write while there are problems (see above)")
            return 2
        written = await insert(fresh)
        print(f"inserted:   {written} rows. Nothing was updated or deleted.")
    else:
        print("nothing written (dry run). Add --apply to insert.")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
