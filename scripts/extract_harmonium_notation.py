#!/usr/bin/env python3
"""Extract learner practice drafts from Andromeda notation PDFs.

Source PDFs are photographed book pages (scans), not digital typesetting — so we
upscale, contrast-normalize, and multi-pass OCR before scoring sargam rows.
"""
from __future__ import annotations

import argparse
import json
import re
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

# Bengali sargam glyphs + frequent OCR confusions from book photos.
SWARA_MAP = {
    "স": "S",
    "শ": "S",
    "ষ": "S",
    "র": "R",
    "ড়": "R",
    "গ": "G",
    "ম": "m",
    "প": "P",
    "ধ": "D",
    "ঢ": "D",
    "ন": "N",
    "ণ": "N",
    # Latin bleed from noisy OCR on photographed pages
    "S": "S",
    "s": "S",
    "R": "R",
    "r": "R",
    "G": "G",
    "g": "G",
    "m": "m",
    "M": "m",
    "P": "P",
    "p": "P",
    "D": "D",
    "d": "D",
    "N": "N",
    "n": "N",
}

# Photo OCR often turns bar lines into punctuation.
BAR_CHARS = "-–—|/।॥:·.•…_=~"

# Roman booklet scans (Sarkarverse RS_*.pdf): Sa Re Ga under lyrics.
ROMAN_SWARA_RE = re.compile(
    r"(?<![A-Za-z])(k[sśṣ]a|dha|ni|na|sa|re|ra|ga|ma|pa)(?:['’`]*)(?![A-Za-z])",
    re.I,
)
ROMAN_SWARA_MAP = {
    "sa": "S",
    "re": "R",
    "ra": "R",
    "ga": "G",
    "ma": "m",
    "pa": "P",
    "dha": "D",
    "ni": "N",
    "na": "N",
    "ksa": "D",
    "kśa": "D",
    "kṣa": "D",
}

# RS_* booklets: Sa ra ga á | …  (á / a' = hold, I or | = bar).
BOOKLET_TOKEN_RE = re.compile(
    r"(?<![A-Za-z])(?:k[sśṣ]a|dha|ni|na|sa|re|ra|ga|ma|pa)['’`]*(?![A-Za-z])"
    r"|á"
    r"|(?<![A-Za-z])a['’`]?(?![A-Za-z])"
    r"|[—–\-]+"
    r"|[|I/]{1,2}",
    re.I,
)


def ensure_tools() -> None:
    for command in ("pdftoppm", "tesseract"):
        result = subprocess.run(["which", command], capture_output=True, text=True)
        if result.returncode:
            raise SystemExit(f"{command} is required")
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    model = MODEL_DIR / "ben.traineddata"
    if not model.exists():
        urllib.request.urlretrieve(MODEL_URL, model)


def preprocess_book_photo(image_path: Path, output_path: Path) -> Path:
    """Prepare a photographed book page for OCR (grayscale, contrast, mild deskew proxy)."""
    from PIL import Image, ImageEnhance, ImageFilter, ImageOps

    with Image.open(image_path) as raw:
        image = ImageOps.exif_transpose(raw).convert("L")
    # Upscale small phone/scanner captures so swara glyphs are clearer.
    width, height = image.size
    if max(width, height) < 2200:
        scale = 2200 / max(width, height)
        image = image.resize((int(width * scale), int(height * scale)), Image.Resampling.LANCZOS)
    image = ImageOps.autocontrast(image, cutoff=1)
    image = ImageEnhance.Contrast(image).enhance(1.35)
    image = ImageEnhance.Sharpness(image).enhance(1.45)
    # Light denoise without erasing thin bar dashes.
    image = image.filter(ImageFilter.MedianFilter(size=3))
    image = ImageOps.autocontrast(image, cutoff=0.5)
    image.save(output_path, format="PNG")
    return output_path


