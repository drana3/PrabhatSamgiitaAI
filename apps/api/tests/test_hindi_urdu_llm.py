"""LLM merge layer for Hindi/Urdu verification (no live API)."""

from __future__ import annotations

from app.services.hindi_urdu_language import HindiUrduVerification
from app.services.hindi_urdu_llm import (
    LlmHindiUrduRow,
    merge_rule_with_llm,
    parse_llm_json,
)


def test_parse_llm_json_accepts_fenced_payload() -> None:
    row = parse_llm_json(
        '```json\n{"lyric_language":"urdu","collection_primary":"urdu",'
        '"confidence":"high","reasoning":"Ghazal register.","lexical_cues":["malik"]}\n```',
        song_number=25,
        title="DUNIAVANLO",
    )
    assert row.collection_primary == "urdu"
    assert row.confidence == "high"


def test_merge_applies_llm_on_low_rule_confidence() -> None:
    rule = HindiUrduVerification(
        song_number=99,
        title="Test",
        primary="hindi",
        confidence="low",
        hindi_score=2.0,
        urdu_score=1.9,
        reasons=("tie",),
    )
    llm = LlmHindiUrduRow(
        song_number=99,
        title="Test",
        lyric_language="urdu",
        collection_primary="urdu",
        confidence="high",
        reasoning="Persian register dominates.",
        lexical_cues=("ishq",),
    )
    merged = merge_rule_with_llm(rule, llm)
    assert merged.primary == "urdu"
    assert any("LLM lyric review" in reason for reason in merged.reasons)


def test_merge_keeps_rule_when_llm_agrees_and_rule_high() -> None:
    rule = HindiUrduVerification(
        song_number=4070,
        title="TUM HO",
        primary="hindi",
        confidence="high",
        hindi_score=9.0,
        urdu_score=0.0,
        reasons=("index",),
    )
    llm = LlmHindiUrduRow(
        song_number=4070,
        title="TUM HO",
        lyric_language="hindi",
        collection_primary="hindi",
        confidence="high",
        reasoning="Devotional Hindi kirtan.",
        lexical_cues=("tum",),
    )
    assert merge_rule_with_llm(rule, llm) == rule


def test_merge_skips_low_confidence_llm() -> None:
    rule = HindiUrduVerification(
        song_number=1,
        title="X",
        primary="hindi",
        confidence="low",
        hindi_score=1.0,
        urdu_score=1.0,
        reasons=(),
    )
    llm = LlmHindiUrduRow(
        song_number=1,
        title="X",
        lyric_language="hindustani",
        collection_primary="urdu",
        confidence="low",
        reasoning="Unclear.",
        lexical_cues=(),
    )
    assert merge_rule_with_llm(rule, llm) == rule