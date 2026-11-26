"""One-shot Hindi vs Urdu primary assignment for Hindustani-indexed songs.

Combines official index exclusivity, lyric-page category, Roman lyric cues,
and optional human transliteration review — not category-string order alone.
"""

from __future__ import annotations

import json
import re
import unicodedata
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Literal

PrimaryLanguage = Literal["hindi", "urdu"]
Confidence = Literal["high", "medium", "low"]

ROOT = Path(__file__).resolve().parents[4]
SONGS_PATH = ROOT / "data" / "generated" / "songs.json"
ASSIGNMENTS_PATH = ROOT / "data" / "generated" / "theme_assignments.json"
HITL_PATH = ROOT / "data" / "generated" / "hitl_review_35.json"
VERIFY_OUTPUT = ROOT / "data" / "generated" / "hindi_urdu_language_verification.json"

# Roman lyric tokens more common in Urdu-leaning PS (Persian/Arabic register in Samgiita Roman).
URDU_ROMAN_MARKERS = (
    r"\bfariaad\b",
    r"\bhamdaard",
    r"\bhamdard",
    r"\bbanda maen\b",
    r"\bmuhabbat",
    r"\bishq",
    r"\bghazal",
    r"\btabiib",
    r"\bharam\b",
    r"\bdunia",
    r"\bduniya",
    r"\bkhuda",
    r"\bshab e\b",
    r"\bdua\b",
)

# Hindi-leaning kirtan / devotional Roman patterns in this catalogue.
HINDI_ROMAN_MARKERS = (
    r"\btum\b",
    r"\btumhi\b",
    r"\btum ho\b",
    r"\bmeri\b",
    r"\bmere\b",
    r"\btumhare\b",
    r"\btumhaara\b",
    r"\btumhaari\b",
    r"\bcahata\b",
    r"\bcahati\b",
    r"\bcahate\b",
    r"\braha\b",
    r"\brahe\b",
    r"\bhain\b",
    r"\bkrs",
    r"\bkrish",
    r"\bjagat",
    r"\bprabhu\b",
    r"\bphul",
    r"\bphu+l",
    r"\bshahad",
    r"\bjadu\b",
    r"\bnagari",
    r"\baye ho\b",
)


def _fold(text: str) -> str:
    decomposed = unicodedata.normalize("NFKD", text or "")
    out: list[str] = []
    for char in decomposed:
        if unicodedata.combining(char):
            continue
        if char.isalpha() or char.isdigit():
            out.append(char.casefold())
        elif char.isspace() or char in "-_/,'":
            out.append(" ")
    return " ".join("".join(out).split())


def _category_scores(category: str) -> tuple[float, float, list[str]]:
    """Score Hindi vs Urdu from official lyric-page category line."""
    reasons: list[str] = []
    raw = (category or "").strip()
    if not raw:
        return 0.0, 0.0, reasons

    lowered = raw.lower()
    hindi_score = 0.0
    urdu_score = 0.0

    # Explicit single-language tags.
    if re.search(r"\(\s*hindi\s*\)", lowered) and "urdu" not in lowered.replace("hindi", ""):
        hindi_score += 2.5
        reasons.append(f'category "{raw}" marks Hindi only (+2.5)')
    elif re.search(r"\bhindi\b", lowered) and not re.search(r"urdu", lowered):
        hindi_score += 2.5
        reasons.append(f'category "{raw}" is Hindi-only (+2.5)')
    elif re.search(r"\burdu\b", lowered) and not re.search(r"hindi", lowered):
        urdu_score += 2.5
        reasons.append(f'category "{raw}" is Urdu-only (+2.5)')

    # Dual labels — strongest matching pattern only (avoid double-counting).
    if re.search(r"urdu\s*/\s*hindi", lowered):
        urdu_score += 3.0
        reasons.append("category lists Urdu before Hindi (+3.0)")
    elif re.search(r"hindi\s*/\s*urdu", lowered):
        hindi_score += 3.0
        reasons.append("category lists Hindi before Urdu (+3.0)")

    # Residual: first occurrence when both words appear (e.g. "D URDU / HINDI").
    if hindi_score == 0.0 and urdu_score == 0.0:
        urdu_at = lowered.find("urdu")
        hindi_at = lowered.find("hindi")
        if urdu_at >= 0 and hindi_at >= 0:
            if urdu_at < hindi_at:
                urdu_score += 1.5
                reasons.append("category lists Urdu before Hindi (+1.5)")
            else:
                hindi_score += 1.5
                reasons.append("category lists Hindi before Urdu (+1.5)")
        elif urdu_at >= 0:
            urdu_score += 2.0
        elif hindi_at >= 0:
            hindi_score += 2.0

    return hindi_score, urdu_score, reasons