def ocr_image(image_path: Path, *, psm: str, lang: str = "ben") -> str:
    command = ["tesseract", str(image_path), "stdout", "-l", lang]
    if lang == "ben":
        command.extend(["--tessdata-dir", str(MODEL_DIR)])
    command.extend(["--psm", psm, "-c", "preserve_interword_spaces=1"])
    result = subprocess.run(
        command,
        check=True,
        capture_output=True,
        text=True,
    )
    return result.stdout or ""


def merge_ocr_passes(primary: str, secondary: str) -> str:
    """Keep primary order; append secondary lines that look like extra sargam rows."""
    if not secondary.strip():
        return primary
    primary_lines = { " ".join(line.split()) for line in primary.splitlines() if line.strip() }
    extras = []
    for line in secondary.splitlines():
        cleaned = " ".join(line.split())
        if cleaned and cleaned not in primary_lines and score_notation_line(cleaned) > 0:
            extras.append(cleaned)
    if not extras:
        return primary
    return primary.rstrip() + "\n" + "\n".join(extras)


def parse_roman_swaras(line: str) -> list[str]:
    notes: list[str] = []
    for match in ROMAN_SWARA_RE.finditer(line):
        mapped = ROMAN_SWARA_MAP.get(match.group(1).lower())
        if mapped:
            notes.append(mapped)
    return notes


def parse_roman_booklet_beats(line: str) -> list[dict[str, Any]]:
    """Sa ra ga á | ga dha pa á → sargam + matra length (kaharva holds)."""
    beats: list[dict[str, Any]] = []
    for raw in BOOKLET_TOKEN_RE.findall(line):
        token = raw.strip()
        if not token or re.fullmatch(r"[|I/]+", token):
            continue
        if token in {"á", "Á"} or re.fullmatch(r"a['’`]?", token, re.I) or re.fullmatch(r"[—–\-]+", token):
            if beats:
                beats[-1]["beats"] += 1
            continue
        core = re.sub(r"['’`]+$", "", token).lower()
        sargam = ROMAN_SWARA_MAP.get(core)
        if not sargam:
            continue
        beats.append({"sargam": sargam, "beats": 1})
    return beats


BOOKLET_LATIN = {
    "S": "Sa",
    "r": "re",
    "R": "Re",
    "g": "ga",
    "G": "Ga",
    "m": "ma",
    "M": "Ma",
    "P": "Pa",
    "d": "dha",
    "D": "Dha",
    "n": "ni",
    "N": "Ni",
}
TAL_RE = re.compile(r"^ta['’`]?l\b", re.I)
DATE_RE = re.compile(
    r"deoghar|jamalpur|kolkata|purulia|ananda nagar|\(\s*\d{1,2}\s+\w+",
    re.I,
)
BEAT_MARK_RE = re.compile(r"^[1lIioO0'’`.\s]+$")
SECTION_TITLE_RE = re.compile(r"giit[ai]\s*$", re.I)
FOOTER_RE = re.compile(r"^\[\s*\d+\s*\]$")
SONG_NUM_RE = re.compile(r"^\(\s*\d{1,4}\s*\)$")


def booklet_sargam_line(beats: list[dict[str, Any]], group_size: int = 4) -> str:
    parts: list[str] = []
    cycle = 0
    group = max(1, group_size)
    for beat in beats:
        core = str(beat["sargam"]).replace(".", "").replace("'", "")
        latin = BOOKLET_LATIN.get(core, core)
        if str(beat["sargam"]).startswith("."):
            latin = f".{latin}"
        count = max(1, int(round(float(beat["beats"]))))
        if cycle > 0 and cycle % group == 0:
            parts.append("|")
        parts.append(latin)
        for _ in range(1, count):
            parts.append("á")
        cycle += count
    return " ".join(parts)


def fold_lyric(text: str) -> str:
    stripped = unicodedata.normalize("NFKD", text or "")
    return "".join(character.lower() for character in stripped if character.isalnum())


