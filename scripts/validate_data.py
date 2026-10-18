from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
GENERATED = ROOT / "data" / "generated"
SEED = ROOT / "data" / "seed"


def load_rows(filename: str) -> list[dict[str, Any]]:
    path = GENERATED / filename
    if not path.exists():
        path = SEED / filename
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise ValueError(f"{path}: root must be a JSON array")
    return data


def valid_url(value: object, *, https_only: bool = False) -> bool:
    if not isinstance(value, str):
        return False
    parsed = urlparse(value)
    allowed_schemes = {"https"} if https_only else {"http", "https"}
    return parsed.scheme in allowed_schemes and bool(parsed.netloc)


def valid_source_reference(value: object) -> bool:
    return isinstance(value, str) and (value.startswith("/") or valid_url(value))


def validate() -> list[str]:
    errors: list[str] = []
    songs = load_rows("songs.json")
    media = load_rows("media.json")
    for extra_name in ("external_audio.json", "youtube_videos.json"):
        extra_path = GENERATED / extra_name
        if extra_path.exists():
            extra = json.loads(extra_path.read_text(encoding="utf-8"))
            if isinstance(extra, list):
                media.extend(extra)
    notations = load_rows("notations.json")
    inventory = load_rows("inventory.json")

    numbers: set[int] = set()
    for index, song in enumerate(songs):
        number = song.get("number")
        if not isinstance(number, int) or not 1 <= number <= 5018:
            errors.append(f"songs[{index}].number must be an integer from 1 to 5018")
            continue
        if number in numbers:
            errors.append(f"duplicate song number: {number}")
        numbers.add(number)
        if not str(song.get("title") or "").strip():
            errors.append(f"song {number}: title is required")
        if not valid_source_reference(song.get("canonical_source_url")):
            errors.append(f"song {number}: canonical_source_url must be a valid source reference")
        if not song.get("canonical_source_status"):
            errors.append(f"song {number}: canonical_source_status is required")

    media_urls: set[str] = set()
    covered_songs: set[int] = set()
    for index, item in enumerate(media):
        url = item.get("url")
        if not valid_url(url, https_only=True):
            errors.append(f"media[{index}].url must be HTTPS")
        elif str(url) in media_urls:
            errors.append(f"duplicate media URL: {url}")
        else:
            media_urls.add(str(url))
        song_number = item.get("song_number")
        if song_number is not None and song_number not in numbers:
            errors.append(f"media[{index}] references unknown song {song_number}")
        elif isinstance(song_number, int):
            covered_songs.add(song_number)
        if not item.get("verification_status"):
            errors.append(f"media[{index}].verification_status is required")

    notation_pairs: set[tuple[int, str]] = set()
    notation_songs: set[int] = set()
    for index, notation in enumerate(notations):
        song_number = notation.get("song_number")
        if song_number not in numbers:
            errors.append(f"notations[{index}] references unknown song {song_number}")
        elif isinstance(song_number, int) and song_number > 0:
            if song_number in notation_songs:
                errors.append(f"duplicate notation song_number {song_number} (Andromeda parts must be grouped)")
            notation_songs.add(song_number)
        source_url = notation.get("source_url")
        if source_url and not valid_url(source_url):
            errors.append(f"notations[{index}].source_url must be a valid URL")
        key = (int(song_number or 0), str(source_url or ""))
        if key in notation_pairs:
            errors.append(f"duplicate notation source for song {song_number}: {source_url}")
        notation_pairs.add(key)
        meta = notation.get("metadata_json") or {}
        if isinstance(meta, dict):
            archive = meta.get("archive_url")
            if archive and not valid_url(archive):
                errors.append(f"notations[{index}].metadata_json.archive_url must be a valid URL")

    practice_path = GENERATED / "notation_practice.json"
    if practice_path.exists():
        practice = json.loads(practice_path.read_text(encoding="utf-8"))
        if isinstance(practice, list):
            practice_songs: set[int] = set()
            for index, draft in enumerate(practice):
                song_number = draft.get("song_number")
                if not isinstance(song_number, int) or song_number not in numbers:
                    errors.append(
                        f"notation_practice[{index}] references unknown song {song_number}"
                    )
                elif song_number in practice_songs:
                    errors.append(f"duplicate notation_practice song_number {song_number}")
                else:
                    practice_songs.add(song_number)
                if not draft.get("notation_text"):
                    errors.append(f"notation_practice[{index}] for song {song_number} has empty notation_text")


    inventory_urls: set[str] = set()
    for index, item in enumerate(inventory):
        url = item.get("url")
        if not valid_url(url):
            errors.append(f"inventory[{index}].url must be a valid URL")
        elif str(url) in inventory_urls:
            errors.append(f"duplicate inventory URL: {url}")
        else:
            inventory_urls.add(str(url))

    if len(numbers) != 5018:
        errors.append(f"catalog must contain exactly 5018 unique songs; found {len(numbers)}")
    if len(covered_songs) < 4900:
        errors.append(
            f"linked media must cover at least 4900 distinct songs; found {len(covered_songs)}"
        )
    return errors


def main() -> int:
    errors = validate()
    if errors:
        print("Data validation failed:")
        for error in errors[:100]:
            print(f"- {error}")
        if len(errors) > 100:
            print(f"- ... and {len(errors) - 100} more")
        return 1
    print("Data validation passed: 5,018 songs and linked resources are structurally valid.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
