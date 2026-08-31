#!/usr/bin/env python3
"""Pilot: compare layout OCR vs text OCR against hand-verified booklet sargam.

Example (Song 2):
    python scripts/pilot_sargam_extract.py --song 2

Requires:
    pip install -r scripts/requirements-sargam-ocr.txt
    brew install tesseract   # or apt install tesseract-ocr
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
import tempfile
import urllib.request
from dataclasses import dataclass
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
FIXTURES = ROOT / "data" / "fixtures"
CACHE = ROOT / "data" / "cache" / "sargam"


def load_extract_module() -> Any:
    spec = spec_from_file_location("extract_harmonium_notation", SCRIPTS / "extract_harmonium_notation.py")
    if not spec or not spec.loader:
        raise RuntimeError("Unable to load extract_harmonium_notation.py")
    module = module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def load_layout_module() -> Any:
    spec = spec_from_file_location("prabhat_sargam_layout_ocr", SCRIPTS / "prabhat_sargam_layout_ocr.py")
    if not spec or not spec.loader:
        raise RuntimeError("Unable to load prabhat_sargam_layout_ocr.py")
    module = module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


@dataclass
class ComparedLine:
    lyric: str
    gold_sargam: str
    gold_beats: list[tuple[str, int]]
    layout_sargam: str | None
    layout_beats: list[tuple[str, int]] | None
    text_sargam: str | None
    text_beats: list[tuple[str, int]] | None
    layout_lyric_score: float
    text_lyric_score: float


def beats_signature(extract: Any, sargam: str) -> list[tuple[str, int]]:
    play = extract.parse_roman_booklet_beats(sargam)
    return [(str(item["sargam"]), int(item["beats"])) for item in play]


def lyric_score(extract: Any, left: str, right: str) -> float:
    if not left or not right:
        return 0.0
    a = extract.fold_lyric(left)
    b = extract.fold_lyric(right)
    if not a or not b:
        return 0.0
    if a in b or b in a:
        return 1.0
    from difflib import SequenceMatcher

    return SequenceMatcher(None, a, b).ratio()


def fetch_pdf(url: str, destination: Path) -> Path:
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists() and destination.stat().st_size > 10_000:
        return destination
    print(f"[fetch] {url}")
    urllib.request.urlretrieve(url, destination)
    return destination


def ocr_page_range(extract: Any, pdf: Path, pages: list[int], work: Path) -> str:
    chunks: list[str] = []
    for page in pages:
        prefix = work / f"page-{page}"
        subprocess.run(
            [
                "pdftoppm",
                "-png",
                "-r",
                "300",
                "-f",
                str(page),
                "-l",
                str(page),
                str(pdf),
                str(prefix),
            ],
            check=True,
            capture_output=True,
        )
        images = sorted(work.glob(f"page-{page}*.png"))
        if not images:
            raise RuntimeError(f"pdftoppm produced no image for page {page}")
        prepared = work / f"{images[0].stem}-prep.png"
        extract.preprocess_book_photo(images[0], prepared)
        primary = extract.ocr_image(prepared, psm="6", lang="eng")
        secondary = extract.ocr_image(prepared, psm="4", lang="eng")
        chunks.append(extract.merge_ocr_passes(primary, secondary))
    return "\n".join(chunks)


def match_pipeline_lines(
    extract: Any,
    gold_lines: list[dict[str, str]],
    candidates: list[tuple[str, str]],
) -> list[tuple[dict[str, str], str, float]]:
    """Greedy match candidate (lyric, sargam) rows to gold lines by lyric similarity."""
    used: set[int] = set()
    matched: list[tuple[dict[str, str], str, float]] = []
    for gold in gold_lines:
        best_index = None
        best_score = 0.0
        for index, (lyric, _sargam) in enumerate(candidates):
            if index in used:
                continue
            score = lyric_score(extract, gold["lyric"], lyric)
            if score > best_score:
                best_score = score
                best_index = index
        if best_index is None or best_score < 0.35:
            matched.append((gold, "", 0.0))
            continue
        used.add(best_index)
        matched.append((gold, candidates[best_index][1], best_score))
    return matched


def compare_song2(
    extract: Any,
    layout: Any,
    pdf: Path,
    gold: dict[str, Any],
    *,
    dpi: int,
    debug_dir: Path | None,
) -> dict[str, Any]:
    pages = [int(page) for page in gold["pages"]]
    layout_lines = layout.extract_pages(pdf, pages, dpi=dpi, debug_dir=debug_dir)
    layout_candidates = [(line.lyrics, line.sargam) for line in layout_lines if line.sargam]

    with tempfile.TemporaryDirectory(prefix="pilot-text-ocr-") as directory:
        text_ocr = ocr_page_range(extract, pdf, pages, Path(directory))

    song = {
        "number": gold["song_number"],
        "transliteration": "\n".join(line["lyric"] for line in gold["lines"]),
        "lyrics_original": "",
    }
    text_notation = extract.parse_rs_song_page(text_ocr, song)
    text_candidates = [
        (str(line["lyrics"]), str(line["sargam_text"]))
        for line in (text_notation or {}).get("lines", [])
    ]

    layout_matches = match_pipeline_lines(extract, gold["lines"], layout_candidates)
    text_matches = match_pipeline_lines(extract, gold["lines"], text_candidates)

    rows: list[ComparedLine] = []
    for index, gold_line in enumerate(gold["lines"]):
        gold_sargam = gold_line["sargam"]
        gold_beats = beats_signature(extract, gold_sargam)
        _, layout_sargam, layout_lyric_score = layout_matches[index]
        _, text_sargam, text_lyric_score = text_matches[index]
        rows.append(
            ComparedLine(
                lyric=gold_line["lyric"],
                gold_sargam=gold_sargam,
                gold_beats=gold_beats,
                layout_sargam=layout_sargam or None,
                layout_beats=beats_signature(extract, layout_sargam) if layout_sargam else None,
                text_sargam=text_sargam or None,
                text_beats=beats_signature(extract, text_sargam) if text_sargam else None,
                layout_lyric_score=layout_lyric_score,
                text_lyric_score=text_lyric_score,
            )
        )

    def beat_hits(rows_: list[ComparedLine], field: str) -> int:
        total = 0
        for row in rows_:
            beats = getattr(row, field)
            if beats is not None and beats == row.gold_beats:
                total += 1
        return total

    report = {
        "song_number": gold["song_number"],
        "title": gold["title"],
        "pages": pages,
        "pdf": str(pdf),
        "gold_line_count": len(gold["lines"]),
        "layout_extracted_rows": len(layout_candidates),
        "text_extracted_rows": len(text_candidates),
        "layout_beat_matches": beat_hits(rows, "layout_beats"),
        "text_beat_matches": beat_hits(rows, "text_beats"),
        "layout_lyric_matches": sum(1 for row in rows if row.layout_lyric_score >= 0.7),
        "text_lyric_matches": sum(1 for row in rows if row.text_lyric_score >= 0.7),
        "lines": [
            {
                "lyric": row.lyric,
                "gold_sargam": row.gold_sargam,
                "gold_beats": row.gold_beats,
                "layout_sargam": row.layout_sargam,
                "layout_beats": row.layout_beats,
                "layout_match": row.layout_beats == row.gold_beats if row.layout_beats else False,
                "layout_lyric_score": round(row.layout_lyric_score, 3),
                "text_sargam": row.text_sargam,
                "text_beats": row.text_beats,
                "text_match": row.text_beats == row.gold_beats if row.text_beats else False,
                "text_lyric_score": round(row.text_lyric_score, 3),
            }
            for row in rows
        ],
        "layout_review_rows": [
            {
                "page": line.page,
                "lyrics": line.lyrics,
                "roman": line.roman,
                "sargam": line.sargam,
                "review": line.review,
                "review_reasons": line.review_reasons,
            }
            for line in layout_lines
        ],
    }
    return report


def print_summary(report: dict[str, Any]) -> None:
    print()
    print(f"Song {report['song_number']}: {report['title']}")
    print(f"PDF pages: {report['pages']}")
    print(f"Gold lines: {report['gold_line_count']}")
    print(
        "Layout OCR: "
        f"{report['layout_extracted_rows']} rows, "
        f"{report['layout_beat_matches']}/{report['gold_line_count']} beat-exact, "
        f"{report['layout_lyric_matches']}/{report['gold_line_count']} lyric>=0.7"
    )
    print(
        "Text OCR:   "
        f"{report['text_extracted_rows']} rows, "
        f"{report['text_beat_matches']}/{report['gold_line_count']} beat-exact, "
        f"{report['text_lyric_matches']}/{report['gold_line_count']} lyric>=0.7"
    )
    print()
    for line in report["lines"]:
        layout_flag = "OK" if line["layout_match"] else "MISS"
        text_flag = "OK" if line["text_match"] else "MISS"
        print(f"- {line['lyric'][:48]}")
        print(f"    layout {layout_flag}  text {text_flag}")
        if not line["layout_match"] and line["layout_sargam"]:
            print(f"    layout got: {line['layout_sargam']}")
        if not line["text_match"] and line["text_sargam"]:
            print(f"    text got:   {line['text_sargam']}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Pilot RS sargam extraction against gold booklet")
    parser.add_argument("--song", type=int, default=2)
    parser.add_argument(
        "--gold",
        type=Path,
        default=FIXTURES / "song2_gold_sargam.json",
    )
    parser.add_argument("--pdf", type=Path, default=None, help="Local PDF path (downloads if missing)")
    parser.add_argument("--dpi", type=int, default=400)
    parser.add_argument("--debug-dir", type=Path, default=ROOT / "data" / "cache" / "sargam" / "debug")
    parser.add_argument("--out", type=Path, default=ROOT / "data" / "generated" / "pilot_song2_report.json")
    parser.add_argument("--no-debug-images", action="store_true")
    args = parser.parse_args()

    if args.song != 2:
        raise SystemExit("Only song 2 is wired in this pilot. Extend data/fixtures for other songs.")

    gold = json.loads(args.gold.read_text(encoding="utf-8"))
    pdf = args.pdf or CACHE / gold["source_pdf"]
    if not pdf.exists():
        fetch_pdf(gold["source_url"], pdf)

    extract = load_extract_module()
    layout = load_layout_module()
    debug_dir = None if args.no_debug_images else args.debug_dir

    report = compare_song2(extract, layout, pdf, gold, dpi=args.dpi, debug_dir=debug_dir)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print_summary(report)
    print(f"[done] report -> {args.out}")


if __name__ == "__main__":
    main()
