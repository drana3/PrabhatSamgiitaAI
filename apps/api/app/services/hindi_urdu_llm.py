"""Optional LLM lyric review for Hindi vs Urdu collection assignment.

Offline batch only — not used on search hot paths. Output is merged into
rule-based verification when confidence is low or scores disagree.
"""

from __future__ import annotations

import json
import re
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Literal

from app.config import get_settings
from app.services.ai import TextProvider, select_provider
from app.services.hindi_urdu_language import (
    ASSIGNMENTS_PATH,
    SONGS_PATH,
    Confidence,
    HindiUrduVerification,
    PrimaryLanguage,
    hindi_urdu_candidate_numbers,
    verify_all_hindi_urdu,
    verify_song,
)
from app.services.transliteration.language_agents import RULESET_CONTEXT

ROOT = Path(__file__).resolve().parents[4]
LLM_OUTPUT = ROOT / "data" / "generated" / "hindi_urdu_llm_verification.json"

LyricLanguage = Literal[
    "hindi",
    "urdu",
    "hindustani",
    "bengali",
    "sanskrit",
    "english",
    "other",
]

_SYSTEM = (
    "You classify the language of Prabhat Samgiita lyrics from Roman text. "
    "Use only the provided lyrics and metadata. Do not invent facts."
)


@dataclass(frozen=True)
class LlmHindiUrduRow:
    song_number: int
    title: str
    lyric_language: LyricLanguage
    collection_primary: PrimaryLanguage
    confidence: Confidence
    reasoning: str
    lexical_cues: tuple[str, ...]

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


def _trim_lyrics(song: dict[str, Any], *, max_chars: int = 2400) -> str:
    parts = [
        str(song.get("title") or ""),
        str(song.get("first_line") or ""),
        str(song.get("lyrics_original") or ""),
    ]
    text = "\n".join(part for part in parts if part).strip()
    if len(text) <= max_chars:
        return text
    return text[:max_chars] + "\n…"


def build_language_prompt(
    song: dict[str, Any],
    *,
    assignment: dict[str, Any] | None,
    rule: HindiUrduVerification | None,
) -> str:
    number = int(song["number"])
    category = str((song.get("metadata_json") or {}).get("category") or "")
    index_note = "not on official Hindi/Urdu index pages"
    if assignment:
        languages = [str(value) for value in assignment.get("languages") or []]
        if languages:
            index_note = f"official index languages: {', '.join(languages)}"
    rule_note = ""
    if rule:
        rule_note = (
            f"Rule-based scorer: primary={rule.primary}, confidence={rule.confidence}, "
            f"hindi_score={rule.hindi_score}, urdu_score={rule.urdu_score}."
        )
    return (
        f"{RULESET_CONTEXT}\n\n"
        "Task: From the Roman lyrics below, decide lyric language and which single "
        "collection (hindi or urdu) this song belongs in for Explore. Many songs are "
        "Hindustani; still pick hindi or urdu as primary register for listing.\n\n"
        "Return only valid JSON (no markdown) with keys:\n"
        '- "lyric_language": one of hindi, urdu, hindustani, bengali, sanskrit, english, other\n'
        '- "collection_primary": hindi or urdu\n'
        '- "confidence": high, medium, or low\n'
        '- "reasoning": one short paragraph\n'
        '- "lexical_cues": array of up to 6 short strings citing Roman words or patterns\n\n'
        f"Song number: {number}\n"
        f"Category line: {category or '(none)'}\n"
        f"Index: {index_note}\n"
        f"{rule_note}\n\n"
        f"ROMAN LYRICS:\n{_trim_lyrics(song)}\n"
    )


def parse_llm_json(text: str, *, song_number: int, title: str) -> LlmHindiUrduRow:
    raw = text.strip()
    fence = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", raw, flags=re.DOTALL)
    if fence:
        raw = fence.group(1)
    start = raw.find("{")
    end = raw.rfind("}")
    if start < 0 or end <= start:
        raise ValueError(f"LLM response for PS {song_number} is not JSON")
    payload = json.loads(raw[start : end + 1])

    lyric_language = str(payload.get("lyric_language") or "").strip().lower()
    collection_primary = str(payload.get("collection_primary") or "").strip().lower()
    confidence = str(payload.get("confidence") or "").strip().lower()
    reasoning = str(payload.get("reasoning") or "").strip()
    cues_raw = payload.get("lexical_cues") or []
    lexical_cues = tuple(str(c).strip() for c in cues_raw if str(c).strip())[:6]

    allowed_lyric = {
        "hindi",
        "urdu",
        "hindustani",
        "bengali",
        "sanskrit",
        "english",
        "other",
    }
    if lyric_language not in allowed_lyric:
        lyric_language = "other"
    if collection_primary not in {"hindi", "urdu"}:
        raise ValueError(f"Invalid collection_primary for PS {song_number}: {collection_primary!r}")
    if confidence not in {"high", "medium", "low"}:
        confidence = "low"

    return LlmHindiUrduRow(
        song_number=song_number,
        title=title,
        lyric_language=lyric_language,  # type: ignore[arg-type]
        collection_primary=collection_primary,  # type: ignore[arg-type]
        confidence=confidence,  # type: ignore[arg-type]
        reasoning=reasoning or "No reasoning provided.",
        lexical_cues=lexical_cues,
    )


