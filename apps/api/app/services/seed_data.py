from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any, cast
from urllib.parse import urljoin

from app.services.notation_links import ANDROMEDA_ARCHIVE, learner_notation_url

DATA_DIR = Path(__file__).resolve().parents[4] / "data"


@lru_cache(maxsize=8)
def load_rows(filename: str) -> list[dict[str, Any]]:
    generated = _read_rows(DATA_DIR / "generated" / filename)
    if filename == "notations.json":
        generated = _merge_notation_practice(
            generated,
            _read_rows(DATA_DIR / "generated" / "notation_practice.json"),
        )
        generated = _merge_expert_notation(generated, _read_expert_notation_rows())
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


def _read_expert_notation_rows() -> list[dict[str, Any]]:
    expert_dir = DATA_DIR / "curated" / "expert_notation"
    if not expert_dir.is_dir():
        return []
    rows: list[dict[str, Any]] = []
    for path in sorted(expert_dir.glob("*.json")):
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        if not isinstance(payload, dict) or not payload.get("song_number"):
            continue
        notation_text = payload.get("notation_text")
        if isinstance(notation_text, dict):
            payload = {
                **payload,
                "notation_text": json.dumps(notation_text, ensure_ascii=False),
            }
        rows.append(payload)
    return rows


def _merge_expert_notation(
    sources: list[dict[str, Any]],
    expert_rows: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Expert-curated sheets override OCR practice drafts for the same song."""
    experts = {row.get("song_number"): row for row in expert_rows if row.get("notation_text")}
    if not experts:
        return sources
    merged: list[dict[str, Any]] = []
    covered: set[Any] = set()
    for source in sources:
        row = dict(source)
        expert = experts.get(row.get("song_number"))
        if expert:
            covered.add(row.get("song_number"))
            source_meta = dict(row.get("metadata_json") or {})
            expert_meta = dict(expert.get("metadata_json") or {})
            prior_status = row.get("verification_status", "unverified")
            row["notation_text"] = expert.get("notation_text")
            row["scale"] = expert.get("scale") or row.get("scale") or "C"
            row["verification_status"] = expert.get("verification_status", "expert_verified")
            row["source_url"] = learner_notation_url(
                expert.get("source_url"),
                row.get("source_url"),
                *(source_meta.get("source_urls") or []),
                *(expert_meta.get("source_urls") or []),
            )
            row["metadata_json"] = {
                **source_meta,
                **expert_meta,
                "source_verification_status": prior_status,
                "archive_url": ANDROMEDA_ARCHIVE,
                "expert_overrides_practice": True,
            }
        merged.append(row)
    for number, expert in experts.items():
        if number in covered:
            continue
        expert_meta = dict(expert.get("metadata_json") or {})
        merged.append(
            {
                "song_number": number,
                "source_url": learner_notation_url(
                    expert.get("source_url"),
                    *(expert_meta.get("source_urls") or []),
                ),
                "notation_text": expert.get("notation_text"),
                "scale": expert.get("scale") or "C",
                "verification_status": expert.get("verification_status", "expert_verified"),
                "metadata_json": {
                    **expert_meta,
                    "archive_url": ANDROMEDA_ARCHIVE,
                    "expert_overrides_practice": True,
                },
            }
        )
    return merged


def _merge_notation_practice(
    sources: list[dict[str, Any]],
    practice_rows: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    drafts = {row.get("song_number"): row for row in practice_rows}
    merged: list[dict[str, Any]] = []
    for source in sources:
        row = dict(source)
        draft = drafts.get(row.get("song_number"))
        source_meta = dict(row.get("metadata_json") or {})
        if draft:
            source_verification_status = row.get("verification_status", "unverified")
            draft_meta = dict(draft.get("metadata_json") or {})
            row["notation_text"] = draft.get("notation_text")
            row["scale"] = draft.get("scale") or "C"
            row["verification_status"] = draft.get("verification_status", "practice_draft")
            row["source_url"] = learner_notation_url(
                row.get("source_url"),
                *(source_meta.get("source_urls") or []),
                draft.get("source_url"),
                *(draft_meta.get("source_urls") or []),
            )
            row["metadata_json"] = {
                **source_meta,
                **draft_meta,
                "source_verification_status": source_verification_status,
                "archive_url": ANDROMEDA_ARCHIVE,
                "source_urls": [
                    url
                    for url in (
                        *(source_meta.get("source_urls") or []),
                        row.get("source_url"),
                    )
                    if url and "sarkarverse.org" not in str(url).lower()
                ]
                or [row["source_url"]],
            }
        else:
            row["metadata_json"] = {
                **source_meta,
                "archive_url": source_meta.get("archive_url")
                or "https://prabhatasamgiita.net/notations/andromeda.php",
                "learner_notice": (
                    "Canonical Andromeda notation PDF is available. "
                    "Interactive Hindi Sargam appears after OCR practice extraction."
                ),
            }
        merged.append(row)
    covered = {row.get("song_number") for row in merged}
    for number, draft in drafts.items():
        if number in covered or not draft.get("notation_text"):
            continue
        draft_meta = dict(draft.get("metadata_json") or {})
        merged.append(
            {
                "song_number": number,
                "source_url": learner_notation_url(
                    draft.get("source_url"),
                    *(draft_meta.get("source_urls") or []),
                ),
                "notation_text": draft.get("notation_text"),
                "scale": draft.get("scale") or "C",
                "verification_status": draft.get("verification_status", "practice_draft"),
                "metadata_json": {
                    **draft_meta,
                    "source_verification_status": draft.get(
                        "verification_status", "practice_draft"
                    ),
                    "archive_url": ANDROMEDA_ARCHIVE,
                    "source_urls": [
                        learner_notation_url(
                            draft.get("source_url"),
                            *(draft_meta.get("source_urls") or []),
                        )
                    ],
                },
            }
        )
    return merged


def _read_rows(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    rows = cast(list[dict[str, Any]], json.loads(path.read_text(encoding="utf-8")))
    if path.name == "songs.json":
        for row in rows:
            source_url = row.get("canonical_source_url")
            if isinstance(source_url, str) and source_url.startswith("/"):
                row["canonical_source_url"] = urljoin("https://prabhatasamgiita.net", source_url)
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
            row["festival"] = ", ".join(assignment.get("festivals", [])) or row.get("festival")
            row["occasion"] = ", ".join(assignment.get("occasions", [])) or row.get("occasion")
            row["season"] = ", ".join(assignment.get("seasons", [])) or row.get("season")
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
