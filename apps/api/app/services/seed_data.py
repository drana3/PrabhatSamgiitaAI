from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any, cast
from urllib.parse import urljoin

DATA_DIR = Path(__file__).resolve().parents[4] / "data"


@lru_cache(maxsize=8)
def load_rows(filename: str) -> list[dict[str, Any]]:
    generated = _read_rows(DATA_DIR / "generated" / filename)
    if filename == "media.json":
        generated = _merge_unique(
            generated,
            _read_rows(DATA_DIR / "generated" / "external_audio.json"),
            "url",
        )
        generated = _merge_unique(
            generated,
            _read_rows(DATA_DIR / "generated" / "youtube_videos.json"),
            "url",
        )
    if filename == "inventory.json":
        external_audio_inventory = [
            {
                "source_kind": "audio",
                "title": row["title"],
                "url": row["url"],
                "status": "active",
                "metadata_json": {
                    **(row.get("metadata_json") or {}),
                    "song_number": row.get("song_number"),
                    "discovered_from": row.get("source_url"),
                },
                "notes": row.get("notes"),
            }
            for row in _read_rows(DATA_DIR / "generated" / "external_audio.json")
        ]
        generated = _merge_unique(generated, external_audio_inventory, "url")
        video_inventory = [
            {
                "source_kind": "video",
                "title": row["title"],
                "url": row["url"],
                "status": "active",
                "metadata_json": {
                    **(row.get("metadata_json") or {}),
                    "song_number": row.get("song_number"),
                    "embed_url": row.get("embed_url"),
                    "discovered_from": row.get("source_url"),
                },
                "notes": row.get("notes"),
            }
            for row in _read_rows(DATA_DIR / "generated" / "youtube_videos.json")
        ]
        generated = _merge_unique(generated, video_inventory, "url")
    seed = _read_rows(DATA_DIR / "seed" / filename)
    if not generated:
        return seed
    if not seed:
        return generated

    if filename == "songs.json":
        return _merge_songs(generated, seed)
    key = {
        "media.json": "url",
        "notations.json": "source_url",
        "inventory.json": "url",
    }.get(filename)
    if not key:
        return generated
    return _merge_unique(generated, seed, key)


def _read_rows(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    rows = cast(list[dict[str, Any]], json.loads(path.read_text(encoding="utf-8")))
    if path.name == "songs.json":
        for row in rows:
            source_url = row.get("canonical_source_url")
            if isinstance(source_url, str) and source_url.startswith("/"):
                row["canonical_source_url"] = urljoin(
                    "https://prabhatasamgiita.net", source_url
                )
    return rows


def _merge_songs(
    generated: list[dict[str, Any]], seed: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    seed_by_number = {row.get("number"): row for row in seed}
    assignments = {
        row.get("song_number"): row
        for row in _read_rows(DATA_DIR / "generated" / "theme_assignments.json")
    }
    merged: list[dict[str, Any]] = []
    for generated_row in generated:
        row = dict(generated_row)
        seed_row = seed_by_number.get(row.get("number"), {})
        for key, value in seed_row.items():
            if row.get(key) in (None, "", [], {}):
                row[key] = value
        assignment = assignments.get(row.get("number"))
        if assignment:
            row["theme"] = ", ".join(assignment.get("themes", [])) or row.get("theme")
            row["festival"] = ", ".join(assignment.get("festivals", [])) or row.get(
                "festival"
            )
            row["occasion"] = ", ".join(assignment.get("occasions", [])) or row.get(
                "occasion"
            )
            row["season"] = ", ".join(assignment.get("seasons", [])) or row.get(
                "season"
            )
            languages = assignment.get("languages", [])
            if languages:
                row["language"] = ", ".join(languages)
            metadata = dict(row.get("metadata_json") or {})
            metadata["canonical_theme_assignments"] = assignment
            row["metadata_json"] = metadata
        merged.append(row)
    return merged


def _merge_unique(
    generated: list[dict[str, Any]],
    seed: list[dict[str, Any]],
    key: str,
) -> list[dict[str, Any]]:
    rows = [dict(row) for row in generated]
    known = {row.get(key) for row in rows}
    rows.extend(dict(row) for row in seed if row.get(key) not in known)
    return rows