def is_sargam_row(line: str) -> bool:
    play = parse_roman_booklet_beats(line)
    matras = sum(item["beats"] for item in play)
    return len(play) >= 3 and matras >= 4


def is_section_title(line: str) -> bool:
    words = line.split()
    if not words or len(words) > 4:
        return False
    return bool(SECTION_TITLE_RE.search(line)) and not is_sargam_row(line)


def stanza_and_sargam_rows(ocr_text: str) -> tuple[list[str], list[dict[str, Any]]]:
    """Split a Roman RS song page: lyric stanza above Tal, then sargam rows."""
    raw_lines = [" ".join(line.split()) for line in ocr_text.splitlines()]
    lines = [line for line in raw_lines if line and not FOOTER_RE.match(line)]
    stanza: list[str] = []
    sargam_lines: list[str] = []
    mode = "lyrics"
    for line in lines:
        if SONG_NUM_RE.match(line):
            continue
        if DATE_RE.search(line):
            continue
        if TAL_RE.match(line):
            mode = "sargam"
            continue
        if mode == "lyrics":
            if DATE_RE.search(line) or is_section_title(line) or BEAT_MARK_RE.match(line):
                continue
            if is_sargam_row(line) and stanza:
                mode = "sargam"
                sargam_lines.append(line)
                continue
            stanza.append(line.rstrip(" ."))
        else:
            if BEAT_MARK_RE.match(line) or TAL_RE.match(line) or DATE_RE.search(line):
                continue
            sargam_lines.append(line)

    rows: list[dict[str, Any]] = []
    index = 0
    while index < len(sargam_lines):
        line = sargam_lines[index]
        if not is_sargam_row(line):
            index += 1
            continue
        play = parse_roman_booklet_beats(line)
        syllables = ""
        nxt = sargam_lines[index + 1] if index + 1 < len(sargam_lines) else ""
        if nxt and not is_sargam_row(nxt):
            syllables = nxt
            index += 1
        rows.append(
            {
                "play": play,
                "sargam": booklet_sargam_line(play),
                "syllables": syllables,
            }
        )
        index += 1
    return stanza, rows


def _coverage(needle: str, haystack: str) -> float:
    if not needle or not haystack:
        return 0.0
    if needle in haystack or haystack in needle:
        return 1.0
    from difflib import SequenceMatcher

    return SequenceMatcher(None, needle, haystack).ratio()


def _play_total(play: list[dict[str, Any]]) -> int:
    return sum(max(1, int(round(float(item["beats"])))) for item in play)


def _split_play(play: list[dict[str, Any]], cut: int) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    left: list[dict[str, Any]] = []
    right: list[dict[str, Any]] = []
    remaining = cut
    for item in play:
        beats = max(1, int(round(float(item["beats"]))))
        if remaining <= 0:
            right.append({"sargam": item["sargam"], "beats": beats})
            continue
        if beats <= remaining:
            left.append({"sargam": item["sargam"], "beats": beats})
            remaining -= beats
        else:
            left.append({"sargam": item["sargam"], "beats": remaining})
            right.append({"sargam": item["sargam"], "beats": beats - remaining})
            remaining = 0
    return left, right


def _best_stanza(text: str, stanza: list[str], used: set[int]) -> tuple[int | None, float]:
    haystack = fold_lyric(text)
    best_index = None
    best_score = 0.0
    for index, lyric in enumerate(stanza):
        score = _coverage(fold_lyric(lyric), haystack)
        if index in used:
            score *= 0.7
        if score > best_score:
            best_score = score
            best_index = index
    return best_index, best_score