def _lyric_scores(song: dict[str, Any]) -> tuple[float, float, list[str]]:
    reasons: list[str] = []
    blob = _fold(
        " ".join(
            part
            for part in (
                song.get("title") or "",
                song.get("first_line") or "",
                (song.get("lyrics_original") or "")[:800],
            )
        )
    )
    if not blob:
        return 0.0, 0.0, reasons

    urdu_hits = sum(1 for pattern in URDU_ROMAN_MARKERS if re.search(pattern, blob))
    hindi_hits = sum(1 for pattern in HINDI_ROMAN_MARKERS if re.search(pattern, blob))
    urdu_score = min(2.0, urdu_hits * 0.35)
    hindi_score = min(2.0, hindi_hits * 0.35)
    if urdu_hits:
        reasons.append(f"Roman lyric Urdu-register markers ({urdu_hits}) (+{urdu_score:.2f})")
    if hindi_hits:
        reasons.append(f"Roman lyric Hindi-register markers ({hindi_hits}) (+{hindi_score:.2f})")
    return hindi_score, urdu_score, reasons


def _index_scores(number: int, assignment: dict[str, Any] | None) -> tuple[float, float, list[str]]:
    reasons: list[str] = []
    if not assignment:
        return 0.0, 0.0, reasons
    languages = [str(value).casefold() for value in assignment.get("languages") or []]
    urls = [str(url).casefold() for url in assignment.get("source_urls") or []]
    hindi_score = 0.0
    urdu_score = 0.0
    on_hindi = "hindi" in languages or any("hindi.html" in url for url in urls)
    on_urdu = "urdu" in languages or any("urdu.html" in url for url in urls)
    if on_hindi and not on_urdu:
        hindi_score += 3.0
        reasons.append("official index: Hindi page only (+3.0)")
    elif on_urdu and not on_hindi:
        urdu_score += 3.0
        reasons.append("official index: Urdu page only (+3.0)")
    elif on_hindi and on_urdu:
        reasons.append("official index: listed on both Hindi and Urdu pages")
    return hindi_score, urdu_score, reasons


def _on_both_hindi_urdu_index(assignment: dict[str, Any] | None) -> bool:
    if not assignment:
        return False
    languages = [str(value).casefold() for value in assignment.get("languages") or []]
    urls = [str(url).casefold() for url in assignment.get("source_urls") or []]
    on_hindi = "hindi" in languages or any("hindi.html" in url for url in urls)
    on_urdu = "urdu" in languages or any("urdu.html" in url for url in urls)
    return on_hindi and on_urdu


def _hitl_primary(
    number: int,
    hitl_by_song: dict[int, str],
    assignment: dict[str, Any] | None,
) -> tuple[float, float, list[str]]:
    if not _on_both_hindi_urdu_index(assignment):
        return 0.0, 0.0, []
    agent = hitl_by_song.get(number)
    if not agent:
        return 0.0, 0.0, []
    if agent == "hindi":
        return 2.5, 0.0, ["transliteration review primary_agent=hindi (+2.5)"]
    if agent == "urdu":
        return 0.0, 2.5, ["transliteration review primary_agent=urdu (+2.5)"]
    return 0.0, 0.0, []


def _load_hitl_primary() -> dict[int, str]:
    if not HITL_PATH.exists():
        return {}
    payload = json.loads(HITL_PATH.read_text(encoding="utf-8"))
    if isinstance(payload, list):
        rows = payload
    else:
        rows = (
            payload.get("song_summaries")
            or payload.get("rows")
            or []
        )
    by_number: dict[int, str] = {}
    for row in rows:
        if not isinstance(row, dict):
            continue
        try:
            number = int(row.get("song_number") or 0)
        except (TypeError, ValueError):
            continue
        agent = str(row.get("primary_agent") or "").strip().lower()
        if number and agent in {"hindi", "urdu"} and number not in by_number:
            by_number[number] = agent
    return by_number


@dataclass(frozen=True)
class HindiUrduVerification:
    song_number: int
    title: str
    primary: PrimaryLanguage
    confidence: Confidence
    hindi_score: float
    urdu_score: float
    reasons: tuple[str, ...]