async def classify_song_with_llm(
    song: dict[str, Any],
    assignment: dict[str, Any] | None,
    rule: HindiUrduVerification | None,
    provider: TextProvider,
) -> LlmHindiUrduRow:
    number = int(song["number"])
    title = str(song.get("title") or song.get("first_line") or f"Song {number}")
    prompt = build_language_prompt(song, assignment=assignment, rule=rule)
    response = await provider.complete(prompt, system=_SYSTEM)
    return parse_llm_json(response, song_number=number, title=title)


def load_llm_verification(path: Path = LLM_OUTPUT) -> dict[int, LlmHindiUrduRow]:
    if not path.exists():
        return {}
    payload = json.loads(path.read_text(encoding="utf-8"))
    rows = payload.get("songs") if isinstance(payload, dict) else payload
    if not isinstance(rows, list):
        return {}
    by_number: dict[int, LlmHindiUrduRow] = {}
    for row in rows:
        if not isinstance(row, dict):
            continue
        number = int(row["song_number"])
        by_number[number] = LlmHindiUrduRow(
            song_number=number,
            title=str(row.get("title") or ""),
            lyric_language=row.get("lyric_language", "other"),
            collection_primary=row.get("collection_primary", "hindi"),
            confidence=row.get("confidence", "low"),
            reasoning=str(row.get("reasoning") or ""),
            lexical_cues=tuple(str(v) for v in (row.get("lexical_cues") or [])),
        )
    return by_number


def merge_rule_with_llm(
    rule: HindiUrduVerification,
    llm: LlmHindiUrduRow | None,
) -> HindiUrduVerification:
    if llm is None:
        return rule
    margin = abs(rule.hindi_score - rule.urdu_score)
    disagree = rule.primary != llm.collection_primary
    if llm.confidence == "low":
        return rule
    should_apply = rule.confidence == "low" or (disagree and margin < 1.5)
    if not should_apply:
        return rule
    note = (
        f"LLM lyric review → {llm.collection_primary} ({llm.confidence}): "
        f"{llm.reasoning[:240]}"
    )
    reasons = tuple(rule.reasons) + (note,)
    if llm.collection_primary == "hindi":
        hindi_score = max(rule.hindi_score, rule.urdu_score + 0.1)
        urdu_score = rule.urdu_score
    else:
        urdu_score = max(rule.urdu_score, rule.hindi_score + 0.1)
        hindi_score = rule.hindi_score
    confidence: Confidence = "medium" if llm.confidence == "high" else "low"
    return HindiUrduVerification(
        song_number=rule.song_number,
        title=rule.title,
        primary=llm.collection_primary,
        confidence=confidence,
        hindi_score=round(hindi_score, 2),
        urdu_score=round(urdu_score, 2),
        reasons=reasons,
    )


def apply_llm_merges(
    verified: list[HindiUrduVerification],
    llm_by_number: dict[int, LlmHindiUrduRow] | None = None,
) -> list[HindiUrduVerification]:
    llm_by_number = llm_by_number if llm_by_number is not None else load_llm_verification()
    if not llm_by_number:
        return verified
    return [merge_rule_with_llm(row, llm_by_number.get(row.song_number)) for row in verified]


def write_llm_report(
    rows: list[LlmHindiUrduRow],
    *,
    path: Path = LLM_OUTPUT,
    provider: str,
    prompt_version: str = "1",
) -> None:
    payload = {
        "version": 1,
        "prompt_version": prompt_version,
        "provider": provider,
        "method": "Roman lyrics + metadata; collection_primary for Explore partition",
        "songs": [row.as_dict() for row in rows],
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def _provider_label(provider: object) -> str:
    return type(provider).__name__


async def run_llm_verification_batch(
    *,
    numbers: list[int] | None = None,
    extra_numbers: list[int] | None = None,
    disagreements_only: bool = False,
    provider: TextProvider | None = None,
) -> list[LlmHindiUrduRow]:
    songs = json.loads(SONGS_PATH.read_text(encoding="utf-8"))
    assignments = json.loads(ASSIGNMENTS_PATH.read_text(encoding="utf-8"))
    by_song = {int(row["number"]): row for row in songs}
    by_assignment = {int(row["song_number"]): row for row in assignments}
    from app.services.hindi_urdu_language import _load_hitl_primary

    hitl = _load_hitl_primary()

    if numbers is None:
        numbers = hindi_urdu_candidate_numbers(songs, assignments)
    target = set(numbers)
    for n in extra_numbers or []:
        target.add(int(n))

    if disagreements_only:
        selected: list[int] = []
        for number in sorted(target):
            song = by_song.get(number)
            if not song:
                continue
            rule = verify_song(song, by_assignment.get(number), hitl_by_song=hitl)
            margin = abs(rule.hindi_score - rule.urdu_score)
            if rule.confidence == "low" or margin < 1.5:
                selected.append(number)
        target = set(selected)

    active = provider or select_provider(get_settings())
    results: list[LlmHindiUrduRow] = []
    for number in sorted(target):
        song = by_song.get(number)
        if not song:
            continue
        rule = verify_song(song, by_assignment.get(number), hitl_by_song=hitl)
        row = await classify_song_with_llm(
            song, by_assignment.get(number), rule, active
        )
        results.append(row)
    write_llm_report(results, provider=_provider_label(active))
    return results


def verify_all_hindi_urdu_with_optional_llm(
    *,
    apply_llm_merge: bool = True,
) -> list[HindiUrduVerification]:
    verified = verify_all_hindi_urdu()
    if apply_llm_merge:
        verified = apply_llm_merges(verified)
    return verified