def pair_stanza_with_sargam(
    stanza: list[str],
    rows: list[dict[str, Any]],
) -> list[tuple[str, dict[str, Any]]]:
    """Match booklet lyrics to sargam. Split a 16-matra row when two phrases share it."""
    if not rows:
        return []
    if len(stanza) == len(rows):
        return [(lyric, row) for lyric, row in zip(stanza, rows)]

    used: set[int] = set()
    paired: list[tuple[str, dict[str, Any]]] = []
    for row in rows:
        syllables = str(row.get("syllables") or "")
        haystack = fold_lyric(syllables) or fold_lyric(row.get("sargam") or "")
        play = list(row["play"])
        matras = _play_total(play)
        parts = syllables.split()
        mid = max(1, len(parts) // 2)
        left_text = " ".join(parts[:mid]) if parts else ""
        right_text = " ".join(parts[mid:]) if parts else ""
        left_i, left_score = _best_stanza(left_text or haystack, stanza, used)
        right_i, right_score = _best_stanza(right_text or haystack, stanza, used)
        split = (
            matras == 16
            and left_i is not None
            and right_i is not None
            and left_i != right_i
            and left_score >= 0.4
            and right_score >= 0.4
        )
        if split:
            left_play, right_play = _split_play(play, 8)
            for index, piece in ((left_i, left_play), (right_i, right_play)):
                used.add(index)
                paired.append(
                    (
                        stanza[index],
                        {
                            "play": piece,
                            "sargam": booklet_sargam_line(piece),
                            "syllables": "",
                        },
                    )
                )
            continue
        best_index, _score = _best_stanza(haystack, stanza, used)
        if best_index is None:
            continue
        used.add(best_index)
        paired.append((stanza[best_index], row))
    return paired


def match_original_lyric(roman_line: str, song: dict[str, Any]) -> str:
    originals = lyric_lines({"lyrics_original": song.get("lyrics_original")})
    trans = lyric_lines({"transliteration": song.get("transliteration")})
    folded = fold_lyric(roman_line)
    best = ""
    best_score = 0.0
    for index, line in enumerate(trans or originals):
        score = _coverage(folded, fold_lyric(line))
        if score > best_score:
            best_score = score
            best = originals[index] if index < len(originals) else ""
    return best if best_score >= 0.35 else ""


def parse_rs_song_page(ocr_text: str, song: dict[str, Any]) -> dict[str, Any] | None:
    """Build learner notation from a Roman RS page: stanza lyrics + held sargam."""
    stanza, rows = stanza_and_sargam_rows(ocr_text)
    paired = pair_stanza_with_sargam(stanza, rows)
    if not paired:
        return None
    lines = []
    for index, (lyric, row) in enumerate(paired):
        play = row["play"]
        beats = _sheet_beats_from_booklet(play)
        measures = [{"beats": beats[start : start + 8]} for start in range(0, len(beats), 8)]
        lines.append(
            {
                "line_number": index + 1,
                "lyrics": lyric,
                "lyrics_original": match_original_lyric(lyric, song),
                "sargam_text": row["sargam"],
                "measures": measures,
            }
        )
    tala_name, tala_beats, tala_groups = detect_tala(ocr_text)
    return {
        "version": 1,
        "source_scale": "C",
        "tempo_bpm": None,
        "tala": {"name": tala_name, "beats": tala_beats, "groups": tala_groups},
        "lines": lines,
    }


def score_notation_line(line: str) -> float:
    """Score whether a noisy OCR line is a sargam row from a book photo."""
    cleaned = " ".join(line.split())
    if len(cleaned) < 3:
        return 0.0
    roman = parse_roman_swaras(cleaned)
    if len(roman) >= 4:
        markers = sum(cleaned.count(char) for char in BAR_CHARS)
        return len(roman) * 1.6 + markers * 2.2
    bengali_letters = sum(1 for character in cleaned if "\u0980" <= character <= "\u09FF")
    if bengali_letters == 0:
        return 0.0
    swaras = sum(character in SWARA_MAP for character in cleaned)
    markers = sum(cleaned.count(char) for char in BAR_CHARS)
    other_bengali = sum(
        1
        for character in cleaned
        if "\u0980" <= character <= "\u09FF"
        and character not in SWARA_MAP
        and unicodedata.category(character)[0] != "M"
    )
    if swaras < 3:
        return 0.0
    density = swaras / max(bengali_letters or len(cleaned), 1)
    # Lyric prose shares some letters (র, ন, ম…) but has many non-swara glyphs.
    if other_bengali >= swaras and markers == 0 and density < 0.5:
        return 0.0
    score = swaras * 1.6 + markers * 2.2 + density * 12 - other_bengali * 0.55
    if markers == 0:
        # Photographed pages often lose dashes; keep only dense swara rows.
        if density < 0.42 or swaras < 5:
            return 0.0
        score *= 0.72
    return score


def notation_lines(ocr_text: str) -> list[tuple[float, str]]:
    lines = [" ".join(line.split()) for line in ocr_text.splitlines()]
    scored = [(score_notation_line(line), line) for line in lines]
    return [(score, line) for score, line in scored if score > 0]


def parse_swaras(line: str) -> list[str]:
    roman = parse_roman_swaras(line)
    if len(roman) >= 4:
        return roman
    normalized = unicodedata.normalize("NFC", line)
    if not any("\u0980" <= character <= "\u09FF" for character in normalized):
        return []
    return [SWARA_MAP[character] for character in normalized if character in SWARA_MAP]


def lyric_lines(song: dict[str, Any]) -> list[str]:
    value = song.get("lyrics_original") or song.get("transliteration") or song.get("first_line")
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
        (("dadra", "da'dra", "daadra"), "Dadra", 6, [3, 3]),
        (("kaharva", "kaharba", "kaharwa"), "Kaharva", 8, [4, 4]),
        (("teental", "tintal", "trital"), "Tintal", 16, [4, 4, 4, 4]),
    )
    haystack = normalized.lower()
    for markers, name, beats, groups in known:
        if any(marker.lower() in haystack for marker in markers):
            return name, beats, groups
    return "Refer to canonical source", 8, [4, 4]