def verify_song(
    song: dict[str, Any],
    assignment: dict[str, Any] | None,
    *,
    hitl_by_song: dict[int, str] | None = None,
) -> HindiUrduVerification:
    number = int(song["number"])
    category = str((song.get("metadata_json") or {}).get("category") or "")

    hindi = 0.0
    urdu = 0.0
    reasons: list[str] = []

    for part_h, part_u, part_reasons in (
        _index_scores(number, assignment),
        _category_scores(category),
        _lyric_scores(song),
    ):
        hindi += part_h
        urdu += part_u
        reasons.extend(part_reasons)

    # HITL only breaks ties on dual-index songs (transliteration pack, not collection law).
    if abs(hindi - urdu) < 1.5:
        part_h, part_u, part_reasons = _hitl_primary(
            number, hitl_by_song or {}, assignment
        )
        hindi += part_h
        urdu += part_u
        reasons.extend(part_reasons)

    if hindi > urdu:
        primary: PrimaryLanguage = "hindi"
        margin = hindi - urdu
    elif urdu > hindi:
        primary = "urdu"
        margin = urdu - hindi
    else:
        # Stable tie-break: devotional K-class → Hindi, D-class ghazal tone → Urdu.
        if category.strip().upper().startswith("D"):
            primary = "urdu"
            reasons.append("tie-break: category class D → Urdu")
        else:
            primary = "hindi"
            reasons.append("tie-break: category class K / other → Hindi")
        margin = 0.0

    if margin >= 2.0 or (margin >= 1.0 and hindi + urdu >= 3.0):
        confidence: Confidence = "high"
    elif margin >= 0.5:
        confidence = "medium"
    else:
        confidence = "low"

    title = str(song.get("title") or song.get("first_line") or f"Song {number}")
    return HindiUrduVerification(
        song_number=number,
        title=title,
        primary=primary,
        confidence=confidence,
        hindi_score=round(hindi, 2),
        urdu_score=round(urdu, 2),
        reasons=tuple(reasons),
    )


def hindi_urdu_candidate_numbers(
    songs: list[dict[str, Any]],
    assignments: list[dict[str, Any]],
) -> list[int]:
    candidates: set[int] = set()
    for row in assignments:
        languages = {str(value).casefold() for value in row.get("languages") or []}
        if "hindi" in languages or "urdu" in languages:
            candidates.add(int(row["song_number"]))
    for song in songs:
        category = str((song.get("metadata_json") or {}).get("category") or "").lower()
        if "hindi" in category or "urdu" in category:
            candidates.add(int(song["number"]))
    return sorted(candidates)


def verify_all_hindi_urdu(
    *,
    songs_path: Path = SONGS_PATH,
    assignments_path: Path = ASSIGNMENTS_PATH,
    apply_llm_merge: bool = False,
) -> list[HindiUrduVerification]:
    songs = json.loads(songs_path.read_text(encoding="utf-8"))
    assignments = json.loads(assignments_path.read_text(encoding="utf-8"))
    by_song = {int(row["number"]): row for row in songs}
    by_assignment = {int(row["song_number"]): row for row in assignments}
    hitl = _load_hitl_primary()

    numbers = hindi_urdu_candidate_numbers(songs, assignments)
    verified: list[HindiUrduVerification] = []
    for number in numbers:
        song = by_song.get(number)
        if not song:
            continue
        verified.append(verify_song(song, by_assignment.get(number), hitl_by_song=hitl))
    if apply_llm_merge:
        from app.services.hindi_urdu_llm import apply_llm_merges

        verified = apply_llm_merges(verified)
    return verified


def partition_collections_from_verification(
    verified: list[HindiUrduVerification],
) -> tuple[list[int], list[int]]:
    hindi: list[int] = []
    urdu: list[int] = []
    for row in verified:
        if row.primary == "hindi":
            hindi.append(row.song_number)
        else:
            urdu.append(row.song_number)
    hindi_set = set(hindi)
    urdu_set = set(urdu)
    overlap = hindi_set & urdu_set
    if overlap:
        raise ValueError(f"Hindi/Urdu overlap after verification: {sorted(overlap)}")
    return sorted(hindi), sorted(urdu)


def write_verification_report(
    verified: list[HindiUrduVerification],
    path: Path = VERIFY_OUTPUT,
) -> None:
    payload = {
        "version": 1,
        "method": "index + category + Roman lyric markers + optional HITL primary_agent",
        "songs": [asdict(row) for row in verified],
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")