# ruff: noqa: E501
"""Plan the `media` rows for the colleagues' PS recordings (docs/ps-audio.md). Pure: no database, no network."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.models.media import Media
from app.services.ps_audio import (
    PS_AUDIO_KEY_PREFIX,
    PS_AUDIO_PROVIDER,
    ps_audio_file_ok,
    ps_audio_route_url,
)

PERFORMER = "Gunavati"
ADDED_NOTE = (
    "Recording by Gunavati from the colleagues' archive (zip of 11 Nov 2026). "
    "Added with Dada's go-ahead of 13 Nov 2026; the file is in a private bucket and plays through the API's signed link."
)


@dataclass(frozen=True)
class PlannedRow:
    song_number: int
    file_name: str
    title: str
    url: str
    r2_key: str
    bytes: int
    row: Media


def media_row(
    *,
    song_number: int,
    title: str,
    api_base_url: str,
    recording: dict[str, Any],
    bucket: str,
    source_archive: str,
    performer: str = PERFORMER,
) -> Media:
    url = ps_audio_route_url(api_base_url, recording["file_name"])
    return Media(
        song_number=song_number,
        kind="audio",
        provider=PS_AUDIO_PROVIDER,
        title=title,
        url=url,
        embed_url=None,
        # "verified": Dada listened and approved these files; it is also what ranks them with the official audio
        verification_status="verified",
        source_url=None,
        notes=ADDED_NOTE,
        metadata_json={
            "performer": performer,
            "source_status": "verified",
            # the recording to play first (audio.json `is_current`); the older archive links stay in the list after it
            "is_current": bool(recording.get("is_current")),
            "is_primary": bool(recording.get("is_current")),
            "r2_bucket": bucket,
            "r2_key": recording["r2_key"],
            "file_name": recording["file_name"],
            "container": recording.get("container"),
            "bytes": recording.get("bytes"),
            "sha256": recording.get("sha256"),
            "source_archive": source_archive,
        },
    )


def plan_rows(
    audio: dict[str, Any],
    titles: dict[int, str],
    *,
    api_base_url: str,
    bucket: str,
) -> tuple[list[PlannedRow], list[str]]:
    """One planned row per uploaded recording of `audio.json`, and the problems found (such a row is left out)."""
    rows: list[PlannedRow] = []
    problems: list[str] = []
    source_archive = str(audio.get("_meta", {}).get("source_archive", ""))
    for key, entry in sorted(audio["songs"].items(), key=lambda item: int(item[0])):
        number = int(key)
        title = titles.get(number)
        if not title:
            problems.append(f"PS {number}: no song title in the catalogue, left out")
            continue
        for recording in entry["recordings"]:
            if recording.get("status") != "uploaded":
                problems.append(f"PS {number}: {recording['file_name']} is not uploaded, left out")
                continue
            if not recording["r2_key"].startswith(PS_AUDIO_KEY_PREFIX) or not ps_audio_file_ok(
                recording["file_name"]
            ):
                problems.append(
                    f"PS {number}: unexpected file name {recording['file_name']!r}, left out"
                )
                continue
            if recording["r2_key"] != PS_AUDIO_KEY_PREFIX + recording["file_name"]:
                problems.append(f"PS {number}: key and file name differ, left out")
                continue
            if not recording["file_name"].startswith(f"{number} "):
                problems.append(
                    f"PS {number}: file name does not start with the song number, left out"
                )
                continue
            row = media_row(
                song_number=number,
                title=title,
                api_base_url=api_base_url,
                recording=recording,
                bucket=bucket,
                source_archive=source_archive,
            )
            rows.append(
                PlannedRow(
                    song_number=number,
                    file_name=recording["file_name"],
                    title=title,
                    url=row.url,
                    r2_key=recording["r2_key"],
                    bytes=int(recording.get("bytes") or 0),
                    row=row,
                )
            )
    return rows, problems