def select_sargam_rows(
    scored_rows: list[tuple[float, list[str]]],
    lyric_count: int,
) -> list[list[str]]:
    """Keep document order, drop near-duplicates, prefer stronger photo-OCR rows."""
    unique: list[tuple[float, list[str]]] = []
    seen: list[tuple[str, ...]] = []
    for score, notes in scored_rows:
        if len(notes) < 3:
            continue
        key = tuple(notes)
        if any(
            len(key) == len(prev)
            and sum(a != b for a, b in zip(key, prev)) <= max(1, len(key) // 8)
            for prev in seen
        ):
            continue
        seen.append(key)
        unique.append((score, notes))

    if lyric_count > 0 and len(unique) > lyric_count:
        # Too many noisy rows from book photos: keep the strongest lyric_count
        # rows, then restore page order so melody still reads top→bottom.
        ranked = sorted(enumerate(unique), key=lambda item: (-item[1][0], item[0]))[:lyric_count]
        ranked.sort(key=lambda item: item[0])
        return [notes for _, (_score, notes) in ranked]
    return [notes for _score, notes in unique]


def _sheet_beats_from_notes(notes: list[str]) -> list[dict[str, Any]]:
    return [
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


def _sheet_beats_from_booklet(play: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        {
            "beat": beat + 1,
            "notes": [
                {
                    "sargam": item["sargam"],
                    "duration": float(item["beats"]),
                    "octave": "middle",
                }
            ],
        }
        for beat, item in enumerate(play)
    ]


def build_notation(song: dict[str, Any], ocr_text: str) -> tuple[dict[str, Any] | None, float]:
    scored_lines = notation_lines(ocr_text)
    lyrics = lyric_lines(song)
    scored_parsed: list[tuple[float, list[str]]] = []
    play_for_notes: dict[tuple[str, ...], list[dict[str, Any]]] = {}
    for score, line in scored_lines:
        play = parse_roman_booklet_beats(line)
        notes = [item["sargam"] for item in play] if play else parse_swaras(line)
        if not notes:
            notes = parse_swaras(line)
            play = [{"sargam": note, "beats": 1} for note in notes]
        if not notes:
            continue
        scored_parsed.append((score, notes))
        play_for_notes[tuple(notes)] = play if play else [{"sargam": note, "beats": 1} for note in notes]
    parsed = select_sargam_rows(scored_parsed, len(lyrics))
    parsed_beats = [
        play_for_notes.get(tuple(notes), [{"sargam": note, "beats": 1} for note in notes])
        for notes in parsed
    ]
    if not parsed:
        return None, 0.0
    lines = []
    for index, notes in enumerate(parsed):
        play = parsed_beats[index] if index < len(parsed_beats) else [{"sargam": n, "beats": 1} for n in notes]
        beats = (
            _sheet_beats_from_booklet(play)
            if any(item["beats"] > 1 for item in play)
            else _sheet_beats_from_notes(notes)
        )
        measures = [{"beats": beats[start : start + 8]} for start in range(0, len(beats), 8)]
        lyric = lyrics[index] if index < len(lyrics) else f"Line {index + 1}"
        lines.append(
            {
                "line_number": index + 1,
                "lyrics": lyric,
                "measures": measures,
            }
        )
    coverage_bonus = 0.0
    if lyrics:
        coverage_bonus = min(len(lines) / max(len(lyrics), 1), 1.0) * 0.08
    confidence = min(
        0.88,
        0.44 + min(len(lines), 20) * 0.025 + min(sum(map(len, parsed)), 120) * 0.0012 + coverage_bonus,
    )
    tala_name, tala_beats, tala_groups = detect_tala(ocr_text)
    return {
        "version": 1,
        "source_scale": "C",
        "tempo_bpm": None,
        "tala": {"name": tala_name, "beats": tala_beats, "groups": tala_groups},
        "lines": lines,
    }, round(confidence, 3)


def ocr_pdf_pages(
    pdf_path: Path,
    work: Path,
    *,
    lang: str = "ben",
    dpi: int = 300,
    multipass: bool = True,
) -> str:
    """Rasterize photographed book pages at high DPI, preprocess, multi-pass OCR."""
    prefix = work / "page"
    subprocess.run(
        [
            "pdftoppm",
            "-png",
            "-r",
            str(dpi),
            str(pdf_path),
            str(prefix),
        ],
        check=True,
        capture_output=True,
    )
    images = sorted(work.glob("page*.png"))
    if not images:
        raise RuntimeError("pdftoppm produced no page images")
    chunks: list[str] = []
    for image in images:
        prepared = work / f"{image.stem}-prep.png"
        preprocess_book_photo(image, prepared)
        # psm 6 = block of text (typical notation page); psm 4 = single column.
        primary = ocr_image(prepared, psm="6", lang=lang)
        if multipass:
            secondary = ocr_image(prepared, psm="4", lang=lang)
            chunks.append(merge_ocr_passes(primary, secondary))
        else:
            chunks.append(primary)
    return "\n".join(chunks)


def source_urls_for(row: dict[str, Any]) -> list[str]:
    meta = row.get("metadata_json") or {}
    urls = meta.get("source_urls") if isinstance(meta, dict) else None
    if isinstance(urls, list) and urls:
        return [str(url) for url in urls if str(url).strip()]
    primary = str(row.get("source_url") or "").strip()
    return [primary] if primary else []


def draft_quality(row: dict[str, Any]) -> tuple[int, int, float]:
    """Prefer more lines and notes for learners; confidence is a tie-breaker."""
    try:
        payload = row.get("notation_text")
        notation = json.loads(payload) if isinstance(payload, str) else (payload or {})
        lines = notation.get("lines") or []
        notes = 0
        for line in lines:
            for measure in line.get("measures") or []:
                for beat in measure.get("beats") or []:
                    notes += len(beat.get("notes") or [])
        confidence = float((row.get("metadata_json") or {}).get("confidence") or 0)
        return (len(lines), notes, confidence)
    except Exception:
        return (0, 0, 0.0)


def extract(row: dict[str, Any], song: dict[str, Any]) -> dict[str, Any] | None:
    urls = source_urls_for(row)
    if not urls:
        return None
    with tempfile.TemporaryDirectory(prefix=f"ps-{row['song_number']}-") as directory:
        work = Path(directory)
        chunks: list[str] = []
        page_count = 0
        for index, url in enumerate(urls):
            pdf = work / f"source-{index + 1}.pdf"
            with urllib.request.urlopen(str(url), timeout=45) as response:
                with pdf.open("wb") as target:
                    shutil.copyfileobj(response, target)
            part_work = work / f"part-{index + 1}"
            part_work.mkdir(parents=True, exist_ok=True)
            text = ocr_pdf_pages(pdf, part_work)
            page_count += len(
                [path for path in part_work.glob("page*.png") if "-prep" not in path.name]
            )
            chunks.append(text)
        ocr_text = "\n".join(chunks)
    notation, confidence = build_notation(song, ocr_text)
    if not notation or confidence < 0.5:
        return None
    lyric_count = len(lyric_lines(song))
    return {
        "song_number": row["song_number"],
        "source_url": urls[0],
        "notation_text": json.dumps(notation, ensure_ascii=False, separators=(",", ":")),
        "scale": "C",
        "verification_status": "practice_draft",
        "metadata_json": {
            "extraction_method": "tesseract_bengali_book_photo_multipass",
            "confidence": confidence,
            "requires_human_review": True,
            "learner_notice": (
                "Practice draft OCR'd from photographed Andromeda book pages, shown as Hindi Sargam. "
                "Compare with the canonical PDF for the complete melody."
            ),
            "line_count": len(notation["lines"]),
            "lyric_line_count": lyric_count,
            "coverage_incomplete": bool(lyric_count and len(notation["lines"]) < lyric_count),
            "source_urls": urls,
            "pdf_page_count": page_count,
            "archive_url": "https://prabhatasamgiita.net/notations/andromeda.php",
            "display_script": "hi",
            "source_kind": "book_photo_scan",
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--song", type=int)
    parser.add_argument("--limit", type=int)
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--output", type=Path, default=OUTPUT)
    parser.add_argument("--fresh", action="store_true")
    parser.add_argument(
        "--missing-only",
        action="store_true",
        help="Only extract songs that have an Andromeda PDF but no practice draft yet.",
    )
    args = parser.parse_args()
    ensure_tools()
    sources = json.loads(NOTATION_SOURCES.read_text(encoding="utf-8"))
    songs = {row["number"]: row for row in json.loads(SONGS.read_text(encoding="utf-8"))}
    if args.song:
        sources = [row for row in sources if row["song_number"] == args.song]
    if args.limit:
        sources = sources[: args.limit]
    output: list[dict[str, Any]] = []
    if args.output.exists() and (not args.fresh or args.song):
        # Never wipe the catalog when refreshing a single song.
        output = json.loads(args.output.read_text(encoding="utf-8"))
        completed_numbers = {row["song_number"] for row in output}
        if args.song and args.fresh:
            output = [row for row in output if int(row["song_number"]) != int(args.song)]
            completed_numbers = {row["song_number"] for row in output}
        if args.missing_only or not args.song:
            sources = [row for row in sources if row["song_number"] not in completed_numbers]
        print(f"resuming with {len(output)} existing drafts; queued {len(sources)}")
    elif args.fresh and not args.song:
        print("fresh full rebuild — existing practice drafts will be replaced as songs complete")

    def checkpoint() -> None:
        best_by_song: dict[int, dict[str, Any]] = {}
        for row in output:
            number = int(row["song_number"])
            current = best_by_song.get(number)
            if current is None or draft_quality(row) > draft_quality(current):
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
