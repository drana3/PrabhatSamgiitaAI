#!/usr/bin/env python3
"""Index Sarkarverse SARGAM PDFs and extract per-song digital sargam into practice drafts.

Best-effort pipeline (do not invent notes):

1. Divyadyuti ``NNNNsl.pdf`` — computer-set Bengali swaralipi with a text layer.
   Parse with pdftotext and the existing learner notation schema. Hindi display
   stays in the app (সা → सा).

2. Roman booklets ``RS_*.pdf`` — HP scans with Sa/Re/Ga under lyrics. English OCR
   splits pages on ``( song )`` headers and writes practice drafts.

3. Other ≤25-song Svaralipi scans — Bengali OCR, same draft schema.

4. Thousand-page dumps (0001-1000.pdf, FromPSnet) — indexed only; they duplicate
   the booklets.

Output:
  data/generated/sarkarverse_sargam_index.json
  data/generated/notation_practice.json  (merged; Roman RS_* preferred)
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import tempfile
import urllib.parse
import urllib.request
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
extract_spec = spec_from_file_location(
    "extract_harmonium_notation",
    Path(__file__).resolve().parent / "extract_harmonium_notation.py",
)
assert extract_spec and extract_spec.loader
extract = module_from_spec(extract_spec)
extract_spec.loader.exec_module(extract)
PRACTICE_OUTPUT = extract.OUTPUT
SONGS = extract.SONGS
build_notation = extract.build_notation
draft_quality = extract.draft_quality
INDEX_PATH = ROOT / "data" / "generated" / "sarkarverse_sargam_index.json"
PLAN_PATH = ROOT / "data" / "generated" / "sarkarverse_sargam_plan.json"
STAMP_PATH = ROOT / "data" / "generated" / "sarkarverse_sargam.stamp"
BOOKLET_SONGS_PATH = ROOT / "data" / "generated" / "roman_booklet_songs.json"
SARGAM_BASE = "https://sarkarverse.org/SARGAM/"
ANDROMEDA_ARCHIVE = "https://prabhatasamgiita.net/notations/andromeda.php"


def learner_notation_url(*candidates: str | None) -> str:
    for raw in candidates:
        url = str(raw or "").strip()
        if not url:
            continue
        lowered = url.lower()
        if "sarkarverse.org" in lowered:
            continue
        if "prabhatasamgiita.net" in lowered:
            return url
    return ANDROMEDA_ARCHIVE


FOLDERS = (
    "0001-1000",
    "1001-2000",
    "2001-3000",
    "3001-4000",
    "4001-5018",
    "Divyadyuti",
    "FromPSnet",
    "Other",
)

USER_AGENT = "PrabhatSamgiitaAI/1.0 (notation-index; +https://sarkarverse.org/SARGAM/)"
PDF_HREF = re.compile(r'href="([^"]+\.pdf)"', re.I)
DIVYADYUTI_FILE = re.compile(r"(?:^|/)(\d{3,4})sl\.pdf$", re.I)
RANGE_FILE = re.compile(
    r"(?<!\d)(\d{3,4})\s*(?:[-–]|_(?:to|tp)_|\s+(?:to|tp)\s+)\s*(\d{3,4})(?!\d)",
    re.I,
)
SPAN_FIXES = {
    "prabhatsangeet_3826-38250.pdf": (3826, 3850),
}
FAMILY_SCORE = {
    "rs_roman": 100,
    "divyadyuti": 80,
    "svaralipi": 70,
    "prabhat_sangeet": 60,
    "songs_booklet": 50,
    "single_song": 40,
}
DIGITAL_SWARA = re.compile(r"সা|রে|রা|গা|মা|পা|ধা|নি")
# Round-paren song numbers only. ``{ 26 }`` / ``[ 34 ]`` are page footers.
SONG_HEADER = re.compile(r"\(\s*(\d{1,3})\s*[.)]*\)")
SOURCE_KIND_RANK = {
    "sarkarverse_roman_ocr": 3,
    "sarkarverse_divyadyuti": 2,
    "sarkarverse_scan_ocr": 1,
    "book_photo_scan": 1,
}


def fetch(url: str, timeout: int = 60) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.read()


def list_folder(folder: str) -> list[str]:
    html = fetch(f"{SARGAM_BASE}?dir={urllib.parse.quote(folder)}").decode("utf-8", "replace")
    hrefs: list[str] = []
    seen: set[str] = set()
    for raw in PDF_HREF.findall(html):
        href = urllib.parse.unquote(raw.split("?")[0])
        if href.startswith("resources/") or href in seen:
            continue
        seen.add(href)
        hrefs.append(href)
    return hrefs


def absolute_pdf_url(href: str) -> str:
    return urllib.parse.urljoin(SARGAM_BASE, href.replace(" ", "%20"))


def ascii_name(name: str) -> str:
    folded = name.replace("%20", " ")
    return re.sub(r"[^a-z0-9._-]+", "_", folded.lower())


def parse_span(name: str) -> tuple[int, int] | None:
    key = ascii_name(name)
    if key in SPAN_FIXES:
        return SPAN_FIXES[key]
    match = RANGE_FILE.search(name.replace("%20", " "))
    if not match:
        return None
    start, end = int(match.group(1)), int(match.group(2))
    if start > end:
        start, end = end, start
    return start, end


def script_and_family(folder: str, name: str, kind: str) -> tuple[str, str]:
    folded = ascii_name(name)
    if kind == "divyadyuti":
        return "bengali", "divyadyuti"
    if folded.startswith("rs_"):
        return "roman", "rs_roman"
    if "svaralipi" in folded:
        return "bengali", "svaralipi"
    if folded.startswith("prabhatsangeet"):
        return "bengali", "prabhat_sangeet"
    if folded.startswith("songs"):
        return "bengali", "songs_booklet"
    if kind in {"range_dump", "psnet_dump"}:
        return "unknown", kind
    if re.fullmatch(r"\d{3,4}\.pdf", name, re.I):
        return "unknown", "single_song"
    return "unknown", "other"


def classify(folder: str, href: str) -> dict[str, Any]:
    name = href.rsplit("/", 1)[-1]
    url = absolute_pdf_url(href)
    dyuti = DIVYADYUTI_FILE.search(href)
    start = end = None
    if folder == "Divyadyuti" and dyuti:
        number = int(dyuti.group(1))
        start = end = number
        kind = "divyadyuti"
    else:
        span = parse_span(name)
        if span:
            start, end = span
        whole_thousand = re.fullmatch(r"(\d{4})-(\d{4})\.pdf", name, re.I)
        kind = "booklet_scan"
        if folder == "FromPSnet":
            kind = "psnet_dump"
        elif whole_thousand and int(whole_thousand.group(2)) - int(whole_thousand.group(1)) >= 999:
            kind = "range_dump"
        elif re.fullmatch(r"\d{3,4}\.pdf", name, re.I):
            number = int(name.rsplit(".", 1)[0])
            start = end = number

    script, family = script_and_family(folder, name, kind)
    parse = "index_only"
    extract_role = "skip_not_roman"
    if kind in {"range_dump", "psnet_dump"}:
        extract_role = "skip_duplicate"
    elif start and end and end - start > 50:
        extract_role = "skip_duplicate"
    if family == "rs_roman" and start and end and end - start <= 75:
        parse = "roman_ocr"
        extract_role = "extract"
    elif kind == "divyadyuti":
        parse = "digital_text"
    elif kind == "booklet_scan" and start and end and 0 <= end - start <= 50:
        parse = "scan_ocr"

    return {
        "kind": kind,
        "family": family,
        "script": script,
        "parse": parse,
        "extract_role": extract_role,
        "song_number": int(start) if start and start == end else None,
        "song_start": start,
        "song_end": end,
        "folder": folder,
        "filename": name,
        "source_url": url,
    }


def enrich_files(files: list[dict[str, Any]]) -> list[dict[str, Any]]:
    enriched: list[dict[str, Any]] = []
    for row in files:
        if row.get("script") and row.get("extract_role") and row.get("family"):
            enriched.append(row)
            continue
        folder = str(row.get("folder") or "")
        name = str(row.get("filename") or "")
        classified = classify(folder, f"{folder}/{name}" if folder else name)
        if row.get("source_url"):
            classified["source_url"] = row["source_url"]
        enriched.append(classified)
    return enriched


def build_index() -> dict[str, Any]:
    files: list[dict[str, Any]] = []
    for folder in FOLDERS:
        try:
            hrefs = list_folder(folder)
        except Exception as exc:
            print(f"folder {folder}: {exc}")
            continue
        for href in hrefs:
            files.append(classify(folder, href))
        print(f"{folder}: {len(hrefs)} pdfs")
    files.sort(key=lambda row: (row["folder"], row.get("song_number") or 0, row["filename"]))
    digital = [row for row in files if row["kind"] == "divyadyuti"]
    by_script: dict[str, int] = {}
    by_role: dict[str, int] = {}
    for row in files:
        by_script[str(row.get("script"))] = by_script.get(str(row.get("script")), 0) + 1
        by_role[str(row.get("extract_role"))] = by_role.get(str(row.get("extract_role")), 0) + 1
    payload = {
        "version": 2,
        "archive_url": SARGAM_BASE,
        "note": (
            "One extractable source per song. Roman RS_* booklets win first. "
            "Then Divyadyuti digital Bengali, then Svaralipi/PrabhatSangeet scans. "
            "Thousand-page dumps are duplicates and are not extracted."
        ),
        "divyadyuti_count": len(digital),
        "file_count": len(files),
        "script_counts": by_script,
        "extract_role_counts": by_role,
        "files": files,
    }
    INDEX_PATH.parent.mkdir(parents=True, exist_ok=True)
    INDEX_PATH.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"wrote {INDEX_PATH} ({len(files)} files, {len(digital)} Divyadyuti)")
    write_plan(payload)
    return payload


def build_plan(index: dict[str, Any]) -> dict[str, Any]:
    """Pick one primary PDF per song so dumps never create duplicate DB rows."""
    files = enrich_files(list(index.get("files") or []))
    candidates: dict[int, list[tuple[int, int, dict[str, Any]]]] = {}
    skipped = [row for row in files if row.get("extract_role") != "extract"]
    extract_files = [row for row in files if row.get("extract_role") == "extract"]
    for row in extract_files:
        span = booklet_span(row)
        if not span:
            continue
        start, end = span
        score = FAMILY_SCORE.get(str(row.get("family")), 0)
        tightness = -(end - start)
        for number in range(start, end + 1):
            if number < 1 or number > 5018:
                continue
            candidates.setdefault(number, []).append((score, tightness, row))

    songs: dict[str, dict[str, Any]] = {}
    for number, options in candidates.items():
        options.sort(key=lambda item: (item[0], item[1]), reverse=True)
        primary = options[0][2]
        songs[str(number)] = {
            "script": primary.get("script"),
            "family": primary.get("family"),
            "parse": primary.get("parse"),
            "primary_file": primary.get("filename"),
            "primary_url": primary.get("source_url"),
            "duplicates": [
                {"file": row.get("filename"), "family": row.get("family")}
                for _score, _tight, row in options[1:]
            ],
        }

    roman_songs = sum(1 for row in songs.values() if row.get("script") == "roman")
    bengali_songs = sum(1 for row in songs.values() if row.get("script") == "bengali")
    return {
        "version": 1,
        "archive_url": SARGAM_BASE,
        "rule": (
            "Exactly one primary source per song_number. "
            "Priority: RS_ Roman booklets > Divyadyuti digital Bengali > "
            "Svaralipi Bengali scans > PrabhatSangeet scans > single-song PDFs. "
            "Range dumps and FromPSnet are never extracted."
        ),
        "summary": {
            "files": len(files),
            "extract_files": len(extract_files),
            "skipped_duplicate_files": len(skipped),
            "songs_with_source": len(songs),
            "roman_songs": roman_songs,
            "bengali_songs": bengali_songs,
            "script_files": {
                script: sum(1 for row in files if row.get("script") == script)
                for script in ("roman", "bengali", "unknown")
            },
        },
        "skipped_files": [
            {"filename": row["filename"], "family": row.get("family"), "reason": row.get("extract_role")}
            for row in skipped
        ],
        "songs": songs,
    }


def write_plan(index: dict[str, Any]) -> dict[str, Any]:
    plan = build_plan(index)
    PLAN_PATH.parent.mkdir(parents=True, exist_ok=True)
    PLAN_PATH.write_text(json.dumps(plan, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    summary = plan["summary"]
    print(
        f"wrote {PLAN_PATH} songs={summary['songs_with_source']} "
        f"roman={summary['roman_songs']} bengali={summary['bengali_songs']}"
    )
    return plan


def is_digital_sargam_row(line: str) -> bool:
    compact = " ".join(line.split())
    if not compact:
        return False
    if "সা" not in compact and "পা" not in compact and "ধা" not in compact:
        return False
    return len(DIGITAL_SWARA.findall(compact)) >= 4


def pdf_to_text(pdf_path: Path) -> str:
    result = subprocess.run(
        ["pdftotext", "-enc", "UTF-8", "-layout", str(pdf_path), "-"],
        check=True,
        capture_output=True,
        text=True,
    )
    return result.stdout or ""


def filter_digital_sargam_text(raw: str) -> str:
    kept = [line for line in raw.splitlines() if is_digital_sargam_row(line)]
    return "\n".join(kept)


def booklet_span(row: dict[str, Any]) -> tuple[int, int] | None:
    filename = str(row.get("filename") or "")
    start, end = row.get("song_start"), row.get("song_end")
    if isinstance(start, int) and isinstance(end, int) and start > 0 and end >= start:
        return start, end
    match = re.fullmatch(r"(\d{3,4})\.pdf", filename, re.I)
    if match:
        number = int(match.group(1))
        return number, number
    return None


def is_roman_ocr_row(row: dict[str, Any]) -> bool:
    if row.get("kind") in {"range_dump", "psnet_dump", "divyadyuti"}:
        return False
    if row.get("family") == "rs_roman" or str(row.get("filename") or "").upper().startswith("RS_"):
        return booklet_span(row) is not None
    return row.get("parse") == "roman_ocr"


def is_scan_ocr_row(row: dict[str, Any]) -> bool:
    if row.get("kind") in {"range_dump", "psnet_dump", "divyadyuti"}:
        return False
    if is_roman_ocr_row(row):
        return False
    span = booklet_span(row)
    if not span:
        return False
    start, end = span
    return end - start <= 50


def ocrable_booklets(index: dict[str, Any]) -> list[dict[str, Any]]:
    return [
        row
        for row in enrich_files(list(index.get("files") or []))
        if is_roman_ocr_row(row) and row.get("extract_role") == "extract"
    ]


def split_booklet_by_song(ocr_text: str, start: int, end: int) -> dict[int, str]:
    """Split OCR on ``( 27 )`` song headers; ignore ``[ 3 ]`` page footers."""
    chunks: dict[int, list[str]] = {}
    current: int | None = None
    for line in ocr_text.splitlines():
        stripped = line.strip()
        header = SONG_HEADER.search(stripped)
        if header and header.start() <= 12:
            number = int(header.group(1))
            if start <= number <= end:
                current = number
                chunks.setdefault(current, [])
                continue
        if current is not None:
            chunks[current].append(line)
    return {
        number: "\n".join(lines)
        for number, lines in chunks.items()
        if any(part.strip() for part in lines)
    }


def draft_from_ocr(
    song: dict[str, Any],
    ocr_text: str,
    parse_url: str,
    learner_url: str,
    *,
    source_kind: str,
    method: str,
) -> dict[str, Any] | None:
    notation = extract.parse_rs_song_page(ocr_text, song)
    confidence = 0.0
    if notation and notation.get("lines"):
        confidence = min(0.88, 0.5 + min(len(notation["lines"]), 16) * 0.03)
    else:
        notation, confidence = build_notation(song, ocr_text)
    if not notation or not notation.get("lines"):
        return None
    number = int(song.get("number") or 0)
    public_url = learner_notation_url(learner_url)
    lyric_count = len(extract.lyric_lines(song))
    return {
        "song_number": number,
        "source_url": public_url,
        "notation_text": json.dumps(notation, ensure_ascii=False, separators=(",", ":")),
        "scale": "C",
        "verification_status": "practice_draft",
        "metadata_json": {
            "extraction_method": method,
            "confidence": confidence,
            "requires_human_review": True,
            "learner_notice": "Full details are available in the PDF.",
            "line_count": len(notation["lines"]),
            "lyric_line_count": lyric_count,
            "coverage_incomplete": bool(lyric_count and len(notation["lines"]) < lyric_count),
            "source_urls": [public_url],
            "parse_url": parse_url,
            "archive_url": ANDROMEDA_ARCHIVE,
            "display_script": "hi",
            "source_kind": source_kind,
        },
    }


def extract_divyadyuti_pdf(
    pdf_path: Path,
    song: dict[str, Any],
    parse_url: str,
    learner_url: str,
) -> dict[str, Any] | None:
    raw = pdf_to_text(pdf_path)
    filtered = filter_digital_sargam_text(raw)
    if not filtered.strip():
        return None
    notation, confidence = build_notation(song, filtered)
    if not notation or not notation.get("lines"):
        return None
    number = int(song.get("number") or 0)
    public_url = learner_notation_url(learner_url)
    return {
        "song_number": number,
        "source_url": public_url,
        "notation_text": json.dumps(notation, ensure_ascii=False, separators=(",", ":")),
        "scale": "C",
        "verification_status": "practice_draft",
        "metadata_json": {
            "extraction_method": "sarkarverse_divyadyuti_pdftotext",
            "confidence": confidence,
            "requires_human_review": True,
            "learner_notice": "Full details are available in the PDF.",
            "line_count": len(notation["lines"]),
            "source_urls": [public_url],
            "parse_url": parse_url,
            "archive_url": ANDROMEDA_ARCHIVE,
            "display_script": "hi",
            "source_kind": "sarkarverse_divyadyuti",
        },
    }


def roman_practice_only(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    kept: list[dict[str, Any]] = []
    for row in rows:
        meta = row.get("metadata_json") if isinstance(row.get("metadata_json"), dict) else {}
        kind = str(meta.get("source_kind") or "")
        method = str(meta.get("extraction_method") or "").lower()
        if kind == "sarkarverse_roman_ocr" or "roman" in method:
            kept.append(row)
    return kept


def merge_practice(
    existing: list[dict[str, Any]],
    incoming: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    best: dict[int, dict[str, Any]] = {}
    for row in [*roman_practice_only(existing), *incoming]:
        number = int(row["song_number"])
        current = best.get(number)
        if current is None:
            best[number] = row
            continue
        new_rank = SOURCE_KIND_RANK.get((row.get("metadata_json") or {}).get("source_kind"), 0)
        old_rank = SOURCE_KIND_RANK.get((current.get("metadata_json") or {}).get("source_kind"), 0)
        if new_rank > old_rank:
            best[number] = row
        elif new_rank == old_rank and draft_quality(row) > draft_quality(current):
            best[number] = row
    return sorted(best.values(), key=lambda row: int(row["song_number"]))


def write_roman_booklet_songs(_rows: list[dict[str, Any]] | None = None) -> None:
    """OCR booklet JSON is not published. Playable copies live in packages/core (songs 1, 2, 4, 27)."""
    payload = {
        "source": "https://sarkarverse.org/SARGAM/?dir=0001-1000",
        "files": [
            "RS_0001-0025.pdf",
            "RS_0026-0050.pdf",
            "RS_0051-0075.pdf",
            "RS_0076-0100.pdf",
            "RS_0101-0125.pdf",
            "RS_0126-0150.pdf",
            "RS_0151-0175.pdf",
        ],
        "count": 0,
        "songs": {},
        "published_booklet_songs": [1, 2, 4, 27],
        "note": "Playable Roman booklet sargam is hardcoded in packages/core/src/harmonium-sample-songs.ts",
    }
    BOOKLET_SONGS_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {BOOKLET_SONGS_PATH} (0 OCR songs; published copies are 1, 2, 4, 27)")


def extract_divyadyuti(index: dict[str, Any], *, song: int | None, limit: int | None) -> int:
    songs = {int(row["number"]): row for row in json.loads(SONGS.read_text(encoding="utf-8"))}
    andromeda = {
        int(row["song_number"]): str(row.get("source_url") or "")
        for row in json.loads(extract.NOTATION_SOURCES.read_text(encoding="utf-8"))
    }
    targets = [row for row in index.get("files", []) if row.get("kind") == "divyadyuti"]
    if song:
        targets = [row for row in targets if int(row["song_number"]) == song]
    if limit:
        targets = targets[:limit]
    existing: list[dict[str, Any]] = []
    if PRACTICE_OUTPUT.exists():
        existing = json.loads(PRACTICE_OUTPUT.read_text(encoding="utf-8"))
    extracted: list[dict[str, Any]] = []
    for item in targets:
        number = int(item["song_number"])
        url = str(item["source_url"])
        try:
            with tempfile.TemporaryDirectory(prefix=f"sv-{number}-") as directory:
                pdf = Path(directory) / f"{number}sl.pdf"
                pdf.write_bytes(fetch(url, timeout=90))
                draft = extract_divyadyuti_pdf(
                    pdf,
                    songs.get(number, {"number": number}),
                    url,
                    andromeda.get(number, ""),
                )
        except Exception as exc:
            print(f"song {number}: {exc}")
            continue
        if draft:
            extracted.append(draft)
            print(f"song {number}: {draft['metadata_json']['line_count']} lines")
        else:
            print(f"song {number}: no digital sargam rows")
    merged = merge_practice(existing, extracted)
    PRACTICE_OUTPUT.write_text(
        json.dumps(merged, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"extracted {len(extracted)}; practice catalog now {len(merged)}")
    return len(extracted)


def extract_booklets(
    index: dict[str, Any],
    *,
    processed: set[str],
    song: int | None,
    limit: int | None,
) -> tuple[int, set[str]]:
    songs = {int(row["number"]): row for row in json.loads(SONGS.read_text(encoding="utf-8"))}
    andromeda = {
        int(row["song_number"]): str(row.get("source_url") or "")
        for row in json.loads(extract.NOTATION_SOURCES.read_text(encoding="utf-8"))
    }
    targets = ocrable_booklets(index)
    if song:
        targets = [
            row
            for row in targets
            if (span := booklet_span(row)) and span[0] <= song <= span[1]
        ]
    else:
        targets = [row for row in targets if str(row["source_url"]) not in processed]
    if limit:
        targets = targets[:limit]
    if targets:
        for command in ("pdftoppm", "tesseract"):
            if subprocess.run(["which", command], capture_output=True).returncode:
                raise SystemExit(f"{command} is required for booklet OCR")
        if any(is_scan_ocr_row(row) for row in targets):
            extract.ensure_tools()
    extracted = 0
    done = set(processed)
    for item in targets:
        url = str(item["source_url"])
        span = booklet_span(item)
        if not span:
            done.add(url)
            continue
        start, end = span
        roman = is_roman_ocr_row(item)
        if not roman:
            print(f"skip {item['filename']} (Bengali PDF, not extracted)")
            done.add(url)
            continue
        lang = "eng" if roman else "ben"
        source_kind = "sarkarverse_roman_ocr" if roman else "sarkarverse_scan_ocr"
        method = "sarkarverse_roman_tesseract" if roman else "sarkarverse_scan_tesseract"
        print(f"ocr {item['filename']} ({lang}) songs {start}-{end}")
        try:
            with tempfile.TemporaryDirectory(prefix="sv-book-") as directory:
                work = Path(directory)
                pdf = work / item["filename"]
                pdf.write_bytes(fetch(url, timeout=120))
                pages = work / "pages"
                pages.mkdir()
                ocr_text = extract.ocr_pdf_pages(
                    pdf,
                    pages,
                    lang=lang,
                    dpi=200,
                    multipass=False,
                )
        except Exception as exc:
            print(f"{item['filename']}: {exc}")
            done.add(url)
            continue
        chunks = split_booklet_by_song(ocr_text, start, end)
        if start == end and start not in chunks and ocr_text.strip():
            chunks = {start: ocr_text}
        drafts: list[dict[str, Any]] = []
        for number, text in sorted(chunks.items()):
            if song and number != song:
                continue
            draft = draft_from_ocr(
                songs.get(number, {"number": number}),
                text,
                url,
                andromeda.get(number, ""),
                source_kind=source_kind,
                method=method,
            )
            if draft:
                drafts.append(draft)
                print(f"song {number}: {draft['metadata_json']['line_count']} OCR lines")
            else:
                print(f"song {number}: no sargam rows in OCR")
        extracted += len(drafts)
        done.add(url)
        print(f"{item['filename']}: {len(drafts)} OCR drafts (not published)")
    PRACTICE_OUTPUT.write_text("[]\n", encoding="utf-8")
    write_roman_booklet_songs([])
    return extracted, done


def source_fingerprint(index: dict[str, Any]) -> str:
    """Hash ingest script + extractable PDF list. Stamp this after a successful extract."""
    digital = []
    booklets = [str(row["source_url"]) for row in ocrable_booklets(index)]
    payload = {
        "script": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "divyadyuti": digital,
        "booklets": sorted(booklets),
    }
    return hashlib.sha256(
        json.dumps(payload, separators=(",", ":")).encode("utf-8")
    ).hexdigest()


def load_stamp(path: Path = STAMP_PATH) -> dict[str, Any] | None:
    if not path.exists():
        return None
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None
    return payload if isinstance(payload, dict) else None


def extract_is_required(index: dict[str, Any], stamp: dict[str, Any] | None) -> bool:
    """First successful run writes a stamp; later commits skip unless sources change."""
    if not stamp:
        return True
    if stamp.get("fingerprint") != source_fingerprint(index):
        return True
    processed = set(stamp.get("processed_booklets") or [])
    return any(str(row["source_url"]) not in processed for row in ocrable_booklets(index))


def write_stamp(
    index: dict[str, Any],
    extracted_count: int,
    processed_booklets: list[str],
    path: Path = STAMP_PATH,
) -> None:
    payload = {
        "fingerprint": source_fingerprint(index),
        "extracted_count": extracted_count,
        "divyadyuti_count": int(index.get("divyadyuti_count") or 0),
        "processed_booklets": sorted(processed_booklets),
        "booklet_total": len(ocrable_booklets(index)),
    }
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--index-only", action="store_true")
    parser.add_argument(
        "--plan",
        action="store_true",
        help="Rebuild Roman/Bengali file taxonomy and the one-primary-per-song plan from the existing index (no download).",
    )
    parser.add_argument("--extract", action="store_true")
    parser.add_argument(
        "--check",
        action="store_true",
        help="Exit 0 and print required=true|false (CI skip when stamp matches).",
    )
    parser.add_argument("--song", type=int)
    parser.add_argument("--limit", type=int)
    parser.add_argument(
        "--booklet-limit",
        type=int,
        default=4,
        help="OCR at most this many scan PDFs per run (CI time box).",
    )
    args = parser.parse_args()
    index = json.loads(INDEX_PATH.read_text(encoding="utf-8")) if INDEX_PATH.exists() else None
    if index is not None:
        index["files"] = enrich_files(index.get("files") or [])
    if args.check:
        if index is None:
            print("required=true")
            print("reason=missing_index")
            return
        required = extract_is_required(index, load_stamp())
        print(f"required={'true' if required else 'false'}")
        print(f"reason={'missing_or_stale_stamp' if required else 'stamp_matches'}")
        return
    if args.index_only or index is None:
        index = build_index()
    elif args.plan:
        write_plan(index)
        INDEX_PATH.write_text(json.dumps(index, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"updated {INDEX_PATH}")
        if not args.extract:
            return
    if args.extract:
        if subprocess.run(["which", "pdftotext"], capture_output=True).returncode:
            raise SystemExit("pdftotext is required (poppler)")
        stamp = load_stamp()
        fingerprint = source_fingerprint(index)
        processed = set(stamp.get("processed_booklets") or []) if stamp and stamp.get("fingerprint") == fingerprint else set()
        booklet_count, processed = extract_booklets(
            index,
            processed=processed,
            song=args.song,
            limit=None if args.song else args.booklet_limit,
        )
        if args.song is None:
            write_stamp(index, booklet_count, sorted(processed))
            print(f"wrote {STAMP_PATH} ({len(processed)}/{len(ocrable_booklets(index))} booklets)")
            if booklet_count < 1 and not processed:
                raise SystemExit("extract produced no drafts")
    elif not args.index_only:
        parser.print_help()
        raise SystemExit("Pass --check, --index-only, and/or --extract")


if __name__ == "__main__":
    main()
