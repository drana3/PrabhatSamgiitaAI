#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import tempfile
import unicodedata
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
NOTATION_SOURCES = ROOT / "data" / "generated" / "notations.json"
SONGS = ROOT / "data" / "generated" / "songs.json"
OUTPUT = ROOT / "data" / "generated" / "notation_practice.json"
MODEL_URL = "https://github.com/tesseract-ocr/tessdata_best/raw/main/ben.traineddata"
MODEL_DIR = Path.home() / ".cache" / "prabhatai" / "tessdata"
SWARA_MAP = {
    "স": "S",
    "শ": "S",
    "র": "R",
    "গ": "G",
    "ম": "m",
    "প": "P",
    "ধ": "D",
    "ঢ": "D",
    "ন": "N",
    "ণ": "N",
}


def ensure_tools() -> None:
    for command in ("pdftoppm", "tesseract"):
        result = subprocess.run(["which", command], capture_output=True, text=True)
        if result.returncode:
            raise SystemExit(f"{command} is required")
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    model = MODEL_DIR / "ben.traineddata"
    if not model.exists():
        urllib.request.urlretrieve(MODEL_URL, model)


def notation_lines(ocr_text: str) -> list[str]:
    lines = [" ".join(line.split()) for line in ocr_text.splitlines()]
    candidates = []
    for line in lines:
        swaras = sum(character in SWARA_MAP for character in line)
        markers = line.count("-") + line.count("|") + line.count("।")
        if swaras >= 3 and markers >= 2:
            candidates.append(line)
    return candidates


def parse_swaras(line: str) -> list[str]:
    normalized = unicodedata.normalize("NFC", line)
    return [SWARA_MAP[character] for character in normalized if character in SWARA_MAP]


def lyric_lines(song: dict[str, Any]) -> list[str]:
    value = song.get("transliteration") or song.get("lyrics_original") or song.get("first_line")
    return [line.strip() for line in str(value or "").splitlines() if line.strip()]


def detect_tala(ocr_text: str) -> tuple[str, int, list[int]]:
    normalized = unicodedata.normalize("NFC", ocr_text)
    known = (
        (("কাহার", "কেহার"), "Kaharva", 8, [4, 4]),
        (("দাদরা",), "Dadra", 6, [3, 3]),
        (("ত্রিতাল", "তিনতাল"), "Tintal", 16, [4, 4, 4, 4]),
        (("একতাল",), "Ektal", 12, [2, 2, 2, 2, 2, 2]),
        (("ঝাঁপতাল", "ঝাপতাল"), "Jhaptal", 10, [2, 3, 2, 3]),
        (("রূপক",), "Rupak", 7, [3, 2, 2]),
    )
    for markers, name, beats, groups in known:
        if any(marker in normalized for marker in markers):
            return name, beats, groups
    return "Refer to canonical source", 8, [4, 4]


def build_notation(song: dict[str, Any], ocr_text: str) -> tuple[dict[str, Any] | None, float]:
    rows = notation_lines(ocr_text)
    lyrics = lyric_lines(song)
    parsed = [parse_swaras(row) for row in rows]
    parsed = [notes for notes in parsed if len(notes) >= 3]
    if not parsed:
        return None, 0.0
    lines = []
    for index, notes in enumerate(parsed):
        beats = [
            {
                "beat": beat + 1,
                "notes": [
                    {
                        "sargam": note,
                        "duration": 1.0,
                        "octave": "middle",
                    }
                ],
            }
            for beat, note in enumerate(notes)
        ]
        measures = [{"beats": beats[start : start + 8]} for start in range(0, len(beats), 8)]
        lines.append(
            {
                "line_number": index + 1,
                "lyrics": lyrics[index % len(lyrics)] if lyrics else f"Line {index + 1}",
                "measures": measures,
            }
        )
    confidence = min(
        0.68, 0.34 + min(len(lines), 5) * 0.045 + min(sum(map(len, parsed)), 40) * 0.002
    )
    tala_name, tala_beats, tala_groups = detect_tala(ocr_text)
    return {
        "version": 1,
        "source_scale": "C",
        "tempo_bpm": None,
        "tala": {"name": tala_name, "beats": tala_beats, "groups": tala_groups},
        "lines": lines,
    }, round(confidence, 3)


