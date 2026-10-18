"""Roman booklet token parsing shared by layout OCR and batch extract."""
from __future__ import annotations

import re
import sys
from pathlib import Path
from typing import Any

SCRIPTS_DIR = Path(__file__).resolve().parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from extract_harmonium_notation import ROMAN_SWARA_MAP  # noqa: E402

ROMAN_TOKEN_RE = re.compile(
    r"(?<![A-Za-z])(?:k[sśṣ]a|dha|ni|na|sa|re|ra|ga|ma|pa)(?:['′`]?)"
    r"|á|(?<![A-Za-z])a['′`]?(?![a-z])"
    r"|[|]{1,2}|[—–\-]+",
    re.IGNORECASE,
)

OCR_ROMAN_FIXES = (
    (re.compile(r"\b0\b"), "a"),
    (re.compile(r"Sa\b(?![a-z])", re.I), "sa"),
    (re.compile(r"([a-z])I(?=[\s|])", re.I), r"\1'"),
    (re.compile(r"['′`]{2,}"), "'"),
)

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


def normalize_roman(raw: str) -> str:
    text = raw.strip()
    for pattern, repl in OCR_ROMAN_FIXES:
        text = pattern.sub(repl, text)
    return re.sub(r"\s+", " ", text).strip()


def play_beats_from_roman(roman: str) -> list[dict[str, Any]]:
    beats: list[dict[str, Any]] = []
    for match in ROMAN_TOKEN_RE.finditer(normalize_roman(roman)):
        token = match.group(0).strip()
        if not token or re.fullmatch(r"[|I/]+", token):
            continue
        if token in {"á", "Á"} or re.fullmatch(r"a['′`]?", token, re.I) or re.fullmatch(
            r"[—–\-]+", token
        ):
            if beats:
                beats[-1]["beats"] += 1
            continue
        core = re.sub(r"['′`]+$", "", token, flags=re.I).lower()
        sargam = ROMAN_SWARA_MAP.get(core)
        if not sargam:
            continue
        if re.search(r"['′`]", token):
            sargam = f"{sargam}'"
        beats.append({"sargam": sargam, "beats": 1})
    return beats


def matra_total(beats: list[dict[str, Any]]) -> int:
    return sum(int(item["beats"]) for item in beats)


def sargam_display_from_beats(beats: list[dict[str, Any]]) -> str:
    parts: list[str] = []
    cycle = 0
    for beat in beats:
        token = str(beat["sargam"])
        core = token.replace(".", "").replace("'", "")
        latin = BOOKLET_LATIN.get(core, core)
        if token.startswith("."):
            latin = f".{latin}"
        elif "'" in token:
            latin = f"{latin}'"
        count = max(1, int(beat["beats"]))
        if cycle > 0 and cycle % 4 == 0:
            parts.append("|")
        parts.append(latin)
        for _ in range(1, count):
            parts.append("á")
        cycle += count
    return " ".join(parts)


def sargam_display_from_roman(roman: str) -> str:
    beats = play_beats_from_roman(roman)
    if not beats:
        return ""
    return sargam_display_from_beats(beats)


def roman_to_booklet_sargam(roman: str) -> tuple[str, list[str]]:
    beats = play_beats_from_roman(roman)
    if not beats:
        return "", ["no_playable_beats"]
    matras = matra_total(beats)
    reasons: list[str] = []
    if matras not in {8, 16}:
        reasons.append(f"unexpected_matras:{matras}")
    return sargam_display_from_beats(beats), reasons