def extract(row: dict[str, Any], song: dict[str, Any]) -> dict[str, Any] | None:
    with tempfile.TemporaryDirectory(prefix=f"ps-{row['song_number']}-") as directory:
        work = Path(directory)
        pdf = work / "source.pdf"
        image = work / "page.png"
        with urllib.request.urlopen(str(row["source_url"]), timeout=20) as response:
            with pdf.open("wb") as target:
                shutil.copyfileobj(response, target)
        subprocess.run(
            [
                "pdftoppm",
                "-f",
                "1",
                "-singlefile",
                "-png",
                "-r",
                "150",
                str(pdf),
                str(image.with_suffix("")),
            ],
            check=True,
            capture_output=True,
        )
        result = subprocess.run(
            [
                "tesseract",
                str(image),
                "stdout",
                "-l",
                "ben",
                "--tessdata-dir",
                str(MODEL_DIR),
                "--psm",
                "6",
            ],
            check=True,
            capture_output=True,
            text=True,
        )
    notation, confidence = build_notation(song, result.stdout)
    if not notation or confidence < 0.5:
        return None
    return {
        "song_number": row["song_number"],
        "source_url": row["source_url"],
        "notation_text": json.dumps(notation, ensure_ascii=False, separators=(",", ":")),
        "scale": "C",
        "verification_status": "practice_draft",
        "metadata_json": {
            "extraction_method": "tesseract_bengali_source_pdf",
            "confidence": confidence,
            "requires_human_review": True,
            "learner_notice": "OCR-derived practice draft; compare with the canonical PDF.",
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--song", type=int)
    parser.add_argument("--limit", type=int)
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--output", type=Path, default=OUTPUT)
    parser.add_argument("--fresh", action="store_true")
    args = parser.parse_args()
    ensure_tools()
    sources = json.loads(NOTATION_SOURCES.read_text(encoding="utf-8"))
    songs = {row["number"]: row for row in json.loads(SONGS.read_text(encoding="utf-8"))}
    if args.song:
        sources = [row for row in sources if row["song_number"] == args.song]
    if args.limit:
        sources = sources[: args.limit]
    output = []
    if args.output.exists() and not args.fresh:
        output = json.loads(args.output.read_text(encoding="utf-8"))
        completed_numbers = {row["song_number"] for row in output}
        sources = [row for row in sources if row["song_number"] not in completed_numbers]
        print(f"resuming with {len(output)} existing drafts")

    def checkpoint() -> None:
        best_by_song: dict[int, dict[str, Any]] = {}
        for row in output:
            number = int(row["song_number"])
            current = best_by_song.get(number)
            confidence = float((row.get("metadata_json") or {}).get("confidence", 0))
            current_confidence = float(
                ((current or {}).get("metadata_json") or {}).get("confidence", 0)
            )
            if current is None or confidence > current_confidence:
                best_by_song[number] = row
        output[:] = sorted(best_by_song.values(), key=lambda row: row["song_number"])
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(
            json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )

    with ThreadPoolExecutor(max_workers=max(1, args.workers)) as pool:
        jobs = {
            pool.submit(extract, row, songs.get(row["song_number"], {})): row for row in sources
        }
        for completed, future in enumerate(as_completed(jobs), start=1):
            row = jobs[future]
            try:
                draft = future.result()
                if draft:
                    output.append(draft)
            except Exception as exc:
                print(f"song {row['song_number']}: {exc}")
            if completed % 25 == 0 or completed == len(jobs):
                print(f"processed {completed}/{len(jobs)}; extracted {len(output)}")
                checkpoint()
    checkpoint()
    print(f"wrote {len(output)} practice drafts to {args.output}")


if __name__ == "__main__":
    main()
